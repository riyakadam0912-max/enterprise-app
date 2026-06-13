# Environment Setup

This repo uses three environment layers.

1. Root `.env` for shared development defaults and orchestration values.
2. `api/.env` for backend-specific runtime settings.
3. `web/.env.local` for frontend build-time client variables.

Backend variables.

1. `DATABASE_URL` is required.
2. `PORT` is standardized to 3000.
3. `FRONTEND_URL` and related aliases are used for CORS and links.
4. `REDIS_HOST` and `REDIS_PORT` enable queue-backed processors when Redis is available.
5. JWT secrets are present for local development defaults.

Frontend variables.

1. `NEXT_PUBLIC_API_URL` defaults to `/api/v1` and is rewritten to the backend.
2. `NEXT_PUBLIC_NOTIFICATION_WS_URL` defaults to `http://localhost:3000`.

Validation.

1. The backend validates its environment on startup through a Nest config validator.
2. The frontend validates public env variables through a Zod schema.
3. Invalid or missing config fails fast instead of producing partial startup behavior.

Practical guidance.

1. Keep the same database URL in the root and backend env files during local development.
2. Do not change the fixed ports unless you also update the orchestrator, rewrite, and docs together.
3. When moving to Docker, map the same 3000/3001 contract instead of changing the app internals.