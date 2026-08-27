# Troubleshooting guide

Purpose

This page lists the most common issues that occur during local development and their likely causes.

Who should read this

This guide is for developers, administrators, and support staff who need a quick recovery path when the application does not start or behave as expected.

Overview

Most startup issues in this repository are caused by ports being occupied, environment variables being missing or incorrect, or the database not being ready.

## Common issues

### Port conflicts

If the API or web app cannot bind to its expected port, check whether 3000 or 3001 is already in use and stop the conflicting process.

### Backend not healthy

If the frontend is stuck waiting for the API, verify that the backend is running and that the health endpoint is available.

### Database connection problems

If Prisma or the backend startup fails, confirm the database connection string and verify that the database service is running.

### Environment mismatch

If the app starts incorrectly, compare the root environment settings, the API environment, and the frontend public variables to ensure they are aligned.

## Recovery shortcuts

```bash
npm run kill:ports
npm run dev:clean
```

## Related documents

- [Getting started](../02-Getting-Started/README.md)
- [Local setup](../02-Getting-Started/LOCAL-SETUP.md)
- [Development guide](../06-Development/README.md)

## Previous page

- [Testing guide](../08-Testing/README.md)

## Next page

- [Changelog](../10-Changelog/README.md)
