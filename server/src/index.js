const fs = require('fs');
const path = require('path');
const serverEnvPath = path.resolve(__dirname, '..', '.env');
const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');
require('dotenv').config({ path: fs.existsSync(serverEnvPath) ? serverEnvPath : rootEnvPath });

const http = require('http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');

const { getInfluxClient } = require('./db/influx');
const { writePlaybackEvent } = require('./db/influx');
const { checkVideoCategory, getYouTubeVideoDetails, getRichMetadataAndPersist } = require('./services/youtubeService');
const { cacheGet } = require('./db/redis');
const { authMiddleware } = require('./middleware/authMiddleware');
const { registerTrackingHandlers } = require('./sockets/trackingHandler');

const app = express();
const httpServer = http.createServer(app);
const port = process.env.PORT || 5000;

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
registerTrackingHandlers(io);

// ─── Express Middleware ────────────────────────────────────────────────────────
app.use(bodyParser.json());
app.use(cors({ origin: '*' }));

// ─── Public Routes ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    connectedSockets: io.engine.clientsCount,
  });
});

// ─── Protected Routes ──────────────────────────────────────────────────────────

/**
 * POST /track
 * REST fallback - nhận playback event → ghi vào InfluxDB.
 * (WebSocket là cơ chế chính, đây là fallback cho client không dùng socket)
 */
