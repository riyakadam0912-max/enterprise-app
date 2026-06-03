# Development Setup

The monorepo now starts from the root with one command:

```bash
npm run dev
```

That command performs three things in a predictable order.

1. It checks that ports 3000 and 3001 are free.
2. It starts the API and WEB services with labeled terminal output.
3. The web app waits for the API health endpoint before booting Next.js.

Service ownership is fixed.

1. API: port 3000.
2. WEB: port 3001.
3. No silent fallback ports are allowed.

Startup sequence.

1. `api/scripts/dev.js` validates the port, runs Prisma generate, applies migrations, and starts NestJS in watch mode.
2. `web/scripts/dev.mjs` validates port 3001, waits for `http://127.0.0.1:3000/api/v1/health`, then starts Next.js.
3. The root orchestrator keeps both services attached and exits them together on `SIGINT` or `SIGTERM`.

Redis-backed queues are optional in local development.

1. Leave `REDIS_ENABLED=false` for a clean API startup without Redis.
2. Set `REDIS_ENABLED=true` and configure `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT` when you want BullMQ jobs locally.

Useful commands.

1. `npm run dev` starts the full stack.
2. `npm run dev:clean` kills ports 3000 and 3001, then starts again.
3. `npm run kill:ports` frees both dev ports without starting anything.
4. `npm run typecheck` validates both packages.

Troubleshooting.

1. If the API fails on port 3000, use `npm run kill:ports` or identify the blocking PID from the error output.
2. If the web app waits forever, the backend is not healthy yet or Prisma/database startup failed.
3. If Prisma migrate fails, check `DATABASE_URL` and whether the local database is running.
4. If sockets do not connect, confirm the API is running and `NEXT_PUBLIC_NOTIFICATION_WS_URL` points to port 3000.

Notes for Docker readiness.

1. The port map is explicit and stable.
2. Health checks are exposed through the API `/health` endpoint.
3. Environment variables are split by service boundary.
4. Prisma generation and migration are part of the backend startup path.