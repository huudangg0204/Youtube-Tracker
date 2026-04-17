const axios = require('axios');
const { cacheGet, getRedisClient } = require('../db/redis');
const { createClient } = require('@supabase/supabase-js');
const Levenshtein = require('levenshtein');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ─── Mood Mapping: 8 Categories ───────────────────────────────────────────────
const MOOD_MAP = {
  'Happy/Upbeat':    ['pop', 'dance', 'disco', 'funk', 'reggaeton', 'k-pop', 'j-pop', 'happy', 'bubblegum'],
  'Sad/Melancholic': ['blues', 'acoustic', 'singer-songwriter', 'emo', 'folk', 'sad', 'melancholy', 'ballad'],
  'Energetic':       ['edm', 'techno', 'drum and bass', 'hardstyle', 'punk', 'rock', 'hard rock', 'power metal'],
  'Chill/Relaxed':   ['lo-fi', 'lofi', 'ambient', 'chillhop', 'bossa nova', 'jazz', 'new age', 'sleep', 'chill'],
  'Angry/Intense':   ['metal', 'hardcore', 'industrial', 'grunge', 'trap', 'death metal', 'thrash'],
  'Romantic/Dreamy': ['r&b', 'soul', 'indie pop', 'dream pop', 'shoegaze', 'love', 'romantic'],
  'Dramatic/Epic':   ['classical', 'soundtrack', 'orchestral', 'post-rock', 'cinematic', 'opera', 'film score'],
  'Party/Dance':     ['house', 'trance', 'reggae', 'latin', 'dancehall', 'club', 'party', 'afrobeat'],
};

// ─── Spotify Client Credentials Token ──────────────────────────────────────────

/**
 * Lấy Spotify access_token qua Client Credentials flow.
 * Token cached trong Redis (TTL 3500s, token expire sau 3600s).
 */
async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env');
  }

  return cacheGet('spotify_access_token', async () => {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
      }
    );
    console.log('[Spotify] New access token acquired');
    return response.data.access_token;
  }, 3500); // Cache 3500s (token real TTL = 3600s)
}

// ─── Search Track ──────────────────────────────────────────────────────────────

/**
 * Làm sạch title YouTube trước khi search trên Spotify.
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
    .replace(/\|.*$/g, '')         // | Official Music Video
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tính match confidence giữa YouTube title và Spotify track name.
 * @returns {number} 0.0-1.0
 */
function computeConfidence(youtubeTitle, spotifyTitle) {
  const a = youtubeTitle.toLowerCase().trim();
  const b = spotifyTitle.toLowerCase().trim();
  const lev = new Levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return Math.round((1 - lev.distance / maxLen) * 100) / 100;
}

/**
 * Tìm bài hát trên Spotify từ title YouTube.
 * @returns {{ spotify_track_id, artist_id, artist_name, album_name, explicit, confidence }} | null
 */
