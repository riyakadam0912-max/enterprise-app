import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') ??
        configService.get<string>('JWT_SECRET') ??
        'SUPER_SECRET_KEY',
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.userId ?? payload.sub,
      email: payload.email,
      role: payload.role,
      employeeId: payload.employeeId ?? null,
      tokenType: payload.tokenType ?? 'access',
      jti: payload.jti ?? null,
    };
  }
}