/**
 * model/song.js – DEPRECATED
 *
 * Sequelize Song model đã bị xóa cùng với PostgreSQL.
 * File này được giữ làm stub để tránh lỗi import nếu có code chưa cập nhật.
 *
 * Dữ liệu bài nhạc giờ được lưu dưới dạng Time-Series trong InfluxDB v3 Core:
 *   Measurement: playback_events
 *   Tags: user_id, video_id, event_type
 *   Fields: ms_played, playback_rate
 */
console.warn('[DEPRECATED] model/song.js – PostgreSQL/Sequelize đã bị xóa. Dùng InfluxDB v3 Core.');
module.exports = null;