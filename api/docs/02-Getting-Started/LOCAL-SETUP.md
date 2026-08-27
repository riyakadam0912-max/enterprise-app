# Local setup

Purpose

This page gives a practical walkthrough for getting the project running locally.

Who should read this

This guide is for developers, QA engineers, and administrators who need to start the application for local validation.

Overview

The project runs as a monorepo with a shared root orchestrator. The backend and frontend are started together using the root package scripts.

## Required tools

- Node.js
- npm
- a running SQL database compatible with Prisma

## Environment variables

At minimum, the backend needs a valid database connection string. The root workflow and the API startup path expect the database to be reachable before the application can fully boot.

## Start the full stack

From the repository root, run:

```bash
npm run dev
```

## Useful recovery commands

```bash
npm run dev:clean
npm run kill:ports
```

## Runtime contract

- API port: 3000
- Web port: 3001
- API prefix: /api/v1

## Troubleshooting notes

If startup fails, check the following in order:

1. whether the required ports are already occupied
2. whether the database is running and reachable
3. whether the backend environment is configured correctly
4. whether the frontend is waiting on an unhealthy API response

## Related documents

- [Getting started](./README.md)
- [Architecture overview](../03-Architecture/README.md)
- [Troubleshooting guide](../09-Troubleshooting/README.md)

## Previous page

- [Getting started](./README.md)

## Next page

- [Architecture overview](../03-Architecture/README.md)
