export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'COMPLIANCE_MANAGER' | 'HR' | 'MANAGER' | 'EMPLOYEE';

export type User = {
  id: number;
  name: string;
  email: string;
  designation?: string | null;
};

export type Session = {
  user: User;
  role: Role;
  roles: string[];
  permissions: string[];
  employeeId: number | null;
  organizationId: number | null;
  organizationName: string | null;
  organizationSlug: string | null;
  organizationLogo: string | null;
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
};

export type AuthPayload = Session & {
  access_token?: string;
  refresh_token?: string;
  primaryBusinessUnitId?: number | null;
  employeeBusinessUnitId?: number | null;
};

export type BusinessUnit = {
  id: number;
  name: string;
  code: string;
  parentId: number | null;
  status: string;
};
