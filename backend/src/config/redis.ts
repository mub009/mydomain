import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on("error", (err) => {
  logger.warn({ err }, "Redis connection error");
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (err) {
    logger.warn({ err }, "Redis unavailable, continuing without cache");
  }
}
