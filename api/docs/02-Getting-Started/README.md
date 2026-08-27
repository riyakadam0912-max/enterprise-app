# Getting started

Purpose

This section is the entry point for new users and contributors who need to run the product locally.

Who should read this

This page is for developers, administrators, QA engineers, and anyone who needs to start the application in a local development environment.

Overview

The repository uses a root orchestrator that starts both the API and the frontend together. A single root command launches the full stack.

## Local run model

The root workspace script is defined in [package.json](../../package.json). It starts the API and the web frontend together through a single orchestrator.

Important runtime contract:

- API: port 3000
- Web app: port 3001
- API route prefix: /api/v1

## Start the application

From the repository root, run:

```bash
npm run dev
```

This command checks the ports, launches the API and web processes, and keeps the two services attached.

## Useful commands

```bash
npm run dev
npm run dev:clean
npm run kill:ports
npm run typecheck
```

## What to expect after startup

- the API should be reachable on http://localhost:3000
- the frontend should be reachable on http://localhost:3001
- the API exposes a Swagger documentation page in development mode

## Related documents

- [Local setup](./LOCAL-SETUP.md)
- [Architecture overview](../03-Architecture/README.md)
- [Troubleshooting guide](../09-Troubleshooting/README.md)

## Previous page

- [Documentation architecture](../01-Introduction/DOCUMENTATION-ARCHITECTURE.md)

## Next page

- [Local setup](./LOCAL-SETUP.md)
