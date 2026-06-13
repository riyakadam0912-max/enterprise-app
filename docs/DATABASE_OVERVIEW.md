# Database Overview

This document provides a complete explanation of the database architecture, storage, access patterns, and current issues for the enterprise application.

---

## 1. Database Technology & Configuration

### **What database is used?**
- **PostgreSQL** is the relational database management system (RDBMS) used.

### **Connection Configuration**
The database connection is configured using environment variables. The main configuration file is:
- **`api/.env.example`** contains the template configuration

#### **Key Configuration**
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/enterprise_db"
```
- **Username**: `postgres`
- **Password**: `password`
- **Host**: `localhost`
- **Port**: `5432`
- **Database Name**: `enterprise_db`

---

## 2. ORM & Client Library

### **Prisma ORM**
Prisma is used as the Object-Relational Mapper (ORM) to interact with the database.

#### **Prisma Schema File**
The schema is defined in:
- **`api/prisma/schema.prisma`**

#### **Prisma Client**
- **Location**: Generated in `api/node_modules/.prisma/client`
- **Regeneration Command**:
  ```bash
  cd api && npx prisma generate
  ```
  Or via package script:
  ```bash
  cd api && npm run prisma:generate
  ```

---

## 3. Database Storage

### **Where is the data stored?**
PostgreSQL stores data in its data directory, typically:
- On Windows: `C:\Program Files\PostgreSQL\<version>\data`
- On Linux/macOS: `/var/lib/postgresql/<version>/data`

However, the exact location depends on your PostgreSQL installation.

### **Data Directory Contents**
- **Base**: Contains per-database subdirectories
- **Global**: Contains global tables like `pg_database`
- **PG_VERSION**: PostgreSQL version file
- **pg_wal**: Write-Ahead Logging (WAL) files
- **pg_hba.conf**: Client authentication configuration

---

## 4. Prisma Service (NestJS Integration)

### **Prisma Service File**
- **Location**: `api/src/prisma/prisma.service.ts`

### **Features Implemented in PrismaService**
1. **Soft Delete Middleware**:
   - Adds a `deletedAt` timestamp instead of actually deleting records
   - Located at: `api/prisma/middleware/softDelete.ts`

2. **Audit Logging Middleware**:
   - Automatically logs all create/update/delete operations
   - Redacts sensitive data (passwords, tokens, secrets)
   - Logs to the `AuditLog` table

3. **Soft Delete & Restore Methods**:
   ```typescript
   async softDeleteById(model: string, id: number)
   async restoreById(model: string, id: number)
   ```

### **PrismaService Class**
```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {
    // Configure with DATABASE_URL
    // Apply middlewares
  }

  async onModuleInit() {
    await this.$connect();
  }
}
```

---

## 5. Database Schema & Models

The schema defines **60+ models** organized into modules:

### **Core Modules**

#### **1. Identity & Access Management (IAM)**
| Model | Purpose |
|-------|---------|
| `User` | System users with login credentials |
| `AppRole` | Role definitions (e.g., ADMIN, HR, EMPLOYEE) |
| `Permission` | Granular permissions (e.g., employee.read, invoice.approve) |
| `RolePermission` | Junction table linking roles to permissions |
| `UserRole` | Junction table linking users to roles |

#### **2. HR & Employee Management**
| Model | Purpose |
|-------|---------|
| `Employee` | Employee records (personal info, salary, etc.) |
| `Attendance` | Daily attendance records |
| `LeaveRequest` | Employee leave requests |
| `Shift` | Work shift definitions |

#### **3. Payroll**
| Model | Purpose |
|-------|---------|
| `PayrollCycle` | Monthly payroll cycles |
| `PayrollEntry` | Individual payroll entries per employee |
| `SalaryStructure` | Salary breakdown (basic, HRA, allowances, etc.) |
| `Payslip` | Generated payslip records |
| `PayrollEarnings` | Earnings details |
| `PayrollDeduction` | Deductions details |
| `PayrollConfig` | Payroll configuration (tax rates, PF limits, etc.) |
| `TaxDeclaration` | Employee tax declarations |
| `Form16` | Generated Form 16 documents |

#### **4. Projects & Tasks**
| Model | Purpose |
|-------|---------|
| `Project` | Project details |
| `ProjectMember` | Project team members |
| `ProjectMessage` | Project chat messages |
| `ProjectLink` | Links associated with projects |
| `Task` | Tasks assigned to employees |

#### **5. CRM (Customer Relationship Management)**
| Model | Purpose |
|-------|---------|
| `Lead` | Sales leads |
| `Deal` | Sales deals |
| `Contact` | Customer contacts |
| `CampaignLead` | Leads from marketing campaigns |
| `Quote` | Sales quotes |
| `QuoteItem` | Line items in quotes |
| `MarketingCampaign` | Marketing campaigns |

#### **6. Accounting & Finance**
| Model | Purpose |
|-------|---------|
| `Invoice` | Invoices |
| `Payment` | Invoice payments |
| `LedgerEntry` | Accounting ledger entries |
| `Expense` | Expense claims |

#### **7. Inventory**
| Model | Purpose |
|-------|---------|
| `Product` | Products |
| `ProductCategory` | Product categories |

#### **8. Files & Assets**
| Model | Purpose |
|-------|---------|
| `File` | File metadata (storage provider, path, URL, etc.) |
| `FileActivity` | File activity logs (download, preview, etc.) |
| `FileAttachment` | File attachments to entities |

#### **9. Notifications**
| Model | Purpose |
|-------|---------|
| `Notification` | Notification records |
| `NotificationRecipient` | Recipients of notifications |
| `NotificationDeliveryLog` | Delivery attempt logs |
| `NotificationPreference` | User notification preferences |
| `NotificationTemplate` | Notification templates |

#### **10. Workflows & Approvals**
| Model | Purpose |
|-------|---------|
| `WorkflowDefinition` | Workflow definitions |
| `WorkflowStage` | Stages in a workflow |
| `WorkflowInstance` | Running workflow instances |
| `WorkflowStep` | Individual steps in an instance |
| `WorkflowRule` | Business rules for workflows |
| `WorkflowAction` | Actions taken in workflows |
| `WorkflowComment` | Comments on workflows |
| `WorkflowAssignment` | Assignments in workflows |
| `WorkflowHistory` | History of workflow changes |
| `WorkflowNotification` | Notifications from workflows |

#### **11. Audit & Activity**
| Model | Purpose |
|-------|---------|
| `AuditLog` | Audit trail of all changes |
| `Activity` | Activity feed entries |
| `ActivityTimeline*` | Activity timeline models |

#### **12. ATS (Applicant Tracking System)**
| Model | Purpose |
|-------|---------|
| `JobOpening` | Job postings |
| `Candidate` | Job applicants |

---

## 6. Database Access Patterns

### **How is the database accessed?**
1. **NestJS REST Controllers**: Handle HTTP requests
2. **Prisma Client**: Executes queries against PostgreSQL
3. **Middleware**: Soft delete and audit logging are applied automatically

### **Example Query Flow**
```typescript
// 1. Controller receives HTTP request
@Get()
@Roles(Role.ADMIN)
@RequirePermissions(Permission.EMPLOYEE_READ)
findAll(@Req() req) {
  return this.employeesService.findAll(req.user);
}

