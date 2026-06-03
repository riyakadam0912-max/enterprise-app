# Startup Workflow

The dev stack now follows a strict contract.

```text
npm run dev
  -> root port precheck
  -> API boot script
  -> Prisma generate
  -> Prisma migrate deploy
  -> NestJS starts on 3000
  -> API health endpoint becomes ready
  -> WEB boot script starts
  -> Next.js starts on 3001
```

How services communicate.

1. The web app calls `/api/v1/*` and Next rewrites that traffic to `http://localhost:3000/api/v1/*`.
2. WebSocket clients connect to `http://localhost:3000` for notifications.
3. The API owns the database connection and the event bus.
4. Background processors run inside the API process when Redis is configured.

What the logs mean.

1. `[PRISMA] Client generated` means schema generation succeeded.
2. `[PRISMA] Migrations applied` means the local database schema is up to date.
3. `[DB] Connected successfully` means Prisma reached the database.
4. `[EVENTS] Event bus initialized` means the Nest event layer is live.
5. `[WEB] Backend is healthy` means the UI is allowed to start.

Common failures.

1. Port 3000 occupied: stop the conflicting process or run `npm run kill:ports`.
2. Port 3001 occupied: same remediation as above.
3. Prisma migration failure: the database server is unreachable or the schema is inconsistent.
4. Web startup timeout: the API never returned a healthy response.
5. Socket disconnects: backend CORS, host, or notification URL is misconfigured.

Operational expectations.

1. Startup should be deterministic.
2. Services should stop together when the terminal closes.
3. No service should silently switch ports.
4. Logs should make ownership and failure cause obvious.