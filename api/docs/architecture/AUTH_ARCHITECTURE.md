# Enterprise ERP Authentication Architecture

## Overview
This document describes the enterprise-grade authentication and authorization architecture implemented for the ERP system.

## Security Model

### Authentication Flow

#### 1. Login Process
```
Client → POST /auth/login {email, password}
  ↓
Server validates credentials
  ↓
Server checks account status (active, not locked)
  ↓
Server generates Access Token (15min) + Refresh Token (7d)
  ↓
Server stores Refresh Token in database with device info
  ↓
Server sets HttpOnly cookies:
  - access_token (HttpOnly, Secure, SameSite=Strict)
  - refresh_token (HttpOnly, Secure, SameSite=Strict)
  ↓
Server returns user info (NO tokens in response body)
  ↓
Client receives user data only
```

#### 2. Authenticated Requests
```
Client → GET /api/protected-resource
  ↓
Browser automatically sends HttpOnly cookies
  ↓
Server extracts access_token from cookie
  ↓
JWT Strategy validates token
  ↓
Server loads user with roles & permissions from database
  ↓
Guards check authorization (roles/permissions)
  ↓
Server processes request
  ↓
Server returns response
```

#### 3. Token Refresh Flow
```
Client → POST /auth/refresh
  ↓
Browser sends refresh_token cookie
  ↓
Refresh Strategy validates token
  ↓
Server checks token in database (not revoked, not expired)
  ↓
Server revokes old refresh token
  ↓
Server generates new Access + Refresh tokens
  ↓
Server stores new refresh token in database
  ↓
Server sets new HttpOnly cookies
  ↓
Client continues with new tokens
```

#### 4. Logout Flow
```
Client → POST /auth/logout
  ↓
Server revokes refresh token in database
  ↓
Server clears HttpOnly cookies
  ↓
Client session terminated
```

## Authorization Model

### Role-Based Access Control (RBAC)

#### Roles Hierarchy
```
SUPER_ADMIN (Full system access)
  ├── ADMIN (Administrative access)
  ├── HR_MANAGER (HR module access)
  ├── PAYROLL_MANAGER (Payroll access)
  ├── FINANCE_MANAGER (Finance access)
  └── SALES_MANAGER (CRM access)
      ├── MANAGER (Team management)
      ├── EMPLOYEE (Standard access)
      └── CONTRACTOR (Limited access)
```

#### Permission System
Permissions follow the pattern: `resource.action`

Examples:
- `employee.read` - View employees
- `employee.create` - Create employees
- `employee.update` - Update employees
- `employee.delete` - Delete employees
- `payroll.process` - Process payroll
- `payroll.approve` - Approve payroll
- `leave.approve` - Approve leave requests

### Database-Driven Authorization

```prisma
User
  ├── UserRole (many-to-many)
  │     └── AppRole
  │           └── RolePermission (many-to-many)
  │                 └── Permission
  └── Direct role field (legacy, for backward compatibility)
```

## Security Features

### 1. HttpOnly Cookies
- **Access Token**: 15 minutes, HttpOnly, Secure, SameSite=Strict
- **Refresh Token**: 7 days, HttpOnly, Secure, SameSite=Strict
- **Protection**: XSS attacks cannot access tokens via JavaScript

### 2. Token Rotation
- Refresh tokens are single-use
- New refresh token issued on each refresh
- Old tokens automatically revoked
- Prevents token replay attacks

### 3. Account Security
- **Failed Login Tracking**: Counts failed attempts
- **Account Lockout**: 5 failed attempts = 30-minute lockout
- **Password History**: Prevents reuse of last 5 passwords
- **Password Complexity**: 
  - Minimum 8 characters
  - Requires uppercase, lowercase, numbers, special chars
- **Password Expiration**: Force change every 90 days

### 4. Session Management
- All active sessions tracked per user
- Device information captured (IP, User-Agent, Device ID)
- Support for "Logout All Devices"
- Automatic cleanup of expired sessions

### 5. Audit Trail
All security events logged:
- Login success/failure
- Logout
- Token refresh
- Password change
- Role/permission changes
- Account lockout
- Suspicious activity

### 6. API Security
- **Helmet**: Security headers (CSP, HSTS, etc.)
- **Rate Limiting**: 10 requests/minute per IP
- **CSRF Protection**: Token-based CSRF prevention
- **Input Validation**: DTO validation with class-validator
- **Request Sanitization**: Automatic input sanitization

## API Endpoints

### Authentication
```typescript
POST   /auth/login              // Login with credentials
POST   /auth/logout             // Logout current session
POST   /auth/logout-all         // Logout all sessions
POST   /auth/refresh            // Refresh access token
GET    /auth/me                 // Get current user + roles + permissions
POST   /auth/register           // Register user (admin only)
POST   /auth/change-password    // Change password
POST   /auth/reset-password     // Reset password
```

