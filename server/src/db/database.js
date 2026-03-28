/**
 * db/database.js
 *
 * PostgreSQL / Sequelize đã được thay thế hoàn toàn bằng InfluxDB v3 Core.
 * File này được giữ lại dưới dạng compatibility stub để không phá vỡ
 * các import cũ mà chưa kịp cập nhật. Nó re-export từ influx.js.
 *
 * KHÔNG khởi tạo PostgreSQL connection hay Sequelize ở đây nữa.
 */

const { writePlaybackEvent, getInfluxClient } = require('./influx');

module.exports = {
  writePlaybackEvent,
  getInfluxClient,
  // initializeDb là no-op để tránh lỗi nếu code cũ vẫn gọi
  initializeDb: async () => {
    console.log('[DB] PostgreSQL/Sequelize đã được xóa. Dùng InfluxDB v3 Core thay thế.');
  },
};