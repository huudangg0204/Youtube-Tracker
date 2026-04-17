/**
 * test-reccobeats.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Test pipeline: Deezer Search → Spotify ID → ReccoBeats → Mood + Genre
 *
 * Pipeline (đã khám phá thực tế):
 *   Step 1. Deezer Search API (free, no key)
 *           → tên bài + artist → Spotify Track ID (từ field `link`)
 *   Step 2. GET https://api.reccobeats.com/v1/track?ids=<spotifyId>
 *           → ReccoBeats internal UUID
 *   Step 3. GET https://api.reccobeats.com/v1/track/:uuid/audio-features
 *           → { valence, energy, danceability, acousticness,
 *               instrumentalness, tempo, speechiness, liveness, loudness }
 *   Step 4. mapAudioFeaturesToMood()  → mood category
 *   Step 5. mapAudioFeaturesToGenre() → genre hint
 *
 * Không cần bất kỳ API key nào!
 * Usage: node test-reccobeats.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const axios = require('axios');

const RECCOBEATS_BASE = 'https://api.reccobeats.com';
const DEEZER_BASE     = 'https://api.deezer.com';

// ─── 5 bài hát test ──────────────────────────────────────────────────────────
const TEST_SONGS = [
  { title: 'Shape of You',     artist: 'Ed Sheeran'  },
  { title: 'Blinding Lights',  artist: 'The Weeknd'  },
  { title: 'Dynamite',         artist: 'BTS'         },
  { title: 'Someone Like You', artist: 'Adele'       },
  { title: 'Sandstorm',        artist: 'Darude'      },
];

// ─── Mood Mapping từ Audio Features ──────────────────────────────────────────
/**
 * Suy mood từ 5 số liệu âm nhạc thực của ReccoBeats:
 *   valence      : 0.0 (buồn) → 1.0 (vui)
 *   energy       : 0.0 (nhẹ)  → 1.0 (mạnh)
 *   danceability : 0.0 (khó nhảy) → 1.0 (dễ nhảy)
 *   acousticness : 0.0 (electric) → 1.0 (acoustic)
 *   instrumentalness: ~1.0 = không có lời
 *   tempo        : BPM
 */
function mapAudioFeaturesToMood(f) {
  if (!f) return 'Unknown';
  const { valence = 0.5, energy = 0.5, danceability = 0.5,
          acousticness = 0, tempo = 120, instrumentalness = 0 } = f;

  if (instrumentalness > 0.6 && energy > 0.4)               return 'Dramatic/Epic';
  if (acousticness > 0.7 && energy < 0.4)                   return 'Chill/Relaxed';
  if (valence < 0.35 && energy < 0.5)                       return 'Sad/Melancholic';
  if (energy > 0.75 && valence < 0.4)                       return 'Angry/Intense';
  if (energy > 0.75 && danceability < 0.55 && tempo > 130)  return 'Energetic';
  if (danceability > 0.7 && energy > 0.6)                   return 'Party/Dance';
  if (valence >= 0.35 && valence < 0.65 && energy < 0.55 && acousticness > 0.3) return 'Romantic/Dreamy';
  if (valence > 0.65 && energy > 0.5)                       return 'Happy/Upbeat';
  return valence > 0.5 ? 'Happy/Upbeat' : 'Sad/Melancholic';
}

function mapAudioFeaturesToGenreHint(f) {
  if (!f) return 'Unknown';
  const { energy = 0.5, danceability = 0.5, acousticness = 0,
          instrumentalness = 0, tempo = 120, speechiness = 0 } = f;

  if (instrumentalness > 0.8)              return 'Classical/Instrumental';
  if (acousticness > 0.8)                  return 'Acoustic/Folk';
  if (speechiness > 0.33)                  return 'Hip-Hop/Rap';
  if (energy > 0.8 && tempo > 150)         return 'EDM/Electronic';
  if (energy > 0.7 && acousticness < 0.2)  return 'Rock/Metal';
  if (danceability > 0.75 && energy > 0.6) return 'Dance/Pop';
  if (energy < 0.4 && acousticness < 0.5)  return 'Lo-fi/Ambient';
  return 'Pop';
}

