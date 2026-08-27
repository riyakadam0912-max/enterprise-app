# User Authentication Data Storage & Handling Analysis

## 📍 Overview

This document provides a comprehensive analysis of where and how user authentication data is stored, handled, and secured in the Enterprise App backend.

---

## 1. Database Schema - User Data Storage

### Location: [prisma/schema.prisma](prisma/schema.prisma)

The **User** model is the core database schema where all user data is stored in PostgreSQL:

```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  password  String
  role      Role
  isActive  Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  employee  Employee?
  invoices  Invoice[]
  leads     Lead[]
  tasks     Task[]
}

enum Role {
  ADMIN
  EMPLOYEE
}
```

### User Fields Breakdown:

| Field | Type | Description | Notes |
|-------|------|-------------|-------|
| `id` | Int | Unique identifier | Auto-incremented primary key |
| `name` | String | User's full name | Required |
| `email` | String | User's email address | Unique, required |
| `password` | String | User's password | **HASHED with bcrypt** |
| `role` | Role (enum) | User's access level | Either ADMIN or EMPLOYEE |
| `isActive` | Boolean | Account status | Defaults to true |
| `createdAt` | DateTime | Account creation timestamp | Auto-set |
| `updatedAt` | DateTime | Last update timestamp | Auto-updated |

---

## 2. Password Handling - Security Details

### ✅ Passwords are HASHED with bcrypt (Not plain text, Not encrypted)

**bcrypt Hash Configuration:**
- **Algorithm**: bcrypt (salted hash)
- **Salt Rounds**: 10
- **One-way function**: Passwords cannot be decrypted, only verified

### Password Hashing Locations:

#### 2A. Registration - [src/auth/auth.service.ts](src/auth/auth.service.ts) (Line 11-15)

```typescript
async register(name: string, email: string, password: string, role: 'ADMIN' | 'EMPLOYEE' = 'EMPLOYEE') {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(password, 10);  // Hash with 10 salt rounds
    const user = await this.prisma.user.create({
      data: { name, email, password: hashedPassword, role },
    });

    return { message: 'User registered successfully', userId: user.id };
  }
```

#### 2B. User Creation via Users Service - [src/users/users.service.ts](src/users/users.service.ts) (Line 9-13)

```typescript
async create(createUserDto: CreateUserDto) {
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);  // Hash with 10 salt rounds
    return this.prisma.user.create({
      data: { ...createUserDto, password: hashedPassword },
    });
  }
```

---

## 3. Authentication Flow

### 3A. Registration Endpoint

**Route**: `POST /auth/register`  
**File**: [src/auth/auth.controller.ts](src/auth/auth.controller.ts) (Line 9-11)

```typescript
@Post('register')
register(@Body() body: { name: string; email: string; password: string; role?: 'ADMIN' | 'EMPLOYEE' }) {
    return this.authService.register(body.name, body.email, body.password, body.role);
}
```

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123",
  "role": "EMPLOYEE"
}
```

**Registration Process**:
1. Check if email already exists (prevent duplicates)
2. Hash password using bcrypt with 10 salt rounds
3. Store hashed password in database
4. Return success message with user ID

---

### 3B. Login Endpoint

**Route**: `POST /auth/login`  
**File**: [src/auth/auth.controller.ts](src/auth/auth.controller.ts) (Line 13-16)

```typescript
@Post('login')
login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
}
```

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Login Process** - [src/auth/auth.service.ts](src/auth/auth.service.ts) (Line 19-38)

```typescript
async login(email: string, password: string) {
    // 1. Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Compare provided password with stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      message: 'Login successful',
      access_token: this.jwtService.sign(payload),
    };
  }
```

**Login Steps**:
1. Query database for user by email
2. Use `bcrypt.compare()` to verify password (compares plain text with hash)
3. If password is valid, create JWT payload
4. Sign JWT token with secret key
5. Return access token to client

---

## 4. JWT Token Strategy & Validation

### JWT Configuration

**File**: [src/auth/jwt.strategy.ts](src/auth/jwt.strategy.ts)

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: 'SUPER_SECRET_KEY',
    });
  }

  async validate(payload: any) {
    console.log('JWT PAYLOAD:', payload);
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
```

**JWT Details**:
- **Secret Key**: `SUPER_SECRET_KEY` (hardcoded - **SECURITY ISSUE: Should be in .env**)
- **Token Location**: Authorization header as Bearer token
- **Payload Contains**: `userId`, `email`, `role`
- **Token Strategy**: Passport JWT strategy

### JWT Token Example:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsInJvbGUiOiJFTVBMT1lFRSJ9.signature
```

---

## 5. Protected Routes & Role-Based Access Control

### JWT Auth Guard

**File**: [src/auth/jwt-auth.guard.ts](src/auth/jwt-auth.guard.ts)

Validates JWT tokens on protected routes.

### Roles Guard & Decorator

**Files**: 
- [src/auth/roles.guard.ts](src/auth/roles.guard.ts) - Checks user role
- [src/auth/roles.decorator.ts](src/auth/roles.decorator.ts) - Marks required roles

### Example Protected Route

**File**: [src/users/users.controller.ts](src/users/users.controller.ts)

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Get()
findAll() {
    return "Admin Only - Protected Users Route";
}
```

**Protection Flow**:
1. JWT token is extracted from Authorization header
2. Token is validated against secret key
3. Payload is decoded to get userId, email, role
4. Route checks if user has required role (ADMIN in this case)
5. Only authorized users can access the endpoint

---

## 6. Data Transfer Objects (DTOs)

### User Creation DTO

**File**: [src/users/dto/create-user.dto.ts](src/users/dto/create-user.dto.ts)

```typescript
export class CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'EMPLOYEE';
}
```