app.post('/track', authMiddleware, async (req, res) => {
  const { videoId, event, ms_played, timestamp, playback_rate, session_id, timezone, click_source, watch_duration_ratio, replay_count } = req.body;

  if (!videoId || !event || ms_played == null) {
    return res.status(400).json({ error: 'Bad Request', message: 'Required: videoId, event, ms_played' });
  }

  const validEvents = ['play', 'pause', 'skip', 'skip_early', 'like', 'dislike', 'add_playlist', 'replay', 'track_completed'];
  if (!validEvents.includes(event)) {
    return res.status(400).json({ error: 'Bad Request', message: `event must be one of: ${validEvents.join(', ')}` });
  }

  try {
    const isMusic = await checkVideoCategory(videoId);
    if (!isMusic) {
      return res.status(200).json({ message: 'Skipped – not a music video', videoId });
    }

    // 1. Phân tích Context Thời gian (Time of Day & Day of Week)
    let timeOfDay = 'unknown';
    let dayOfWeek = 'unknown';
    if (timezone) {
      try {
        const date = new Date(timestamp || Date.now());
        const hour = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(date), 10);
        if (hour >= 5 && hour < 12) timeOfDay = 'morning';
        else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
        else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
        else timeOfDay = 'night';
        
        dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone }).format(date);
      } catch (e) {
        // Fallback im lặng
      }
    }

    // 2. Ghi Dòng sự kiện (Event Stream) vào InfluxDB
    await writePlaybackEvent({
      userId: req.userId,
      videoId,
      eventType: event,
      msPlayed: ms_played,
      playbackRate: playback_rate || 1,
      timestamp: timestamp || Date.now(),
      sessionId: session_id,
      clickSource: click_source,
      timeOfDay,
      dayOfWeek,
      watchDurationRatio: watch_duration_ratio,
      replayCount: replay_count
    });

    // 3. Fire & Forget: Kéo Tĩnh (Metadata) về SQL để Huấn luyện AI (Tránh lag bằng cách chạy ngầm)
    if (event === 'play') {
      getRichMetadataAndPersist(videoId).catch(() => {});
    }

    // 4. Bắn Web Socket về giao diện Front-end
    io.to(`user:${req.userId}`).emit('new_track_event', { videoId, eventType: event, timestamp: Date.now() });

    return res.status(201).json({ message: 'Deep Tracking event recorded', data: { userId: req.userId, videoId, event } });
  } catch (error) {
    console.error('[/track] Error:', error.message);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * GET /history
 * 50 playback events gần nhất của user, dùng InfluxDB Flight SQL.
 */
app.get('/history', authMiddleware, async (req, res) => {
  try {
    const influx = getInfluxClient();
    const database = process.env.INFLUXDB_DATABASE;
    const userId = req.userId;

    const query = `
      SELECT video_id, event_type, ms_played, time, time_of_day, click_source, watch_duration_ratio, replay_count
      FROM playback_events
      WHERE user_id = '${userId}'
        AND event_type != 'disconnect'
      ORDER BY time DESC
      LIMIT 100
    `;

    const rows = [];
    const result = await influx.query(query, database);
    for await (const row of result) {
      rows.push({
        videoId: row.video_id,
        eventType: row.event_type,
        msPlayed: Number(row.ms_played),
        timestamp: row.time,
        timeOfDay: row.time_of_day || 'unknown',
        clickSource: row.click_source || 'unknown',
        watchRatio: Number(row.watch_duration_ratio || 0),
        replayCount: Number(row.replay_count || 0)
      });
    }

    const uniqueIds = [...new Set(rows.map(r => r.videoId))];
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: metadata } = await supabase.from('videos').select('video_id, title, artist, category_name').in('video_id', uniqueIds);
    
    const metaMap = {};
    if (metadata) {
      metadata.forEach(m => metaMap[m.video_id] = m);
    }

    const populatedRows = rows.map(r => {
      const meta = metaMap[r.videoId] || {};
      return {
        ...r,
        title: meta.title || 'Unknown Video',
        artist: meta.artist || 'Unknown Artist',
        category: meta.category_name || 'Music',
        thumbnail: `https://img.youtube.com/vi/${r.videoId}/hqdefault.jpg`
      };
    });

    return res.status(200).json({ data: populatedRows, count: populatedRows.length });
  } catch (error) {
    console.error('[/history] Error:', error.message);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * GET /stats
 * Thống kê nghe nhạc: tổng ms/ngày (7 ngày), skip rate, top 5 videos.
 */
app.get('/stats', authMiddleware, async (req, res) => {
  try {
    const influx = getInfluxClient();
    const database = process.env.INFLUXDB_DATABASE;
    const userId = req.userId;

    // ── Query 1: Tổng ms nghe mỗi ngày trong 7 ngày gần nhất ─────────────
    const dailyQuery = `
      SELECT DATE_TRUNC('day', time) as day, SUM(ms_played) as total_ms
      FROM playback_events
      WHERE user_id = '${userId}'
        AND ms_played > 0
        AND time > now() - interval '7 days'
      GROUP BY day
      ORDER BY day ASC
    `;

    // ── Query 2: Skip rate & Skip Early ──────────────────────────────────
    const skipRateQuery = `
      SELECT
        SUM(CASE WHEN event_type = 'skip' THEN 1 ELSE 0 END) AS skip_count,
        SUM(CASE WHEN event_type = 'skip_early' THEN 1 ELSE 0 END) AS skip_early_count,
        SUM(CASE WHEN event_type IN ('play', 'replay') THEN 1 ELSE 0 END) AS total_count
      FROM playback_events
      WHERE user_id = '${userId}'
    `;

    // ── Query 3: Top 5 videos (Weekly & Monthly) ─────────────────────────────────────────────
    const topVideosWeekQuery = `
      SELECT video_id, 
             SUM(ms_played) as total_ms, 
             SUM(CASE WHEN event_type = 'track_completed' THEN 1 ELSE 0 END) as play_count
      FROM playback_events
      WHERE user_id = '${userId}'
        AND (ms_played > 0 OR event_type = 'track_completed')
        AND time > now() - interval '7 days'
      GROUP BY video_id
      ORDER BY play_count DESC, total_ms DESC
      LIMIT 5
    `;

    const topVideosMonthQuery = `
      SELECT video_id, 
             SUM(ms_played) as total_ms, 
             SUM(CASE WHEN event_type = 'track_completed' THEN 1 ELSE 0 END) as play_count
      FROM playback_events
      WHERE user_id = '${userId}'
        AND (ms_played > 0 OR event_type = 'track_completed')
        AND time > now() - interval '30 days'
      GROUP BY video_id
      ORDER BY play_count DESC, total_ms DESC
      LIMIT 5
    `;

    // ── Query 4: Context Distribution (time_of_day) ──────────────────────
    const contextQuery = `
      SELECT time_of_day, COUNT(*) as count
      FROM playback_events
      WHERE user_id = '${userId}'
        AND event_type = 'play'
        AND time_of_day != 'unknown'
      GROUP BY time_of_day
    `;

    // ── Query 5: Total Historical Playtime ───────────────────────────────
    const totalPlaytimeQuery = `
      SELECT SUM(ms_played) as total_ms
      FROM playback_events
      WHERE user_id = '${userId}'
        AND ms_played > 0
    `;

    // Chạy các queries song song
    const [dailyResult, skipResult, topWeekResult, topMonthResult, contextResult, totalPlaytimeResult] = await Promise.all([
      influx.query(dailyQuery, database),
      influx.query(skipRateQuery, database),
      influx.query(topVideosWeekQuery, database),
      influx.query(topVideosMonthQuery, database),
      influx.query(contextQuery, database),
      influx.query(totalPlaytimeQuery, database),
    ]);

    const dailyMs = [];
    for await (const row of dailyResult) {
      dailyMs.push({ day: row.day, total_ms: Number(row.total_ms) });
    }

    let skipRate = 0;
    let skipEarlyRate = 0;
    for await (const row of skipResult) {
      const total = Number(row.total_count);
      const skips = Number(row.skip_count);
      const skipEarly = Number(row.skip_early_count);
      skipRate = total > 0 ? Math.round((skips / total) * 100) / 100 : 0;
      skipEarlyRate = total > 0 ? Math.round((skipEarly / total) * 100) / 100 : 0;
    }

    const parseTopResult = async (result) => {
      const top = [];
      for await (const row of result) {
        top.push({ videoId: row.video_id, totalMs: Number(row.total_ms), playCount: Number(row.play_count || 0) });
      }
      return top;
    };

    const topVideosWeek = await parseTopResult(topWeekResult);
    const topVideosMonth = await parseTopResult(topMonthResult);

    // Hydrate Top Videos
    const topIds = [...new Set([...topVideosWeek.map(v => v.videoId), ...topVideosMonth.map(v => v.videoId)])];
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: topMeta } = await supabase.from('videos').select('video_id, title, artist').in('video_id', topIds);
    const topMetaMap = {};
    if (topMeta) topMeta.forEach(m => topMetaMap[m.video_id] = m);

    const hydrateList = (list) => list.map(v => ({
      ...v,
      title: topMetaMap[v.videoId]?.title || 'Unknown Title',
      artist: topMetaMap[v.videoId]?.artist || 'Unknown Artist',
      thumbnail: `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`
    }));

    const populatedTopVideos = {
      week: hydrateList(topVideosWeek),
      month: hydrateList(topVideosMonth)
    };

    const contextDist = [];
    for await (const row of contextResult) {
      contextDist.push({ timeOfDay: row.time_of_day, count: Number(row.count) });
    }

    let totalHistoryMs = 0;
    for await (const row of totalPlaytimeResult) {
      totalHistoryMs = Number(row.total_ms) || 0;
    }

    return res.status(200).json({
      data: {
        daily_ms: dailyMs,
        skip_rate: skipRate,
        skip_early_rate: skipEarlyRate,
        top_videos: populatedTopVideos,
        context_distribution: contextDist,
        total_history_ms: totalHistoryMs
      },
    });
  } catch (error) {
    console.error('[/stats] Error:', error.message);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * GET /history/daily
 * Lấy lịch sử nghe nhạc trong ngày (tổng hợp ms_played và play_count).
 */
app.get('/history/daily', authMiddleware, async (req, res) => {
  try {
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: 'Missing date parameter' });

    const influx = getInfluxClient();
    const database = process.env.INFLUXDB_DATABASE;
    const userId = req.userId;

    const query = `
      SELECT video_id, 
             SUM(ms_played) as total_ms,
             SUM(CASE WHEN event_type = 'track_completed' THEN 1 ELSE 0 END) as play_count
      FROM playback_events
      WHERE user_id = '${userId}'
        AND (ms_played > 0 OR event_type = 'track_completed')
        AND DATE_TRUNC('day', time) = '${date}T00:00:00Z'
      GROUP BY video_id
      ORDER BY play_count DESC, total_ms DESC
    `;

    const rows = [];
    const result = await influx.query(query, database);
    for await (const row of result) {
      rows.push({
        videoId: row.video_id,
        totalMs: Number(row.total_ms),
        playCount: Number(row.play_count || 0)
      });
    }

    const uniqueIds = [...new Set(rows.map(r => r.videoId))];
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: metadata } = await supabase.from('videos').select('video_id, title, artist, category_name').in('video_id', uniqueIds);
    
    const metaMap = {};
    if (metadata) {
      metadata.forEach(m => metaMap[m.video_id] = m);
    }

    const populatedRows = rows.map(r => {
      const meta = metaMap[r.videoId] || {};
      return {
        ...r,
        title: meta.title || 'Unknown Video',
        artist: meta.artist || 'Unknown Artist',
        category: meta.category_name || 'Music',
        thumbnail: `https://img.youtube.com/vi/${r.videoId}/hqdefault.jpg`
      };
    });

    return res.status(200).json({ data: populatedRows, count: populatedRows.length });
  } catch (error) {
    console.error('[/history/daily] Error:', error.message);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * GET /recommend
 * Gợi ý video dựa trên top video user nghe nhiều nhất.
 * Cache Redis 1h per user.
 */
app.get('/recommend', authMiddleware, async (req, res) => {
  try {
    const influx = getInfluxClient();
    const database = process.env.INFLUXDB_DATABASE;
    const userId = req.userId;

    const recommendations = await cacheGet(
      `recommend_${userId}`,
      async () => {
        // Lấy top 3 video user nghe nhiều nhất
        const topQuery = `
          SELECT video_id, SUM(ms_played) as total_ms
          FROM playback_events
          WHERE user_id = '${userId}' AND ms_played > 0
          GROUP BY video_id
          ORDER BY total_ms DESC
          LIMIT 3
        `;

        const topVideos = [];
        const result = await influx.query(topQuery, database);
        for await (const row of result) {
          topVideos.push(row.video_id);
        }

        if (topVideos.length === 0) return [];

        // Gọi YouTube Data API search related
        const axios = require('axios');
        const relatedVideos = [];

        for (const videoId of topVideos) {
          try {
            const resp = await axios.get('https://www.googleapis.com/youtube/v3/search', {
              params: {
                part: 'snippet',
                relatedToVideoId: videoId,
                type: 'video',
                videoCategoryId: '10', // Music only
                maxResults: 3,
                key: process.env.YOUTUBE_API_KEY,
              },
            });

            (resp.data.items || []).forEach((item) => {
              relatedVideos.push({
                videoId: item.id.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails?.medium?.url,
              });
            });
          } catch (ytErr) {
            console.warn(`[/recommend] YouTube search failed for ${videoId}: ${ytErr.message}`);
          }
        }

        // Loại trùng lặp theo videoId
        const seen = new Set();
        return relatedVideos.filter((v) => {
          if (seen.has(v.videoId)) return false;
          seen.add(v.videoId);
          return true;
        });
      },
      3600 // TTL 1 giờ
    );

    return res.status(200).json({ data: recommendations, count: recommendations.length });
  } catch (error) {
    console.error('[/recommend] Error:', error.message);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// ─── Start Server ──────────────────────────────────────────────────────────────
httpServer.listen(port, () => {
  console.log(`[Server] Running on http://localhost:${port}`);
  console.log(`[Server] WebSocket ready (Socket.IO)`);
  console.log(`[Server] Stack: Express + Socket.IO + InfluxDB v3 Core + Supabase Auth + Redis`);
});