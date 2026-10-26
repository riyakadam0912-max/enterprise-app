import { isSuperAdminSession, type AuthSession } from '../../stores/auth-store';

/** Management authority does not imply a personal employee identity. */
export function canLoadPersonalAttendance(session: Partial<AuthSession>): boolean {
  const administrative = isSuperAdminSession(session) || session.isPlatformAdmin === true ||
    session.role === 'ADMIN' || session.role === 'HR';
  return !administrative || session.employeeId != null;
}
