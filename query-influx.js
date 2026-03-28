require('dotenv').config();
const { InfluxDBClient } = require('@influxdata/influxdb3-client');

const client = new InfluxDBClient({
  host: process.env.INFLUXDB_HOST,
  token: process.env.INFLUXDB_TOKEN,
  database: process.env.INFLUXDB_DATABASE,
});

async function main() {
  console.log(`📡 Kết nối → ${process.env.INFLUXDB_HOST} / db: ${process.env.INFLUXDB_DATABASE}\n`);

  // Query 20 event gần nhất
  const sql = `
    SELECT time, user_id, video_id, event_type, ms_played, playback_rate
    FROM playback_events
    ORDER BY time DESC
    LIMIT 20
  `;

  console.log('📊 20 playback events gần nhất:\n');
  console.log('─'.repeat(80));

  const result = await client.query(sql, process.env.INFLUXDB_DATABASE);

  let count = 0;
  for await (const row of result) {
    count++;
    const time = new Date(Number(row.time) / 1_000_000).toISOString();
    console.log(`[${count}] ${time}`);
    console.log(`    user_id   : ${row.user_id}`);
    console.log(`    video_id  : ${row.video_id}`);
    console.log(`    event     : ${row.event_type}`);
    console.log(`    ms_played : ${row.ms_played}ms (${(row.ms_played / 1000).toFixed(1)}s)`);
    console.log(`    rate      : x${row.playback_rate}`);
    console.log('─'.repeat(80));
  }

  if (count === 0) {
    console.log('⚠️  Không có dữ liệu. Thử chạy node test-track.js trước.');
  } else {
    console.log(`\n✅ Tổng: ${count} event`);
  }

  await client.close();
}

main().catch(console.error);
