import Redis from 'ioredis';
import { logger } from './logger';

let redis: Redis;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      logger.error('REDIS_URL is required');
      process.exit(1);
    }
    redis = new Redis(url, { maxRetriesPerRequest: null });
    redis.on('error', (err) => logger.error('Redis error', { error: err }));
    redis.on('connect', () => logger.info('Redis connected'));
  }
  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    logger.info('Redis disconnected');
  }
}
