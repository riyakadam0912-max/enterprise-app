import type { Session } from '@/src/types/auth';
export function can(session: Session | null, permission: string, roles: string[] = []) { if (!session) return false; if (session.isPlatformAdmin || session.role === 'ADMIN' || session.role === 'SUPER_ADMIN') return true; return session.permissions.includes(permission) || roles.includes(session.role); }
