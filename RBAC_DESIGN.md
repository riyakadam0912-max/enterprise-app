# Role-Based Access Control (RBAC) Design

## Overview
This document describes the RBAC system design for the Enterprise ERP application, providing granular access control through roles and permissions.

## Core Concepts

### 1. Roles
Roles represent job functions or organizational positions. Each role is a collection of permissions.

### 2. Permissions
Permissions are atomic access rights following the pattern: `resource.action`

### 3. Users
Users can have multiple roles, and inherit all permissions from those roles.

## Database Schema

```prisma
model User {
  id                      Int           @id @default(autoincrement())
  email                   String        @unique
  password                String
  role                    Role          // Legacy enum for backward compatibility
  userRoles               UserRole[]    // New RBAC system
  refreshTokens           RefreshToken[]
  securityEvents          SecurityEvent[]
  // ... other fields
}

model AppRole {
  id                Int                @id @default(autoincrement())
  name              String             @unique
  description       String?
  isActive          Boolean            @default(true)
  isSystem          Boolean            @default(false)  // Cannot be deleted
  userRoles         UserRole[]
  rolePermissions   RolePermission[]
}

model Permission {
  id                Int                @id @default(autoincrement())
  name              String             @unique  // e.g., "employee.read"
  resource          String             // e.g., "employee"
  action            String             // e.g., "read"
  description       String?
  isActive          Boolean            @default(true)
  rolePermissions   RolePermission[]
}

model UserRole {
  id          Int       @id @default(autoincrement())
  userId      Int
  roleId      Int
  assignedBy  Int?
  assignedAt  DateTime  @default(now())
  expiresAt   DateTime? // Optional expiration
  isActive    Boolean   @default(true)
  user        User      @relation(fields: [userId], references: [id])
  role        AppRole   @relation(fields: [roleId], references: [id])
  
  @@unique([userId, roleId])
}

model RolePermission {
  id           Int        @id @default(autoincrement())
  roleId       Int
  permissionId Int
  grantedBy    Int?
  grantedAt    DateTime   @default(now())
  role         AppRole    @relation(fields: [roleId], references: [id])
  permission   Permission @relation(fields: [permissionId], references: [id])
  
  @@unique([roleId, permissionId])
}
```

## Standard Roles

### SUPER_ADMIN
- **Description**: Full system access, can manage all resources
- **Permissions**: ALL
- **Use Case**: System administrators, IT team

### ADMIN
- **Description**: Administrative access to most modules
- **Permissions**: 
  - All CRUD operations on most resources
  - Cannot manage system configuration
- **Use Case**: General administrators

### HR_MANAGER
- **Description**: Human Resources management
- **Permissions**:
  - employee.* (all employee operations)
  - leave.* (all leave operations)
  - attendance.* (all attendance operations)
  - performance.* (all performance operations)
- **Use Case**: HR department heads

### PAYROLL_MANAGER
- **Description**: Payroll processing and management
- **Permissions**:
  - payroll.* (all payroll operations)
  - employee.read
  - attendance.read
- **Use Case**: Payroll department

### FINANCE_MANAGER
- **Description**: Financial operations management
- **Permissions**:
  - invoice.* (all invoice operations)
  - payment.* (all payment operations)
  - ledger.* (all ledger operations)
  - report.finance (financial reports)
- **Use Case**: Finance department heads

### SALES_MANAGER
- **Description**: Sales and CRM management
- **Permissions**:
  - lead.* (all lead operations)
  - deal.* (all deal operations)
  - contact.* (all contact operations)
  - quote.* (all quote operations)
- **Use Case**: Sales team leaders

### MANAGER
- **Description**: Team management capabilities
- **Permissions**:
  - employee.read
  - leave.approve
  - expense.approve
  - task.* (all task operations)
  - project.read
- **Use Case**: Department managers, team leads

### EMPLOYEE
- **Description**: Standard employee access
- **Permissions**:
  - employee.read (own profile)
  - leave.create (own leave requests)
  - expense.create (own expenses)
  - task.read (assigned tasks)
  - attendance.create (own attendance)
