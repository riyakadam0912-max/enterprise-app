# Documentation architecture

Purpose

This page explains the new documentation layout and the reason each section exists.

Who should read this

This document is useful for maintainers, contributors, and anyone who wants to find the correct documentation page quickly.

Overview

The new structure reduces duplication and gives every topic a single obvious location.

## New structure

1. Introduction
   - What the product is and how the docs are organized
2. Getting started
   - Local setup and first run instructions
3. Architecture
   - System composition, runtime flow, and major components
4. Modules
   - Product areas and responsibilities
5. Administration
   - Access, roles, and operational oversight
6. Development
   - Backend and frontend development guidance
7. Deployment
   - Environment, runtime, and release guidance
8. Testing
   - Test strategy and how to run the relevant checks
9. Troubleshooting
   - Common failures and recovery steps
10. Changelog
   - Release and documentation updates
11. Archive
   - Historical implementation records

## Design principles

- One topic, one destination
- Plain English instead of internal shorthand
- Technical accuracy based on the current codebase
- Clear audience labels in each page
- Minimal duplication and no temporary implementation chatter

## Placeholder visuals

The following diagrams are recommended for future documentation improvements:

- architecture overview showing browser, API, database, and notification flow
- module relationship map showing CRM, HR, finance, projects, and reporting connections
- authentication flow showing login, JWT validation, and role-based access
- deployment flow showing frontend, backend, database, and environment relationships

## Related documents

- [Introduction](./README.md)
- [Documentation audit](./DOCUMENTATION-AUDIT.md)
- [Getting started](../02-Getting-Started/README.md)

## Previous page

- [Documentation audit](./DOCUMENTATION-AUDIT.md)

## Next page

- [Getting started](../02-Getting-Started/README.md)
