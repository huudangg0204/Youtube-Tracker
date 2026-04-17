const { getInfluxClient } = require('../db/influx');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ─── Prompt Template ───────────────────────────────────────────────────────────
const PROMPT_TEMPLATE = `Bạn là một Music Curator cá nhân với giọng văn vui vẻ, dí dỏm và thân thiện.
Nhiệm vụ của bạn là viết một bản tóm tắt "Weekly Wrapped" thành một đoạn văn ngắn gọn (khoảng 150-200 từ) bằng tiếng Việt dựa trên dữ liệu JSON được cung cấp.

YÊU CẦU NỘI DUNG BẮT BUỘC:
1. Mở đầu bằng 1 câu summary ấn tượng, bất ngờ về tuần nghe nhạc.
2. Highlight top artist và bình luận vì sao họ nổi bật tuần này.
3. Bình luận về khung giờ nghe chủ đạo (đêm/sáng/chiều...) và nhận xét tính cách một cách hài hước.
4. Nếu có genre shift → bình luận sự thay đổi tâm trạng một cách hài hước (bỏ qua nếu dữ liệu là unknown/null).
5. Nếu có binge track (replay > 5 lần) → đùa vui về bài "nghiện" (bỏ qua nếu dữ liệu là unknown/null).
6. Nhận xét mood tổng thể dựa trên mood_distribution.
7. Kết bằng 1 câu khuyến khích hoặc gợi ý nhẹ nhàng cho tuần mới.

YÊU CẦU ĐỊNH DẠNG & GIỚI HẠN (PHẢI TUÂN THỦ NGHIÊM NGẶT):
- CHỈ TRẢ VỀ DUY NHẤT ĐOẠN VĂN KẾT QUẢ. Tuyệt đối KHÔNG in ra quá trình suy nghĩ, KHÔNG giải thích, KHÔNG đếm từ, KHÔNG lặp lại yêu cầu, KHÔNG có lời chào/tạm biệt ở ngoài đoạn văn.
- Dùng emoji phù hợp xuyên suốt đoạn văn.
- KHÔNG dùng bất kỳ định dạng markdown nào (KHÔNG gạch đầu dòng, KHÔNG in đậm, KHÔNG in nghiêng, KHÔNG heading). Chỉ dùng văn bản thuần túy (plain text) ghép nối thành 1 đoạn văn duy nhất.
- KHÔNG bịa thêm dữ liệu, chỉ bám sát JSON.

Dữ liệu tuần:
`;

// ─── Week Boundaries ───────────────────────────────────────────────────────────

/**
 * Tính Monday→Sunday của TUẦN TRƯỚC.
 */
function getWeekBoundaries() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...

  // Monday tuần này
  const thisMonday = new Date(now);
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  // Monday tuần trước
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);

  // Sunday tuần trước
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);
  lastSunday.setHours(23, 59, 59, 999);

  return {
    weekStart: lastMonday.toISOString().split('T')[0],
    weekEnd: lastSunday.toISOString().split('T')[0],
    // Timestamps cho InfluxDB
    weekStartISO: lastMonday.toISOString(),
    weekEndISO: new Date(lastSunday.getTime() + 1).toISOString(), // +1ms for exclusive end
  };
}

// ─── Analytics Engine ──────────────────────────────────────────────────────────

/**
 * Query InfluxDB + Supabase để tạo JSON thống kê tuần.
 */
