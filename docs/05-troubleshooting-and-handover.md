# Troubleshooting and handover

This guide records current limitations, repeatable diagnostics, significant history, maintenance priorities, and enough context to resume work without earlier conversations.

**Contents:** [Start context](#start-here-project-context) · [Known limitations](#known-limitations-and-technical-debt) · [Troubleshooting](#troubleshooting-by-symptom) · [History](#significant-history) · [Maintenance](#maintenance-guidance) · [First tasks](#first-tasks-for-an-incoming-developer) · [Open questions](#outstanding-questions-and-coverage-gaps) · [Documentation audit](#documentation-audit-record)

**Related:** [README](../README.md) · [Product guide](01-product-guide.md) · [Architecture](02-architecture-and-codebase.md) · [Module reference](03-modules-apis-and-data.md) · [Development](04-development-testing-and-deployment.md)

## Start here: project context

Enterprise ERP is a TypeScript monorepo with three packages:

- `api/`: NestJS 11 modular monolith, Prisma 5, PostgreSQL, REST under `/api/v1`.
- `web/`: Next.js 16/React 19 main client on port 3001, proxying to API port 3000 in development.
- `app/`: Expo 57/React Native mobile subset.

The most important invariants are:

1. Every tenant record and direct-object lookup must be constrained by accessible organization and, where applicable, business unit.
2. API guards plus service-level ownership/scope are security; menus and route redirects are not.
3. Browser authentication uses access/refresh cookies and persisted sessions. Production secrets, issuer, audience, cookie settings, and proxy trust must agree.
4. Many records use soft deletion, but restore and uniqueness behavior is module-specific.
5. Attendance, leave, timesheets, tasks, and payroll share time and approval assumptions. Timezone, working day, overnight, break, concurrency, and cutover behavior need focused tests.
6. Vercel is not a persistent process. WebSockets, in-memory cache, local files, BullMQ workers, and cron must be evaluated with that constraint.

Before changing code, run `git status`, read the relevant controller/service/DTO/schema/tests, inspect symbol usages, and preserve unrelated worktree changes. Source and current migrations override old implementation narratives.

## Known limitations and technical debt

| Area | Verified condition | Impact / safe direction |
|---|---|---|
| Client parity | Web has far more administration screens than mobile | Treat mobile as a deliberate subset; define product priority before parity work |
| Web patterns | Shared API/query components coexist with older page-local fetching and duplicate route variants (`add`/`new`, nested edit variants) | Consolidate per module only with behavior tests and redirect/link review |
| Super-admin shells | Billing/plans and some super-admin views have pages, but the backend/data evidence does not establish a complete subscription platform | Do not sell or operate these as finished billing without end-to-end verification |
| ATS exposure | API and data models exist; first-class web navigation/screen coverage is limited compared with HR modules | Confirm desired user journey before adding UI |
| Realtime | Socket.IO broadcasts are process-local | Use polling as reliability path; add a tested adapter before multi-instance realtime claims |
| Queues | BullMQ is conditional and persistent workers are disabled on Vercel | Keep inline fallback reliable or deploy supervised workers elsewhere |
| Caching | Global cache defaults to small process memory; invalidation varies by module | Do not assume cross-instance coherence |
| Files | Local storage is unsuitable for ephemeral production hosts | Configure and test object storage, lifecycle, and recovery |
| Observability | Logging and metrics helpers exist, but no complete alerting/dashboard/on-call runbook is checked in | Select an owner and define service-level monitoring |
| Backups/DR | No repository-backed backup, restore, disaster recovery, RTO/RPO, or rollback procedure | Establish provider procedures before production handover |
| Database history | Large migration history includes a rebaseline and many late migrations | Rehearse from clean DB and from production-like snapshot; never reorder applied migrations |
| Soft deletion | Widespread but inconsistent restore behavior and uniqueness implications | Read exact service and schema for each module |
| Payroll compliance | India-oriented concepts exist; no evidence certifies jurisdiction-wide statutory correctness | Require payroll/legal validation before relying on calculations |
| Test environment | Some integration/e2e tests require dedicated PostgreSQL/Redis variables | Skips or missing services are not passes; report them explicitly |
| Documentation decisions | No formal ADR collection records original rationale | Label reasoning as inferred until maintainers confirm it |

Search markers such as `TODO`, `FIXME`, “coming soon,” and mocks before release, but distinguish test mocks and input placeholders from unfinished production behavior.

## Troubleshooting by symptom

| Symptom | Likely cause | Diagnosis | Resolution |
|---|---|---|---|
| Web cannot reach API | API stopped, wrong proxy target, port conflict | Open `/health`; inspect API/web terminals; check `API_PROXY_TARGET` | Start API, use root `npm run dev`, or correct target and restart web |
| CORS error | Browser origin is absent or malformed | Compare browser origin with API startup configuration | Set `FRONTEND_URL(S)`/origin aliases exactly; do not use wildcard with credentials |
| Repeated `401` | Missing/expired cookies, mismatched JWT config, failed refresh, stale session | Inspect browser cookies/network; check API auth logs and `/auth/me` | Re-login; align access/refresh secrets, issuer/audience and cookie topology; avoid clearing DB blindly |
| Login throttled unexpectedly | Shared/local counter state or wrong client IP behind proxy | Check response, Vercel/proxy headers, Redis/Postgres throttle configuration | Configure exact trusted proxy CIDRs and shared storage; wait/reset only the known test bucket |
| `403` after login | Role/permission, ownership, organization or unit scope | Inspect token profile, selected context, endpoint decorators and service scope | Grant correct permission/access or switch context; do not bypass service checks |
| Record is `404` but exists | Out-of-scope record, soft deletion, wrong selected organization/unit | Query safely by ID plus tenant/deleted fields; inspect request context | Correct context/access or use supported restore; never remove tenant filters |
| Prisma client/type mismatch | Schema changed without generation | Compare schema, migration status, generated-client error | `npm run prisma:generate`; reinstall if needed; do not edit generated files |
| Migration fails | Wrong database, drift, missing prerequisite, concurrent deploy | Run `prisma:migrate:status`, inspect SQL and DB logs | Stop concurrent migration jobs; fix with reviewed forward migration or provider recovery |
| Expo cannot connect | Device cannot reach localhost, wrong API URL, firewall, dev server mode | Confirm phone and host network; open API health using LAN IP | Set `EXPO_PUBLIC_API_URL` to reachable LAN URL, start with `start:lan`, allow port 3000 |
| Mobile refuses production API in development | Safety guard detected production target | Inspect `app/src/config/env.ts` and environment | Use local/staging; set explicit override only for an intentional test |
| Check-in reports active/conflict state | Existing attendance/session row, concurrent write, shift/date interpretation | Fetch own attendance and session history; check organization timezone and logs | Use supported checkout, reopen, recovery, or reconciliation action; do not delete rows manually |
| Wrong attendance duration/status | Overnight shift, breaks, working-day/holiday/leave rule, flexible session, timezone | Reproduce with exact timestamps and shift history; run focused utility/service tests | Fix rule and regression tests together; consider historical shift assignment |
| Notification count stale | Polling off, cache, failed query, process-local socket | Inspect notification/count requests and web env | Enable polling; invalidate query/cache; do not rely on socket across instances |
| Email not sent | Provider is `NONE`, credentials/from domain invalid, adapter failure | Check provider config and delivery logs; render template locally | Configure verified provider/domain; use restricted test script; protect secrets |
| Uploaded file disappears | Local storage on ephemeral host or wrong provider/key | Inspect file metadata, provider selection, object key/bucket | Configure S3-compatible durable storage and test upload/download/delete |
| Queue job never runs | Queue disabled, no Redis, Vercel worker disabled | Check `REDIS_QUEUE_ENABLED`, Redis status, host type | Use inline behavior or deploy a persistent supervised worker |
| Tests unexpectedly skip/fail database cases | Dedicated test URL missing or migrations absent | Read test output and `.env.test.example` | Create isolated test DB/Redis, migrate it, set explicit test variables |

### Minimal diagnostic order

```powershell
git status --short
node --version
npm --version
npm --prefix api run prisma:validate
npm run typecheck
# With the stack running:
Invoke-WebRequest http://localhost:3000/health
```

Add focused tests next. Do not start by reseeding or resetting a database; those actions can destroy diagnostic evidence and data.

## Significant history

This is historical context, not a claim that every regression path remains tested.

| Period / commit evidence | Change | Why it matters now |
|---|---|---|
| March–July 2026 migrations | Core ERP models expanded, then migration history was rebaselined | Fresh installs must be tested through the full checked-in migration chain |
| July–August 2026 | Organization attribution, hierarchy, business units, file keys, password/reset and directory permissions added | Older single-tenant or local-file documentation became unsafe |
| September 2026 | Project ownership/collaboration, task timers/messages, client portal, customers, attendance planning added | Projects are now a deep subsystem, not basic CRUD |
| October 2026 | Holidays/ranges, attendance breaks/flexible sessions/reconciliation, quote/invoice itemization, timesheet review, leave entitlements, payroll components added | Date and workflow behavior spans more modules and requires integration thinking |
| 24–26 October commits | Attendance consistency, authentication/scope, reconciliation and UI fixes | Previous attendance incident reports contained valuable failure modes but were not stable reference docs |
| 27–31 October commits | Payroll/workflow expansion, CRM/HR/reports/access improvements, tenant hardening | Earlier audits that said “pending” or “complete” became contradictory |
| 4 November 2026 (`60f3d27e`) | Project workflow and query compatibility fix | Current docs must use source after this commit as the behavioral baseline |

Old documentation also recorded authentication 401s from mismatched environment settings, missing employee links in ESS, mock-to-provider email work, and Expo LAN connection issues. Their durable lessons are incorporated above; old “production-ready” labels and copied validation output were not retained as current evidence.

## Maintenance guidance

### Routine

- Review dependency and security audit results; update one runtime area at a time.
- Run typecheck, lint, focused tests, full package tests, build, Prisma validation/status, and release audit in CI.
- Monitor auth failures/throttling, API latency/error rate, cron completion, queue backlog where enabled, email delivery, object storage failures, DB capacity, and backup success.
- Test organization and business-unit isolation whenever a module gains a list, detail, import, export, file, or report endpoint.
- Keep schema, migration, API DTO, client types/forms, permissions, navigation, tests, and this documentation in the same change.
- Review platform and tenant audit attribution for every new background job.

### Debugging

Trace one request end to end: client API call → proxy/base URL → controller → guards/context → service scope/business rule → Prisma query/transaction → audit/event/notification → response transformation → query-cache refresh. Capture IDs, organization/unit context, role/permission, timestamps with timezone, and the exact response; never capture secrets or customer data in tickets.

### Safe data work

Prefer read-only scripts and transactions. Take a provider backup before migrations or repairs. Do not use `prisma migrate reset`, ad hoc deletes, password repair scripts, seed scripts, or bulk imports against production without a reviewed runbook and explicit authorization.

## First tasks for an incoming developer

1. Provision isolated local and test PostgreSQL databases; run the full migration chain and development seed.
2. Run and record `typecheck`, `lint`, unit/package tests, API e2e with an isolated DB, builds, Prisma validation/status, Expo Doctor, and release audit. Separate failures, skips, and environment limitations.
3. Walk five critical journeys: auth/context switch; lead→deal→quote→invoice; project/task/timesheet review; attendance→leave→payroll; client invitation/project access.
4. Add or confirm CI protection for those checks and a clean-database migration test.
5. Establish production ownership for database backups/restores, secrets, email/domain, object storage, cron, monitoring, and incident response.
6. Product-review partial areas—mobile parity, ATS UI, billing/plans, and duplicated web routes—before implementation cleanup.
7. Add architecture decision records for tenancy, deployment topology, queue/realtime strategy, soft deletion, and payroll compliance assumptions if maintainers can confirm them.

## Outstanding questions and coverage gaps

These require owner or production-environment evidence; the repository cannot answer them accurately.

- Which hosting topology is authoritative: Vercel for both clients/API, or a persistent API host?
- Who owns each production environment, domain, database, email provider, object store, Redis, and mobile signing account?
- What are the backup retention, restore test cadence, RTO, RPO, incident escalation, and rollback approvals?
- Which organizations/regions and payroll rules are contractually supported?
- Are billing/plans intended product features, placeholders, or an external-system integration?
- Which web features must reach mobile, and in what priority order?
- What user-acceptance evidence and browser/device accessibility matrix are required for release?
- Which environment variables are actually configured in each deployment? Do not answer by copying secrets into documentation.
- Are external consumers relying on undocumented API endpoints or exact response shapes?
- What data-retention and hard-deletion requirements apply to audit, employees, clients, and files?

## Documentation audit record

The rewrite inspected project-authored Markdown outside dependencies/generated output; package scripts and manifests; API composition, controllers, shared middleware/guards/configuration; web and mobile routes/configuration; the Prisma schema, migrations and seeds; test locations; Vercel/EAS/deploy files; current worktree status; and recent Git history.

The previous documentation had several classes of conflict:

- repeated setup guides with missing package installs or incorrect environment-template claims;
- dated plans, incident reports, and implementation logs presented beside current reference material;
- “complete,” “working,” or “production-ready” statements whose pasted test results were historical rather than reproducible now;
- old authentication, notification, dashboard, tenant, and attendance descriptions superseded by later code;
- multiple documentation indexes and architecture files linking to one another;
- one empty module implementation guide;
- decorative formatting and long duplicated code narratives.

Durable content preserved here includes architecture and request flow, organization/business-unit rules, RBAC/auth/session behavior, Redis/serverless limitations, attendance incident lessons, email and notification configuration concepts, database/migration commands, frontend/mobile topology, and recent security/workflow history. Unsupported completion claims and real/sensitive values were excluded.

### Validation limits of this rewrite

The documents were checked statically against repository paths, scripts, controllers, models, configuration, routes, and recent history. Documentation links and Mermaid blocks were validated structurally. Application behavior was not changed. Database migrations/seeds, tests, builds, deployment, live email/storage/Redis, and destructive recovery procedures were not executed as part of this documentation-only task; no pass claim is made for them.

[← Development, testing, and deployment](04-development-testing-and-deployment.md) · [Back to README](../README.md)
