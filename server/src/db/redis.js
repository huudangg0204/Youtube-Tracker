const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');

// Load .env
const serverEnvPath = path.resolve(__dirname, '..', '..', '.env');
const rootEnvPath = path.resolve(__dirname, '..', '..', '..', '.env');
require('dotenv').config({ path: fs.existsSync(serverEnvPath) ? serverEnvPath : rootEnvPath });

let redisClient = null;

/**
 * Lấy Redis client (lazy singleton, auto-connect).
 * @returns {Promise<import('redis').RedisClientType>}
 */
async function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = createClient({ url: redisUrl });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log(`[Redis] Connected → ${redisUrl}`);
    });

    await redisClient.connect();
  }
  return redisClient;
}

/**
 * Cache-first get: lấy từ Redis, nếu không có thì gọi fetchFn và cache lại.
 * @param {string} key          - Redis key
 * @param {Function} fetchFn    - Async function trả về dữ liệu thực
 * @param {number} ttlSeconds   - TTL tính theo giây (mặc định 24h)
 */
async function cacheGet(key, fetchFn, ttlSeconds = 86400) {
  const redis = await getRedisClient();

  const cached = await redis.get(key);
  if (cached !== null) {
    return JSON.parse(cached);
  }

  console.log(`[Redis] Cache MISS → ${key} – fetching from source...`);
  const data = await fetchFn();

  if (data !== null && data !== undefined) {
    await redis.set(key, JSON.stringify(data), { EX: ttlSeconds });
  }

  return data;
}

module.exports = { getRedisClient, cacheGet };
