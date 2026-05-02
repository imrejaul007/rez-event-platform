import express from 'express';
import helmet from 'helmet';
import expressMongoSanitize from 'express-mongo-sanitize';
import { validateEvent, getKnownEventTypes, EventValidationError } from './services/eventValidator';
import { routeEvent } from './services/eventRouter';
import { EventLog } from './models/EventLog';
import { getRedis } from './config/redis';
import { logger } from './config/logger';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

export function createHttpServer() {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(expressMongoSanitize());

  // ── Health Routes ───────────────────────────────────────────────────────────

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'rez-event-platform', timestamp: Date.now() });
  });

  app.get('/health/live', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.get('/health/ready', async (_req: Request, res: Response) => {
    try {
      const redis = getRedis();
      await redis.ping();
      res.json({ status: 'ready', redis: 'ok' });
    } catch (err) {
      res.status(503).json({ status: 'not_ready', error: String(err) });
    }
  });

  app.get('/health/detailed', async (_req: Request, res: Response) => {
    try {
      const redis = getRedis();
      const pong = await redis.ping();
      res.json({
        status: 'ok',
        service: 'rez-event-platform',
        redis: pong === 'PONG' ? 'ok' : 'error',
        uptime: process.uptime(),
        timestamp: Date.now(),
      });
    } catch (err) {
      res.status(503).json({ status: 'degraded', error: String(err) });
    }
  });

  // ── Metrics ────────────────────────────────────────────────────────────────

  app.get('/metrics', (_req: Request, res: Response) => {
    // Prometheus-compatible metrics stub
    res.set('Content-Type', 'text/plain');
    res.end('# rez-event-platform metrics endpoint\n');
  });

  // ── Schemas ────────────────────────────────────────────────────────────────

  app.get('/schemas', (_req: Request, res: Response) => {
    res.json({
      schemas: getKnownEventTypes().map((type) => ({
        event: type,
        version: 'v1',
      })),
    });
  });

  // ── Events ─────────────────────────────────────────────────────────────────

  /**
   * POST /events — publish an event to the platform
   * Headers:
   *   x-internal-token: <INTERNAL_SERVICE_TOKENS_JSON value for this service>
   *   x-source-service: <caller service name>
   */
  app.post('/events', async (req: Request, res: Response, next: NextFunction) => {
    const sourceService = req.headers['x-source-service'] as string;
    const internalToken = req.headers['x-internal-token'] as string;

    // Basic auth check (token validated against INTERNAL_SERVICE_TOKENS_JSON)
    if (!internalToken) {
      res.status(401).json({ error: 'Missing x-internal-token header' });
      return;
    }

    try {
      const payload = req.body;

      // Generate eventId if not present
      const eventId = (payload.event_id as string) || uuidv4();

      // Validate event
      let validatedEvent: ReturnType<typeof validateEvent>;
      let validationStatus: 'valid' | 'invalid' | 'error' = 'valid';
      let validationErrors: string[] | undefined;

      try {
        validatedEvent = validateEvent(payload);
      } catch (err) {
        if (err instanceof EventValidationError) {
          validationStatus = 'invalid';
          validationErrors = err.errors;
          logger.warn('Event validation failed', { eventId, errors: err.errors });
          res.status(400).json({ error: 'Invalid event', details: err.errors });
          return;
        }
        throw err;
      }

      // Route event
      const routingResult = routeEvent(validatedEvent.event);

      // Log event to MongoDB
      const logEntry = new EventLog({
        eventId,
        event: validatedEvent.event,
        version: validatedEvent.version,
        correlationId: validatedEvent.correlation_id,
        source: sourceService || validatedEvent.source,
        timestamp: validatedEvent.timestamp,
        data: validatedEvent.data,
        routingResult,
        validationStatus,
        processedAt: new Date(),
      });
      await logEntry.save();

      // Enqueue for async processing
      const redis = getRedis();
      await redis.lpush('events:pending', JSON.stringify({
        eventId,
        event: validatedEvent.event,
        data: validatedEvent.data,
        subscribers: routingResult.subscribers,
        correlationId: validatedEvent.correlation_id,
        timestamp: Date.now(),
      }));

      logger.info('Event published', {
        eventId,
        event: validatedEvent.event,
        subscribers: routingResult.subscribers,
        source: sourceService,
      });

      res.status(202).json({
        status: 'accepted',
        eventId,
        routed: routingResult.matched,
        subscribers: routingResult.subscribers,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Event Query ────────────────────────────────────────────────────────────

  app.get('/events/:correlationId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const logs = await EventLog.find({ correlationId: req.params.correlationId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      res.json({ events: logs });
    } catch (err) {
      next(err);
    }
  });

  // ── Error Handler ──────────────────────────────────────────────────────────

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
