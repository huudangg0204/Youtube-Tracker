const { createClient } = require('@supabase/supabase-js');
const { writePlaybackEvent } = require('../db/influx');
const { checkVideoCategory } = require('../services/youtubeService');

// ─── Supabase client để verify JWT trên socket ──────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─── Throttle map: socketId → lastProcessedAt (ms) ──────────────────────────
// Chặn spam: tối đa 1 heartbeat/giây mỗi socket
const throttleMap = new Map();
const THROTTLE_MS = 1000;

/**
 * Xác thực JWT Supabase từ handshake.auth.token.
 * @returns {string|null} userId nếu hợp lệ, null nếu không
 */
async function verifySocketJwt(token) {
  if (!token) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

/**
 * Đăng ký toàn bộ socket event handlers lên io instance.
 * @param {import('socket.io').Server} io
 */
function registerTrackingHandlers(io) {
  // ── Middleware: Auth JWT trước khi accept connection ──────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const userId = await verifySocketJwt(token);

    if (!userId) {
      return next(new Error('Unauthorized: invalid or missing JWT'));
    }

    socket.userId = userId;
    next();
  });

  // ── Connection ─────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Join phòng riêng theo userId – Dashboard sẽ listen phòng này
    socket.join(`user:${userId}`);
    console.log(`[Socket] Connected  id=${socket.id} user=${userId}`);

    // Thông báo client đã kết nối thành công
    socket.emit('connected', { userId, socketId: socket.id });

    // ── tracking_heartbeat ─────────────────────────────────────────────────
    socket.on('tracking_heartbeat', async (payload) => {
      // 1. Throttle: bỏ qua nếu < 1s kể từ lần cuối
      const now = Date.now();
      const lastTime = throttleMap.get(socket.id) || 0;
      if (now - lastTime < THROTTLE_MS) return;
      throttleMap.set(socket.id, now);

      // 2. Validate payload
      const { video_id, current_time, playing, rate } = payload || {};
      if (!video_id || current_time == null) {
        socket.emit('error', { message: 'tracking_heartbeat: video_id và current_time là bắt buộc' });
        return;
      }

      try {
        // 3. Kiểm tra category Music (có Redis cache từ Task 1)
        const isMusic = await checkVideoCategory(video_id);
        if (!isMusic) return; // Bỏ qua video không phải nhạc

        // 4. Xác định event_type từ trạng thái playing
        const eventType = playing ? 'play' : 'pause';

        // 5. Ghi vào InfluxDB v3 Core
        await writePlaybackEvent({
          userId,
          videoId: video_id,
          eventType,
          msPlayed: THROTTLE_MS,        // mỗi heartbeat = ~1s đã nghe
          playbackRate: rate || 1,
          timestamp: now,
        });

        // 6. Broadcast tới room Dashboard của user (realtime update)
        io.to(`user:${userId}`).emit('new_track_event', {
          videoId: video_id,
          eventType,
          currentTime: current_time,
          playbackRate: rate || 1,
          timestamp: now,
        });

        console.log(`[Socket] Heartbeat user=${userId} video=${video_id} playing=${playing}`);
      } catch (err) {
        console.error(`[Socket] Error processing heartbeat: ${err.message}`);
        socket.emit('error', { message: 'Server error processing heartbeat' });
      }
    });

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      throttleMap.delete(socket.id);
      console.log(`[Socket] Disconnected id=${socket.id} user=${userId} reason=${reason}`);

      try {
        // Ghi disconnect point để biết khi nào user thoát
        await writePlaybackEvent({
          userId,
          videoId: 'session_end',
          eventType: 'disconnect',
          msPlayed: 0,
          playbackRate: 1,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error(`[Socket] Error writing disconnect point: ${err.message}`);
      }
    });
  });
}

module.exports = { registerTrackingHandlers };
