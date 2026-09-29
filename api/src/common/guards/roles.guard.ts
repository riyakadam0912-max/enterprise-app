import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
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

const normalizeRoleName = (value: string | undefined | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized.toUpperCase() : null;
};

const normalizeRoleList = (values: string[] | undefined): string[] =>
  (values ?? [])
    .map((value) => normalizeRoleName(value))
    .filter((value): value is string => value !== null);

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

    const normalizedRequiredRoles = normalizeRoleList(requiredRoles);
    const normalizedUserRoles = normalizeRoleList(user?.roles);
    const normalizedUserRole = normalizeRoleName(user?.role);

    // Platform admins bypass role checks for privileged routes.
    const isPlatformAdmin =
      normalizedUserRole === Role.ADMIN ||
      normalizedUserRole === Role.SUPER_ADMIN ||
      user?.isSuperAdmin === true ||
      user?.isPlatformAdmin === true ||
      normalizedUserRoles.includes(Role.ADMIN) ||
      normalizedUserRoles.includes(Role.SUPER_ADMIN);

    if (isPlatformAdmin) {
      return true;
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }

    const hasRole =
      normalizedRequiredRoles.includes(normalizedUserRole ?? '') ||
      normalizedUserRoles.some((role) =>
        normalizedRequiredRoles.includes(role),
      );

    if (!hasRole) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
