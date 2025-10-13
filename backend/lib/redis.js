import Redis from "ioredis";

const useTLS = (process.env.REDIS_TLS || "false").toLowerCase() === "true";

export const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT || 6379),
  username: process.env.REDIS_USERNAME || "default", // Redis 6+ ACLs
  password: process.env.REDIS_PASSWORD || undefined,
  tls: useTLS ? { servername: process.env.REDIS_HOST } : undefined,
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on("connect", () => console.log("Redis connected"));
redis.on("ready", () => console.log("Redis ready"));
redis.on("error", (e) => console.error("Redis error", e));

export async function connectRedis() {
  await redis.set("foo", "bar");
  console.log("foo =", await redis.get("foo"));
}
