import { createApp } from "@/app";
import { env } from "@/config/env";
import { connectDatabase, disconnectDatabase } from "@/config/database";
import { assertPrismaClientIsCurrent } from "@/config/prismaClientCheck";
import { connectRedis, redis } from "@/config/redis";
import { logger } from "@/config/logger";

async function main(): Promise<void> {
  // Fail here rather than halfway through a request: a client generated
  // before the latest schema is missing models and enums the code uses.
  assertPrismaClientIsCurrent();

  await connectDatabase();
  await connectRedis();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      redis.disconnect();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
