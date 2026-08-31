# Development guide

Purpose

This page explains how the project is structured for active development and how to work within the monorepo safely.

Who should read this

This page is for developers and contributors who are editing the frontend, backend, or schema.

Overview

The repository is organized as a monorepo with two main application packages:

- api for the NestJS backend
- web for the Next.js frontend

The root package manages the shared development workflow.

## Project structure

- root scripts orchestrate the full local stack
- api contains backend modules, Prisma schema, and tests
- web contains the frontend application and UI components

## Common commands

From the repository root:

```bash
npm run dev
npm run dev:clean
npm run typecheck
npm run build
npm run lint
```

From the backend package:

```bash
cd api
npm run dev
npm run typecheck
npm run test
npm run test:e2e
```

From the frontend package:

```bash
cd web
npm run dev
npm run typecheck
npm run build
```

## Developer utilities

The API keeps a small set of reusable developer utilities in [api/scripts](../../api/scripts). These are intended to support local validation without changing application behavior.

- `npm run check-user` — inspect a known seeded user record.
- `npm run list-users` — print the first seeded users for quick local validation.
- `npm run inspect:orgs` — inspect organizations and their linked users.
- `npm run dashboard:test` — perform a smoke test for dashboard access through the API.
- `npm run verify:leave` — verify the leave request workflow from login to API calls.
- `npm run repair-passwords` — repair plaintext development passwords into bcrypt hashes.
- `npm run email:render` — render the welcome email template for a quick template check.
- `npm run email:test` — send a real test welcome email through the API mail stack.

Use these scripts when validating seeded data, auth, dashboard access, leave workflows, or email output during development.

## Development expectations

- keep schema changes in Prisma migrations
- keep environment configuration aligned across local setup
- avoid introducing documentation drift when changing runtime behavior

## Organization feature validation

When changing organization creation, editing, or hierarchy behavior, validate both packages from the repository root:

```bash
npm --prefix api run typecheck
npm --prefix web run typecheck
npm --prefix web run build
```

The organization UI is implemented in `web/app/dashboard/organization/page.tsx` and `web/src/components/super-admin/OrganizationCreateModal.tsx`. Shared country, state, city, timezone, and currency option builders are in `web/src/lib/geo-options.ts`. Organization update and delete authorization is enforced by the API service, not only by UI visibility.

## Related documents

- [Administration](../05-Administration/README.md)
- [Deployment guide](../07-Deployment/README.md)
- [Testing guide](../08-Testing/README.md)

## Previous page

- [Administration](../05-Administration/README.md)

## Next page

- [Deployment guide](../07-Deployment/README.md)
