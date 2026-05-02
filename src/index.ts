import dotenv from 'dotenv';
dotenv.config();

import { createHttpServer } from './httpServer';
import { createWorker } from './worker';
import { connectMongo } from './config/mongodb';
import { connectRedis } from './config/redis';
import { logger } from './config/logger';

const PORT = parseInt(process.env.PORT || '4008', 10);
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '4108', 10);

async function bootstrap() {
  logger.info('Starting rez-event-platform...');

  await connectMongo();
  await connectRedis();

  // Start HTTP server (receives + routes events)
  const httpServer = createHttpServer();
  httpServer.listen(PORT, () => {
    logger.info(`rez-event-platform listening on port ${PORT}`);
  });

  // Start BullMQ worker (processes event queues)
  await createWorker();

  logger.info('rez-event-platform bootstrapped successfully');
}

bootstrap().catch((err) => {
  logger.error('Failed to bootstrap', { error: err });
  process.exit(1);
});
