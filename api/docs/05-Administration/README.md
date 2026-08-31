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

### Organization management

Organization administrators can create and manage direct child organizations from the organization page. Platform administrators can manage organizations from the Super Admin organization list and can create, edit, activate, suspend, or delete organizations across the platform.

Organization forms use dependent location fields:

- Country selection limits the available states or regions.
- State selection limits the available cities.
- Changing a country clears the selected state and city and selects the first timezone available for that country.
- Timezones are stored as IANA identifiers. India uses `Asia/Kolkata`, and country-specific timezone options are shown where metadata is available.

Edit actions load the existing organization values, normalize legacy country and state names to their ISO codes, and save through the organization update endpoint. Delete is a soft archive operation and requires confirmation. Organization administrators are limited to direct children of their own organization; platform administrators retain platform-wide access.

## Common admin tasks

- confirm environment variables are valid
- verify the API and web services are running on their expected ports
- validate the database connection before starting the application
- review role and permissions boundaries
- review organization hierarchy and direct-child access
- monitor notifications and workflow events

## Related documents

- [Module overview](../04-Modules/README.md)
- [Development guide](../06-Development/README.md)
- [Troubleshooting guide](../09-Troubleshooting/README.md)

## Previous page

- [Module overview](../04-Modules/README.md)

## Next page

- [Development guide](../06-Development/README.md)