async function searchTrackOnSpotify(title, channelTitle) {
  try {
    const token = await getSpotifyToken();
    const cleanTitle = cleanYouTubeTitle(title);

    if (!cleanTitle) return null;

    const response = await axios.get('https://api.spotify.com/v1/search', {
      params: {
        q: `${cleanTitle} ${channelTitle}`,
        type: 'track',
        limit: 5,
        market: 'VN',
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const tracks = response.data?.tracks?.items;
    if (!tracks || tracks.length === 0) return null;

    // Tính confidence cho mỗi result, chọn best match
    let bestMatch = null;
    let bestConfidence = 0;

    for (const track of tracks) {
      const artistNames = track.artists?.map(a => a.name).join(', ') || '';
      
      // So sánh trực tiếp với track.name (phòng khi YouTube chỉ có tên bài hát)
      let confidence1 = computeConfidence(cleanTitle, track.name);
      
      // So sánh với định dạng "Artist - Track" thường thấy trên YouTube
      let confidence2 = computeConfidence(cleanTitle, `${artistNames} - ${track.name}`);
      let confidence3 = computeConfidence(cleanTitle, `${track.name} - ${artistNames}`);
      
      // Nếu tên bài hát xuất hiện trực tiếp trong title YouTube (fuzzy match)
      let confidence4 = cleanTitle.toLowerCase().includes(track.name.toLowerCase()) ? 0.7 : 0;
      
      const confidence = Math.max(confidence1, confidence2, confidence3, confidence4);
      
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = track;
      }
    }

    // Ngưỡng tối thiểu: 0.3
    if (!bestMatch || bestConfidence < 0.3) {
      console.log(`[Spotify] No confident match for "${cleanTitle}" (best: ${bestConfidence})`);
      return null;
    }

    const primaryArtist = bestMatch.artists?.[0];

    return {
      spotify_track_id: bestMatch.id,
      artist_id: primaryArtist?.id || null,
      artist_name: primaryArtist?.name || 'Unknown Artist',
      album_name: bestMatch.album?.name || 'Unknown Album',
      explicit: bestMatch.explicit || false,
      confidence: bestConfidence,
    };
  } catch (error) {
    console.warn('[Spotify] Search error:', error.message);
    return null;
  }
}

// ─── Artist Genres ─────────────────────────────────────────────────────────────

/**
 * Lấy genres[] từ Spotify Artist object.
 * Cache Redis 7 ngày (genre ít thay đổi).
 */
async function getArtistGenres(artistId) {
  if (!artistId) return [];

  return cacheGet(`spotify_artist_${artistId}`, async () => {
    const token = await getSpotifyToken();
    const response = await axios.get(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data?.genres || [];
  }, 604800); // 7 ngày
}

// ─── Genre → Mood Mapping ──────────────────────────────────────────────────────

/**
 * Map array genres → 1 mood category duy nhất.
 * Dùng scoring: genre nào match nhiều mood keywords nhất → chọn mood đó.
 */
function mapGenresToMood(genres) {
  if (!genres || genres.length === 0) return 'Unknown';

  const scores = {};
  for (const [mood, keywords] of Object.entries(MOOD_MAP)) {
    scores[mood] = 0;
  }

  for (const genre of genres) {
    const genreLower = genre.toLowerCase().trim();
    for (const [mood, keywords] of Object.entries(MOOD_MAP)) {
      for (const keyword of keywords) {
        if (genreLower.includes(keyword) || keyword.includes(genreLower)) {
          scores[mood] += 1;
        }
      }
    }
  }

  // Chọn mood có score cao nhất
  let bestMood = 'Unknown';
  let bestScore = 0;
  for (const [mood, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestMood = mood;
    }
  }

  return bestMood;
}

// ─── Language Detection ────────────────────────────────────────────────────────

/**
 * Detect ngôn ngữ bài hát từ title.
 * Dùng franc-min (lightweight).
 */
async function detectLanguage(title) {
  try {
    // franc-min is ESM-only, use dynamic import
    const { franc } = await import('franc-min');
    const langCode = franc(title);
    return langCode === 'und' ? 'Unknown' : langCode;
  } catch (error) {
    console.warn('[Language] Detection error:', error.message);
    return 'Unknown';
  }
}

// ─── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Hàm chính: Enrich video với Spotify metadata.
 * Gọi tất cả hàm trên theo thứ tự: check DB → search → genres → mood → language → upsert.
 */
async function enrichVideoWithSpotify(videoId, title, channelTitle) {
  try {
    // 1. Check xem đã enrich chưa
    const { data: existing } = await supabase
      .from('spotify_metadata')
      .select('video_id')
      .eq('video_id', videoId)
      .single();

    if (existing) return; // Đã có, skip

    // 2. Search trên Spotify
    const track = await searchTrackOnSpotify(title, channelTitle);
    if (!track) {
      console.log(`[Spotify] No match found for "${title}" — skipping enrichment`);
      return;
    }

    // 3. Lấy genres từ Artist
    const genres = await getArtistGenres(track.artist_id);

    // 4. Map genres → mood
    const mood = mapGenresToMood(genres);

    // 5. Detect language
    const language = await detectLanguage(title);

    // 6. Upsert vào Supabase
    const { error } = await supabase.from('spotify_metadata').upsert([{
      video_id: videoId,
      spotify_track_id: track.spotify_track_id,
      spotify_artist_id: track.artist_id,
      artist_name: track.artist_name,
      album_name: track.album_name,
      genres: genres,
      mood: mood,
      language: language,
      explicit: track.explicit,
      match_confidence: track.confidence,
    }], { onConflict: 'video_id' });

    if (error) {
      console.error('[Spotify] Supabase upsert error:', error.message);
    } else {
      console.log(`[Spotify] Enriched ${videoId} → mood=${mood}, artist=${track.artist_name}, genres=[${genres.slice(0, 3).join(', ')}]`);
    }
  } catch (error) {
    console.warn('[Spotify] Enrichment error (non-blocking):', error.message);
  }
}

module.exports = {
  getSpotifyToken,
  searchTrackOnSpotify,
  getArtistGenres,
  mapGenresToMood,
  detectLanguage,
  enrichVideoWithSpotify,
  cleanYouTubeTitle,
  computeConfidence,
  MOOD_MAP,
};
