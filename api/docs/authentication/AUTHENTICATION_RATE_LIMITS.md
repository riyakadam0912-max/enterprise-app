# Authentication rate limits

All limits are per client IP and endpoint. Window and block duration are both
60,000 milliseconds (one minute). Exceeding the limit returns HTTP 429 with
Retry-After in seconds; blocked requests do not extend the block.

| Endpoint | Requests per minute | Block duration |
| --- | --- | --- |
| POST /api/v1/auth/bootstrap-admin | 1 | 60 seconds |
| POST /api/v1/auth/bootstrap-super-admin | 1 | 60 seconds |
| POST /api/v1/auth/login | 5 | 60 seconds |
| POST /api/v1/auth/reset-password | 5 | 60 seconds |
| POST /api/v1/auth/forgot-password | 5 | 60 seconds |
| POST /api/v1/auth/refresh | 5 | 60 seconds |
| POST /api/v1/auth/logout | 20 | 60 seconds |

Other authenticated profile, registration, password-change, current-user and
logout-all routes retain their existing guards and have no rate-limit policy.
The shared default is not a global guard.

## Storage and production configuration

Redis is optional. With no Redis connection, production uses atomic PostgreSQL
counters in AuthRateLimitBucket, shared across API instances. Development and test
use memory when Redis is absent. Apply the AuthRateLimitBucket migration before
deploying the updated API; the existing build:vercel command deploys migrations.

A configured RATE_LIMIT_REDIS_URL takes precedence over REDIS_URL. Explicit legacy
REDIS_ENABLED=true can use REDIS_HOST/REDIS_PORT; production requires an explicit
host. URLs must use redis:// or rediss://, not HTTPS REST endpoints. The dedicated
rate-limit URL does not enable queues. Production never uses process-local limits.

Both PostgreSQL and Redis use atomic fixed-window counters and full one-minute
blocks. PostgreSQL housekeeping removes expired buckets in bounded batches during
requests; Redis keys expire automatically. Counter keys contain hashed route/client
identities. A selected backend outage returns HTTP 503 and does not switch stores
or reset quotas. No extra package or external Redis service is required.

Run npm run redis:status to see configured consumers. --production reads the local
production configuration; --probe additionally checks a configured Redis connection.
This command never prints URLs or credentials and does not change deployment env.
See [Redis runtime audit](./REDIS_RUNTIME_AUDIT.md) for cache, queues and WebSockets.

## Client IP and proxies

Outside Vercel, the guard uses Express's resolved IP or the socket peer and ignores
caller-provided forwarding headers. Express proxy trust remains disabled by
default. Persistent hosts behind a reverse proxy must configure explicit trusted
proxy addresses/subnets using TRUSTED_PROXY_CIDRS (comma-separated CIDRs) and
restrict direct origin access. An empty value keeps proxy trust disabled. Never enable blanket
proxy trust or trust a caller-selected leftmost X-Forwarded-For value.

On Vercel (VERCEL=1), the guard accepts a single valid IP from the platform-managed
x-vercel-forwarded-for header. Invalid values fall back to the resolved/socket IP.
It never falls back to arbitrary x-forwarded-for values.
See [Vercel request headers](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for).

## Verification

From api, run:

- npm test -- --runInBand auth-throttling.spec.ts vercel-throttler.guard.spec.ts redis-throttler.storage.spec.ts
- npm run typecheck

HTTP tests cover all seven limited endpoints, full block duration, recovery,
independent route budgets, and spoofed forwarding headers. Storage tests cover
failure handling, connection lifecycle, and production configuration.
For actual cross-instance Redis verification, set TEST_RATE_LIMIT_REDIS_URL to a
disposable Redis URL and run npm test -- --runInBand redis-throttler.integration.spec.ts.
This integration test is skipped when its explicit test URL is absent.
For PostgreSQL, set TEST_RATE_LIMIT_DATABASE_URL to a disposable migrated database
and run npm test -- --runInBand postgres-throttler.integration.spec.ts.