async function generateWeeklySummaryJSON(userId, weekStart, weekEnd, weekStartISO, weekEndISO) {
  const influx = getInfluxClient();
  const database = process.env.INFLUXDB_DATABASE;

  // Q1: Tổng thời lượng nghe
  const totalMsQuery = `
    SELECT SUM(ms_played) as total_ms FROM playback_events 
    WHERE user_id = '${userId}' AND ms_played > 0 
    AND time >= '${weekStartISO}' AND time < '${weekEndISO}'
  `;

  // Q2: Tổng track completed
  const totalTracksQuery = `
    SELECT COUNT(*) as cnt FROM playback_events 
    WHERE user_id = '${userId}' AND event_type = 'track_completed'
    AND time >= '${weekStartISO}' AND time < '${weekEndISO}'
  `;

  // Q3: Top video_ids (theo play_count)
  const topVideosQuery = `
    SELECT video_id, COUNT(*) as play_count, SUM(ms_played) as total_ms
    FROM playback_events WHERE user_id = '${userId}'
    AND event_type = 'track_completed'
    AND time >= '${weekStartISO}' AND time < '${weekEndISO}'
    GROUP BY video_id ORDER BY play_count DESC LIMIT 5
  `;

  // Q4: Events theo giờ (peak hour)
  const hourlyQuery = `
    SELECT time FROM playback_events
    WHERE user_id = '${userId}' AND event_type = 'play'
    AND time >= '${weekStartISO}' AND time < '${weekEndISO}'
  `;

  // Q5: Binge track (replay nhiều nhất)
  const bingeQuery = `
    SELECT video_id, COUNT(*) as play_count
    FROM playback_events
    WHERE user_id = '${userId}' 
    AND event_type IN ('track_completed', 'replay')
    AND time >= '${weekStartISO}' AND time < '${weekEndISO}'
    GROUP BY video_id ORDER BY play_count DESC LIMIT 1
  `;

  // Q6: Skip rate + completion rate
  const rateQuery = `
    SELECT 
      SUM(CASE WHEN event_type = 'skip' THEN 1 ELSE 0 END) AS skip_count,
      SUM(CASE WHEN event_type = 'skip_early' THEN 1 ELSE 0 END) AS skip_early_count,
      SUM(CASE WHEN event_type = 'track_completed' THEN 1 ELSE 0 END) AS completed_count,
      SUM(CASE WHEN event_type IN ('play', 'replay') THEN 1 ELSE 0 END) AS total_plays
    FROM playback_events
    WHERE user_id = '${userId}'
    AND time >= '${weekStartISO}' AND time < '${weekEndISO}'
  `;

  // Q7: Tất cả video_ids tuần để lấy mood
  const weekVideosQuery = `
    SELECT DISTINCT video_id FROM playback_events
    WHERE user_id = '${userId}' AND event_type = 'track_completed'
    AND time >= '${weekStartISO}' AND time < '${weekEndISO}'
  `;

  // Chạy song song
  const [totalMsRes, totalTracksRes, topVideosRes, hourlyRes, bingeRes, rateRes, weekVideosRes] =
    await Promise.all([
      influx.query(totalMsQuery, database),
      influx.query(totalTracksQuery, database),
      influx.query(topVideosQuery, database),
      influx.query(hourlyQuery, database),
      influx.query(bingeQuery, database),
      influx.query(rateQuery, database),
      influx.query(weekVideosQuery, database),
    ]);

  // Parse results
  let totalMs = 0;
  for await (const row of totalMsRes) totalMs = Number(row.total_ms) || 0;

  let totalTracks = 0;
  for await (const row of totalTracksRes) totalTracks = Number(row.cnt) || 0;

  const topVideoRows = [];
  for await (const row of topVideosRes) {
    topVideoRows.push({ videoId: row.video_id, playCount: Number(row.play_count), totalMs: Number(row.total_ms) });
  }

  const hourCounts = new Array(24).fill(0);
  for await (const row of hourlyRes) {
    const h = new Date(row.time).getHours();
    hourCounts[h]++;
  }

  let bingeVideoId = null, bingePlayCount = 0;
  for await (const row of bingeRes) {
    bingeVideoId = row.video_id;
    bingePlayCount = Number(row.play_count);
  }

  let skipCount = 0, skipEarlyCount = 0, completedCount = 0, totalPlays = 0;
  for await (const row of rateRes) {
    skipCount = Number(row.skip_count) || 0;
    skipEarlyCount = Number(row.skip_early_count) || 0;
    completedCount = Number(row.completed_count) || 0;
    totalPlays = Number(row.total_plays) || 0;
  }

  const weekVideoIds = [];
  for await (const row of weekVideosRes) weekVideoIds.push(row.video_id);

  // ── Hydrate with Supabase metadata ──
  const allVideoIds = [...new Set([...topVideoRows.map(v => v.videoId), ...(bingeVideoId ? [bingeVideoId] : []), ...weekVideoIds])];

  let metaMap = {};
  let spotifyMap = {};
  if (allVideoIds.length > 0) {
    const { data: videosMeta } = await supabase.from('videos').select('video_id, title, artist').in('video_id', allVideoIds);
    if (videosMeta) videosMeta.forEach(m => { metaMap[m.video_id] = m; });

    const { data: spotifyMeta } = await supabase.from('track_metadata').select('video_id, artist_name, mood, genres').in('video_id', allVideoIds);
    if (spotifyMeta) spotifyMeta.forEach(m => { spotifyMap[m.video_id] = m; });
  }

  // ── Top 3 Artists ──
  const artistMap = {};
  for (const v of topVideoRows) {
    const artistName = spotifyMap[v.videoId]?.artist_name || metaMap[v.videoId]?.artist || 'Unknown';
    if (!artistMap[artistName]) artistMap[artistName] = { name: artistName, play_count: 0, total_hours: 0 };
    artistMap[artistName].play_count += v.playCount;
    artistMap[artistName].total_hours += v.totalMs / 3600000;
  }
  const top3Artists = Object.values(artistMap)
    .sort((a, b) => b.play_count - a.play_count)
    .slice(0, 3)
    .map(a => ({ ...a, total_hours: Math.round(a.total_hours * 10) / 10 }));

  // ── Peak Listening Hours ──
  let peakStart = 0, peakMax = 0;
  for (let i = 0; i < 24; i++) {
    const windowSum = hourCounts[i] + hourCounts[(i + 1) % 24] + hourCounts[(i + 2) % 24] + hourCounts[(i + 3) % 24];
    if (windowSum > peakMax) {
      peakMax = windowSum;
      peakStart = i;
    }
  }
  const peakEnd = (peakStart + 4) % 24;
  let peakLabel = 'Balanced Listener 🎶';
  if (peakStart >= 22 || peakStart < 5) peakLabel = 'Night Owl 🦉';
  else if (peakStart >= 5 && peakStart < 12) peakLabel = 'Early Bird 🐦';
  else if (peakStart >= 12 && peakStart < 17) peakLabel = 'Afternoon Listener 🌤️';
  else if (peakStart >= 17 && peakStart < 22) peakLabel = 'Evening Vibes 🌆';

  // ── Mood Distribution ──
  const moodDist = {};
  for (const vid of weekVideoIds) {
    const mood = spotifyMap[vid]?.mood || 'Unknown';
    moodDist[mood] = (moodDist[mood] || 0) + 1;
  }

  // ── Genre from top tracks (for genre shift placeholder) ──
  const genreCounts = {};
  for (const vid of weekVideoIds) {
    const genres = spotifyMap[vid]?.genres || [];
    for (const g of genres) {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    }
  }
  const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

  // ── Binge Track ──
  let bingeTrack = null;
  if (bingeVideoId && bingePlayCount >= 3) {
    const bMeta = metaMap[bingeVideoId] || {};
    const bSpotify = spotifyMap[bingeVideoId] || {};
    bingeTrack = {
      title: bMeta.title || 'Unknown',
      artist: bSpotify.artist_name || bMeta.artist || 'Unknown',
      replay_count: bingePlayCount,
    };
  }

  return {
    user_id: userId,
    week_start: weekStart,
    week_end: weekEnd,
    total_listening_hours: Math.round((totalMs / 3600000) * 10) / 10,
    total_tracks_played: totalTracks,
    top_3_artists: top3Artists,
    peak_listening_hours: {
      start: `${String(peakStart).padStart(2, '0')}:00`,
      end: `${String(peakEnd).padStart(2, '0')}:00`,
      label: peakLabel,
    },
    genre_shift: {
      this_week_top: topGenre,
    },
    binge_track: bingeTrack,
    mood_distribution: moodDist,
    skip_rate: totalPlays > 0 ? Math.round((skipCount / totalPlays) * 100) / 100 : 0,
    completion_rate: totalPlays > 0 ? Math.round((completedCount / totalPlays) * 100) / 100 : 0,
  };
}