### Session Management
```typescript
GET    /auth/sessions           // List active sessions
DELETE /auth/sessions/:id       // Revoke specific session
```

### RBAC Management (Admin Only)
```typescript
GET    /roles                   // List all roles
POST   /roles                   // Create role
PUT    /roles/:id               // Update role
DELETE /roles/:id               // Delete role
GET    /permissions             // List all permissions
POST   /roles/:id/permissions   // Assign permissions to role
POST   /users/:id/roles         // Assign roles to user
```

## Usage Examples

### Backend: Protecting Routes

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { RequirePermissions } from './auth/decorators/permissions.decorator';
import { CurrentUser } from './auth/decorators/current-user.decorator';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class EmployeesController {
  
  // Requires authentication only
  @Get()
  findAll(@CurrentUser() user) {
    return this.employeesService.findAll();
  }

  // Requires HR_MANAGER or ADMIN role
  @Post()
  @Roles('HR_MANAGER', 'ADMIN')
  create(@CurrentUser() user, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  // Requires specific permission
  @Delete(':id')
  @RequirePermissions('employee.delete')
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }

  // Requires both role AND permission
  @Post(':id/promote')
  @Roles('HR_MANAGER')
  @RequirePermissions('employee.update', 'employee.promote')
  promote(@Param('id') id: string) {
    return this.employeesService.promote(id);
  }
}
```

### Frontend: Consuming Auth State

```typescript
// ❌ OLD WAY (INSECURE)
const role = localStorage.getItem('role');
const token = localStorage.getItem('token');

// ✅ NEW WAY (SECURE)
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user, roles, permissions, isLoading } = useAuth();

  // Check permission
  const canCreateEmployee = permissions.includes('employee.create');

  // Check role
  const isHRManager = roles.includes('HR_MANAGER');

  return (
    <div>
      {canCreateEmployee && (
        <button>Create Employee</button>
      )}
    </div>
  );
}
```

### Frontend: Making Authenticated Requests

```typescript
// Cookies are automatically sent by browser
const response = await fetch('/api/employees', {
  method: 'GET',
  credentials: 'include', // Important: include cookies
});
```

## Migration Guide

### Step 1: Database Migration
```bash
cd api
npx prisma migrate dev --name add-enterprise-security
npx prisma generate
```

### Step 2: Seed Initial Data
```bash
npm run seed:security
```

### Step 3: Update Environment Variables
```env
JWT_ACCESS_SECRET=<strong-secret-key>
JWT_REFRESH_SECRET=<different-strong-secret-key>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECRET=<cookie-secret>
```

### Step 4: Update Frontend
1. Remove all localStorage auth code
2. Implement `/auth/me` consumption
3. Update route guards to use backend permissions
4. Test thoroughly

### Step 5: Deploy
1. Deploy backend first
2. Run database migration
3. Deploy frontend
4. Monitor security events

## Security Best Practices

### DO ✅
- Always use HttpOnly cookies for tokens
- Validate all input on the server
- Check permissions on every request
- Log all security events
- Use HTTPS in production
- Implement rate limiting
- Use strong password policies
- Rotate secrets regularly

### DON'T ❌
- Store tokens in localStorage
- Trust client-side role/permission checks
- Skip input validation
- Expose sensitive data in logs
- Use weak JWT secrets
- Allow unlimited login attempts
- Reuse passwords
- Skip security headers

## Troubleshooting

### Issue: "User not authenticated"
- Check if cookies are being sent (`credentials: 'include'`)
- Verify CORS settings allow credentials
- Check if access token has expired

### Issue: "Missing required permissions"
- Verify user has correct roles assigned
- Check role has required permissions
- Ensure permissions are active

### Issue: "Account is locked"
- Wait for lockout period to expire (30 minutes)
- Or admin can manually unlock account

### Issue: Tokens not refreshing
- Check refresh token hasn't been revoked
- Verify refresh token hasn't expired
- Ensure refresh endpoint is being called correctly

## Performance Considerations

- User roles/permissions are loaded once during JWT validation
- Cached in request context for the duration of the request
- No additional database queries for authorization checks
- Refresh tokens stored with indexes for fast lookup

## Monitoring

Monitor these metrics:
- Failed login attempts per IP
- Account lockouts
- Token refresh rate
- Session duration
- Permission denial rate
- Suspicious activity patterns

## Future Enhancements

- [ ] Multi-factor authentication (MFA)
- [ ] OAuth2/OIDC integration
- [ ] Biometric authentication
- [ ] Geolocation-based access control
- [ ] Advanced threat detection
- [ ] Automated security reports