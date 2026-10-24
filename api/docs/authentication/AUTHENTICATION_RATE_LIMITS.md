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

## Production configuration

Set RATE_LIMIT_REDIS_URL to a Redis connection URL shared by every API instance
of the deployment. REDIS_URL is used if the dedicated URL is absent. Use separate
Redis databases or instances for production and preview environments.
The dedicated URL works with REDIS_ENABLED=false and does not enable queues.
Production startup refuses to use process-local counters when neither URL is set.
No new package is needed: the API already depends on ioredis.

Redis uses atomic fixed-window counters. Excess traffic starts a full one-minute
block. Keys expire automatically and contain hashed route/client identities.
Redis failures return HTTP 503; there is no fallback that bypasses limits.
Development/test without Redis uses Nest's in-memory rolling-window storage.

Before rollout, configure the Redis URL, allow the API host to reach Redis, and
check a disposable client IP against the deployed endpoints. Verify that a block
survives requests reaching different instances. No live deployment was changed
as part of this implementation.

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
