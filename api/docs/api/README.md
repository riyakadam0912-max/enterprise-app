# API overview

## Purpose

This page gives a concise summary of the backend service and its role in the product.

## Who should read this

This page is for developers, QA engineers, and administrators who need a quick view of the API layer.

## Overview

The backend is built with NestJS and uses Prisma for database access. It exposes the product’s business logic through a versioned API under `/api/v1`.

## Main responsibilities

- authentication and role-based access
- business module APIs for HR, CRM, finance, projects, and operations
- dashboard and reporting endpoints
- workflow and approval handling

## Runtime

- API port: 3000
- Frontend origin: http://localhost:3001
- API prefix: /api/v1

## Common commands

```bash
cd api
npm run dev
npm run test
npm run test:e2e
npm run lint
```

## Related documents

- [Development guide](../06-Development/README.md)
- [Architecture overview](../03-Architecture/README.md)
- [Troubleshooting guide](../09-Troubleshooting/README.md)
