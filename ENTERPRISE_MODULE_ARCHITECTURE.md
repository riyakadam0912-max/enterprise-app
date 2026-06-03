# Enterprise Module Architecture

This repository standardizes ERP modules around one shared backend and frontend shape.

## Backend Standard

Every module should expose the same core service behavior:

- `dto/` for create, update, and query inputs.
- A controller with CRUD endpoints and explicit Swagger metadata.
- A service that owns data access and transformation.
- Shared pagination and response shaping through `api/src/common/dto/module-query.dto.ts`, `api/src/common/interfaces/module-list.interface.ts`, and `api/src/common/services/standard-module.service.ts`.
- Global response normalization and error handling through the common interceptor and exception filter.

## Frontend Standard

Every module page should be built from the same page shell and data primitives:

- `ModuleTemplate` for consistent page layout.
- `EnterpriseModulePage` for module stats, sections, and actions.
- `DataTable` for list views, search, filtering, selection, and export.
- Shared form controls and guards for role-aware module access.

## Migration Rule

New modules should start from this standard first. Existing modules should be migrated one at a time, beginning with the simplest CRUD flows and then moving to workflow-heavy or analytics-heavy modules.