# Architecture and codebase

This guide explains how a request travels through the system, where each concern lives, and what a developer must preserve when extending it.

**Contents:** [Stack](#verified-technology-stack) · [Structure](#repository-structure) · [Request flow](#request-flow) · [Security](#authentication-authorization-and-isolation) · [Shared mechanisms](#shared-mechanisms) · [Clients](#client-architecture) · [Extension points](#extension-points-and-change-consequences)

**Related:** [Product guide](01-product-guide.md) · [Module reference](03-modules-apis-and-data.md) · [Development](04-development-testing-and-deployment.md) · [Handover](05-troubleshooting-and-handover.md)

## Verified technology stack

| Layer | Technology | Role |
|---|---|---|
| API | Node.js, TypeScript, NestJS 11, Express adapter | REST controllers, validation, authorization, business services, events, and optional WebSockets |
| Data | PostgreSQL, Prisma 5 | Relational schema, generated client, migrations, transactions, and seeds |
| Web | Next.js 16 App Router, React 19, TypeScript | Main browser UI and API proxy |
| Mobile | Expo 57, React Native 0.86, Expo Router | Selected native ERP workflows |
| Client data | Axios, TanStack Query; React Hook Form and Zod where adopted | HTTP transport, server-state cache, forms, and client validation |
| UI | Tailwind CSS, Radix primitives, Lucide, Recharts | Styling, controls, icons, and reporting charts |
| Async/integration | Nest event emitter; optional BullMQ/Redis, Socket.IO, email providers, S3 | In-process events, optional queues/cache/rate limit/realtime, delivery, and files |
| Tests | Jest/Supertest, Node test runner, React Native Testing Library | API unit/integration/e2e, web utility/UI checks, and mobile tests |
| Deployment | Vercel configurations and serverless API adapters; PowerShell deploy helper | Web/API deployment paths and an attendance cron endpoint |

Versions come from the three package manifests. “Optional” means code enables the facility only when configuration supports it.

## Repository structure

```text
enterprise-app/
├── api/
│   ├── api/                  # Vercel/serverless entry points
│   ├── prisma/               # schema, migrations, seeds, bootstrap
│   ├── src/
│   │   ├── domains/          # domain-module composition
│   │   ├── common/           # guards, DTOs, filters, scope and utilities
│   │   ├── auth/             # login, JWT, sessions, throttling
│   │   └── <module>/         # controller, service, DTOs, tests
│   └── test/                 # e2e configuration and helpers
├── web/
│   ├── app/                  # Next.js routes and layouts
│   └── src/                  # API clients, providers, hooks, components
├── app/
│   ├── app/                  # Expo Router routes
│   └── src/                  # mobile API, state, components, config
├── scripts/                  # root development and release utilities
└── docs/                     # maintained guides
```

Important entry points:

| Entry | Responsibility |
|---|---|
| `api/src/main.ts` | Starts the persistent API, development Swagger, shutdown hooks |
| `api/src/create-nest-app.ts` | Builds the Nest application, CORS, security, prefix, pipes, filters, interceptors |
| `api/src/app.module.ts` | Composes domain modules and request middleware |
| `api/api/index.ts` | Serverless API adapter |
| `api/api/attendance-cron.ts` | Secret-protected attendance automation entry |
| `api/prisma/schema.prisma` | Canonical data model and deletion relations |
| `web/app/layout.tsx` and route layouts | Web shell and providers |
| `web/src/config/env.ts` | Browser API/realtime/polling configuration |
| `web/next.config.ts` | API proxy behavior |
| `app/app/_layout.tsx` | Mobile navigation/provider root |
| `app/src/config/env.ts` | Mobile API target and production-target guard |

## Request flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Web or mobile client
    participant N as NestJS middleware and guards
    participant S as Module service
    participant P as Prisma
    participant D as PostgreSQL
    U->>C: Action or form submission
    C->>N: HTTP request and auth cookies/token
    N->>N: CORS, request ID, auth, tenant context, role/permission checks
    N->>S: Validated DTO and authenticated user
    S->>S: Scope and business-rule checks
    S->>P: Scoped query or transaction
    P->>D: SQL
    D-->>P: Rows or error
    P-->>S: Typed result
    S-->>N: Result; events/audit/notifications as applicable
    N-->>C: Standard response or normalized error
    C-->>U: Cache update and rendered feedback
```

The global API prefix is `/api/v1`. In local web development, Next.js proxies browser calls to the API target. Clients should call their shared API layer rather than hard-code hosts.

A typical API module uses a controller for HTTP mapping, DTO classes for input validation, and a service for rules and Prisma access:

```ts
@Post()
create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthUser) {
  return this.projectsService.create(dto, user);
}
```

The exact decorator names vary by older and newer modules. Follow a nearby maintained module and shared common decorators rather than copying legacy duplicates.

## Authentication, authorization, and isolation

### Authentication

Login produces short-lived access and longer-lived refresh credentials. The browser flow uses HttpOnly cookies; JWT strategy validation checks the access secret, issuer, and audience. Refresh sessions are persisted in `AuthSession`, enabling rotation and logout-all behavior. Passwords use bcrypt hashes. Forgot/reset and password-change paths are implemented.

Production configuration requires distinct, non-placeholder access and refresh secrets. Cookie security, same-site behavior, and domain must match deployment topology.

### Authorization

The API combines:

1. Base-role checks (`Role` enum and role guards).
2. Database-defined application roles and permissions (`AppRole`, `Permission`, join tables).
3. Service-level ownership and scope checks for records, teams, clients, and assignments.

The permissions guard is the reusable extension point for granular authorization. Hiding a button is not authorization.

### Tenant and business-unit isolation

`AuditContextMiddleware` and `TenantContextMiddleware` run on every route. Organization-context decorators and shared scope services resolve the caller's organization tree and unit access. Most tenant models carry `organizationId`; many also carry `businessUnitId`.

`SUPER_ADMIN` has deliberate platform access, but tenant-visible audit records still require correct organization attribution. Background jobs with no trustworthy tenant belong in `SystemAuditEvent`, not an arbitrary tenant's `AuditLog`.

**Constraint:** a new query that omits shared scope rules can expose cross-tenant data even if its controller is guarded. Tests named for IDOR (insecure direct object reference), scope, or tenant behavior are useful patterns.

## Shared mechanisms

### Validation and responses

Nest's global validation pipe transforms inputs and rejects invalid DTO data. A transform interceptor creates the shared success envelope; the HTTP exception filter normalizes failures. Check `api/src/create-nest-app.ts`, `api/src/common/interceptors/transform.interceptor.ts`, and `api/src/common/filters/http-exception.filter.ts` before changing client response parsing.

### State and caching

TanStack Query holds server state in both clients where adopted. Some older screens still fetch locally. The API global cache is a small five-minute in-memory cache by default; module services invalidate known keys. Redis configuration does not automatically make every cache distributed.

**Inferred rationale:** query caching reduces duplicate reads and makes mutation refresh predictable. Mixed adoption reflects incremental refactoring, not two intentional standards.

### Workflows and events

`api/src/workflows/` stores workflow definitions, stages, instances, steps, assignments, actions, comments, notifications, and history. `api/src/common/workflows/approval-workflow.ts` provides shared approval behavior. Leave and expenses are prominent consumers.

Nest's event emitter handles in-process reactions, including CRM and notification activity. Deal work can use BullMQ only when a Redis connection and explicit queue flag are enabled. Vercel disables persistent workers.

**Tradeoff:** in-process events are simple but are not a durable cross-instance bus. Queued work improves durability on persistent hosts but adds Redis and worker operations.

### Errors, audit, and metrics

Business services throw Nest HTTP exceptions for expected failures. Audit middleware plus explicit audit transaction helpers record mutations. `MetricsService` exposes internal counters; there is no checked-in full observability stack or alerting runbook.

### Notifications and email

Notifications support recipients, preferences, templates, delivery logs, read state, polling, and optional process-local Socket.IO updates. Email provider selection supports the adapters present in `api/src/email/`; provider credentials are environment supplied. Realtime is not cross-instance because no Socket.IO Redis adapter is configured.

### Files

File records and file attachments separate metadata from storage. Local storage is suitable for development; S3 is selected when configured. Upload controllers use Multer and storage providers. Preserve tenant checks, file-category validation, size/type limits, and `fileKey` behavior when adding downloads.

### Imports and exports

Several modules expose import endpoints and use shared import/export utilities. `ImportLog` records import metadata. Spreadsheet handling is present in the clients. Imports commonly return partial success; validate row-level errors rather than assuming atomic behavior.

## Client architecture

### Web

Next.js App Router route groups cover login, organization selection, tenant dashboard, ESS, public quotes, notifications, and super-admin pages. Shared API modules and Axios configuration live under `web/src`. Providers supply authentication, backend health, query caching, organization/business-unit context, and notifications.

Route guards improve navigation but the API remains authoritative. When adding a page, update navigation and permission-aware visibility as well as the route.

### Mobile

Expo Router defines native routes. SecureStore protects session material; shared Axios clients call the same API. Mobile environment code deliberately blocks accidental development use of a production API unless explicitly allowed. The mobile app implements a selected operational subset, so every backend feature does not require an immediate mobile screen.

## Design choices and inferred rationale

| Choice | Evidence | Consequence |
|---|---|---|
| Modular monolith API | Nest domain modules in one deployment/database | Easy transactions and shared rules; module boundaries require discipline |
| Shared PostgreSQL with tenant columns | Prisma relations and scope services | Efficient operations; every query must enforce scope |
| Soft deletion on many models | Widespread `deletedAt`, soft-delete middleware/helpers | Queries and unique rules must account for deleted records |
| REST plus optional realtime | Controllers, polling config, Socket.IO gateways | REST is the reliable contract; realtime is an enhancement |
| Serverless-compatible and persistent-host paths | Vercel adapters plus `main.ts` | Queues, WebSockets, local files, and cron behave differently by host |

Rationales above are inferred from implementation unless explicitly documented in code comments; the repository contains no formal architecture decision records.

## Extension points and change consequences

When adding a business feature:

1. Add or change Prisma models and a migration; decide tenant keys, unit keys, indexes, uniqueness, and `onDelete` behavior.
2. Add the Nest module/controller/service/DTOs and register it in the appropriate domain module.
3. Apply JWT, role/permission, ownership, organization, and unit checks.
4. Add audit, workflow, notification, file, import/export, and cache behavior only where the business flow needs them.
5. Add a client API function/hook, route, form validation, loading/error/empty states, and navigation.
6. Test rules and isolation before broad happy-path UI tests.

Changing organization resolution, auth cookies, response envelopes, soft deletion, dates/timezones, attendance calculations, or workflow transitions has system-wide consequences. Read usages and run focused tests before modifying those shared mechanisms.

[← Product guide](01-product-guide.md) · [Next: Modules, APIs, and data →](03-modules-apis-and-data.md)
