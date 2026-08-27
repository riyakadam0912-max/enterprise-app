# Enterprise ERP/CRM Platform Documentation

## 1. Executive Summary

This platform is a full ERP/CRM system designed to unify sales, human resources, finance, attendance, payroll, analytics, and notifications in one operational suite. It provides a single source of truth for employee, customer, and transaction data while giving each department a role-aware experience tailored to its daily work.

The system is built for:

- HR teams managing employees, leave, attendance, payroll, and performance.
- Sales teams tracking leads, deals, contacts, quotes, and pipeline progression.
- Finance teams handling invoices, payments, ledger entries, and expenses.
- Administrators overseeing access, workflow approvals, reporting, and governance.

The core value proposition is operational consistency. Instead of maintaining separate spreadsheets or disconnected tools for HR, CRM, and finance, the platform uses shared records, controlled workflows, and real-time reporting. That reduces duplication, improves auditability, and gives leadership faster access to reliable business metrics.

## 2. System Architecture

The solution uses a three-tier enterprise architecture:

1. Frontend: Next.js App Router application written in TypeScript.
2. Backend: NestJS API exposing REST endpoints and workflow services.
3. Database: Prisma ORM backed by a SQL database for transactional storage and relational integrity.

### High-Level Flow

```text
User Browser
   -> Next.js Frontend
   -> NestJS API (/api/v1/...)
   -> Service Layer
   -> Prisma ORM
   -> SQL Database
```

### Request Flow

1. The user interacts with a page in the frontend, such as a leave request form or a dashboard report.
2. The frontend sends an authenticated request to the backend API.
3. NestJS routes the request to the correct controller.
4. The controller delegates business logic to a service.
5. The service validates permissions, applies workflow rules, and reads or writes data using Prisma.
6. The database persists the transaction, and the service returns a typed response.
7. The frontend refreshes the view and shows updated data.

### API Structure

The API follows a versioned REST pattern under `/api/v1/...`. Example routes include:

- `/api/v1/analytics/summary`
- `/api/v1/leads`
- `/api/v1/leave-requests`
- `/api/v1/attendance`
- `/api/v1/payroll`

Versioning keeps the platform stable as modules evolve and allows the business to add future features without breaking older clients.

## 3. Technology Stack

### Next.js

Next.js is used for the frontend because it provides a modern App Router structure, server-friendly routing, and an excellent developer experience for complex enterprise portals. It is well suited to authenticated dashboards, module-based navigation, and data-driven views.

Benefits:

- Strong routing model for large business applications.
- Good performance for dashboard pages and code splitting.
- Easy integration with TypeScript and reusable UI components.
- Supports both interactive screens and reporting-heavy pages.

### NestJS

NestJS is used for the backend because it provides a structured, modular architecture with clear separation of controllers, services, guards, and providers. That makes it ideal for ERP systems where business rules, permissions, and workflows must remain predictable.

Benefits:

- Modular codebase that scales with many business domains.
- Built-in support for validation, dependency injection, and guards.
- Clean separation of API, workflow, and persistence logic.
- Well suited to role-based enterprise workflows.

### Prisma

Prisma is used for the database layer because it gives a type-safe ORM over a relational SQL database. It reduces schema mistakes, makes relationships explicit, and keeps the data model aligned with TypeScript application code.

Benefits:

- Type-safe database access.
- Clear relational modeling.
- Easier migrations and schema evolution.
- Better maintainability for enterprise-grade domain models.

## 4. Module Overview

### 4.1 CRM Module

The CRM module manages the sales pipeline from lead capture to deal closure.

Core capabilities:

- Lead management for storing and tracking prospects.
- Deal pipeline management for revenue opportunities.
- Stage tracking with probability and close date forecasting.
- Activity logging for calls, follow-ups, and touchpoints.

Why it matters:

- Sales teams can see pipeline health in one place.
- Managers can measure conversion rates and forecast revenue.
- Activities are tied to people and records instead of living in email threads.

### 4.2 HRMS Module

The HRMS module manages the employee lifecycle and work-related records.

Core capabilities:

- Employee master data.
- Leave request submission and multi-step approvals.
- Attendance tracking with check-in and check-out.
- Payroll basics such as salary structures, payroll cycles, and payroll entries.

Why it matters:

- HR has one consistent employee record across all workflows.
- Managers and HR can approve leave with audit history.
- Attendance and leave data can feed payroll and reporting.

### 4.3 Finance Module

The finance module covers core transaction and bookkeeping workflows.

Core capabilities:

- Invoices for billing and receivables.
- Payments for invoice settlement.
- Ledger entries for accounting visibility.
- Expense tracking for employee and company spend.

