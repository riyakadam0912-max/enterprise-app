# Enterprise ERP Security Refactor Implementation

## Overview
This document outlines the comprehensive security refactor to move from client-side authentication to enterprise-grade server-side security.

## Current Security Issues Identified

### Critical Issues
1. **JWT tokens stored in localStorage** - Vulnerable to XSS attacks
2. **Role information stored in localStorage** - Can be manipulated by users
3. **Frontend determines permissions** - Authorization bypass possible
4. **No refresh token rotation** - Token theft risk
5. **No session management** - Cannot revoke access
6. **No account lockout** - Brute force vulnerability
7. **No password policies** - Weak password risk

## Implementation Strategy

### Phase 1: Database & Schema ✅
- [x] Enhanced User model with security fields
- [x] RBAC tables (AppRole, Permission, UserRole, RolePermission)
- [x] RefreshToken table with device tracking
- [x] SecurityEvent table for audit logging
- [x] Extended Role enum with enterprise roles

### Phase 2: Backend Security Infrastructure
- [ ] HttpOnly cookie-based authentication
- [ ] JWT + Refresh token strategies
- [ ] Role-based access control (RBAC)
- [ ] Permission-based authorization
- [ ] Account lockout mechanism
- [ ] Password complexity validation
- [ ] Session management & revocation
- [ ] Security event logging

### Phase 3: API Security Hardening
- [ ] Helmet security headers
- [ ] Rate limiting (throttling)
- [ ] CSRF protection
- [ ] Input validation with DTOs
- [ ] Request sanitization

### Phase 4: Frontend Refactor
- [ ] Remove localStorage auth
- [ ] Implement /auth/me endpoint consumption
- [ ] Backend-driven UI permissions
- [ ] Secure cookie handling

### Phase 5: Documentation & Testing
- [ ] Security architecture documentation
- [ ] RBAC design documentation
- [ ] Migration guide
- [ ] Security testing

## Key Security Improvements

### 1. HttpOnly Cookies
```typescript
// Access Token: 15 minutes, HttpOnly, Secure, SameSite
// Refresh Token: 7 days, HttpOnly, Secure, SameSite
```

### 2. Token Rotation
- Refresh tokens are single-use
- New refresh token issued on each refresh
- Old tokens automatically revoked

### 3. Session Management
- Track all active sessions per user
- Support "Logout All Devices"
- Automatic session cleanup

### 4. Account Security
- Failed login tracking
- Account lockout after 5 failed attempts
- 30-minute lockout duration
- Password history (last 5 passwords)
- Password complexity requirements

### 5. Audit Trail
- All authentication events logged
- Security events tracked
- IP address and device info captured

## Database Schema Changes

### User Table Additions
```prisma
failedLoginAttempts     Int           @default(0)
accountLockedUntil      DateTime?
lastPasswordChange      DateTime      @default(now())
passwordHistory         Json?
lastLoginAt             DateTime?
lastLoginIp             String?
userRoles               UserRole[]
refreshTokens           RefreshToken[]
securityEvents          SecurityEvent[]
```

### New Tables
- AppRole
- Permission  
- UserRole
- RolePermission
- RefreshToken
- SecurityEvent

## API Endpoints

### Authentication
- POST /auth/login - Login with credentials
- POST /auth/logout - Logout current session
- POST /auth/logout-all - Logout all sessions
- POST /auth/refresh - Refresh access token
- GET /auth/me - Get current user with roles & permissions
- POST /auth/register - Register new user (admin only)
- POST /auth/change-password - Change password
- POST /auth/reset-password - Reset password

### Session Management
- GET /auth/sessions - List active sessions
- DELETE /auth/sessions/:id - Revoke specific session

### RBAC Management (Admin only)
- GET /roles - List all roles
- POST /roles - Create role
- PUT /roles/:id - Update role
- DELETE /roles/:id - Delete role
- GET /permissions - List all permissions
- POST /roles/:id/permissions - Assign permissions to role
- POST /users/:id/roles - Assign roles to user

## Security Headers (Helmet)
```typescript
{
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: true,
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: true,
  xssFilter: true
}
```

## Rate Limiting
```typescript
{
  ttl: 60, // 1 minute
  limit: 10, // 10 requests per minute per IP
  ignoreUserAgents: [], // No exceptions
}
```

## Password Policy
```typescript
{
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventPasswordReuse: 5, // Last 5 passwords
  maxAge: 90 days, // Force change every 90 days
}
```

## Migration Steps

### 1. Run Prisma Migration
```bash
cd api
npx prisma migrate dev --name add-enterprise-security
npx prisma generate
```

### 2. Seed Initial Roles & Permissions
```bash
npm run seed:security
```

### 3. Update Environment Variables
```env
JWT_ACCESS_SECRET=<strong-secret>
JWT_REFRESH_SECRET=<different-strong-secret>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECRET=<cookie-secret>
SESSION_SECRET=<session-secret>
```

### 4. Deploy Backend Changes
- Update auth module
- Add security middleware
- Deploy to staging
- Test thoroughly

### 5. Deploy Frontend Changes
- Remove localStorage usage
- Implement /auth/me consumption
- Update route guards
- Deploy to staging
- Test thoroughly

### 6. Production Deployment
- Database migration
- Backend deployment
- Frontend deployment
- Monitor security events

## Testing Checklist

### Authentication
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Account lockout after failed attempts
- [ ] Token refresh flow
- [ ] Logout single session
- [ ] Logout all sessions
- [ ] Password change
- [ ] Password reset

### Authorization
- [ ] Role-based access control
- [ ] Permission-based access control
- [ ] Unauthorized access blocked
- [ ] Admin-only endpoints protected

### Security
- [ ] XSS protection (HttpOnly cookies)
- [ ] CSRF protection
- [ ] Rate limiting works
- [ ] Security headers present
- [ ] Audit logs created
- [ ] Session tracking works

### Frontend
- [ ] No localStorage auth data
- [ ] UI permissions from backend
- [ ] Proper error handling
- [ ] Secure cookie handling

## Rollback Plan

If issues arise:
1. Revert frontend deployment
2. Revert backend deployment
3. Rollback database migration if needed
4. Restore from backup if necessary

## Success Criteria

- ✅ No authentication data in localStorage
- ✅ All auth decisions made server-side
- ✅ HttpOnly cookies for tokens
- ✅ RBAC fully functional
- ✅ Permission system operational
- ✅ Account lockout working
- ✅ Audit logging complete
- ✅ Security headers present
- ✅ Rate limiting active
- ✅ All tests passing

## Timeline

- Phase 1: Database & Schema - ✅ Complete
- Phase 2: Backend Security - 4-6 hours
- Phase 3: API Security - 2-3 hours
- Phase 4: Frontend Refactor - 3-4 hours
- Phase 5: Documentation & Testing - 2-3 hours

**Total Estimated Time: 11-16 hours**

## Next Steps

1. Implement JWT strategies with HttpOnly cookies
2. Create RBAC guards and decorators
3. Implement permission system
4. Add security middleware
5. Create /auth/me endpoint
6. Refactor frontend auth
7. Test thoroughly
8. Document and deploy