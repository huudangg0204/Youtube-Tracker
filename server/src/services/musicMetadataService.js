const axios = require('axios');
const { cacheGet } = require('../db/redis');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const DEEZER_BASE     = 'https://api.deezer.com';
const RECCOBEATS_BASE = 'https://api.reccobeats.com';

// ─── Title Cleaner ─────────────────────────────────────────────────────────────

/**
 * Làm sạch title YouTube trước khi search trên Deezer.
 * Giữ nguyên từ lastfmService.js – đã được test thực tế.
 */
function cleanYouTubeTitle(title) {
  return title
    .replace(/\(.*?\)/g, '')       // (Official Video), (Lyrics), (Vietsub), ...
    .replace(/\[.*?\]/g, '')       // [Official Audio], [MV], ...
    .replace(/official\s*(music\s*)?video/gi, '')
    .replace(/official\s*audio/gi, '')
    .replace(/\blyrics?\b/gi, '')
    .replace(/\bvietsub\b/gi, '')
    .replace(/\bmv\b/gi, '')
    .replace(/\baudio\b/gi, '')
    .replace(/\bft\.?\b/gi, '')
    .replace(/\bfeat\.?\b/gi, '')
    .replace(/\|.*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Language Detection ────────────────────────────────────────────────────────

/**
 * Detect ngôn ngữ bài hát từ title (dùng franc-min, ESM-only).
 */
async function detectLanguage(title) {
  try {
    const { franc } = await import('franc-min');
    const langCode = franc(title);
    return langCode === 'und' ? 'Unknown' : langCode;
  } catch (error) {
    console.warn('[MusicMeta] Language detection error:', error.message);
    return 'Unknown';
  }
}

// ─── Mood Mapping từ Audio Features (11 features) ────────────────────────────

/**
 * Suy mood từ toàn bộ 11 audio features của ReccoBeats.
 *
 * Features sử dụng:
 *   valence          : 0.0 (tiêu cực/buồn) → 1.0 (tích cực/vui)
 *   energy           : 0.0 (nhẹ nhàng)     → 1.0 (mạnh mẽ)
 *   danceability     : 0.0 (khó nhảy)      → 1.0 (dễ nhảy)
 *   acousticness     : 0.0 (electric)      → 1.0 (acoustic)
 *   instrumentalness : ~1.0 = không có lời (nhạc cụ thuần tuý)
 *   speechiness      : >0.66 = hoàn toàn lời nói, >0.33 = mix lời/nhạc
 *   liveness         : >0.8 = live performance
 *   loudness         : dB (thường -60 → 0)
 *   tempo            : BPM
 *   mode             : 1 = major (tươi sáng), 0 = minor (tối/buồn) ← quan trọng!
 *   key              : 0-11, Pitch Class (0=C, 1=C#, 2=D, ...)
 *
 * @param {object} f - Toàn bộ audio features object
 * @returns {string} Mood category
 */
function mapAudioFeaturesToMood(f) {
  if (!f) return 'Unknown';

  const {
    valence          = 0.5,
    energy           = 0.5,
    danceability     = 0.5,
    acousticness     = 0,
    instrumentalness = 0,
    speechiness      = 0,
    liveness         = 0,
    loudness         = -10,
    tempo            = 120,
    mode             = 1,   // 1=major, 0=minor
  } = f;

  // ── Live Performance ──────────────────────────────────────────────────────
  // Ưu tiên detect live recording trước khi phân loại mood
  // liveness > 0.8 = khả năng cao là live show (tắt filter này nếu muốn classify mood bình thường)
  // if (liveness > 0.8) return 'Dramatic/Epic'; // tuỳ chọn

  // ── Dramatic/Epic ─────────────────────────────────────────────────────────
  // Nhạc cụ thuần (không lời), năng lượng vừa-cao, thường minor
  if (instrumentalness > 0.6 && energy > 0.4) return 'Dramatic/Epic';

  // ── Angry/Intense ─────────────────────────────────────────────────────────
  // Năng lượng rất cao + cảm xúc tiêu cực + minor key
  if (energy > 0.8 && valence < 0.35 && mode === 0) return 'Angry/Intense';
  // Năng lượng cao + tiêu cực (ngay cả major key)
  if (energy > 0.85 && valence < 0.3)               return 'Angry/Intense';

  // ── Sad/Melancholic ───────────────────────────────────────────────────────
  // Kết hợp minor key + valence thấp (chỉ số mạnh nhất của buồn)
  if (mode === 0 && valence < 0.35 && energy < 0.6) return 'Sad/Melancholic';
  // Valence rất thấp (kể cả major key)
  if (valence < 0.25 && energy < 0.55)              return 'Sad/Melancholic';

  // ── Chill/Relaxed ─────────────────────────────────────────────────────────
  // Acoustic cao, energy thấp — điển hình acoustic ballad / ambient
  if (acousticness > 0.75 && energy < 0.45)   return 'Chill/Relaxed';
  // Lo-fi / ambient: loudness rất thấp, energy thấp
  if (loudness < -18 && energy < 0.35)         return 'Chill/Relaxed';

  // ── Romantic/Dreamy ───────────────────────────────────────────────────────
  // Cảm xúc trung tính, nhịp vừa, acoustic vừa — nhạc tình cảm / indie
  if (valence >= 0.3 && valence < 0.6 && energy < 0.55
      && acousticness > 0.25 && danceability < 0.65)  return 'Romantic/Dreamy';

  // ── Energetic ─────────────────────────────────────────────────────────────
  // Năng lượng cao, nhịp nhanh, không đặc biệt dễ nhảy (rock, metal, punk)
  if (energy > 0.78 && tempo > 135 && danceability < 0.6) return 'Energetic';

  // ── Party/Dance ───────────────────────────────────────────────────────────
  // Danceability cao + energy cao — EDM, pop dance, club
  if (danceability > 0.72 && energy > 0.62)    return 'Party/Dance';
  // Speechiness + danceability → hip-hop/rap party
  if (speechiness > 0.15 && danceability > 0.7 && energy > 0.55) return 'Party/Dance';

  // ── Happy/Upbeat ──────────────────────────────────────────────────────────
  // Valence cao + energy vừa-cao + major key
  if (valence > 0.65 && energy > 0.45 && mode === 1) return 'Happy/Upbeat';
  // Valence rất cao (kể cả mọi key)
  if (valence > 0.75 && energy > 0.4)           return 'Happy/Upbeat';

  // ── Fallback dựa trên valence + mode ─────────────────────────────────────
  if (valence > 0.5 && mode === 1) return 'Happy/Upbeat';
  if (valence < 0.5 && mode === 0) return 'Sad/Melancholic';
  return valence > 0.5 ? 'Happy/Upbeat' : 'Sad/Melancholic';
}

/**
 * Gợi ý thể loại nhạc từ toàn bộ audio features.
 *
 * Sử dụng thêm: mode (major/minor), key, liveness, loudness.
 *
 * @param {object} f - Toàn bộ audio features object
 * @returns {string} Genre label
 */
function mapAudioFeaturesToGenreHint(f) {
  if (!f) return 'Unknown';

  const {
    energy           = 0.5,
    danceability     = 0.5,
    acousticness     = 0,
    instrumentalness = 0,
    speechiness      = 0,
    liveness         = 0,
    loudness         = -10,
    tempo            = 120,
    mode             = 1,
    valence          = 0.5,
  } = f;

  // ── Classical / Orchestral ────────────────────────────────────────────────
  // Instrumental hoàn toàn, không mạnh, thường là live hoặc acoustic
  if (instrumentalness > 0.85 && acousticness > 0.3)  return 'Classical';
  if (instrumentalness > 0.9)                          return 'Classical/Instrumental';

  // ── Jazz / Blues ──────────────────────────────────────────────────────────
  // Instrumental vừa, acoustic cao, live vừa, tempo trung bình
  if (instrumentalness > 0.4 && acousticness > 0.5
      && tempo >= 70 && tempo <= 160)                  return 'Jazz/Blues';

  // ── Hip-Hop / Rap ─────────────────────────────────────────────────────────
  // Nhiều lời nói, danceability cao
  if (speechiness > 0.33 && danceability > 0.55)      return 'Hip-Hop/Rap';
  if (speechiness > 0.5)                               return 'Hip-Hop/Rap';

  // ── EDM / Electronic ─────────────────────────────────────────────────────
  // Năng lượng rất cao, tempo rất nhanh, KHÔNG acoustic
  if (energy > 0.82 && tempo > 128 && acousticness < 0.15) return 'EDM/Electronic';

  // ── Rock / Metal ──────────────────────────────────────────────────────────
  // Năng lượng cao, loudness cao (ít âm), minor key, không acoustic
  if (energy > 0.72 && loudness > -8 && acousticness < 0.2
      && danceability < 0.65)                          return 'Rock/Metal';

  // ── Acoustic / Folk / Singer-Songwriter ───────────────────────────────────
  // Acoustic rất cao, năng lượng thấp, ít lời nói
  if (acousticness > 0.8 && energy < 0.5)              return 'Acoustic/Folk';

  // ── Dance / Pop ───────────────────────────────────────────────────────────
  // Danceability cao, energy vừa-cao, major key, valence tích cực
  if (danceability > 0.72 && energy > 0.58
      && mode === 1 && valence > 0.4)                  return 'Dance/Pop';

  // ── K-Pop / J-Pop ─────────────────────────────────────────────────────────
  // High danceability + high energy + major + tempo 100-160
  if (danceability > 0.65 && energy > 0.65 && mode === 1
      && tempo >= 100 && tempo <= 165)                 return 'K-Pop/J-Pop';

  // ── R&B / Soul ────────────────────────────────────────────────────────────
  // Danceability vừa, energy thấp-vừa, valence trung, speechiness nhẹ
  if (danceability > 0.55 && energy < 0.65
      && speechiness > 0.05 && speechiness < 0.33
      && acousticness < 0.5)                           return 'R&B/Soul';

  // ── Lo-fi / Ambient ───────────────────────────────────────────────────────
  // Năng lượng thấp, loudness thấp
  if (energy < 0.38 && loudness < -15)                 return 'Lo-fi/Ambient';

  // ── Pop (fallback) ────────────────────────────────────────────────────────
  return 'Pop';
}

// ─── Step 1: Deezer Search → ISRC ─────────────────────────────────────────────

/**
 * Tìm bài hát trên Deezer → trả về ISRC (ID chuẩn quốc tế của track).
 * Dùng 2 request: /search → id → /track/:id → isrc.
 * Không cần API key.
 *
 * @param {string} title   - YouTube title đã được clean
 * @param {string} artist  - Channel title (tương đương artist)
 * @returns {{ isrc, track_name, artist_name, deezer_id }} | null
 */
async function searchDeezerTrack(title, artist) {
  try {
    const q = encodeURIComponent(`${title} ${artist}`);
    const response = await axios.get(`${DEEZER_BASE}/search?q=${q}&limit=3`, {
      timeout: 8000,
    });

    const items = response.data?.data;
    if (!items || items.length === 0) return null;

    // Ưu tiên track khớp cả tên lẫn artist, nếu không có thì khớp nguyên title
    const best = items.find(t =>
      t.title?.toLowerCase().includes(title.toLowerCase()) &&
      t.artist?.name?.toLowerCase().includes(artist.toLowerCase())
    ) || items.find(t =>
      t.title?.toLowerCase().includes(title.toLowerCase())
    ) || items[0];

    // Lấy ISRC từ /track/:id (endpoint đầy đủ hơn)
    const detail = await axios.get(`${DEEZER_BASE}/track/${best.id}`, {
      timeout: 8000,
    });
    const isrc = detail.data?.isrc || null;

    const album_name = detail.data?.album?.title || null;

    return {
      deezer_id:   best.id,
      track_name:  best.title,
      artist_name: best.artist?.name || artist,
      album_name,
      isrc,
    };
  } catch (error) {
    console.warn('[MusicMeta] Deezer search error:', error.message);
    return null;
  }
}

// ─── Step 2: ISRC → ReccoBeats UUID ───────────────────────────────────────────

/**
 * Ánh xạ ISRC → ReccoBeats internal UUID.
 * Endpoint: GET /v1/track?ids=<isrc>
 * Cache Redis 30 ngày (ISRC–UUID không thay đổi).
 *
 * @param {string} isrc
 * @returns {{ uuid, track_name, artist_name }} | null
 */
async function getReccoBeatsUUID(isrc) {
  if (!isrc) return null;

  const cacheKey = `rb_uuid_${isrc}`;

  return cacheGet(cacheKey, async () => {
    const response = await axios.get(`${RECCOBEATS_BASE}/v1/track`, {
      params: { ids: isrc },
      timeout: 8000,
    });

    const content = response.data?.content;
    if (!content || content.length === 0) return null;

    const track = content[0];
    return {
      uuid:        track.id,
      track_name:  track.trackTitle,
      artist_name: track.artists?.[0]?.name || 'Unknown',
    };
  }, 2592000); // 30 ngày
}

// ─── Step 3: UUID → Audio Features ────────────────────────────────────────────

/**
 * Lấy audio features từ ReccoBeats theo UUID.
 * Endpoint: GET /v1/track/:uuid/audio-features
 * Cache Redis 7 ngày (audio features của 1 track không đổi).
 *
 * @param {string} uuid - ReccoBeats internal UUID
 * @returns {{ valence, energy, danceability, acousticness,
 *             instrumentalness, tempo, speechiness, liveness, loudness }}
 */
async function getReccoBeatsAudioFeatures(uuid) {
  if (!uuid) return null;

  const cacheKey = `rb_features_${uuid}`;

  return cacheGet(cacheKey, async () => {
    const response = await axios.get(
      `${RECCOBEATS_BASE}/v1/track/${uuid}/audio-features`,
      { timeout: 8000 }
    );
    return response.data;
  }, 604800); // 7 ngày
}

// ─── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Hàm chính: Enrich video với audio features từ Deezer + ReccoBeats.
 *
 * Pipeline:
 *   1. Check DB – nếu đã có thì bỏ qua (idempotent)
 *   2. Clean YouTube title
 *   3. Deezer search → ISRC
 *   4. ReccoBeats ISRC → UUID
 *   5. ReccoBeats UUID → audio features
 *   6. Map features → mood + genre hint
 *   7. Detect language
 *   8. Upsert vào Supabase track_metadata
 *
 * Fire-and-forget: mọi lỗi đều được catch và log, không block server.
 *
 * @param {string} videoId      - YouTube video ID
 * @param {string} title        - YouTube video title (raw)
 * @param {string} channelTitle - YouTube channel name (thường là artist)
 */
async function enrichVideoAudioFeatures(videoId, title, channelTitle) {
  try {
    // 1. Check xem đã enrich chưa (idempotent)
    const { data: existing } = await supabase
      .from('track_metadata')
      .select('video_id')
      .eq('video_id', videoId)
      .single();

    if (existing) return; // Đã có, skip

    // 2. Clean title
    const cleanTitle = cleanYouTubeTitle(title);
    if (!cleanTitle) {
      console.log(`[MusicMeta] Empty clean title for "${title}" — skipping`);
      return;
    }

    // --- Core Pipeline ---
    let artist_name = channelTitle;
    let album_name = null;
    let features = null;
    let isFound = false;

    // 3. Deezer search → ISRC
    const deezerResult = await searchDeezerTrack(cleanTitle, channelTitle);
    if (deezerResult?.isrc) {
      album_name = deezerResult.album_name;
      
      // 4. ISRC → ReccoBeats UUID
      const rbTrack = await getReccoBeatsUUID(deezerResult.isrc);
      if (rbTrack) {
        artist_name = rbTrack.artist_name || artist_name;
        
        // 5. ReccoBeats UUID → audio features
        features = await getReccoBeatsAudioFeatures(rbTrack.uuid);
        if (features) {
          isFound = true;
        }
      }
    }

    if (!isFound) {
      console.log(`[MusicMeta] Track "${cleanTitle}" not found or lacks features — marking as Unknown`);
    }

    // 6. Map → mood + genre (Sẽ trả về 'Unknown' + 'Pop' nếu features == null)
    const mood      = mapAudioFeaturesToMood(features);
    const genreHint = mapAudioFeaturesToGenreHint(features);

    // 7. Detect language
    const language = await detectLanguage(title);

    // 8. Upsert vào Supabase
    const { error } = await supabase.from('track_metadata').upsert([{
      video_id:         videoId,
      artist_name:      artist_name,           // Đã lấy an toàn hoặc fallback channelTitle
      album_name:       album_name,            // Đã lấy an toàn hoặc null
      genres:           [genreHint],
      mood:             mood,
      language:         language,
      match_confidence: null,
      audio_features:   features,              // Lưu toàn bộ 11 raw features (null nếu lỗi)
    }], { onConflict: 'video_id' });

    if (error) {
      console.error('[MusicMeta] Supabase upsert error:', error.message);
    } else {
      console.log(
        `[MusicMeta] Enriched ${videoId} → mood=${mood}, genre=${genreHint}, ` +
        `artist=${artist_name}, valence=${features?.valence?.toFixed(2) || 'N/A'}, energy=${features?.energy?.toFixed(2) || 'N/A'}`
      );
    }
  } catch (error) {
    console.warn('[MusicMeta] Enrichment error (non-blocking):', error.message);
  }
}

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  cleanYouTubeTitle,
  detectLanguage,
  searchDeezerTrack,
  getReccoBeatsUUID,
  getReccoBeatsAudioFeatures,
  mapAudioFeaturesToMood,
  mapAudioFeaturesToGenreHint,
  enrichVideoAudioFeatures,
};
