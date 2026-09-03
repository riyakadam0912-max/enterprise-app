# ERP Context Memory

## What the ERP is

This project is a multi-tenant enterprise ERP platform built around a NestJS API, a Next.js frontend, and a Prisma-driven PostgreSQL data model. It combines HR, payroll, attendance, CRM, projects, finance, notifications, workflow approvals, and organization-level administration.

## Repository structure

```text
enterprise-app/
├─ api/                   # NestJS backend and Prisma schema
├─ web/                   # Next.js frontend
├─ scripts/               # root orchestration and utilities
├─ README.md              # top-level project summary
├─ deploy.ps1             # deployment helper script
├─ package.json           # root scripts and shared tooling
├─ api/docs/              # documentation set
└─ ...
```

## Tech stack

- Backend: NestJS 11, TypeScript
- Frontend: Next.js 16, React 19, TypeScript
- Database: PostgreSQL with Prisma ORM
- Auth: JWT + Passport + cookie-based session flow
- Access control: role guards, permission guards, tenant middleware
- Optional infra: Redis, BullMQ, WebSockets, email providers

## Frontend/backend architecture

- API is mounted under `/api/v1` in `api/src/create-nest-app.ts`.
- Frontend is Next.js App Router under `web/app`.
- Requests are authenticated with JWT and should include organization and BU context for multi-tenant access.
- The backend enforces org and business-unit constraints before services read or write data.

## Database/Prisma setup

- Schema source: `api/prisma/schema.prisma`
- Prisma client generation via `npm --prefix api run prisma:generate`
- Migrations via `npx prisma migrate deploy` or repo scripts
- Soft-delete and audit logging are applied in `api/src/prisma/prisma.service.ts`

## Major modules

- Identity/auth: `api/src/auth`
- Organization hierarchy: `api/src/organizations`
- Business-unit scoping: `api/src/business-units`
- Users/admin: `api/src/users`
- RBAC: `api/src/rbac`
- HR: `api/src/domains/hr.module.ts`
- CRM: `api/src/domains/crm.module.ts`
- Finance: `api/src/domains/finance.module.ts`
- Projects: `api/src/domains/projects.module.ts`
- Notifications/workflows: `api/src/workflows`, `api/src/notifications`

## Authentication/RBAC/multi-tenancy structure

- User role is defined in Prisma enum `Role`.
- App-level roles/permissions are represented by `AppRole`, `Permission`, `RolePermission`, and `UserRole`.
- Auth payload includes role, roles, permissions, organizationId, primaryBusinessUnitId, employeeBusinessUnitId.
- `JwtStrategy` reads the JWT from cookie or Authorization header.
- `RolesGuard` and `PermissionsGuard` enforce route-level access control.
- `TenantContextMiddleware` resolves org and BU context, with strict checks against illegal overrides.

## Organization and Business Unit rules

- `Organization` supports parent/child hierarchy using `parentId`.
- `BusinessUnit` also supports parent/child structure and is scoped to an org.
- Wide-scoped roles (`SUPER_ADMIN`, `ADMIN`, `HR`, `COMPLIANCE_MANAGER`) may access all units or a selected unit.
- Non-wide users are restricted to their assigned business unit.
- Platform admins and org admins are not interchangeable; access is validated against tenant context.

## Important environment/configuration requirements

Required categories in `api/src/config/env.ts`:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `FRONTEND_URL` or `FRONTEND_ORIGIN`
- `EMAIL_PROVIDER`

Additional production-critical settings:

- `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `COOKIE_DOMAIN`
- `REDIS_*` if Redis-enabled behavior is needed
- `EMAIL_*` provider credentials
- `BOOTSTRAP_*` secrets for first-time setup

## Development and deployment commands

```bash
# repo root
npm install
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test

# API
cd api
npm run dev
npm run build
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
npm test

# Web
cd web
npm run dev
npm run build
npm run typecheck
```

## Important architectural decisions

- Multi-tenancy is enforced at the service and middleware level, not only at the UI.
- The codebase is intentionally hybrid: legacy scalar `User.role` and newer role-permission records coexist.
- Audit logging is centralized and enforced at the Prisma middleware layer.
- Production validation is strict to prevent insecure secret and cookie configuration.
- Vercel deployment is supported for both API and web, with explicit origin handling and proxying.

## Critical dependencies and constraints

- Do not assume documentation is up to date; prefer actual implementation in code.
- Organization and BU checks must be respected when adding or changing features.
- Production requires non-placeholder secrets and valid frontend/origin config.
- Security-sensitive flows (login, reset, tenant switching, BU selection) should be validated before patching.

## Current known issues

- Some older documentation files still describe a generic ERP and may be stale.
- The RBAC model is hybrid and should be treated carefully when adding permissions.
- Production deployment still needs explicit environment validation and bootstrapping.
- Certain modules are present in code but not fully documented or polished for user-facing workflows.

## Important recent changes

- Organization hierarchy and child-org management are implemented.
- Business-unit access scoping was added and is enforced by middleware/services.
- Auth and tenant context now include org/BU metadata in JWT data.
- Prisma audit middleware and soft delete logic have been strengthened.
- Vercel config and environment validation reflect production-specific rules.

## Important files/directories to inspect first

- `api/prisma/schema.prisma`
- `api/src/app.module.ts`
- `api/src/config/env.ts`
- `api/src/auth/auth.service.ts`
- `api/src/common/middleware/tenant-context.middleware.ts`
- `api/src/business-units/business-units.service.ts`
- `api/src/organizations/organizations.service.ts`
- `api/src/users/users.service.ts`
- `api/src/prisma/prisma.service.ts`
- `api/docs/ERP_DOCUMENTATION.md`
- `api/docs/DEVELOPMENT_TESTING_DEPLOYMENT.md`
- `api/docs/TECHNICAL_WORKFLOWS_AND_CODE_DOCUMENTATION.md`

## Rules an AI agent must follow before modifying the project

1. Treat the codebase and Prisma schema as the source of truth; do not rely on older docs alone.
2. Verify the feature or bug in the current implementation before writing a patch.
3. Preserve multi-tenant and business-unit constraints during any modification.
4. Check auth, RBAC, org scope, and BU scope before changing route logic.
5. Validate environment settings and Prisma schema before claiming deployment readiness.
6. Document any assumptions and clearly separate current behavior from historical notes.

## Documentation references

- [api/docs/ERP_DOCUMENTATION.md](api/docs/ERP_DOCUMENTATION.md)
- [api/docs/DEVELOPMENT_TESTING_DEPLOYMENT.md](api/docs/DEVELOPMENT_TESTING_DEPLOYMENT.md)
- [api/docs/TECHNICAL_WORKFLOWS_AND_CODE_DOCUMENTATION.md](api/docs/TECHNICAL_WORKFLOWS_AND_CODE_DOCUMENTATION.md)

## Cleanup audit - 2026-09-03

- Removed generated Jest result files: `api/jest-results.json` and `api/jest-summary.json`.
- Removed duplicate or unused diagnostics: `api/scripts/password-verify-readonly.js`, `api/scripts/start-dev.js`, and `api/scripts/kill-port.ps1`.
- Removed completed upload test artifacts: `expense-upload-test.js`, `test-file.txt`, and `test-image.jpg`.
- Removed the local backup environment file `api/.env.local.bak`; production secrets must remain in Vercel environment settings.
- Removed generated API logs: `api/hr-report.log`, `api/jest-output.log`, and `api/test-output.log`.
- Kept active root/API development scripts, deployment configs, package manifests, Prisma migrations, documentation, dependencies, and generated build/cache directories because they are used by development or deployment workflows.
