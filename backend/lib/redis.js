import Redis from "ioredis";

const useTLS = (process.env.REDIS_TLS || "false").toLowerCase() === "true";

const redisConfig = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT || 6379),
  username: process.env.REDIS_USERNAME || "default",
  password: process.env.REDIS_PASSWORD || undefined,
  tls: useTLS ? { servername: process.env.REDIS_HOST } : undefined,
  enableReadyCheck: true,
  lazyConnect: false,
};

// Original Redis connection (for your existing code)
export const redis = new Redis({
  ...redisConfig,
  maxRetriesPerRequest: 2, // Keep this for your existing code
});

// BullMQ-specific Redis connection
export const redisBullMQ = new Redis({
  ...redisConfig,
  maxRetriesPerRequest: null, // BullMQ requires this to be null
});

redis.on("connect", () => console.log("Redis connected"));
redis.on("ready", () => console.log("Redis ready"));
redis.on("error", (e) => console.error("Redis error", e));

redisBullMQ.on("connect", () => console.log("BullMQ Redis connected"));
redisBullMQ.on("ready", () => console.log("BullMQ Redis ready"));
redisBullMQ.on("error", (e) => console.error("BullMQ Redis error", e));

export async function connectRedis() {
  await redis.set("foo", "bar");
  console.log("foo =", await redis.get("foo"));
}
