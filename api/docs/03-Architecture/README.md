# Architecture overview

Purpose

This page explains the main runtime structure of the product in plain language.

Who should read this

This guide is intended for developers, administrators, support staff, and technical leads who need to understand how the application is organized.

Overview

The system is composed of three main layers:

- frontend for the user interface
- backend API for business logic and security
- database for persistent records and relationships

## Runtime components

### Frontend

The web app is a Next.js application that runs on port 3001. It handles the main user experience, dashboards, forms, and module screens.

### Backend

The API is a NestJS application that runs on port 3000. It exposes a versioned route prefix of /api/v1 and manages authentication, authorization, controllers, services, and module workflows.

### Database

The data layer uses Prisma with a relational SQL database. Prisma provides schema validation, migrations, and typed database access.

## Request flow

A typical request follows this path:

1. The browser sends a request from the frontend.
2. The frontend calls the backend API.
3. NestJS routes the request to the appropriate module.
4. The service layer applies workflow rules and validation.
5. Prisma reads or writes the database.
6. The API returns a structured response to the frontend.

## Key architecture notes

- The API uses global prefix /api/v1.
- CORS is enabled for the web frontend origin.
- The API applies global validation and uses controller-level guards.
- The application supports JWT-based authentication and role-aware access.

## Related documents

- [Getting started](../02-Getting-Started/README.md)
- [Module overview](../04-Modules/README.md)
- [Troubleshooting guide](../09-Troubleshooting/README.md)

## Previous page

- [Local setup](../02-Getting-Started/LOCAL-SETUP.md)

## Next page

- [Module overview](../04-Modules/README.md)
