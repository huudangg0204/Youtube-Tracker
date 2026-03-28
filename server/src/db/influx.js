const { InfluxDBClient, Point } = require('@influxdata/influxdb3-client');
const fs = require('fs');
const path = require('path');

// Load .env từ nhiều vị trí có thể
const serverEnvPath = path.resolve(__dirname, '..', '..', '.env');
const rootEnvPath = path.resolve(__dirname, '..', '..', '..', '.env');
require('dotenv').config({ path: fs.existsSync(serverEnvPath) ? serverEnvPath : rootEnvPath });

let client = null;

/**
 * Khởi tạo InfluxDB v3 Core client (lazy singleton).
 */
function getInfluxClient() {
  if (!client) {
    const host = process.env.INFLUXDB_HOST;
    const token = process.env.INFLUXDB_TOKEN;
    const database = process.env.INFLUXDB_DATABASE;

    if (!host || !token || !database) {
      throw new Error(
        'Missing InfluxDB config. Please set INFLUXDB_HOST, INFLUXDB_TOKEN, INFLUXDB_DATABASE in .env'
      );
    }

    client = new InfluxDBClient({ host, token, database });
    console.log(`[InfluxDB] Client connected → ${host} / database: ${database}`);
  }
  return client;
}

async function writePlaybackEvent({ userId, videoId, eventType, msPlayed, playbackRate = 1, timestamp, sessionId, clickSource, timeOfDay, dayOfWeek, watchDurationRatio, replayCount }) {
  const influx = getInfluxClient();
  const database = process.env.INFLUXDB_DATABASE;

  const point = Point.measurement('playback_events')
    .setTag('user_id', userId)
    .setTag('video_id', videoId)
    .setTag('event_type', eventType)
    .setTag('session_id', sessionId || 'unknown')
    .setTag('click_source', clickSource || 'direct')
    .setTag('time_of_day', timeOfDay || 'unknown')
    .setTag('day_of_week', dayOfWeek || 'unknown')
    .setIntegerField('ms_played', Math.round(msPlayed))
    .setFloatField('playback_rate', playbackRate)
    .setFloatField('watch_duration_ratio', watchDurationRatio || 0)
    .setIntegerField('replay_count', replayCount || 0)
    .setTimestamp(BigInt((timestamp || Date.now()) * 1_000_000));

  await influx.write(point, database);

  console.log(`[InfluxDB] Written → user:${userId} video:${videoId} event:${eventType} session:${sessionId?.substring(0,6) || ''}`);
}

module.exports = { getInfluxClient, writePlaybackEvent };
