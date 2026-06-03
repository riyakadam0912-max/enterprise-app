'use client';

import { normalizeRole, type AppRole } from '@/utils/auth/permissions';
import { useAuthSession } from '@/stores/auth-store';

const permissionMatrix: Record<string, AppRole[]> = {
  'employee.create': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER', 'HR', 'MANAGER'],
  'employee.read': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER', 'HR', 'MANAGER'],
  'employee.update': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER', 'HR', 'MANAGER'],
  'employee.delete': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER'],
  'task.create': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER', 'MANAGER'],
  'task.update': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER', 'MANAGER'],
  'audit.read': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER'],
  'report.read': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER', 'HR', 'MANAGER'],
};

export function RoleGuard({
  permissions,
  roles,
  role,
  fallback = null,
  children,
}: {
  permissions?: string[];
  roles?: AppRole[];
  role?: string | null;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const session = useAuthSession();
  const currentRole = normalizeRole(role ?? session.role);

  const allowed = Boolean(currentRole) && (
    (roles?.length ? roles.includes(currentRole as AppRole) : true) &&
    (permissions?.length ? permissions.some((permission) => (permissionMatrix[permission] ?? ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE_MANAGER']).includes(currentRole as AppRole)) : true)
  );

  return allowed ? <>{children}</> : <>{fallback}</>;
}