// 2. Service uses PrismaClient
async findAll(user: any) {
  return this.prisma.employee.findMany({
    where: { deletedAt: null },
  });
}

// 3. PrismaService applies middlewares (audit log, soft delete)
// 4. Prisma Client executes SQL query
// 5. Results are returned to the client
```

---

## 7. Migrations

### **Migration Files**
Located in: `api/prisma/migrations/`
- **20260302050747_init**: Initial schema
- **20260312074228_add_products_payments_notifications_files_audit_rbac**: Adds RBAC system
- **20260313064616_add_attendance_module**: Adds attendance tracking
- **...25+ additional migrations**: Adding more features

### **Migration Commands**
```bash
# Check migration status
cd api && npx prisma migrate status

# Apply pending migrations
cd api && npx prisma migrate deploy

# Create new migration from schema changes
cd api && npx prisma migrate dev --name <migration_name>

# Sync schema directly without migrations (development only)
cd api && npx prisma db push
```

---

## 8. Seeding

### **Seed File**
- **Location**: `api/prisma/seed.ts`

### **What does the seed do?**
1. Clears existing data
2. Creates permissions (60+ granular permissions)
3. Creates roles with permissions:
   - SUPER_ADMIN: Full access
   - ADMIN: Broad administrative access
   - HR: HR module access
   - MANAGER: Team management access
   - EMPLOYEE: Basic employee access
4. Creates admin user:
   - Email: `admin@example.com`
   - Password: `admin123`
5. Creates 50 employees across 4 departments (Sales, Engineering, HR, Finance)
6. Creates 5 managers
7. Creates 3 months of attendance data
8. Creates 5 tasks per employee
9. Creates 3 months of payroll data

### **Seed Command**
```bash
cd api && npm run seed
```

---

## 9. Current Issues & Solutions

### **Issue 1: Migration History Problems**
- **Problem**: Some migrations fail to apply because they reference tables or types created in later migrations
- **Example**: Migration `20260320000000_create_shift_table` fails because `ShiftType` enum isn't created yet
- **Current Workaround**: Use `prisma db push` instead of migrations for development
- **Solution**:
  1. Fix migration order
  2. Ensure all enums/tables are created before they're referenced
  3. Alternatively, reset migration history and recreate from scratch

### **Issue 2: Duplicate Prisma Service Files**
- **Problem**: Two Prisma service files exist:
  - `api/src/prisma.service.ts` (empty)
  - `api/src/prisma/prisma.service.ts` (actual implementation)
- **Solution**: Delete the empty file

### **Issue 3: Soft Delete Middleware**
- **Notes**: The soft delete middleware is implemented, but not all queries filter by `deletedAt: null` automatically
- **Solution**: Ensure all queries include the `deletedAt: null` condition

---

## 10. Database Best Practices Implemented

1. **Soft Deletes**: Instead of deleting records, set `deletedAt` timestamp
2. **Audit Logging**: All changes are logged automatically
3. **Sensitive Data Redaction**: Passwords, tokens, and secrets are redacted in audit logs
4. **RBAC**: Granular role-based access control with permissions
5. **Prisma ORM**: Type-safe database access
6. **Migrations**: Version-controlled schema changes

---

## 11. Useful Commands

```bash
# Prisma
cd api
npx prisma generate          # Regenerate client
npx prisma db push           # Sync schema to DB
npx prisma migrate deploy    # Apply migrations
npx prisma studio            # Open Prisma Studio (GUI)
npx prisma validate          # Validate schema

# Database
npm run seed                 # Seed database
npm run build                # Build API
npm run start:dev            # Start dev server
```

---

## 12. Key Files Summary

| File | Purpose |
|------|---------|
| `api/prisma/schema.prisma` | Database schema definition |
| `api/prisma/seed.ts` | Database seeding script |
| `api/src/prisma/prisma.service.ts` | Prisma service with middlewares |
| `api/.env.example` | Environment variable template |
| `api/src/common/enums/permissions.enum.ts` | Permission enum definitions |
| `api/src/common/enums/role.enum.ts` | Role enum definitions |
