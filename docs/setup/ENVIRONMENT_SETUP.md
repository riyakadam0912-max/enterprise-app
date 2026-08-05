# Environment setup

## Purpose

This page explains the environment files used by the project.

## Who should read this

This guide is for developers, administrators, and DevOps engineers.

## Environment layers

- Root `.env` for shared development settings
- `api/.env` for backend runtime settings
- `web/.env.local` for frontend public variables

## Important settings

- `DATABASE_URL` is required for the backend
- API port is standardized to 3000
- Web port is standardized to 3001
- The frontend uses public environment variables for API and notification endpoints

## Notes

Keep the database connection aligned between the root and backend environment files during local development. The fixed ports should remain stable unless the runtime contract is intentionally changed.

## Related documents

- [Development setup](./DEVELOPMENT_SETUP.md)
- [Getting started](../02-Getting-Started/README.md)
- [Troubleshooting guide](../09-Troubleshooting/README.md)