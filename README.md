# Enterprise ERP

Enterprise ERP is a multi-organization business system for sales, people operations, projects, finance, and internal administration. It serves platform operators, organization administrators, HR teams, managers, employees, and selected clients through a web application and a smaller mobile application.

The repository contains a NestJS API, a Next.js web client, and an Expo mobile client. PostgreSQL is the system of record. Features include CRM, quotes and invoices, projects and tasks, attendance and leave, expenses, payroll, recruitment, performance, notifications, files, reports, and audit history. Coverage differs between web and mobile; see the [module reference](docs/03-modules-apis-and-data.md).

## Quick start

Prerequisites: Node.js 20.19.4 or newer, npm 9 or newer, and PostgreSQL. These versions satisfy the strictest checked-in client requirement.

```powershell
npm install
npm --prefix api install
npm --prefix web install
npm --prefix app install
Copy-Item api/.env.example api/.env
# Edit api/.env and set DATABASE_URL plus distinct JWT secrets.
npm run prisma:generate
npm run prisma:migrate
npm --prefix api run seed
npm run dev
```

The development launcher expects the API at `http://localhost:3000` and web client at `http://localhost:3001`. Open `http://localhost:3001`. Development-only Swagger documentation is available at `http://localhost:3000/api`; health is at `http://localhost:3000/health`.

These commands match the package scripts and configuration. They were not executed during this documentation-only rewrite because migration and seed commands change the configured database. See the [development guide](docs/04-development-testing-and-deployment.md) before using a non-empty database.

## Documentation

- [Product guide](docs/01-product-guide.md) — business purpose, roles, terms, and common journeys.
- [Architecture and codebase](docs/02-architecture-and-codebase.md) — runtime design, repository map, request flow, security, and extension points.
- [Modules, APIs, and data](docs/03-modules-apis-and-data.md) — implemented-module reference, routes, endpoints, models, and workflows.
- [Development, testing, and deployment](docs/04-development-testing-and-deployment.md) — setup, environment, scripts, change workflow, tests, and operations.
- [Troubleshooting and handover](docs/05-troubleshooting-and-handover.md) — limitations, diagnosis, history, incoming-developer context, and open questions.

## Suggested reading paths

| Reader | Start here | Then read |
|---|---|---|
| Business reader | [Product guide](docs/01-product-guide.md) | [Module reference](docs/03-modules-apis-and-data.md) |
| Beginner | [Product guide](docs/01-product-guide.md) | [Architecture](docs/02-architecture-and-codebase.md), then [development](docs/04-development-testing-and-deployment.md) |
| Developer or coding agent | [Handover](docs/05-troubleshooting-and-handover.md) | [Architecture](docs/02-architecture-and-codebase.md), [module reference](docs/03-modules-apis-and-data.md), then [development](docs/04-development-testing-and-deployment.md) |

## Repository map

| Path | Purpose |
|---|---|
| `api/` | NestJS REST API, Prisma schema and migrations, background/event work, and API tests |
| `web/` | Next.js App Router web application |
| `app/` | Expo Router mobile application |
| `scripts/` | Root development, release-audit, and port-management utilities |
| `docs/` | Maintained handover documentation |

Documentation describes verified behavior as of 4 November 2026. Source code and the Prisma schema take precedence when behavior changes.
