# Administration

Purpose

This section explains the common administrative responsibilities for running and governing the platform.

Who should read this

This page is intended for administrators, support teams, and business owners who manage configuration, access, and day-to-day operational controls.

Overview

Administration covers identity, role access, tenant organization context, and operational health. The platform is designed so that users see only the information they are allowed to access.

## Administration areas

### Access control

The application uses JWT authentication and role-aware access checks. Users are assigned permissions based on their role and the scope of their organization or team.

### Environment management

The system relies on environment variables for database, API, and frontend configuration. A correct environment configuration is required before development or deployment can run reliably.

### Operational oversight

Administrators should monitor the API, web app, database connection, and job or notification services that the product depends on.

## Common admin tasks

- confirm environment variables are valid
- verify the API and web services are running on their expected ports
- validate the database connection before starting the application
- review role and permissions boundaries
- monitor notifications and workflow events

## Related documents

- [Module overview](../04-Modules/README.md)
- [Development guide](../06-Development/README.md)
- [Troubleshooting guide](../09-Troubleshooting/README.md)

## Previous page

- [Module overview](../04-Modules/README.md)

## Next page

- [Development guide](../06-Development/README.md)
