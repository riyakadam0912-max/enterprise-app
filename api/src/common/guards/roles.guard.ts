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
  method?: string;
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

    // Platform admins bypass role checks for privileged routes.
    const isPlatformAdmin =
      user?.role === Role.ADMIN ||
      user?.role === Role.SUPER_ADMIN ||
      user?.isSuperAdmin === true ||
      user?.isPlatformAdmin === true ||
      (user?.roles &&
        (user.roles.includes(Role.ADMIN) ||
          user.roles.includes(Role.SUPER_ADMIN)));

    if (isPlatformAdmin) {
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
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