- **Use Case**: Regular employees

### CONTRACTOR
- **Description**: Limited access for contractors
- **Permissions**:
  - task.read (assigned tasks)
  - project.read (assigned projects)
  - timesheet.create (own timesheets)
- **Use Case**: External contractors, consultants

## Permission Categories

### Employee Management
```
employee.read
employee.create
employee.update
employee.delete
employee.export
employee.import
```

### Leave Management
```
leave.read
leave.create
leave.update
leave.delete
leave.approve
leave.reject
```

### Payroll
```
payroll.read
payroll.create
payroll.update
payroll.delete
payroll.process
payroll.approve
payroll.export
```

### Attendance
```
attendance.read
attendance.create
attendance.update
attendance.delete
attendance.approve
```

### CRM
```
lead.read
lead.create
lead.update
lead.delete
lead.convert
deal.read
deal.create
deal.update
deal.delete
deal.close
contact.read
contact.create
contact.update
contact.delete
```

### Finance
```
invoice.read
invoice.create
invoice.update
invoice.delete
invoice.approve
payment.read
payment.create
payment.update
payment.delete
payment.approve
ledger.read
ledger.create
ledger.update
```

### Projects & Tasks
```
project.read
project.create
project.update
project.delete
project.manage
task.read
task.create
task.update
task.delete
task.assign
```

### Reports
```
report.read
report.create
report.export
report.finance
report.hr
report.sales
```

### System Administration
```
user.read
user.create
user.update
user.delete
role.read
role.create
role.update
role.delete
permission.read
permission.assign
audit.read
```

## Implementation

### Backend: Checking Permissions

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { RequirePermissions } from './auth/decorators/permissions.decorator';

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  
  @Get()
  @RequirePermissions('employee.read')
  findAll() {
    // Only users with employee.read permission can access
  }

  @Post()
  @RequirePermissions('employee.create')
  create(@Body() dto: CreateEmployeeDto) {
    // Only users with employee.create permission can access
  }

  @Delete(':id')
  @RequirePermissions('employee.delete')
  remove(@Param('id') id: string) {
    // Only users with employee.delete permission can access
  }
}
```

### Backend: Checking Roles

```typescript
import { Roles } from './auth/decorators/roles.decorator';
import { RolesGuard } from './auth/guards/roles.guard';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  
  @Post('process')
  @Roles('PAYROLL_MANAGER', 'ADMIN')
  processPayroll() {
    // Only PAYROLL_MANAGER or ADMIN can access
  }
}
```

### Backend: Combining Role and Permission Checks

```typescript
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class EmployeesController {
  
  @Post(':id/promote')
  @Roles('HR_MANAGER', 'ADMIN')
  @RequirePermissions('employee.update', 'employee.promote')
  promote(@Param('id') id: string) {
    // Must have HR_MANAGER or ADMIN role
    // AND have both employee.update and employee.promote permissions
  }
}
```

### Frontend: Checking Permissions

```typescript
import { useAuth } from '@/hooks/useAuth';

function EmployeeActions() {
  const { permissions } = useAuth();

  const canCreate = permissions.includes('employee.create');
  const canDelete = permissions.includes('employee.delete');

  return (
    <div>
      {canCreate && <button>Create Employee</button>}
      {canDelete && <button>Delete Employee</button>}
    </div>
  );
}
```

### Frontend: Checking Roles

```typescript
import { useAuth } from '@/hooks/useAuth';

