import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';
import type { AuthUser } from '../types/auth';

interface RequestWithUser {
  user?: AuthUser;
  url: string;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    console.error(
      `[DEBUG ROLES-GUARD] url=${request.url} requiredRoles=${JSON.stringify(requiredRoles ?? [])} ` +
        `user.role=${user?.role ?? 'null'} user.roles=${JSON.stringify(user?.roles ?? [])} user?.userId=${user?.userId ?? user?.id ?? 'null'}`,
    );

    // ADMIN and SUPER_ADMIN bypass everything
    const isPlatformAdmin =
      user?.role === Role.ADMIN ||
      user?.role === Role.SUPER_ADMIN ||
      user?.isSuperAdmin === true ||
      user?.isPlatformAdmin === true ||
      (user?.roles &&
        (user.roles.includes(Role.ADMIN) ||
          user.roles.includes(Role.SUPER_ADMIN)));

    if (isPlatformAdmin) {
      console.error(
        `[DEBUG ROLES-GUARD] url=${request.url} BYPASS (ADMIN/SUPER_ADMIN role)`,
      );
      return true;
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!user) {
      return true;
    }

    // Check both user.role and user.roles array
    const hasRole =
      requiredRoles.includes(user.role) ||
      (user.roles &&
        user.roles.some((role: string) => requiredRoles.includes(role)));

    if (!hasRole) {
      console.error(
        `[DEBUG ROLES-GUARD] url=${request.url} THROW Forbidden required=${JSON.stringify(requiredRoles)} have=${JSON.stringify({ role: user.role, roles: user.roles })}`,
      );
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
