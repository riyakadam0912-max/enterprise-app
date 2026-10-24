# Attendance request DEP0169 warning audit

Date: 2026-10-24. Reported route: `/api/v1/attendance/today`.

## Finding

The supplied entries contain Node's DEP0169 deprecation warning. They do not contain
an HTTP status, exception or stack identifying an attendance failure. Node documents
legacy URL parsing as deprecated and recommends the WHATWG URL API:
https://nodejs.org/api/deprecations.html#dep0169-insecure-urlparse

No direct `url.parse()` call was found in application source. A confirmed reachable
call exists during application initialization when Redis-backed authentication
throttling receives a URL. The serverless handler initializes the entire Nest app,
so an initialization warning can be attributed to whichever request starts it.
The supplied logs alone cannot establish that this is their only source, or confirm
which backend is configured in the deployed environment.

Local reproduction used synthetic credentials and lazy connection, without any
network request or access to deployed secrets. Intercepting `node:url.parse` showed:

```text
url.parse
  ioredis/built/utils/index.js:205 parseURL
  ioredis/built/Redis.js:621 parseOptions
  new Redis
```

Authentication created `new Redis(connection.url, options)`. The diagnostic probe
used the same pattern. Queue setup also passed the unresolved `{ url }` configuration
instead of explicit connection fields. Other dependencies contain legacy parser
calls, but ordinary Express path parsing takes its fast path and the configured JWT
extractors use cookies/bearer headers rather than URL query extraction. These are
not evidence that those libraries caused the reported warnings.

## Fix

`src/config/redis-options.ts` translates Redis TCP URLs using WHATWG `URL` into
structured ioredis options. All three application consumers now use that helper.
It preserves decoded ACL/password authentication, TLS for `rediss:`, explicit ports,
database selection, IPv6 and existing query options. URL fields take precedence over
query fields. Invalid ports, database numbers, credential encoding and prototype
query keys produce a credential-free configuration error.

No dependencies were patched and warnings were not suppressed. Authentication's
lazy connection, timeout, retry and offline-queue settings are preserved. No
attendance calculation, database schema or production data changed.

## Verification and deployment

Regression tests construct the real lazy ioredis client and production throttle
factory with legacy `url.parse()` replaced by a throwing test spy. This proves those
paths no longer invoke that parser without contacting a Redis server. Additional
tests cover TLS, encoded credentials, IPv6, URL/query precedence, database selection,
invalid configuration and credential redaction. TypeScript checking passed.

Validation: **7 suites, 175 tests passed**, with Node's `--throw-deprecation` enabled:

```text
node --throw-deprecation node_modules/jest/bin/jest.js --runInBand --silent redis-options.spec.ts redis.spec.ts redis-throttler.storage.spec.ts env.spec.ts application-config.module.spec.ts attendance.service.spec.ts attendance-time.utils.spec.ts
node node_modules/typescript/bin/tsc --noEmit
```

The storage-unavailable log messages in test output are expected failure-path
fixtures; the ts-jest configuration warning is an existing tooling warning.

Redeploy the API with these changes, exercise authenticated attendance requests and
check fresh logs. This workspace change does not verify a deployed fix. If DEP0169
continues, temporarily enable `NODE_OPTIONS=--trace-deprecation` on the affected
deployment and inspect the full stack to identify the remaining caller. Retain
existing Node options when adding the flag; remove the tracing flag after diagnosis.
Do not disable deprecation warnings or downgrade Node to conceal the issue.
