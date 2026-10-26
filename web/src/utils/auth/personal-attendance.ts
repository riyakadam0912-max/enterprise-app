import { isSuperAdminSession, type AuthSession } from '../../stores/auth-store';

/** Management authority does not imply a personal employee identity. */
export function canLoadPersonalAttendance(session: Partial<AuthSession>): boolean {
  if (!session.user) return false;
  if (session.employeeOrganizationId != null && session.employeeOrganizationId !== session.organizationId) return false;
  const administrative = isSuperAdminSession(session) || session.isPlatformAdmin === true ||
    session.role === 'ADMIN' || session.role === 'HR';
  return !administrative || (session.employeeId != null && session.employeeOrganizationId === session.organizationId);
}
