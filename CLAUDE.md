# Claude Code Configuration — rez-event-platform

## Behavioral Rules
- Do what has been asked; nothing more, nothing less
- NEVER create files unless necessary
- ALWAYS read a file before editing
- NEVER commit secrets or .env files

## Architecture
- Event-driven central bus using BullMQ + Redis
- Zod schemas for event validation (source: `../SOURCE-OF-TRUTH/EVENT-SCHEMAS.md`)
- Routing table for event → subscribers (source: `../SOURCE-OF-TRUTH/ARCHITECTURE-INTEGRATION.md`)
- MongoDB for event log persistence

## Build & Test
```bash
npm run build
npm run dev
npm test
```

## Key Files
- `src/services/eventValidator.ts` — Zod schemas from EVENT-SCHEMAS.md
- `src/services/eventRouter.ts` — Routing table from ARCHITECTURE-INTEGRATION.md
- `src/httpServer.ts` — HTTP API (POST /events)
- `src/worker.ts` — BullMQ async event forwarder

## Environment Variables
- `MONGODB_URI`, `REDIS_URL`, `INTERNAL_SERVICE_TOKENS_JSON`, `SENTRY_DSN`
- `REZ_ACTION_ENGINE_URL`, `REZ_FEEDBACK_SERVICE_URL`
