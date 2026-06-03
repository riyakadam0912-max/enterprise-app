export type AppRole = 'SUPER_ADMIN' | 'ADMIN' | 'COMPLIANCE_MANAGER' | 'HR' | 'MANAGER' | 'EMPLOYEE';

export function normalizeRole(role?: string | null): AppRole | null {
  switch (role?.toUpperCase()) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
    case 'COMPLIANCE_MANAGER':
    case 'HR':
    case 'MANAGER':
    case 'EMPLOYEE':
      return role.toUpperCase() as AppRole;
    default:
      return null;
  }
}

export function isAdmin(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'SUPER_ADMIN' || normalized === 'ADMIN' || normalized === 'COMPLIANCE_MANAGER';
}

export function isManager(role?: string | null): boolean {
  return normalizeRole(role) === 'MANAGER';
}

export function canManageProjects(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'SUPER_ADMIN' || normalized === 'ADMIN' || normalized === 'COMPLIANCE_MANAGER' || normalized === 'MANAGER';
}

export function canAccessUsers(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'SUPER_ADMIN' || normalized === 'ADMIN' || normalized === 'COMPLIANCE_MANAGER' || normalized === 'HR' || normalized === 'MANAGER';
}

export function canAccessAuditLogs(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'SUPER_ADMIN' || normalized === 'ADMIN' || normalized === 'COMPLIANCE_MANAGER';
}