Why it matters:

- Finance can track money movement without manual spreadsheets.
- Each transaction is linked back to the relevant user or employee.
- Reporting is easier because records are structured and queryable.

### 4.4 Analytics & Dashboard

The analytics layer provides cross-module executive visibility.

Core capabilities:

- KPI cards for quick operational overview.
- Reports for sales, HR, finance, and attendance.
- Real-time or near-real-time summary statistics.

Why it matters:

- Leadership can monitor business health in one dashboard.
- Aggregate views reduce manual reporting effort.
- Operational bottlenecks are easier to spot early.

### 4.5 Notifications System

The notifications system captures business alerts and workflow messages.

Core capabilities:

- Real-time alerts for approvals, actions, and workflow events.
- Unread counts for user attention management.
- Notification records stored in the database for traceability.

Why it matters:

- Users do not need to constantly refresh screens or search for updates.
- Approvals and exceptions are visible immediately.
- The business maintains an auditable message trail.

### 4.6 Timesheets

The timesheets module records work logs and supports reporting.

Core capabilities:

- Work logging by employee or task.
- Daily and period-based reporting.
- Support for downstream payroll and productivity visibility.

Why it matters:

- Managers can see how time is being spent.
- Time data can support billing, planning, and performance analysis.
- Work entries are structured instead of being captured informally.

## 5. Database Design (Prisma)

The database is designed around relational entities that represent people, work, money, and workflow status. Key models are linked through foreign keys and unique constraints to preserve integrity.

### Key Models

#### User

The `User` model stores login identity, roles, and employee linkage.

```prisma
model User {
  id         Int     @id @default(autoincrement())
  name       String
  email      String  @unique
  password   String
  role       Role
  employeeId Int?    @unique
  managerId  Int?
}
```

#### Lead

Leads represent sales prospects and can be assigned to employees.

```prisma
model Lead {
  id            Int   @id @default(autoincrement())
  name          String
  status        String @default("New")
  assignedToId  Int?
  leadScore     Int?
}
```

#### Deal

Deals capture pipeline opportunities linked to leads and contacts.

```prisma
model Deal {
  id           Int    @id @default(autoincrement())
  title        String
  value        Float
  stage        String @default("NEW")
  probability  Float?
  leadId       Int?
  contactId    Int?
  assignedToId Int?
}
```

#### LeaveRequest

Leave requests store HR approval workflows.

```prisma
model LeaveRequest {
  id           Int      @id @default(autoincrement())
  employeeId   Int?
  startDate    DateTime
  endDate      DateTime
  leaveType    String
  status       String   @default("PENDING")
  approvalTrail Json?
}
```

#### Attendance

Attendance stores daily check-in and check-out data.

```prisma
model Attendance {
  id            Int      @id @default(autoincrement())
  employeeId    Int
  date          DateTime
  checkIn       DateTime?
  checkOut      DateTime?
  workingHours  Float?
  lateMinutes   Int      @default(0)
  overtimeHours Float    @default(0)
  status        AttendanceStatus

  @@unique([employeeId, date])
}
```

#### Invoice

Invoices represent billing documents.

```prisma
model Invoice {
  id          Int      @id @default(autoincrement())
  invoiceNo   String   @unique
  status      String   @default("DRAFT")
  totalAmount Float    @default(0)
  userId      Int
}
```

#### Payment

Payments capture invoice settlement.

```prisma
model Payment {
  id            Int      @id @default(autoincrement())
  invoiceId     Int
  amount        Float
  paymentMethod String
  status        String
}
```

### Design Principles

- Shared master entities reduce duplication.
- Transactional records reference master data through IDs.
- Approval history is stored as structured workflow data.
- Unique constraints prevent duplicate operational records.

## 6. API Design

The API uses REST conventions and standardizes responses so the frontend can consume all modules consistently.

### REST Structure

- `GET` for list and read operations.
- `POST` for creating new records.
- `PATCH` for updates and workflow transitions.
- `DELETE` for removal or soft deletion.

### Example Endpoints

- `GET /api/v1/analytics/summary`
- `POST /api/v1/leads`
- `DELETE /api/v1/leads/:id`
- `POST /api/v1/leave-requests`
- `PATCH /api/v1/leave-requests/:id/manager-approve`
- `PATCH /api/v1/attendance/check-in`
- `PATCH /api/v1/attendance/check-out`

### Standard API Response Envelope

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

Error responses follow the same structure with `success: false` and a populated `error` object or message. This makes the frontend simpler, more consistent, and easier to debug.

## 7. Authentication & Authorization

The platform uses JWT-based authentication for secure session handling.

### Authentication Flow

