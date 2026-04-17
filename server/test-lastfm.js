/**
 * test-lastfm.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Test thủ công: Gọi Last.fm API đúng theo quy trình của hệ thống
 * để xác định xem tag có thực sự rỗng hay không.
 *
 * Pipeline:
 *   1. cleanYouTubeTitle(title)          → loại bỏ noise
 *   2. track.search                      → tìm artist + track name
 *   3. track.getInfo                     → lấy toptags + album
 *   4. mapTagsToMood(tags)               → suy ra mood
 *
 * Usage:
 *   node test-lastfm.js
 * Yêu cầu: LASTFM_API_KEY phải có trong .env (cùng thư mục server hoặc root)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');

// ─── Load .env từ server/ hoặc root ──────────────────────────────────────────
const serverEnvPath = path.resolve(__dirname, '.env');
const rootEnvPath = path.resolve(__dirname, '..', '.env');
require('dotenv').config({
  path: fs.existsSync(serverEnvPath) ? serverEnvPath : rootEnvPath,
});

const axios = require('axios');

// ─── 5 bài hát test (giống dữ liệu thật từ YouTube) ─────────────────────────
const TEST_SONGS = [
  { title: 'Shape of You (Official Music Video)', channel: 'Ed Sheeran' },
  { title: 'Blinding Lights [Official Audio]', channel: 'The Weeknd' },
  { title: 'Nụ Hôn Bisou', channel: 'Lãng' },
  { title: 'Billie Eilish - BIRDS OF A FEATHER (Official Lyric Video', channel: 'BillieEilishVEVO' },
  { title: 'Beethoven Moonlight Sonata | Classical Music', channel: 'ClassicFM' },
];

// ─── Mood Map (copy từ lastfmService.js) ──────────────────────────────────────
const MOOD_MAP = {
  'Happy/Upbeat': ['pop', 'dance', 'disco', 'funk', 'reggaeton', 'k-pop', 'j-pop', 'happy', 'bubblegum', 'kpop'],
  'Sad/Melancholic': ['blues', 'acoustic', 'singer-songwriter', 'emo', 'folk', 'sad', 'melancholy', 'ballad', 'melancholic'],
  'Energetic': ['edm', 'techno', 'drum and bass', 'hardstyle', 'punk', 'rock', 'hard rock', 'power metal', 'electronic'],
  'Chill/Relaxed': ['lo-fi', 'lofi', 'ambient', 'chillhop', 'bossa nova', 'jazz', 'new age', 'sleep', 'chill', 'relax', 'chillout'],
  'Angry/Intense': ['metal', 'hardcore', 'industrial', 'grunge', 'trap', 'death metal', 'thrash', 'heavy metal'],
  'Romantic/Dreamy': ['r&b', 'soul', 'indie pop', 'dream pop', 'shoegaze', 'love', 'romantic', 'rnb', 'indie'],
  'Dramatic/Epic': ['classical', 'soundtrack', 'orchestral', 'post-rock', 'cinematic', 'opera', 'film score', 'instrumental'],
  'Party/Dance': ['house', 'trance', 'reggae', 'latin', 'dancehall', 'club', 'party', 'afrobeat', 'hip-hop', 'hip hop'],
};

// ─── Helpers (copy từ lastfmService.js) ───────────────────────────────────────
function cleanYouTubeTitle(title) {
  return title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
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

function computeConfidence(youtubeTitle, lastfmTitle) {
  const a = youtubeTitle.toLowerCase().trim();
  const b = lastfmTitle.toLowerCase().trim();
  // Levenshtein đơn giản (tránh phụ thuộc npm trong test script)
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  const dist = dp[a.length][b.length];
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : Math.round((1 - dist / maxLen) * 100) / 100;
}

function mapTagsToMood(tags) {
  if (!tags || tags.length === 0) return 'Unknown';
  const scores = {};
  for (const mood of Object.keys(MOOD_MAP)) scores[mood] = 0;
  for (const tag of tags) {
    const t = tag.toLowerCase().trim();
    for (const [mood, keywords] of Object.entries(MOOD_MAP)) {
      for (const kw of keywords) {
        if (t.includes(kw) || kw.includes(t)) scores[mood]++;
      }
    }
  }
  let bestMood = 'Unknown', bestScore = 0;
  for (const [mood, score] of Object.entries(scores)) {
    if (score > bestScore) { bestScore = score; bestMood = mood; }
  }
  return bestMood;
}

// ─── Last.fm API wrapper ───────────────────────────────────────────────────────
async function callLastfm(method, params = {}) {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) throw new Error('LASTFM_API_KEY chưa được set trong .env!');

  const response = await axios.get('http://ws.audioscrobbler.com/2.0/', {
    params: { method, api_key: apiKey, format: 'json', autocorrect: 1, ...params },
    timeout: 8000,
  });

  if (response.data?.error) {
    throw new Error(`Last.fm error ${response.data.error}: ${response.data.message}`);
  }
  return response.data;
}

// ─── Step 1: track.search ─────────────────────────────────────────────────────
async function searchTrack(cleanTitle) {
  const data = await callLastfm('track.search', { track: cleanTitle, limit: 5 });
  const tracks = data?.results?.trackmatches?.track;
  if (!tracks || tracks.length === 0) return null;

  const trackList = Array.isArray(tracks) ? tracks : [tracks];
  let bestMatch = null, bestConfidence = 0;

  for (const track of trackList) {
    const c1 = computeConfidence(cleanTitle, track.name);
    const c2 = computeConfidence(cleanTitle, `${track.artist} - ${track.name}`);
    const c3 = cleanTitle.toLowerCase().includes(track.name.toLowerCase()) ? 0.7 : 0;
    const conf = Math.max(c1, c2, c3);
    if (conf > bestConfidence) { bestConfidence = conf; bestMatch = track; }
  }

  if (!bestMatch || bestConfidence < 0.3) return null;
  return { artist_name: bestMatch.artist || 'Unknown', track_name: bestMatch.name, confidence: bestConfidence };
}

// ─── Step 2: track.getTopTags ───────────────────────────────────────────────
// Lấy danh sách top tags được cộng đồng Last.fm gán cho bài hát,
// sắp xếp theo count (phổ biến nhất trước). Không cần user auth.
async function getTrackTopTags(artistName, trackName) {
  const data = await callLastfm('track.getTopTags', { artist: artistName, track: trackName });
  const rawTags = data?.toptags?.tag || [];
  const tagList = Array.isArray(rawTags) ? rawTags : [rawTags];

  // Mỗi tag có: { name, count, url } — giữ nguyên count để debug
  const tags = tagList.map(t => t.name?.toLowerCase()).filter(Boolean);
  const tagsWithCount = tagList.map(t => ({ name: t.name, count: Number(t.count) }));

  return { tags, tagsWithCount, raw_toptags: data?.toptags };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const SEPARATOR = '─'.repeat(70);
  console.log('\n' + SEPARATOR);
  console.log('  🎵  Last.fm API Test – Kiểm tra Tags & Mood Pipeline');
  console.log(SEPARATOR + '\n');

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    console.error('❌  LASTFM_API_KEY không tìm thấy trong .env!');
    process.exit(1);
  }
  console.log(`✅  API Key: ${apiKey.substring(0, 6)}${'*'.repeat(apiKey.length - 6)}\n`);

  const results = [];

  for (let i = 0; i < TEST_SONGS.length; i++) {
    const song = TEST_SONGS[i];
    console.log(`${SEPARATOR}`);
    console.log(`[${i + 1}/${TEST_SONGS.length}] INPUT: "${song.title}"`);
    console.log(`        Channel: ${song.channel}`);
    console.log(SEPARATOR);

    const result = {
      input_title: song.title,
      input_channel: song.channel,
      clean_title: null,
      search_result: null,
      track_info: null,
      tags: [],
      mood: 'Unknown',
      error: null,
    };

    try {
      // Step 1: Clean title
      const cleanTitle = cleanYouTubeTitle(song.title);
      result.clean_title = cleanTitle;
      console.log(`  🧹  Clean title  : "${cleanTitle}"`);

      // Step 2: Search on Last.fm
      console.log(`  🔍  track.search → searching...`);
      const searchResult = await searchTrack(cleanTitle);

      if (!searchResult) {
        console.log(`  ⚠️   track.search → No match (confidence < 0.3)`);
        result.mood = 'Unknown (no search match)';
        results.push(result);
        console.log('');
        continue;
      }

      result.search_result = searchResult;
      console.log(`  ✅  track.search → artist: "${searchResult.artist_name}", track: "${searchResult.track_name}", confidence: ${searchResult.confidence}`);

      // Step 3: getTopTags → tags (sorted by community count)
      console.log(`  📋  track.getTopTags → fetching top tags...`);
      const { tags, tagsWithCount, raw_toptags } = await getTrackTopTags(searchResult.artist_name, searchResult.track_name);

      result.tags = tags;

      console.log(`  🏷️   toptags (raw): ${JSON.stringify(raw_toptags)}`);
      console.log(`  🏷️   tags+count   : ${tagsWithCount.slice(0, 5).map(t => `${t.name}(${t.count})`).join(', ') || '(rỗng!)'}`);
      console.log(`  🏷️   tags (parsed): [${tags.join(', ') || '(rỗng!)'}]`);

      // Step 4: Map mood
      const mood = mapTagsToMood(tags);
      result.mood = mood;
      console.log(`  🎭  Mood         : ${mood}`);

    } catch (err) {
      result.error = err.message;
      console.error(`  ❌  Lỗi: ${err.message}`);
    }

    results.push(result);
    console.log('');

    // Delay nhỏ để không bị rate-limit
    if (i < TEST_SONGS.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  // ─── Tổng kết ─────────────────────────────────────────────────────────────
  console.log(SEPARATOR);
  console.log('  📊  TÓM TẮT KẾT QUẢ');
  console.log(SEPARATOR);
  console.log('');

  const tableData = results.map((r, i) => ({
    '#': i + 1,
    'Input Title': r.input_title.substring(0, 35) + (r.input_title.length > 35 ? '…' : ''),
    'Artist Found': r.search_result?.artist_name || '(không tìm thấy)',
    'Tags Count': r.tags.length,
    'Tags Sample': r.tags.slice(0, 3).join(', ') || '(rỗng)',
    'Mood': r.mood,
    'Error': r.error || '',
  }));

  console.table(tableData);

  // Chẩn đoán
  const withTags = results.filter(r => r.tags.length > 0).length;
  const withNoTags = results.filter(r => r.tags.length === 0 && !r.error && r.search_result).length;
  const noMatch = results.filter(r => !r.search_result && !r.error).length;
  const withErrors = results.filter(r => r.error).length;

  console.log('\n📌  PHÂN TÍCH:');
  console.log(`  ✅  Có tags đầy đủ   : ${withTags}/${results.length} bài`);
  console.log(`  ⚠️   Tìm thấy nhưng tag rỗng: ${withNoTags}/${results.length} bài`);
  console.log(`  ❌  Không tìm thấy   : ${noMatch}/${results.length} bài`);
  console.log(`  💥  Lỗi API          : ${withErrors}/${results.length} bài`);

  if (withNoTags > 0) {
    console.log('\n🔎  KẾT LUẬN: Một số bài tìm thấy trên Last.fm nhưng toptags trả về rỗng.');
    console.log('    → Đây là thực tế của Last.fm: không phải tất cả track đều được cộng đồng tag.');
    console.log('    → Xem xét dùng artist.getTopTags hoặc tag.getTopTracks để fallback.');
  } else if (withTags === results.length) {
    console.log('\n✅  KẾT LUẬN: Tất cả bài hát đều có tags → pipeline hoạt động đúng.');
    console.log('    → Nếu hệ thống vẫn trả mood=Unknown, có thể do Redis cache đang cache kết quả cũ (rỗng).');
  } else {
    console.log('\n⚠️  KẾT LUẬN HỖN HỢP: Một số tags có, một số không.');
  }

  console.log('\n' + SEPARATOR + '\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
