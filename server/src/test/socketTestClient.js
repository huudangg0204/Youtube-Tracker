/**
 * socketTestClient.js
 *
 * Script test độc lập để kiểm thử WebSocket server.
 * Chạy: node server/src/test/socketTestClient.js
 *
 * Yêu cầu:
 *   npm install socket.io-client
 *   Điền SUPABASE_JWT vào biến bên dưới (lấy từ Supabase Auth Dashboard)
 */

const { io } = require('socket.io-client');

// ─── Cấu hình ─────────────────────────────────────────────────────────────────
const SERVER_URL = 'http://localhost:5000';

// Điền JWT thật lấy từ Supabase (Authentication → Users → Access Token)
const VALID_JWT = process.env.TEST_JWT || 'PASTE_YOUR_SUPABASE_JWT_HERE';

// Video ID thật để test (nên là video nhạc – category 10)
const TEST_VIDEO_ID = 'dQw4w9WgXcQ'; // Rick Astley – Never Gonna Give You Up

// ─── Test 1: Kết nối KHÔNG có JWT → phải bị reject ────────────────────────────
console.log('\n[TEST 1] Kết nối không có JWT – expect disconnect với error Unauthorized...');
const noAuthSocket = io(SERVER_URL, { auth: {} });

noAuthSocket.on('connect_error', (err) => {
  console.log(`  ✅ connect_error nhận được: "${err.message}"`);
  noAuthSocket.disconnect();
  runTest2();
});

noAuthSocket.on('connect', () => {
  console.log('  ❌ Không nên kết nối được khi không có JWT!');
  noAuthSocket.disconnect();
  runTest2();
});

// ─── Test 2: Kết nối có JWT hợp lệ ───────────────────────────────────────────
function runTest2() {
  console.log('\n[TEST 2] Kết nối với JWT hợp lệ – expect connected event...');

  const socket = io(SERVER_URL, {
    auth: { token: VALID_JWT },
    reconnection: false,
  });

  let heartbeatCount = 0;
  let heartbeatInterval = null;

  socket.on('connect', () => {
    console.log(`  ✅ Socket connected: ${socket.id}`);
  });

  socket.on('connected', (data) => {
    console.log(`  ✅ Server confirmed: userId=${data.userId} socketId=${data.socketId}`);
    startHeartbeats();
  });

  socket.on('new_track_event', (event) => {
    console.log(`  📡 new_track_event received:`, JSON.stringify(event));
  });

  socket.on('error', (err) => {
    console.error(`  ⚠️ Socket error:`, err);
  });

  socket.on('connect_error', (err) => {
    console.log(`  ❌ connect_error: ${err.message}`);
    console.log('     → Pastikan VALID_JWT sudah diisi dengan benar!');
  });

  socket.on('disconnect', (reason) => {
    console.log(`  ℹ️  Socket disconnected: ${reason}`);
  });

  // ── Heartbeat loop ────────────────────────────────────────────────────────
  function startHeartbeats() {
    console.log('\n[TEST 3] Gửi tracking_heartbeat mỗi 5s trong 30s...');

    heartbeatInterval = setInterval(() => {
      heartbeatCount++;
      const payload = {
        video_id: TEST_VIDEO_ID,
        current_time: heartbeatCount * 5,
        playing: true,
        rate: 1,
      };
      socket.emit('tracking_heartbeat', payload);
      console.log(`  → Heartbeat #${heartbeatCount}: current_time=${payload.current_time}s`);

      if (heartbeatCount >= 6) {
        clearInterval(heartbeatInterval);
        testDisconnect();
      }
    }, 5000);
  }

  // ── Test disconnect ───────────────────────────────────────────────────────
  function testDisconnect() {
    console.log('\n[TEST 4] Ngắt kết nối – server phải ghi disconnect point...');
    socket.disconnect();
    setTimeout(() => {
      console.log('\n✅ Tất cả tests hoàn tất!');
      console.log('   → Kiểm tra InfluxDB để xác nhận có data từ heartbeats');
      process.exit(0);
    }, 2000);
  }
}
