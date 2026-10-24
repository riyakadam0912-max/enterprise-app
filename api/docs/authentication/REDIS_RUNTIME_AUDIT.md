# Redis runtime audit and configuration

Redis is optional. Application records and audit events live in PostgreSQL.

| Consumer | Without Redis | With configured Redis |
| --- | --- | --- |
| Production authentication limits | Shared PostgreSQL AuthRateLimitBucket | Shared Redis counters |
| Development authentication limits | In-memory counters | Shared Redis counters |
| Deal-won workflow | Runs inline | Queue only when explicitly enabled on a persistent host |
| Application cache | In-memory, five-minute default TTL | Still in-memory |
| Audit records | PostgreSQL | Still PostgreSQL |
| WebSockets | Process-local on persistent hosts; disabled on Vercel | Still no Redis broadcast adapter |

## Findings and corrections

The inspected local API environment, stored production template and Vercel env
snapshots contained no Redis URL. REDIS_ENABLED=false was expected to disable the
optional queue dependency. Phase 1 incorrectly introduced a mandatory production
Redis dependency. Production now uses the existing database when Redis is absent.

Queue imports previously inspected process.env before ConfigModule loaded .env.
A single ApplicationConfigModule now loads and validates configuration before
root and deal modules decide whether to register BullMQ. REDIS_URL alone no longer
starts workers, and explicit disablement is respected. Persistent queue workers
are always disabled on Vercel; deal workflows run inline there.

The installed BullMQ version accepts a URL connection object; that was not a bug.
The cache was and remains in memory. Its default TTL was 300 milliseconds, and is
now 300,000 milliseconds (five minutes). No Socket.IO Redis adapter is installed;
the environment template and gateway messages no longer claim one exists.

## Supported configurations

No Redis (default): leave URL variables unset, REDIS_ENABLED=false, and
REDIS_QUEUE_ENABLED=false. Production uses PostgreSQL rate counters. Migrate the
new AuthRateLimitBucket table before deploying. The Vercel build already runs
migration deployment. Missing tables/database outages return 503 for limited auth
routes; counters do not silently fall back to process-local memory.

Optional Redis for authentication: set RATE_LIMIT_REDIS_URL (preferred) or
REDIS_URL to a TCP redis:// or rediss:// connection. Queue flags may stay false.
Do not use an HTTPS REST URL. A selected Redis outage returns 503 instead of
resetting limits in another backend. The auth connection works on Vercel.

Persistent queue host: set REDIS_QUEUE_ENABLED=true and REDIS_URL. The legacy
REDIS_ENABLED=true flag is accepted when REDIS_QUEUE_ENABLED is absent. For legacy
host connections, configure REDIS_HOST and REDIS_PORT; production does not silently
choose localhost. Set REDIS_QUEUE_ENABLED=false to keep workflows inline even
when REDIS_ENABLED=true is used for authentication host configuration.

WebSockets remain separate: WEBSOCKET_ENABLED=true is suitable for one persistent
host. Multi-instance broadcasts require a separately implemented and tested
adapter; Redis flags do not provide one. WebSockets remain disabled on Vercel.

## Visibility and validation

From api:

    npm run redis:status
    npm run redis:status -- --production
    npm run redis:status -- --production --probe

The report contains backend selections, enablement reasons and configuration key
names only. It never prints Redis URLs, hosts, passwords or database credentials.
It describes the command's environment and local files, not unqueried live Vercel
settings. --probe uses PING only when a Redis connection is explicitly configured.
Startup logs state the selected authentication backend without credentials.

Run configuration, auth throttling, Redis storage, PostgreSQL storage and existing
HTTP guard tests. The optional PostgreSQL integration test requires an explicit
TEST_RATE_LIMIT_DATABASE_URL pointing at a disposable migrated database; Redis
integration requires TEST_RATE_LIMIT_REDIS_URL. No test infers production URLs.

## Verification completed on 2026-10-24

The focused configuration and authentication suite passed all 67 tests; audit and
transaction regression checks passed all 41 tests. The PostgreSQL concurrency
integration test passed against an isolated local PostgreSQL 18 instance. All 105
migrations, including AuthRateLimitBucket, applied successfully to a separate empty
test database. TypeScript, the Nest build, and Prisma schema validation passed.
These checks do not establish the migration or deployment status of production.
