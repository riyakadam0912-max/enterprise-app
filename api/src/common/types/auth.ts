import { Role } from '../enums/role.enum';

export interface AuthUser {
  id: number;
  userId: number;
  email: string;
  name: string;
  role: Role;
  roles: string[];
  permissions: string[];
  employeeId: number | null;
  organizationId: number | null;
  organizationSlug?: string | null;
  isPlatformAdmin?: boolean;
  isSuperAdmin?: boolean;
  primaryBusinessUnitId?: number | null;
  employeeBusinessUnitId?: number | null;
  tokenType: string;
  jti: string | null;
}

export interface JwtPayload {
  sub?: number;
  userId?: number;
  email?: string;
  name?: string;
  role?: Role;
  roles?: string[];
  permissions?: string[];
  employeeId?: number | null;
  organizationId?: number | null;
  organizationSlug?: string | null;
  isPlatformAdmin?: boolean;
  isSuperAdmin?: boolean;
  primaryBusinessUnitId?: number | null;
  employeeBusinessUnitId?: number | null;
  tokenType?: string;
  jti?: string | null;
}
