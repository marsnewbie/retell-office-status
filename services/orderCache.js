
const Redis = require("ioredis");

let redisClient;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
  console.log("✅ Connected to Redis");
} else {
  console.warn("⚠️ No REDIS_URL found. Using in-memory fallback.");
}

const memoryCache = new Map();
const EXPIRE_SECONDS = 300;

function getKey(store) {
  return `order:${store}`;
}

async function setOrder(store, orderData) {
  const key = getKey(store);
  const value = JSON.stringify(orderData);
  if (redisClient) {
    await redisClient.setex(key, EXPIRE_SECONDS, value);
  } else {
    memoryCache.set(key, { value, expires: Date.now() + EXPIRE_SECONDS * 1000 });
  }
}

async function getOrder(store) {
  const key = getKey(store);
  if (redisClient) {
    const data = await redisClient.get(key);
    if (data) await redisClient.del(key);
    return data ? JSON.parse(data) : null;
  } else {
    const record = memoryCache.get(key);
    if (!record) return null;
    if (Date.now() > record.expires) {
      memoryCache.delete(key);
      return null;
    }
    memoryCache.delete(key);
    return JSON.parse(record.value);
  }
}

module.exports = { setOrder, getOrder };
