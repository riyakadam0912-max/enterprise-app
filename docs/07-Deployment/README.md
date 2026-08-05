# Deployment guide

Purpose

This page describes the deployment model at a high level and keeps the instructions aligned with the codebase’s current runtime contract.

Who should read this

This section is for DevOps engineers, release owners, and operations teams.

Overview

The application is designed to run as a coordinated pair of services:

- the API service on port 3000
- the web application on port 3001

The root orchestrator and the package scripts define the runtime boundary for local development. Production deployment should preserve the same service separation and environment expectations.

## Deployment principles

- keep the API and web services independent but coordinated
- maintain a stable API port and web port contract
- validate environment variables before startup
- use Prisma migrations as part of Database deployment preparation

## Recommended deployment checklist

1. confirm the database is reachable
2. validate the API environment variables
3. validate the frontend public environment variables
4. run Prisma generation and migration deployment
5. start the API and then the web service

## Related documents

- [Development guide](../06-Development/README.md)
- [Testing guide](../08-Testing/README.md)
- [Troubleshooting guide](../09-Troubleshooting/README.md)

## Previous page

- [Development guide](../06-Development/README.md)

## Next page

- [Testing guide](../08-Testing/README.md)
