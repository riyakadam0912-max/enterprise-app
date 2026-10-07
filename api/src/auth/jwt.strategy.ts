import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../common/enums/role.enum';
import type { AuthUser, JwtPayload } from '../common/types/auth';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
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

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.sid) {
      const session = await this.prisma.authSession.findUnique({
        where: { id: payload.sid },
        select: { userId: true, expiresAt: true, revokedAt: true },
      });
      if (
        !session ||
        session.userId !== (payload.sub ?? payload.userId) ||
        session.revokedAt !== null ||
        session.expiresAt <= new Date()
      ) {
        throw new UnauthorizedException(
          'Authentication session is no longer active',
        );
      }
    }

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
      homeOrganizationId: payload.organizationId ?? null,
      organizationSlug: payload.organizationSlug ?? null,
      organizationName: payload.organizationName ?? null,
      organizationLogo: payload.organizationLogo ?? null,
      isPlatformAdmin: payload.isPlatformAdmin ?? false,
      isSuperAdmin: payload.isSuperAdmin ?? false,
      primaryBusinessUnitId: payload.primaryBusinessUnitId ?? null,
      employeeBusinessUnitId: payload.employeeBusinessUnitId ?? null,
      tokenType: payload.tokenType ?? 'access',
      jti: payload.jti ?? null,
      sessionId: payload.sid ?? null,
    };
  }
}