function AdminPanel() {
  const { roles } = useAuth();

  const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');

  if (!isAdmin) {
    return <div>Access Denied</div>;
  }

  return <div>Admin Panel Content</div>;
}
```

## Permission Assignment Flow

### 1. Create Role
```typescript
POST /roles
{
  "name": "SALES_REPRESENTATIVE",
  "description": "Sales team member",
  "isActive": true
}
```

### 2. Assign Permissions to Role
```typescript
POST /roles/:roleId/permissions
{
  "permissionIds": [1, 2, 3, 4] // lead.read, lead.create, deal.read, deal.create
}
```

### 3. Assign Role to User
```typescript
POST /users/:userId/roles
{
  "roleIds": [5], // SALES_REPRESENTATIVE role
  "expiresAt": "2025-12-31T23:59:59Z" // Optional expiration
}
```

### 4. User Inherits Permissions
User now has:
- lead.read
- lead.create
- deal.read
- deal.create

## Dynamic Permission Checking

### Service Layer
```typescript
@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: number) {
    // Get user with permissions
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true }
                }
              }
            }
          }
        }
      }
    });

    // Extract permissions
    const permissions = user.userRoles.flatMap(ur =>
      ur.role.rolePermissions.map(rp => rp.permission.name)
    );

    // Check permission
    if (!permissions.includes('employee.read')) {
      throw new ForbiddenException('Missing employee.read permission');
    }

    // Proceed with operation
    return this.prisma.employee.findMany();
  }
}
```

## Permission Inheritance

Users can have multiple roles, and permissions are accumulated:

```
User: John Doe
Roles:
  - MANAGER (permissions: employee.read, leave.approve, task.*)
  - SALES_REPRESENTATIVE (permissions: lead.*, deal.*, contact.read)

Effective Permissions:
  - employee.read
  - leave.approve
  - task.read
  - task.create
  - task.update
  - task.delete
  - lead.read
  - lead.create
  - lead.update
  - lead.delete
  - deal.read
  - deal.create
  - deal.update
  - deal.delete
  - contact.read
```

## Audit Trail

All role and permission changes are logged:

```typescript
// When role is assigned to user
await this.prisma.securityEvent.create({
  data: {
    userId: targetUserId,
    eventType: 'ROLE_ASSIGNED',
    severity: 'INFO',
    details: {
      roleId: roleId,
      roleName: role.name,
      assignedBy: currentUserId,
    },
  },
});

// When permission is granted to role
await this.prisma.securityEvent.create({
  data: {
    eventType: 'PERMISSION_GRANTED',
    severity: 'INFO',
    details: {
      roleId: roleId,
      permissionId: permissionId,
      permissionName: permission.name,
      grantedBy: currentUserId,
    },
  },
});
```

## Best Practices

### 1. Principle of Least Privilege
- Grant only the minimum permissions required
- Start with restrictive permissions, expand as needed
- Regular permission audits

### 2. Role Design
- Create roles based on job functions, not individuals
- Keep roles focused and specific
- Avoid creating too many roles (role explosion)

### 3. Permission Naming
- Use consistent naming: `resource.action`
- Be specific: `employee.update` vs `employee.update.salary`
- Document each permission clearly

### 4. Testing
- Test permission checks in unit tests
- Test role assignments in integration tests
- Test UI permission hiding in E2E tests

### 5. Performance
- Cache user permissions in JWT payload
- Use database indexes on role/permission tables
- Avoid N+1 queries when loading permissions

## Migration Strategy

### Phase 1: Parallel Systems
- Keep legacy `role` enum field
- Add new RBAC system alongside
- Both systems active simultaneously

### Phase 2: Gradual Migration
- Migrate users to new RBAC system
- Update code to check both systems
- Monitor and validate

### Phase 3: Complete Transition
- Remove legacy role checks
- Deprecate role enum field
- Full RBAC enforcement

## Troubleshooting

### User Can't Access Resource
1. Check if user has required role
2. Check if role has required permission
3. Check if permission is active
4. Check if user role is active and not expired

### Permission Not Working
1. Verify permission exists in database
2. Check permission is assigned to role
3. Verify role is assigned to user
4. Clear any permission caches

### Too Many Permissions
1. Review and consolidate similar permissions
2. Create permission groups
3. Use wildcard permissions (e.g., `employee.*`)

## Future Enhancements

- [ ] Permission groups/categories
- [ ] Conditional permissions (time-based, location-based)
- [ ] Permission delegation
- [ ] Temporary permission elevation
- [ ] Permission request workflow
- [ ] Advanced permission analytics