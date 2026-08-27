# Testing guide

Purpose

This page provides the current testing path for the repository and explains how to validate changes with the existing scripts.

Who should read this

This guide is for QA engineers, developers, and release owners who need to verify behavior before shipping changes.

Overview

The repository includes unit, integration, and end-to-end test coverage. The current scripts are organized around the API package and the root workspace workflow.

## Run tests

From the repository root:

```bash
npm test
```

From the API package:

```bash
cd api
npm run test
npm run test:e2e
npm run test:cov
```

From the frontend package:

```bash
cd web
npm run test
```

## Validation goals

- confirm backend behavior with Jest
- validate API flows with e2e tests
- verify type safety with the frontend and backend typecheck scripts

## Related documents

- [Deployment guide](../07-Deployment/README.md)
- [Troubleshooting guide](../09-Troubleshooting/README.md)
- [Development guide](../06-Development/README.md)

## Previous page

- [Deployment guide](../07-Deployment/README.md)

## Next page

- [Troubleshooting guide](../09-Troubleshooting/README.md)
