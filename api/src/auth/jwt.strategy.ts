import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../common/enums/role.enum';
import type { AuthUser, JwtPayload } from '../common/types/auth';
import type { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_ACCESS_SECRET');
    const issuer = configService.get<string>('JWT_ISSUER');
    const audience = configService.get<string>('JWT_AUDIENCE');

    if (!secret || !issuer || !audience) {
      throw new Error('JWT access token configuration is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request | undefined) => {
          const cookieStore = req?.cookies as
            | Record<string, string | undefined>
            | undefined;
          const token = cookieStore?.enterprise_access_token;
          return typeof token === 'string' ? token : null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: secret,
      issuer,
      audience,
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub ?? payload.userId ?? 0,
      userId: payload.userId ?? payload.sub ?? 0,
      email: payload.email ?? '',
      name: payload.name ?? '',
      role: payload.role ?? Role.EMPLOYEE,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      employeeId: payload.employeeId ?? null,
      organizationId: payload.organizationId ?? null,
      organizationSlug: payload.organizationSlug ?? null,
      isPlatformAdmin: payload.isPlatformAdmin ?? false,
      isSuperAdmin: payload.isSuperAdmin ?? false,
      primaryBusinessUnitId: payload.primaryBusinessUnitId ?? null,
      employeeBusinessUnitId: payload.employeeBusinessUnitId ?? null,
      tokenType: payload.tokenType ?? 'access',
      jti: payload.jti ?? null,
    };
  }
}
