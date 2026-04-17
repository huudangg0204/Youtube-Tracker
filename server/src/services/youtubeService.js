const axios = require('axios');
const { cacheGet } = require('../db/redis');
const { createClient } = require('@supabase/supabase-js');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

/**
 * Cạo chi tiết Data từ Youtube API và lưu vĩnh viễn Metadata vào Supabase.
 * Hàm này dùng để tạo tệp Dataset huấn luyện AI sau này.
 */
async function getRichMetadataAndPersist(videoId) {
  try {
    // 1. Kiểm tra xem Video ID đã có trong CSDL Supabase chưa
    const { data: existing } = await supabase.from('videos').select('video_id').eq('video_id', videoId).single();
    if (existing) return; // Đã từng cạo rồi, bỏ qua cho nhẹ API.

    // 2. Fetch full Snippet và ContentDetails từ Google
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'snippet,contentDetails', id: videoId, key: YOUTUBE_API_KEY },
    });

    const item = response.data.items?.[0];
    if (!item) return;

    const { title, channelTitle, categoryId, tags } = item.snippet;
    const durationIso = item.contentDetails.duration; // "PT4M13S"

    // Map một vài category tiêu biểu
    const catMap = { '10': 'Music', '24': 'Entertainment', '22': 'People & Blogs', '20': 'Gaming' };
    const categoryName = catMap[categoryId] || 'Unknown';

    // 3. Ghi trực tiếp xuống Supabase
    const { error } = await supabase.from('videos').insert([{
      video_id: videoId,
      title,
      artist: channelTitle,
      category_id: categoryId,
      category_name: categoryName,
      duration_iso: durationIso,
      tags: tags || []
    }]);

    if (error) {
      console.error('[YoutubeService] Supabase insert error:', error.message);
    } else {
      console.log(`[Supabase] Metadata ingested for AI Dataset: ${videoId} (${title})`);

      // Fire & Forget: Enrich audio features (mood, genre) qua Deezer + ReccoBeats
      const { enrichVideoAudioFeatures } = require('./musicMetadataService');
      enrichVideoAudioFeatures(videoId, title, channelTitle).catch(err => {
        console.warn('[MusicMeta] Enrichment failed (non-blocking):', err.message);
      });
    }
  } catch (error) {
    console.warn('[YoutubeService] Ignore error ingesting rich metadata:', error.message);
  }
}

/**
 * Láy thông tin chi tiết video YouTube.
 * Cache Redis 24h để tiết kiệm quota YouTube Data API.
 *
 * @param {string} videoUrl - Full YouTube URL (https://www.youtube.com/watch?v=...)
 * @returns {{ title, artist, url, category, isMusic, videoId }}
 */
async function getYouTubeVideoDetails(videoUrl) {
  try {
    const videoId = new URL(videoUrl).searchParams.get('v');
    if (!videoId) throw new Error('Invalid YouTube URL');

    const cacheKey = `yt_vid_${videoId}`;

    const videoDetails = await cacheGet(cacheKey, async () => {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          part: 'snippet',
          id: videoId,
          key: YOUTUBE_API_KEY,
        },
      });

      const item = response.data.items?.[0];
      if (!item) throw new Error('Video not found');

      const { title, channelTitle, categoryId } = item.snippet;
      return {
        videoId,
        title,
        artist: channelTitle,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        categoryId,
        category: categoryId === '10' ? 'Music' : 'Other',
        isMusic: categoryId === '10',
      };
    });

    return videoDetails;
  } catch (error) {
    console.error('[YoutubeService] Error fetching video details:', error.message);
    throw error;
  }
}

/**
 * Kiểm tra xem video có phải nhạc (category 10) hay không.
 * Cache Redis 24h.
 *
 * @param {string} videoId - YouTube video ID
 * @returns {boolean}
 */
async function checkVideoCategory(videoId) {
  try {
    const cacheKey = `yt_vid_${videoId}`;

    const data = await cacheGet(cacheKey, async () => {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          part: 'snippet',
          id: videoId,
          key: YOUTUBE_API_KEY,
        },
      });

      const item = response.data.items?.[0];
      if (!item) return null;

      const { title, channelTitle, categoryId } = item.snippet;
      return {
        videoId,
        title,
        artist: channelTitle,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        categoryId,
        category: categoryId === '10' ? 'Music' : 'Other',
        isMusic: ['10', '22', '24'].includes(categoryId), // Cho phép Music(10), Blogs(22), Entertainment(24)
      };
    });

    return ['10', '22', '24'].includes(data?.categoryId);
  } catch (error) {
    console.error('[YoutubeService] Error checking video category:', error.message);
    throw error;
  }
}

module.exports = { getYouTubeVideoDetails, checkVideoCategory, getRichMetadataAndPersist };