This DTO validates incoming request data for user creation.

---

## 7. Complete Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  USER REGISTRATION                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. POST /auth/register                                     │
│     { name, email, password, role }                        │
│            ↓                                                │
│  2. Check if email exists (Duplicate check)               │
│            ↓                                                │
│  3. Hash password: bcrypt.hash(password, 10)              │
│            ↓                                                │
│  4. Store in Database:                                      │
│     User { id, name, email, hashedPassword, role }        │
│            ↓                                                │
│  5. Return: { message, userId }                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    USER LOGIN                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. POST /auth/login                                        │
│     { email, password }                                    │
│            ↓                                                │
│  2. Find user in database by email                         │
│            ↓                                                │
│  3. If not found → throw UnauthorizedException           │
│            ↓                                                │
│  4. Compare password: bcrypt.compare(plain, hash)         │
│            ↓                                                │
│  5. If invalid → throw UnauthorizedException             │
│            ↓                                                │
│  6. Create JWT payload:                                     │
│     { sub: userId, email, role }                          │
│            ↓                                                │
│  7. Sign JWT: jwtService.sign(payload)                    │
│            ↓                                                │
│  8. Return: { message, access_token }                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              ACCESSING PROTECTED ROUTE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. GET /users                                              │
│     Header: Authorization: Bearer <access_token>          │
│            ↓                                                │
│  2. Extract token from Authorization header               │
│            ↓                                                │
│  3. Validate JWT signature with secret key                 │
│            ↓                                                │
│  4. Decode payload (userId, email, role)                  │
│            ↓                                                │
│  5. Check if user has required role (ADMIN)              │
│            ↓                                                │
│  If valid → Execute route                                 │
│  If invalid → return 401/403 Unauthorized                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Security Analysis

### ✅ Secure Practices

1. **Password Hashing**: Using bcrypt with 10 salt rounds
2. **Password Comparison**: Using bcrypt.compare() instead of plain text comparison
3. **Unique Email**: Email field is unique to prevent duplicate accounts
4. **Role-Based Access**: RBAC implemented with guards and decorators
5. **JWT Tokens**: Stateless authentication using JWT

### ⚠️ Security Issues & Recommendations

| Issue | Severity | Recommendation |
|-------|----------|-----------------|
| JWT secret hardcoded | 🔴 **HIGH** | Move `SUPER_SECRET_KEY` to `.env` file |
| No password validation rules | 🟡 **MEDIUM** | Add password strength validation (min 8 chars, special chars, etc.) |
| No rate limiting | 🟡 **MEDIUM** | Implement rate limiting on `/auth/login` to prevent brute force |
| Console.log in JWT strategy | 🟡 **MEDIUM** | Remove `console.log('JWT PAYLOAD:', payload)` from production |
| No HTTPS enforcement | 🟡 **MEDIUM** | Enforce HTTPS in production |
| No refresh token mechanism | 🟡 **MEDIUM** | Implement refresh tokens for better security |
| No account lockout | 🟡 **MEDIUM** | Implement account lockout after failed login attempts |

---

## 9. Summary Table - User Data Fields

| Field | Where Stored | How Used | Security |
|-------|--------------|----------|----------|
| `id` | Database (User table) | JWT payload (as `sub`) | Public |
| `name` | Database (User table) | Display purposes | Public |
| `email` | Database (User table) | Login identifier, unique constraint | Public |
| `password` | Database (User table) | Password verification during login | **Hashed with bcrypt** |
| `role` | Database (User table) | Authorization checks (ADMIN/EMPLOYEE) | Public |
| `isActive` | Database (User table) | Account status | Should check in guards |
| `createdAt` | Database (User table) | Audit trail | Public |
| `updatedAt` | Database (User table) | Audit trail | Public |

---

## 10. Files Reference

- **Database Schema**: [prisma/schema.prisma](prisma/schema.prisma)
- **Auth Service**: [src/auth/auth.service.ts](src/auth/auth.service.ts)
- **Auth Controller**: [src/auth/auth.controller.ts](src/auth/auth.controller.ts)
- **Users Service**: [src/users/users.service.ts](src/users/users.service.ts)
- **Users Controller**: [src/users/users.controller.ts](src/users/users.controller.ts)
- **JWT Strategy**: [src/auth/jwt.strategy.ts](src/auth/jwt.strategy.ts)
- **JWT Auth Guard**: [src/auth/jwt-auth.guard.ts](src/auth/jwt-auth.guard.ts)
- **Roles Guard**: [src/auth/roles.guard.ts](src/auth/roles.guard.ts)
- **Roles Decorator**: [src/auth/roles.decorator.ts](src/auth/roles.decorator.ts)
- **User DTO**: [src/users/dto/create-user.dto.ts](src/users/dto/create-user.dto.ts)

---

## 11. Quick Reference - API Endpoints

| Endpoint | Method | Purpose | Protected | Role Required |
|----------|--------|---------|-----------|---------------|
| `/auth/register` | POST | Register new user | ❌ No | - |
| `/auth/login` | POST | Authenticate user | ❌ No | - |
| `/users` | GET | Get all users | ✅ Yes | ADMIN |
| `/employees` | GET | Get all employees | ✅ Yes | - |

---

## 12. Key Takeaways

1. **Passwords are HASHED** with bcrypt using 10 salt rounds (NOT encrypted, NOT plain text)
2. **User data is stored** in PostgreSQL database via Prisma ORM
3. **Authentication uses JWT** tokens with Bearer scheme
4. **Password verification** uses bcrypt.compare() for secure comparison
5. **Protected routes** require valid JWT token + appropriate role
6. **User fields** include: id, name, email, password (hashed), role, isActive, timestamps
7. **Security should be improved** by moving JWT secret to .env and implementing additional hardening measures
