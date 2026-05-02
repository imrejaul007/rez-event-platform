import { Queue, Worker } from 'bullmq';
import { getRedis } from './config/redis';
import { logger } from './config/logger';

let worker: Worker;

export async function createWorker(): Promise<Worker> {
  const redis = getRedis();

  const eventQueue = new Queue('event-processing', { connection: redis as never });

  worker = new Worker(
    'event-processing',
    async (job) => {
      const { eventId, event, data, subscribers, correlationId } = job.data;

      logger.debug('Processing event job', { eventId, event, jobId: job.id });

      // Forward to each subscriber (placeholder — HTTP POST to subscriber URL)
      for (const subscriber of subscribers) {
        try {
          await forwardToSubscriber(subscriber, { eventId, event, data, correlationId });
        } catch (err) {
          logger.error('Failed to forward to subscriber', {
            subscriber,
            eventId,
            error: String(err),
          });
        }
      }

      return { processed: true, subscribers };
    },
    {
      connection: redis as never,
      concurrency: 10,
    }
  );

  worker.on('completed', (job) => {
    logger.debug('Event job completed', { jobId: job.id, event: job.data.event });
  });

  worker.on('failed', (job, err) => {
    logger.error('Event job failed', { jobId: job?.id, error: err.message });
  });

  logger.info('Event processing worker started');

  return worker;
}

async function forwardToSubscriber(subscriber: string, payload: Record<string, unknown>): Promise<void> {
  // Map subscriber name to URL (configured via env vars or service registry)
  const subscriberUrl = getSubscriberUrl(subscriber);
  if (!subscriberUrl) {
    logger.debug('No URL configured for subscriber, skipping', { subscriber });
    return;
  }

  // Use dynamic import for axios to avoid adding it as a direct dep
  const axios = (await import('axios')).default;
  await axios.post(`${subscriberUrl}/events`, payload, {
    timeout: 5000,
    headers: { 'Content-Type': 'application/json' },
  });

  logger.debug('Event forwarded to subscriber', { subscriber, url: subscriberUrl });
}

function getSubscriberUrl(subscriber: string): string | undefined {
  const urlMap: Record<string, string | undefined> = {
    'automation-service': process.env.REZ_ACTION_ENGINE_URL,
    'analytics-service': process.env.ANALYTICS_EVENTS_URL,
    'wallet-service': process.env.WALLET_SERVICE_URL,
    'insights-service': process.env.INSIGHTS_SERVICE_URL,
    'rez-gamification-service': process.env.GAMIFICATION_SERVICE_URL,
    'rez-feedback-service': process.env.REZ_FEEDBACK_SERVICE_URL,
    'copilot-ui': process.env.COPILOT_UI_URL,
    'logging-service': process.env.LOGGING_SERVICE_URL,
  };
  return urlMap[subscriber];
}

export async function closeWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    logger.info('Event worker closed');
  }
}
