# Development setup

## Purpose

This page explains how to start the project for local development.

## Who should read this

This guide is for developers, QA engineers, and administrators.

## Start the stack

Run the following command from the repository root:

```bash
npm run dev
```

This starts the API and the web app together.

## Runtime contract

- API: port 3000
- Web: port 3001
- API prefix: /api/v1

## Common commands

```bash
npm run dev
npm run dev:clean
npm run kill:ports
npm run typecheck
```

## Troubleshooting

- If a port is already in use, stop the conflicting process or run `npm run kill:ports`.
- If the web app does not finish starting, confirm that the API is healthy and the database is available.
- If the database connection fails, check the local database and the `DATABASE_URL` value.

## Related documents

- [Environment setup](./ENVIRONMENT_SETUP.md)
- [Getting started](../02-Getting-Started/README.md)
- [Troubleshooting guide](../09-Troubleshooting/README.md)