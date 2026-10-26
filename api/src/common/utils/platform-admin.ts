import type { AuthUser } from '../types/auth';
import { Role } from '../enums/role.enum';

type PlatformIdentity = Partial<
  Pick<AuthUser, 'role' | 'roles' | 'isSuperAdmin' | 'isPlatformAdmin'>
>;

/** Organization ADMIN is intentionally not a platform administrator. */
export function isPlatformAdministrator(user: PlatformIdentity): boolean {
  return (
    user.isSuperAdmin === true ||
    user.isPlatformAdmin === true ||
    user.role === Role.SUPER_ADMIN ||
    user.roles?.includes(Role.SUPER_ADMIN) === true
  );
}
