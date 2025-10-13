import { redis } from "./redis.js";

export const cacheGet = async (key) => {
  const v = await redis.get(key);
  return v ? JSON.parse(v) : null;
};

export const cacheSet = async (key, value, ttlSeconds = 60) => {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  ttlSeconds = Number(ttlSeconds) || 0;
  if (ttlSeconds > 0) {
    await redis.set(key, str, "EX", ttlSeconds);
  } else {
    await redis.set(key, str);
  }
};

export const cacheDelPattern = async (pattern) => {
  const stream = redis.scanStream({ match: pattern, count: 500 });
  const batch = [];
  await new Promise((resolve, reject) => {
    stream.on("data", async (keys) => {
      if (!keys.length) return;
      batch.push(...keys);
      if (batch.length >= 500) {
        const chunk = batch.splice(0, batch.length);
        await redis.del(...chunk);
      }
    });
    stream.on("end", async () => {
      if (batch.length) await redis.del(...batch);
      resolve();
    });
    stream.on("error", reject);
  });
};

export const cacheKeyFromReq = (req, prefix) =>
  `${prefix}:${req.originalUrl.replace(/\W+/g, ":")}`.toLowerCase();
