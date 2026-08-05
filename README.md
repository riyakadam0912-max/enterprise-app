# Enterprise ERP

## Overview

Enterprise ERP is a modular business platform for people, sales, finance, projects, notifications, and reporting. The repository is organized as a monorepo with a NestJS API, a Next.js frontend, and a Prisma-backed relational database.

## Key features

- HR and employee workflows
- CRM and sales tracking
- Finance and accounting workflows
- Project and task coordination
- Notifications and approvals
- Reporting and analytics

## Technology stack

- Frontend: Next.js
- Backend: NestJS
- Data layer: Prisma + SQL database
- Authentication: JWT and role-based access

## Quick start

```bash
npm run dev
```

## Runtime contract

- API: http://localhost:3000
- Web: http://localhost:3001
- API prefix: /api/v1

## Environment variables

- API environment template: [api/.env.example](api/.env.example)
- Web environment template: [web/.env.example](web/.env.example)
- Copy each template to `.env` in the matching package before local development or deployment.
- Replace placeholder values with real production settings before pushing to GitHub or deploying.

## Project structure

- [api](./api)
- [web](./web)
- [docs](./docs)

## Documentation

- [Documentation home](./docs/README.md)
- [Getting started](./docs/02-Getting-Started/README.md)
- [Architecture overview](./docs/03-Architecture/README.md)
- [Troubleshooting guide](./docs/09-Troubleshooting/README.md)
- [Archive](./docs/Archive/README.md)
