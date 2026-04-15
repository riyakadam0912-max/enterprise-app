# Enterprise App Backend API

NestJS + Prisma backend for the Enterprise App. This service provides authentication, role-aware access control, dashboard aggregation, and CRUD/import endpoints across CRM, HR, finance, and operations modules.

## Current Status (As of 2026-03-22)

Implemented and wired in the app module:

- Auth and users foundations
- Dashboard aggregation API
- 20+ business modules with database-backed entities
- Prisma migrations for all modules listed in this document
- JWT auth guard and role guard usage across protected routes
- Project and task workflow APIs for assignment, submission, review, and status transitions
- HRMS RBAC upgrade with HR role support and scoped employee visibility
- Multi-level leave approval workflow (PENDING_MANAGER -> PENDING_HR -> APPROVED/REJECTED)
- HRMS expansion kickoff across all 4 tracks:
	- Payroll core (salary structures, payroll cycles, payroll entries)
	- ATS core (job openings, candidates, interviews)
	- Expense approval hardening (owner scope, manager -> HR approvals, rejection trail)
	- Performance starter (goal cycles, goals, performance reviews)

Core runtime behavior:

- API runs on http://localhost:3000
- CORS enabled for frontend origin http://localhost:3001
- Global DTO validation pipe enabled with transform and whitelist

## Tech Stack

- NestJS 11
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT (nestjs/jwt + passport-jwt)
- class-validator and class-transformer
- Jest + Supertest

## Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create .env in api root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/enterprise_db"
JWT_SECRET="replace_with_secure_secret"
JWT_EXPIRATION="24h"
```

### 3) Apply database migrations and seed

```bash
npx prisma migrate deploy
npm run seed
```

For creating a new migration during development, use:

```bash
npx prisma migrate dev --name <migration_name>
```

### 4) Run backend

```bash
npm run start:dev
```

## Scripts

- npm run start:dev: run with watch mode
- npm run start:prod: run compiled build
- npm run build: compile TypeScript
- npm run lint: run eslint
- npm run test: unit tests
- npm run test:e2e: integration/e2e tests
- npm run test:cov: coverage report
- npm run seed: seed database

## Implemented API Surface

Auth and platform:

- POST /auth/register
- POST /auth/login
- GET /users (admin guarded)
- GET /dashboard (JWT guarded stats endpoint)

Business modules (controllers currently present):

- /employees
- /leads
- /timesheets
- /deals
- /campaign-leads
- /leave-requests
- /invoices
- /ledger-entries
- /tickets
- /form-submissions
- /marketing-campaigns
- /expenses
- /projects
- /tasks
- /contacts
- /events
- /dynamic-forms
- /quotes
- /payments
- /products
- /notifications
- /file-attachments
- /audit-logs
- /activities
- /reports
- /payroll
- /ats
- /performance

Typical endpoint pattern per module:

- GET list, GET by id
- POST create
- PATCH update
- DELETE remove
- Additional module-specific reporting/grouping endpoints (for example, by-status, by-department)
- Bulk import endpoint in several modules using POST /import

Project workflow endpoints:

- POST /projects
- POST /projects/:id/assign-manager
- PATCH /projects/:id/status
- GET /projects/:id/progress
- GET /projects/:id/links
- POST /projects/:id/links
- DELETE /projects/:id/links/:linkId

Task workflow endpoints:

- POST /tasks
- PATCH /tasks/:id/status
- POST /tasks/:id/submit-work
- POST /tasks/:id/review
- GET /tasks/upcoming

## Security and Authorization

- JWT token issued from login and used as Bearer token
- JwtAuthGuard applied on protected modules
- RolesGuard + Roles decorator applied where admin-only actions are required
- Users route is restricted to admin role
- Roles supported: ADMIN, HR, MANAGER, EMPLOYEE
- Project visibility is role scoped: admin sees all, manager sees owned projects, employee access is restricted
- Task visibility is role scoped: admin sees all, manager sees team/project tasks, employee sees assigned tasks
- Employee visibility is role scoped: admin/hr all, manager only team, employee self only

## Data Model Summary

The Prisma schema includes entities for:

- Identity: User, Role enum
- CRM: Lead, CampaignLead, Deal, Contact
- HR and work tracking: Employee, Timesheet, LeaveRequest, Task, Project, ProjectLink, Attendance
- HR core extensions: SalaryStructure, PayrollCycle, PayrollEntry, GoalCycle, Goal, PerformanceReview
- Recruitment: JobOpening, Candidate, Interview
- Finance: Invoice, LedgerEntry, Expense
- Operations and events: Ticket, TicketType, Event
- Marketing and forms: MarketingCampaign, DynamicForm, FormSubmission
- Sales and quoting: Quote, Product
- Platform support: Notification, FileAttachment, AuditLog, Activity

Refer to prisma/schema.prisma for full field-level schema.

## Project Structure

Key folders:

- src/auth: login/register, JWT strategy, guards
- src/common: decorators and enums
- src/prisma: Prisma module/service
- src/dashboard: stats aggregation
- src/<module>: controller, service, dto for each business module
- prisma/migrations: tracked evolution of domain model

## What Has Been Completed So Far

- Backend foundation with NestJS + Prisma fully in place
- Database schema expanded to support broad enterprise workflows
- Migration history committed for iterative module rollout
- REST module coverage implemented across CRM, HR, finance, and operations
- Dashboard endpoint providing cross-module aggregated stats
- Role-aware auth model integrated with protected endpoints
- Frontend integration enabled by CORS and stable localhost contract (3001 -> 3000)
- Project manager assignment and project progress aggregation endpoints
- Task submission and review workflow with statuses: PENDING, IN_PROGRESS, SUBMITTED, APPROVED, REJECTED

## Workflow Notes

- Task submission writes submissionLink and reviewComment fields used by employee/manager flows.
- Legacy task statuses are normalized to workflow-safe values in service logic and migration scripts.
- Project status is normalized to ACTIVE or COMPLETED for dashboard and filtering consistency.
- Expense workflow now supports staged approvals with status flow:
	- PENDING_MANAGER -> PENDING_HR -> APPROVED
	- Rejection path: REJECTED with rejectionReason and approvalTrail history
- Payroll run endpoint generates payroll entries for active salary structures per cycle.
- ATS supports candidate stage transitions and interview scheduling.

## Testing and Verification

```bash
npm run lint
npm run test
npm run test:e2e
```

## Notes for Contributors

- Keep DTO validation in sync with Prisma model updates
- Prefer migration-based schema changes over direct DB edits
- When adding a module, update app.module.ts imports and the frontend API layer