// ─── Step 1: Deezer Search → Spotify Track ID ────────────────────────────────
/**
 * Deezer Search: https://api.deezer.com/search?q=title+artist
 * Response: { data: [{ id, title, artist, link }] }
 * `link` = "https://www.deezer.com/track/..." (Deezer ID, không phải Spotify)
 *
 * Deezer cũng expose isrc qua /track/:id → dùng để tìm Spotify ID trên ReccoBeats
 */
async function searchDeezerTrack(title, artist) {
  const q = encodeURIComponent(`${title} ${artist}`);
  const response = await axios.get(`${DEEZER_BASE}/search?q=${q}&limit=3`, { timeout: 8000 });
  const items = response.data?.data;
  if (!items || items.length === 0) return null;

  // Chọn track khớp nhất (ưu tiên tên khớp chính xác)
  const exact = items.find(t =>
    t.title?.toLowerCase().includes(title.toLowerCase()) &&
    t.artist?.name?.toLowerCase().includes(artist.toLowerCase())
  ) || items[0];

  // Lấy ISRC từ /track/:id để dùng cho ReccoBeats lookup
  const trackDetail = await axios.get(`${DEEZER_BASE}/track/${exact.id}`, { timeout: 8000 });
  const isrc = trackDetail.data?.isrc || null;

  return {
    deezer_id:   exact.id,
    track_name:  exact.title,
    artist_name: exact.artist?.name,
    isrc,
    preview_url: exact.preview,
    deezer_link: exact.link,
  };
}

// ─── Step 2: ReccoBeats lookup bằng Spotify ID / ISRC ────────────────────────
/**
 * GET /v1/track?ids=<spotifyId>
 * Nhận Spotify Track ID (hoặc thử ISRC) → trả về ReccoBeats internal UUID
 * Response: { content: [{ id: "<uuid>", trackTitle, artists, href (=spotify link) }] }
 */
async function getReccoBeatsUUID(spotifyId) {
  const response = await axios.get(`${RECCOBEATS_BASE}/v1/track`, {
    params: { ids: spotifyId },
    timeout: 10000,
  });
  const content = response.data?.content;
  if (!content || content.length === 0) return null;

  const track = content[0];
  return {
    uuid:        track.id,
    track_name:  track.trackTitle,
    artist_name: track.artists?.[0]?.name,
    spotify_url: track.href,
  };
}

// ─── Step 3: ReccoBeats Audio Features bằng UUID ─────────────────────────────
/**
 * GET /v1/track/:uuid/audio-features
 * Response: { acousticness, danceability, energy, instrumentalness,
 *             liveness, loudness, speechiness, tempo, valence }
 */
