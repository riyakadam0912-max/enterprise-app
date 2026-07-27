import {
  Injectable,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '../common/types/auth';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<any>();

    this.logger.debug({
      path: request.path,
      middlewareResolvedOrg: request.organizationId,
    });

    const canActivate = (await super.canActivate(context)) as boolean;

    if (canActivate && request.user) {
      const middlewareResolvedOrg: number | null | undefined =
        request.organizationId;
      const user = request.user as AuthUser;

      if (middlewareResolvedOrg !== undefined) {
        user.organizationId = middlewareResolvedOrg;
      }

      if (request.__isPlatformAdmin === true) {
        user.isPlatformAdmin = true;
      }

      console.error(
        `[DEBUG JWT-GUARD] url=${request.path} final: userId=${user.userId ?? user.id} ` +
          `role=${user.role} roles=${JSON.stringify(user.roles ?? [])} ` +
          `permissions.length=${(user.permissions ?? []).length} ` +
          `orgId=${user.organizationId ?? 'null'} empId=${user.employeeId ?? 'null'} ` +
          `isPlatformAdmin=${user.isPlatformAdmin}`,
      );
    }

    return canActivate;
  }

  handleRequest<TUser = AuthUser>(err: unknown, user: TUser | undefined) {
    if (err || !user) {
      throw err instanceof Error
        ? err
        : new UnauthorizedException('Unauthorized');
    }
    return user;
  }
}
