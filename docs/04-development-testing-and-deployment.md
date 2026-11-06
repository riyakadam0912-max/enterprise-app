# Development, testing, and deployment

This guide is the operational path from a clean checkout to a maintainable change and an evidence-based deployment.

**Contents:** [Prerequisites](#prerequisites) · [Install](#installation) · [Environment](#environment-variables) · [Database](#database-setup) · [Run](#local-development) · [Change a feature](#changing-or-adding-a-feature) · [Test](#testing-and-quality-checks) · [Deploy](#deployment) · [Operations](#operations-backup-and-rollback)

**Related:** [Architecture](02-architecture-and-codebase.md) · [Module reference](03-modules-apis-and-data.md) · [Troubleshooting](05-troubleshooting-and-handover.md)

## Prerequisites

| Tool | Required | Evidence |
|---|---|---|
| Node.js 20.19.4+ | Yes | Mobile package engine; also satisfies current Next/Nest tooling |
| npm 9+ | Yes | Mobile package engine and checked-in npm lockfiles |
| PostgreSQL | Yes | Prisma provider and `DATABASE_URL` examples |
| Git | Recommended | Source and migration history |
| Redis | No | Only optional queues/shared auth throttling |
| Android Studio/Xcode or Expo Go/development build | Only for native testing | Expo application |

Use the lockfiles and `npm install`/`npm ci`; do not mix package managers without intentionally replacing lockfiles.

## Installation

From the repository root:

```powershell
npm install
npm --prefix api install
npm --prefix web install
npm --prefix app install
Copy-Item api/.env.example api/.env
```

There is no checked-in `web/.env.example`. The web defaults to same-origin `/api/v1` and its development launcher defaults the proxy to `http://127.0.0.1:3000`. Create `web/.env.local` only to override documented web values. This corrects older documentation that claimed every package had an environment template.

Do not copy repository `.env` files into another environment or commit secrets. The tracked examples are the only documentation source intended for copying.

## Environment variables

### Core API

| Name | Purpose | Safe local example / rule |
|---|---|---|
| `NODE_ENV` | Selects development/test/production safety behavior | `development` |
| `DATABASE_URL` | PostgreSQL connection used by Prisma | `postgresql://postgres:postgres@localhost:5432/enterprise_db` |
| `PORT`, `HOST` | API listener | `3000`, `0.0.0.0` locally |
| `FRONTEND_URL`, `FRONTEND_URLS` | Allowed browser origins and generated links | `http://localhost:3001`; comma-separated extras |
| `FRONTEND_ORIGIN`, `FRONTEND_ORIGINS` | Legacy/alternate origin names still read by configuration | Match frontend values if used |
| `JWT_ACCESS_SECRET` | Access-token signature | Unique random value, at least 32 random bytes in production |
| `JWT_REFRESH_SECRET` | Refresh-token signature | Different unique random value |
| `JWT_ISSUER`, `JWT_AUDIENCE` | Token validation boundaries | `http://localhost:3000`, `enterprise-api` |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Token/session lifetimes | Example template: `1d`, `7d`; review production risk |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `COOKIE_DOMAIN` | Browser cookie transport | Local secure=false; production topology determines values |
| `TRUSTED_PROXY_CIDRS` | Exact trusted reverse-proxy networks for client IP | Empty for direct local use; never blanket-trust proxies |
| `CRON_SECRET` | Authenticates attendance cron calls | Random secret; never expose to browser |
| `ATTENDANCE_FLEXIBLE_TASK_CUTOVER_DATE` | Data boundary for flexible task-work calculation | Set only from a reviewed migration/rollout decision |

`api/src/config/env.ts` validates production settings. Production secrets must not use example placeholders, and access/refresh secrets must be distinct.

### Optional infrastructure

| Name | Purpose | Safe default |
|---|---|---|
| `REDIS_ENABLED` | Enables legacy/optional Redis connection paths | `false` |
| `REDIS_QUEUE_ENABLED` | Enables deal queue when Redis exists | `false` |
| `RATE_LIMIT_REDIS_URL`, `REDIS_URL` | Shared auth counter/queue TCP URLs | Omit locally; use `rediss://…` in production |
| `REDIS_HOST`, `REDIS_PORT` | Legacy Redis location | `127.0.0.1`, `6379` only if enabled |
| `WEBSOCKET_ENABLED` | Enables process-local Socket.IO gateways | `false`, especially on Vercel |
| `FILE_STORAGE_PROVIDER` | Selects file provider | `local` for development, `s3` for durable production |
| `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_S3_PREFIX` | Object-store location | Non-sensitive names/prefix; template uses `assets/riya_erp` |
| `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY` | Object-store credentials | Secret manager only |
| `EMAIL_PROVIDER` | Selects provider adapter | `NONE` locally |
| Provider-specific email variables | SMTP/Nodemailer, SES, SendGrid, Resend credentials/from address | Use the names in `api/.env.example`; secret manager only |
| `COMPANY_*` | Email branding and support details | Non-sensitive development labels/URLs/colors |
| `WEB_APP_URL` | Client invitation base URL | Production web origin |

### Web and mobile

| Name | Purpose | Safe local value |
|---|---|---|
| `API_PROXY_TARGET` | Next.js server proxy target | `http://127.0.0.1:3000` |
| `NEXT_PUBLIC_API_URL` | Browser API base | `/api/v1` (preferred same-origin default) |
| `NEXT_PUBLIC_NOTIFICATION_WS_URL` | Optional realtime origin | Empty when WebSockets are off |
| `NEXT_PUBLIC_POLLING_ENABLED` | Enables fallback polling | `true` |
| `NEXT_PUBLIC_POLLING_INTERVAL_MS` | Background polling interval | Use validated positive milliseconds |
| `NEXT_PUBLIC_POLLING_INTERVAL_ACTIVE_MS` | Active-page polling interval | Use validated positive milliseconds |
| `EXPO_PUBLIC_API_URL` | Mobile API reachable from device/emulator | LAN API URL, for example `http://192.168.1.10:3000/api/v1` |
| `EXPO_PUBLIC_NOTIFICATION_API_URL` | Optional distinct mobile notification API | Usually same as API URL |
| `EXPO_PUBLIC_ALLOW_PRODUCTION_API_IN_DEV` | Explicit override for risky development target | `false` |

All `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` values are client-visible; never place secrets in them.

### Test and production bootstrap

Tests use `.env.test` based on `api/.env.test.example`; integration suites require explicit variables such as `TEST_AUDIT_DATABASE_URL`, `TEST_RATE_LIMIT_DATABASE_URL`, and `TEST_RATE_LIMIT_REDIS_URL` and may skip without them.

Production bootstrap reads `BOOTSTRAP_SUPER_ADMIN_EMAIL`, `BOOTSTRAP_SUPER_ADMIN_PASSWORD`, optional organization-admin credentials, and organization code/name/slug/timezone/currency variables. Passwords must be supplied out of source control.

## Database setup

Create an empty PostgreSQL database, configure `DATABASE_URL`, then:

```powershell
npm run prisma:generate
npm --prefix api run prisma:validate
npm run prisma:migrate
npm --prefix api run seed
```

`prisma:migrate` applies existing migrations with `prisma migrate deploy`. For a new schema change during development, use Prisma's migration creation workflow deliberately from `api/`, inspect the SQL, and then commit both schema and migration. There is no root script that creates a development migration.

The development seed is not documented as safe for a shared production database. For production initialization:

```powershell
$env:NODE_ENV = 'production'
# Set DATABASE_URL and BOOTSTRAP_* through the deployment secret system.
npm --prefix api run seed:production
```

The production seed checks environment and placeholders, is designed to be idempotent, and avoids destructive reset. Still back up a populated database and rehearse the exact release in staging.

## Local development

Start API and web together:

```powershell
npm run dev
```

Useful alternatives:

| Command | Use |
|---|---|
| `npm run dev:clean` | Kill expected dev ports, then restart |
| `npm run dev:api` | API only |
| `npm run dev:web` | Web only; proxy still needs an API target |
| `npm --prefix api run start:debug` | Nest debugger/watch mode |
| `npm --prefix app run start:lan` | Expo on LAN for a physical device |
| `npm --prefix app run android` / `ios` | Launch platform target |
| `npm run kill:ports` | Stop processes on repository dev ports; inspect script before use on shared machines |

Expected endpoints:

- API root: `http://localhost:3000/api/v1`
- API health: `http://localhost:3000/health`
- Development Swagger: `http://localhost:3000/api`
- Web: `http://localhost:3001`

## Changing or adding a feature

Use this sequence to avoid a UI-only or unscoped change:

1. **Define the business rule.** Identify actors, tenant/unit boundary, ownership, statuses, transitions, validation, failure behavior, audit needs, and deletion semantics.
2. **Change data safely.** Update `api/prisma/schema.prisma`, create and inspect a new migration, regenerate Prisma, and decide indexes and relational deletion.
3. **Implement API.** Add DTOs, service rules, controller endpoints, module registration, guards/permissions, scope filters, audit, cache invalidation, and events/notifications as required.
4. **Add tests.** Cover permission and cross-tenant denial, state transitions, validation, concurrency/date boundaries, and the happy path.
5. **Implement clients.** Add the shared API method and query/mutation hook before the page. Include accessible labels, loading, empty, error, success, and permission states.
6. **Connect navigation.** Add role/permission-aware menus and deep-link behavior. Add mobile only when product scope requires it.
7. **Validate end to end.** Test screen → proxy/client → controller → service → PostgreSQL and resulting audit/notification/file behavior.

Representative locations:

```text
api/src/projects/                 API controller, service, DTOs, tests
web/src/lib/ or web/src/api/      shared web transport/modules (follow current neighbor)
web/app/dashboard/projects/       web routes
app/src/api/ and app/app/         mobile transport and routes
```

The web code has incremental patterns and some legacy duplication. Prefer the current shared API/query/form components already used by the nearest recently maintained module; do not introduce a third pattern.

## Testing and quality checks

| Command | What it runs |
|---|---|
| `npm run typecheck` | TypeScript checks for API, web, and mobile |
| `npm run lint` | ESLint for all three packages |
| `npm test` | Unit/package tests for API, web, and mobile |
| `npm run test:e2e` | API e2e suite using `.env.test` |
| `npm run test:ci` | Unit/package tests followed by API e2e |
| `npm --prefix api run test:cov` | API Jest coverage |
| `npm run build` | Prisma/Nest API build then Next production build |
| `npm --prefix app run prebuild:check` | Expo Doctor |
| `npm run release:audit` | Repository release-readiness checks implemented by `scripts/release-audit.js` |
| `npm run audit:dependencies` | Critical-level npm audits for root and packages; requires registry access |

API unit tests sit beside source as `*.spec.ts`; e2e configuration is under `api/test/`. Some PostgreSQL/Redis integration specs require explicit test services. Web tests currently use the Node test runner for rich-text sanitation and UI checks. Mobile uses Jest/Expo and React Native testing utilities.

Do not run database tests against development or production data. A green unit suite does not validate provider credentials, cron scheduling, serverless persistence, or customer workflows.

## Deployment

### Supported evidence

- API and web contain Vercel/serverless configuration and adapters.
- `npm run build` builds API then web.
- API `build:vercel` generates Prisma, applies migrations through a retry wrapper, then builds Nest.
- Root `deploy.ps1` automates a repository-specific deployment path; review its target, authentication requirements, and environment before running.
- Expo EAS profiles exist for Android preview and production builds.

### Release order

1. Back up the database using the hosting provider's supported mechanism.
2. Review migration SQL, especially locks, backfills, constraints, and destructive statements.
3. Configure secrets and origins; verify API/web URLs, cookie topology, storage, email, cron, and optional infrastructure.
4. Apply migrations once using a controlled release job.
5. Run production bootstrap only when required.
6. Deploy API, then web; build mobile separately when its contract changed.
7. Check health, login/refresh/logout, organization/unit switching, one critical mutation per changed domain, audit attribution, and background delivery.

Running migrations in every concurrent serverless build can race despite retry logic. Prefer a single deployment migration step if the platform permits it.

### Host-specific constraints

| Concern | Vercel/serverless | Persistent Node host |
|---|---|---|
| WebSockets | Keep disabled; instances are ephemeral | May enable, but still process-local without an adapter |
| BullMQ workers | Disabled | May enable with Redis and worker supervision |
| Local file storage | Not durable | Durable only if host volume lifecycle is managed; S3 preferred |
| Cron | Platform schedule calls secret endpoint | External scheduler/process can call endpoint |
| In-memory cache | Per instance | Per process; still not shared across replicas |

## Operations, backup, and rollback

The repository does **not** contain a verified backup schedule, restore drill, recovery-time objective, recovery-point objective, or provider-specific rollback runbook. These are handover blockers for production operations, not application commands to improvise.

Minimum owner actions:

- Enable encrypted automated PostgreSQL backups and point-in-time recovery with the database provider.
- Document and test restore into an isolated environment.
- Version object storage or define file recovery separately from database recovery.
- Retain deployment artifacts and record which commit/migration set is live.
- Make schema changes backward compatible when possible. Rolling application code back does not reverse a migration.
- For a necessary database rollback, write and review a forward repair migration or provider restore plan; never use `prisma migrate reset` on production.

[← Modules, APIs, and data](03-modules-apis-and-data.md) · [Next: Troubleshooting and handover →](05-troubleshooting-and-handover.md)