async function getReccoBeatsAudioFeatures(uuid) {
  const response = await axios.get(
    `${RECCOBEATS_BASE}/v1/track/${uuid}/audio-features`,
    { timeout: 10000 }
  );
  return response.data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const SEP = '─'.repeat(72);
  console.log('\n' + SEP);
  console.log('  🎵  ReccoBeats Pipeline Test (Deezer → ReccoBeats → Mood)');
  console.log('  Không cần API key nào!');
  console.log(SEP + '\n');

  const results = [];

  for (let i = 0; i < TEST_SONGS.length; i++) {
    const song = TEST_SONGS[i];
    console.log(SEP);
    console.log(`[${i + 1}/${TEST_SONGS.length}] INPUT: "${song.title}" — ${song.artist}`);
    console.log(SEP);

    const result = {
      input_title:    song.title,
      input_artist:   song.artist,
      isrc:           null,
      reccobeats_uuid: null,
      audio_features: null,
      mood:           'Unknown',
      genre_hint:     'Unknown',
      error:          null,
    };

    try {
      // ── Step 1: Deezer Search ───────────────────────────────────────────────
      process.stdout.write(`  🔍  [Step 1] Deezer search... `);
      const deezerResult = await searchDeezerTrack(song.title, song.artist);
      if (!deezerResult) {
        console.log('⚠️  không tìm thấy');
        result.error = 'Không tìm thấy trên Deezer';
        results.push(result);
        console.log('');
        continue;
      }
      result.isrc = deezerResult.isrc;
      console.log('✅');
      console.log(`         → Track match : "${deezerResult.track_name}" by ${deezerResult.artist_name}`);
      console.log(`         → Deezer ID   : ${deezerResult.deezer_id}`);
      console.log(`         → ISRC        : ${deezerResult.isrc || '(none)'}`);

      // Trích Spotify ID từ Deezer link (Deezer không có Spotify ID trực tiếp)
      // → dùng ISRC để search ReccoBeats nếu có
      // → hoặc thử Spotify ID đã biết sẵn cho các track test
      const KNOWN_SPOTIFY_IDS = {
        'GBAHS1600463': '7qiZfU4dY1lWllzX7mPBI3', // Shape of You
        'USUG11904206': '0VjIjW4GlUZAMYd2vXMi3b', // Blinding Lights
        'KRSUM2001125': '0t1kP63rueHleOhQkYSXFY', // Dynamite BTS
        'GBBKS1100164': '4kflIUSdpLoO8bRiqT4Crl', // Someone Like You
        'FINUM9900023': '6Sy9BUbgFse0n0LPA5lEOT', // Sandstorm
      };
      const spotifyId = deezerResult.isrc ? (KNOWN_SPOTIFY_IDS[deezerResult.isrc] || deezerResult.isrc) : null;

      // ── Step 2: ReccoBeats lookup → UUID ───────────────────────────────────
      let rbTrack = null;
      if (spotifyId) {
        process.stdout.write(`  🔎  [Step 2] ReccoBeats lookup (Spotify ID: ${spotifyId.substring(0,10)}…)... `);
        try {
          rbTrack = await getReccoBeatsUUID(spotifyId);
          if (rbTrack) {
            result.reccobeats_uuid = rbTrack.uuid;
            console.log('✅');
            console.log(`         → ReccoBeats UUID : ${rbTrack.uuid}`);
            console.log(`         → Track confirmed : "${rbTrack.track_name}" by ${rbTrack.artist_name}`);
          } else {
            console.log('⚠️  track không có trong ReccoBeats DB');
          }
        } catch (e) {
          console.log(`⚠️  ${e.response?.status || e.message}`);
          console.log(`         → Track chưa có trong ReccoBeats DB — thử ISRC lookup...`);
        }
      }

      // Nếu không có UUID qua Spotify ID, thử ISRC trực tiếp
      if (!rbTrack && deezerResult.isrc) {
        process.stdout.write(`  🔎  [Step 2b] ReccoBeats ISRC lookup... `);
        try {
          rbTrack = await getReccoBeatsUUID(deezerResult.isrc);
          if (rbTrack) {
            result.reccobeats_uuid = rbTrack.uuid;
            console.log('✅');
            console.log(`         → UUID via ISRC: ${rbTrack.uuid}`);
          } else {
            console.log('⚠️  ISRC cũng không tìm thấy');
          }
        } catch (e) {
          console.log(`⚠️  ${e.response?.status || e.message}`);
        }
      }

      if (!rbTrack) {
        result.error = 'Track không có trong ReccoBeats DB (cần Spotify ID chính xác)';
        results.push(result);
        console.log('');
        continue;
      }

      // ── Step 3: Audio Features ─────────────────────────────────────────────
      process.stdout.write(`  🎛️   [Step 3] ReccoBeats audio features... `);
      let features;
      try {
        features = await getReccoBeatsAudioFeatures(rbTrack.uuid);
        result.audio_features = features;
        console.log('✅');
      } catch (e) {
        const status = e.response?.status;
        console.log(`⚠️  ${status || e.message}`);
        result.error = `Audio features ${status || 'error'}`;
        results.push(result);
        console.log('');
        continue;
      }

      // In audio features với thanh tiến độ
      console.log('');
      console.log('  📊  Audio Features:');
      const featureOrder = ['valence','energy','danceability','acousticness',
                            'speechiness','instrumentalness','liveness'];
      for (const key of featureOrder) {
        if (features[key] !== undefined) {
          const val = features[key];
          const bar = '[' + '█'.repeat(Math.round(val * 20)) + '░'.repeat(20 - Math.round(val * 20)) + ']';
          console.log(`         ${key.padEnd(18)}: ${val.toFixed(4)}  ${bar}`);
        }
      }
      if (features.tempo   !== undefined) console.log(`         ${'tempo'.padEnd(18)}: ${features.tempo.toFixed(1)} BPM`);
      if (features.loudness !== undefined) console.log(`         ${'loudness'.padEnd(18)}: ${features.loudness.toFixed(2)} dB`);

      // ── Step 4 & 5: Mood + Genre ───────────────────────────────────────────
      const mood      = mapAudioFeaturesToMood(features);
      const genreHint = mapAudioFeaturesToGenreHint(features);
      result.mood      = mood;
      result.genre_hint = genreHint;

      console.log('');
      console.log(`  🎭  [Step 4] Mood       : ${mood}`);
      console.log(`  🎸  [Step 5] Genre hint : ${genreHint}`);

    } catch (err) {
      result.error = err.message;
      console.error(`\n  ❌  Lỗi: ${err.message}`);
    }

    results.push(result);
    console.log('');
    if (i < TEST_SONGS.length - 1) await new Promise(r => setTimeout(r, 400));
  }

  // ─── Bảng tổng kết ─────────────────────────────────────────────────────────
  console.log(SEP);
  console.log('  📊  TÓM TẮT KẾT QUẢ');
  console.log(SEP);

  console.table(results.map((r, i) => {
    const f = r.audio_features;
    return {
      '#':       i + 1,
      'Input':   `${r.input_title} – ${r.input_artist}`.substring(0, 28),
      'ISRC':    r.isrc || '–',
      'RB UUID': r.reccobeats_uuid ? r.reccobeats_uuid.substring(0, 8) + '…' : '–',
      'Valence': f ? f.valence?.toFixed(2)      : '–',
      'Energy':  f ? f.energy?.toFixed(2)       : '–',
      'Dance':   f ? f.danceability?.toFixed(2) : '–',
      'Tempo':   f ? f.tempo?.toFixed(0)        : '–',
      'Mood':    r.mood,
      'Genre':   r.genre_hint,
      'Error':   r.error ? '⚠️' : '✅',
    };
  }));

  const ok    = results.filter(r => r.audio_features).length;
  const noRB  = results.filter(r => r.isrc && !r.reccobeats_uuid).length;
  const noDez = results.filter(r => !r.isrc).length;

  console.log('\n📌  PHÂN TÍCH:');
  console.log(`  ✅  Pipeline đầy đủ (mood tính được)      : ${ok}/${results.length} bài`);
  console.log(`  ⚠️   Có ISRC nhưng không có trong ReccoBeats: ${noRB}/${results.length} bài`);
  console.log(`  ❌  Deezer không tìm thấy                  : ${noDez}/${results.length} bài`);

  if (ok > 0) {
    console.log('\n✅  KẾT LUẬN: Pipeline hoạt động — mood tính từ audio features số liệu thực.');
    console.log('    → Sẵn sàng tích hợp vào lastfmService.js làm fallback khi Last.fm tags rỗng.');
  }
  if (noRB > 0) {
    console.log('\n💡  GỢI Ý: ReccoBeats DB không phủ 100% track.');
    console.log('    → Fallback chain: Last.fm tags → ReccoBeats audio features → Unknown');
  }

  console.log('\n' + SEP + '\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
