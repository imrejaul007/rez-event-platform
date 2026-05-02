# rez-event-platform

Central event bus for the REZ ecosystem. Validates, routes, logs, and forwards all platform events.

## Responsibilities

1. **Schema validation** — validate all incoming events against Zod schemas (`inventory.low`, `order.completed`, `payment.success`)
2. **Routing** — route events to correct subscribers based on routing table
3. **Persistence** — log every event to MongoDB for audit/replay
4. **Async delivery** — enqueue events for async forwarding to downstream services

## Events Supported

| Event | Schema | Subscribers |
|-------|--------|-------------|
| `inventory.low` | v1 | automation, analytics, feedback |
| `order.completed` | v1 | automation, analytics, gamification |
| `payment.success` | v1 | automation, wallet, analytics |

Full routing table: `src/services/eventRouter.ts`

## API

### Publish Event
```
POST /events
x-internal-token: <token>
x-source-service: <service-name>
Content-Type: application/json

{
  "event": "inventory.low",
  "version": "v1",
  "correlation_id": "uuid-v4",
  "source": "inventory-service",
  "timestamp": 1746057600000,
  "data": { ... }
}
```

### Query Events
```
GET /events/:correlationId
```

### Schemas
```
GET /schemas
```

## Deployment

Render: `npm run build` → `node dist/index.js` (port 4008)

Auto-deploys on push to `main`.