1. User signs in with email and password.
2. Backend validates credentials and issues a JWT.
3. Frontend stores the token and sends it on protected requests.
4. Guards verify the token before allowing access.

### Role-Based Access Control

Supported roles include:

- Admin
- HR
- Manager
- Employee

Role-based access ensures that users only see and modify what they are allowed to access. For example, managers can approve team leave requests, HR can finalize leave approvals, and employees can only submit or edit their own data within policy limits.

## 8. Frontend Architecture

The frontend follows a modular App Router structure suitable for enterprise dashboards.

### Folder Structure

```text
web/
  app/
    dashboard/
    ess/
    login/
  src/
    api/
    components/
    hooks/
    services/
    utils/
```

### Component Design

- Pages provide route-level screens.
- Shared components provide tables, dashboards, and action controls.
- Feature-specific hooks encapsulate API calls and state transitions.
- Layouts enforce authentication and role-aware navigation.

### API Client Handling

The frontend uses a typed API client layer to centralize backend access, reduce repetitive fetch logic, and keep request/response shapes consistent.

### State Management Approach

The application relies primarily on React component state and feature hooks. This is appropriate for a modular ERP because most state is local to a page, a workflow, or a data grid rather than a global real-time store.

## 9. Testing Strategy

The platform uses layered testing to protect both business rules and user flows.

### Unit Tests

- Validate isolated service logic.
- Confirm workflow rules such as approval transitions and attendance constraints.

### E2E Tests

- Verify complete user journeys.
- Confirm controllers, services, and persistence work together.

### Contract Testing

- Protect API shapes consumed by the frontend.
- Reduce regressions in dashboard and workflow endpoints.

### Smoke Tests

- Quickly validate that critical reports and modules load.
- Useful after deployment or schema changes.

## 10. Error Handling & Logging

The backend uses structured error handling so clients receive meaningful failures and operators can diagnose issues quickly.

### Global Exception Strategy

- Authentication errors return unauthorized responses.
- Validation errors return bad request responses with clear messages.
- Not-found and forbidden errors communicate workflow or access issues.

### API Error Structure

```json
{
  "success": false,
  "data": null,
  "error": {
    "message": "Leave request is not pending manager approval"
  }
}
```

### Debugging Approach

- Use backend logs to identify workflow failures.
- Use dashboard state and status fields to trace user actions.
- Use approval trails and audit records to reconstruct historical behavior.

## 11. Deployment Strategy

### Local Development Setup

1. Install dependencies in the frontend and backend.
2. Start the NestJS API on port 3000.
3. Start the Next.js frontend on port 3001.
4. Confirm the frontend can reach the backend through CORS-enabled requests.

### Environment Variables

Typical required configuration includes:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRATION`
- `FRONTEND_URL`
- `REDIS_URL` or Redis host and port if queues are enabled

### Production Deployment Overview

- Deploy the frontend to a web host or container platform.
- Deploy the NestJS API separately behind a secure reverse proxy.
- Run Prisma migrations during release deployment.
- Monitor API errors, database health, and workflow throughput.

## 12. Known Issues & Troubleshooting

### ECONNREFUSED

Cause: The backend API is not running or the frontend is pointing to the wrong port.

Fix:

- Start the API on port 3000.
- Confirm the frontend is using the correct base URL.
- Ensure CORS allows the frontend origin.

### Prisma Schema Mismatch

Cause: The code and database schema are out of sync after a migration change.

Fix:

- Run the Prisma migration workflow.
- Regenerate the Prisma client.
- Restart the backend and refresh the TypeScript environment.

### Undefined Variables in React

Cause: A component references data before it has loaded.

Fix:

- Add loading states.
- Guard against null or undefined values.
- Verify hook return values before rendering.

### Migration Errors

Cause: Conflicting schema history or incomplete migration execution.

Fix:

- Review migration files for drift.
- Reconcile schema changes before release.
- Ensure database permissions and connection settings are correct.

## 13. Future Enhancements

- AI-assisted analytics and forecasting.
- Mobile application for approvals and field access.
- Multi-tenant architecture for multiple companies.
- More granular role-based dashboards.
- Advanced reporting warehouse for historical trend analysis.
- Queue-based notifications for email, SMS, and push delivery.

## 14. Conclusion

This ERP/CRM platform provides a scalable and extensible foundation for managing customers, employees, finances, attendance, payroll, and analytics in a single system. Its modular architecture, shared relational database, workflow enforcement, and role-based access controls make it suitable for growing organizations that need both operational efficiency and trustworthy reporting.

The system is designed to evolve. New modules, approvals, reports, and integrations can be added without disrupting the core platform, which is exactly what enterprise software needs to support long-term growth.