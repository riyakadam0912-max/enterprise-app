# Cross-reference validation

Purpose

This page records the verification work used to confirm that the documentation reflects the current codebase and the current runtime contract.

Who should read this

This page is intended for maintainers and release owners who need evidence that the documentation remains grounded in the implementation.

Overview

The documentation was validated against the active repository files and the current startup scripts. The source of truth for technical claims remains the implementation itself.

## Verified technical facts

- Root command: npm run dev
- API port: 3000
- Web port: 3001
- API route prefix: /api/v1
- Backend framework: NestJS
- Frontend framework: Next.js
- Database access layer: Prisma
- Authentication model: JWT with role-aware access

## Verification notes

The active scripts and configuration files confirm the current local startup path and runtime port contract. The documentation therefore avoids describing old or alternative run instructions that are not reflected in the current repo.

## Related documents

- [Documentation audit](./DOCUMENTATION-AUDIT.md)
- [Documentation architecture](./DOCUMENTATION-ARCHITECTURE.md)
- [Local setup](../02-Getting-Started/LOCAL-SETUP.md)

## Previous page

- [Documentation architecture](./DOCUMENTATION-ARCHITECTURE.md)

## Next page

- [Getting started](../02-Getting-Started/README.md)
