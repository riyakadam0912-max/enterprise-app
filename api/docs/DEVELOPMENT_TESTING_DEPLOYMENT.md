# Development, Testing & Deployment

## Table of Contents

1. [Purpose and scope](#purpose-and-scope)
2. [Development workflow](#development-workflow)
3. [Repository and project structure](#repository-and-project-structure)
4. [Local development setup](#local-development-setup)
5. [Environment and configuration requirements](#environment-and-configuration-requirements)
6. [Coding standards and architecture conventions](#coding-standards-and-architecture-conventions)
7. [Testing strategy](#testing-strategy)
8. [Build, validation, and quality gates](#build-validation-and-quality-gates)
9. [Deployment architecture](#deployment-architecture)
10. [Production verification checklist](#production-verification-checklist)
11. [Troubleshooting guide](#troubleshooting-guide)
12. [Known issues and current status](#known-issues-and-current-status)
13. [Historical and recent changes](#historical-and-recent-changes)
14. [Cross-references](#cross-references)

## Purpose and scope

This document captures how the ERP is built, run, tested, and deployed in the current codebase. It is intentionally grounded in the live implementation under the NestJS API, the Next.js web app, and the Prisma schema rather than the older, broader documentation set.

The source of truth is the application code in the workspace:

- API: `api/`
- Web frontend: `web/`
- Shared root scripts: `scripts/`
- Database schema: `api/prisma/schema.prisma`

## Development workflow

### Typical local setup

From the repository root:

```bash
npm install
npm run dev
```

The root dev orchestration launches both services:

- API on port 3000
- Web on port 3001

The script is in `scripts/dev.js` and uses `concurrently` to run the API and web processes together.

### Direct commands

```bash
npm run dev:api
npm run dev:web
npm run build
npm run lint
npm run typecheck
npm run test
```

### API workflow

The API uses NestJS with `npm --prefix api run dev` and `npm --prefix api run start:dev`.

Key scripts from `api/package.json`:

- `build`: runs Prisma generation and NestJS build
- `prisma:generate`: generates Prisma client
- `prisma:validate`: checks schema validity
- `prisma:migrate`: applies pending migrations
- `seed`: bootstraps sample data
- `db:bootstrap`: application bootstrap helper
- `test`: runs Jest
- `test:cov`: coverage run

### Web workflow

The web app uses Next.js and starts via `npm --prefix web run dev`.

Key scripts:

- `dev`: runs the local web app
- `build`: `next build`
- `start`: `next start --port 3001`
- `typecheck`: `tsc --noEmit`

## Repository and project structure

```text
enterprise-app/
├─ api/
│  ├─ src/
│  ├─ prisma/
│  ├─ scripts/
│  ├─ test/
│  ├─ docs/
│  ├─ package.json
│  ├─ vercel.json
│  └─ ...
├─ web/
│  ├─ app/
│  ├─ src/
│  ├─ scripts/
│  ├─ package.json
│  ├─ vercel.json
│  └─ ...
├─ scripts/
├─ package.json
├─ README.md
├─ deploy.ps1
└─ ...
```

### Backend structure

The main code paths are organized by business domain and shared infrastructure:

- `api/src/app.module.ts` - root module and middleware registration
- `api/src/domains/*.module.ts` - domain groupings
- `api/src/auth/` - auth, JWT, guards
- `api/src/organizations/` - org and hierarchy logic
- `api/src/business-units/` - BU scoping
- `api/src/users/` - user lifecycle and account management
- `api/src/rbac/` - role and permission mapping
- `api/src/workflows/` - approval and workflow engine
- `api/src/notifications/` - notification flows
- `api/src/common/` - shared guard, middleware, auth types, filters
- `api/src/config/` - environment validation and runtime configuration

### Frontend structure

The web app uses the Next.js App Router under `web/app/` and runtime API proxying in `web/next.config.ts`.

## Local development setup

### Required services

The current stack expects:

- PostgreSQL with a configured `DATABASE_URL`
- JWT secrets and cookie settings
- Optional Redis when WebSocket or queue processing is enabled
- Optional email provider configuration for sending mail

### Typical startup sequence

1. Create database and populate connection string.
2. Install dependencies at root or in each package.
3. Ensure environment variables are present.
4. Run Prisma generation and migrations.
5. Start the API and web app.

```bash
cd api
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Then in a second terminal:

```bash
cd web
npm install
npm run dev
```

## Environment and configuration requirements

The API validates environment variables in `api/src/config/env.ts`. The runtime expects the following categories:

### Required and common settings

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `FRONTEND_URL` or `FRONTEND_ORIGIN`
- `EMAIL_PROVIDER`

### Security and cookie settings

- `COOKIE_SECURE`
- `COOKIE_SAME_SITE`
- `COOKIE_DOMAIN`

### Optional infrastructure settings

- `REDIS_ENABLED`
- `REDIS_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `WEBSOCKET_ENABLED`
- `SENDGRID_*`
- `RESEND_*`
- `AWS_SES_*`
- `SMTP_*`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_SUPER_ADMIN_EMAIL`
- `BOOTSTRAP_SUPER_ADMIN_PASSWORD`

### Production rules

The validation layer explicitly rejects placeholder or insecure secrets in production and requires a valid frontend origin and secure cookie settings.

## Coding standards and architecture conventions

### Backend conventions

- NestJS modules are domain-based and appended under `api/src`.
- Guards are layered on routes using `JwtAuthGuard`, `RolesGuard`, and `PermissionsGuard`.
- Services access Prisma through `PrismaService`.
- Audit logging is attached to Prisma middleware and records changed records.
- Multi-tenant scoping is enforced through organization and business-unit checks.

### Frontend conventions

- Next.js App Router components and route groups live under `web/app`.
- API calls are proxied and/or point to configured backend URLs.
- The frontend is designed for role-aware pages and multi-org selection flows.

### Data and access logic

- `User.organizationId` is the tenant key for org-scoped records.
- `User.primaryBusinessUnitId` and `Employee.businessUnitId` support unit scoping.
- `TenantContextMiddleware` resolves request-level organization and BU context from JWT payload and headers.

## Testing strategy

### Current test coverage pattern

The repository uses Jest for API tests. Typical commands:

```bash
cd api
npm test
npm run test:cov
```

There are tests for:

- auth
- user lifecycle
- org and BU access controls
- file management
- payroll and attendance
- workflow engine
- Vercel and bootstrap logic

### What the tests cover

- happy-path CRUD flows
- access denials
- organization scoping
- business-unit validation
- security-related password and role checks
- bootstrap behavior for super admin setup

### Notable test considerations

The codebase includes security-focused tests around:

- cross-tenant organization access
- BU access override attempts
- super admin bypass rules
- password reset and login failure flows

## Build, validation, and quality gates

The workspace supports:

```bash
npm run build
npm run lint
npm run typecheck
npm run test
```

### Prisma validation

```bash
cd api
npx prisma validate
npx prisma generate
npx prisma migrate status
```

### Deployment validation

Before production deployment, verify:

- Prisma schema is valid
- `DATABASE_URL` is set to the production database
- secrets are non-placeholder values
- frontend origins are explicitly allowed
- CORS allows production domain and Vercel preview hosts only when intentional
- email provider is configured

## Deployment architecture

### API deployment

The API has a Vercel config in `api/vercel.json` and a build entry in `api/package.json`.

Important behavior:

- build command: `npm run build:vercel`
- output directory: `.`
- dispatches API routes through `api/index.ts`
- uses a redirect from `/` to `/api/v1/`

### Web deployment

The web app is configured as a Next.js app in `web/vercel.json`.

Important behavior:

- build command: `npm run build`
- output directory: `.next`
- uses `next.config.ts` to rewrite `/api/v1/*` to the configured backend proxy target

### Vercel production notes

The codebase includes both a live API proxy target and legacy fallback options in `web/next.config.ts`. The runtime checks for legacy Vercel hosts and warns when using them.

### Production design assumptions

- API and web are separate deployment targets.
- Shared tenant context is driven by JWT payloads and request headers.
- Redis is optional but strongly tied to queue and websocket behavior.
- Vercel preview deployments may require explicit origin additions to `FRONTEND_URLS`.

## Production verification checklist

Use this checklist before shipping:

- [ ] `DATABASE_URL` points to a live database and Prisma migrations are applied.
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are unique, secure, and non-placeholder.
- [ ] `JWT_ISSUER` and `JWT_AUDIENCE` match the running environment.
- [ ] `FRONTEND_URL` or `FRONTEND_ORIGIN` is configured for production.
- [ ] `FRONTEND_URLS` includes all trusted origins.
- [ ] `COOKIE_SECURE=true` and Samesite mode is valid.
- [ ] `EMAIL_PROVIDER` is configured with a working sender.
- [ ] `BOOTSTRAP_SUPER_ADMIN_*` values are set and secure for first-time install.
- [ ] Org and BU permission rules are tested in production-like data.
- [ ] Login, role assignment, tenant selection, and access-denied cases were smoke-tested.
- [ ] Audit logs and mail sending are not failing silently.

## Troubleshooting guide

### 1. Prisma client generation or migration errors

Symptoms:

- `PrismaClientInitializationError`
- schema validation failures
- migration drift

Checks:

```bash
cd api
npx prisma generate
npx prisma validate
npx prisma migrate status
```

### 2. Local app does not start on ports 3000/3001

Symptoms:

- port already in use
- dev script fails before server starts

Checks:

```bash
node scripts/kill-ports.js
npm run dev
```

### 3. Auth or org selection fails after login

Symptoms:

- login succeeds but requests reject with 403 or missing organization context
- `organizationId` is null or missing

Checks:

- confirm user has `organizationId`
- confirm `organization` exists and is active
- inspect JWT token payload for `organizationId`, `roles`, and `permissions`
- validate request headers for `X-Organization-Id` if using a super-admin impersonation flow

### 4. Business-unit access appears inconsistent

Symptoms:

- manager or HR user cannot list or view expected units
- BU context resolves to all units or no units unexpectedly

Checks:

- confirm `primaryBusinessUnitId` or `employee.businessUnitId`
- confirm the org is active and the BU is active
- verify `TenantContextMiddleware` resolution path and `X-Business-Unit-Id` use

### 5. CORS or cookie failures in production

Symptoms:

- browser blocks requests to the API
- cookie-based auth is not persisted

Checks:

- ensure frontend origin is in `FRONTEND_URLS`
- check `COOKIE_SECURE`, `COOKIE_SAME_SITE`, and `COOKIE_DOMAIN`
- confirm Vercel preview origins are whitelisted if required

## Known issues and current status

### Current known issues

1. Older and generic documentation still exists elsewhere in the repo and does not always reflect the current ERP implementation.
   - Current status: active documentation has been rewritten to follow the live codebase; older docs remain as historical reference only.

2. The ERP is broad and partially modular; some modules appear implemented in code but not fully documented or uniformly tested.
   - Current status: the live implementation is considered the authoritative source. Any module not clearly present in code should be treated as partial or planned.

3. Some access control logic relies on both legacy role fields and newer `AppRole`/`Permission` structures.
   - Current status: hybrid RBAC still functions, but documentation should treat the two systems together as a single access model.

4. CORS is intentionally lenient in the dev and preview path to avoid a hard 500 cascade.
   - Current status: operationally workable, but production origins should still be explicit and reviewed.

5. The codebase expects production bootstrap secrets to be configured early.
   - Current status: this is required for a secure zero-downtime setup and should be treated as a deployment prerequisite.

### Planned or incomplete features

Any feature that is only described in legacy docs but not verified in the live code should be treated as planned or incomplete until a corresponding code path is confirmed in the current implementation.

## Historical and recent changes

### Current state of the historical record

The earlier `10-Changelog` documentation describes these significant changes:

- documentation restructure into numbered sections
- setup guidance consolidated into a getting-started path
- org management updates for country and timezone support
- child org admin management improvements
- platform admin vs org admin separation

### Recent implementation themes visible in code

- multi-tenant organization hierarchy with `parentId`
- BU hierarchy with `parentId` and access scoping
- JWT-based auth with cookie and header support
- stricter production environment validation
- hybrid RBAC through `User.role`, `AppRole`, `UserRole`, and `Permission`
- audit logging middleware attached at the Prisma layer

## Cross-references

- Overview and setup: [ERP_DOCUMENTATION.md](./ERP_DOCUMENTATION.md)
- Technical workflows and code documentation: [TECHNICAL_WORKFLOWS_AND_CODE_DOCUMENTATION.md](./TECHNICAL_WORKFLOWS_AND_CODE_DOCUMENTATION.md)