// ─── Gemini LLM ────────────────────────────────────────────────────────────────

/**
 * Gọi Gemini 2.0 Flash để generate wrapped text.
 */
async function callGemini(summaryJSON) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY in .env');

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemma-4-26b-a4b-it' });

  const prompt = PROMPT_TEMPLATE + JSON.stringify(summaryJSON, null, 2);

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ─── On-Demand Logic ───────────────────────────────────────────────────────────

/**
 * Core function: Check DB → return nếu có → generate nếu chưa.
 * @param {string} userId
 * @returns {{ wrapped_text, summary_json, week_start, week_end, cached }}
 */
async function getOrGenerateWeeklyInsight(userId) {
  const { weekStart, weekEnd, weekStartISO, weekEndISO } = getWeekBoundaries();

  // 1. Check DB xem tuần trước đã có insight chưa
  const { data: existing, error: fetchError } = await supabase
    .from('weekly_insights')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single();

  if (existing && !fetchError) {
    console.log(`[Insights] Cache HIT for user=${userId} week=${weekStart}`);
    return {
      wrapped_text: existing.wrapped_text,
      summary_json: existing.summary_json,
      week_start: existing.week_start,
      week_end: existing.week_end,
      cached: true,
    };
  }

  // 2. Generate mới
  console.log(`[Insights] Cache MISS for user=${userId} week=${weekStart} — generating...`);

  const summaryJSON = await generateWeeklySummaryJSON(userId, weekStart, weekEnd, weekStartISO, weekEndISO);

  // Nếu không có data tuần trước
  if (summaryJSON.total_tracks_played === 0) {
    return {
      wrapped_text: '🎧 Tuần trước bạn chưa nghe bài nào trên YouTube. Hãy mở YouTube và bắt đầu hành trình âm nhạc nào! 🎵',
      summary_json: summaryJSON,
      week_start: weekStart,
      week_end: weekEnd,
      cached: false,
      empty: true,
    };
  }

  // 3. Gọi LLM
  let wrappedText;
  try {
    wrappedText = await callGemini(summaryJSON);
  } catch (err) {
    console.error('[Insights] Gemini API error:', err.message);
    wrappedText = `🎵 Tuần này bạn đã nghe ${summaryJSON.total_listening_hours} giờ nhạc với ${summaryJSON.total_tracks_played} bài hát. Hãy tiếp tục khám phá âm nhạc nhé! 🎶`;
  }

  // 4. Lưu vào DB (ON CONFLICT → skip nếu bị race condition)
  const { error: insertError } = await supabase.from('weekly_insights').upsert([{
    user_id: userId,
    week_start: weekStart,
    week_end: weekEnd,
    summary_json: summaryJSON,
    wrapped_text: wrappedText,
  }], { onConflict: 'user_id,week_start' });

  if (insertError) {
    console.warn('[Insights] DB insert warning:', insertError.message);
  } else {
    console.log(`[Insights] Saved weekly insight for user=${userId} week=${weekStart}`);
  }

  return {
    wrapped_text: wrappedText,
    summary_json: summaryJSON,
    week_start: weekStart,
    week_end: weekEnd,
    cached: false,
  };
}

module.exports = { getOrGenerateWeeklyInsight, generateWeeklySummaryJSON, getWeekBoundaries };
