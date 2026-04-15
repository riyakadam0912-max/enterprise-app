import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { Role } from '../common/enums/role.enum';

type AuthTokenPayload = {
  sub: number;
  userId: number;
  email: string;
  role: Role;
  employeeId: number | null;
  tokenType: 'access' | 'refresh';
  jti?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(name: string, email: string, password: string, role: Role = Role.EMPLOYEE, employeeId?: number) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    if (employeeId) {
      const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { name, email, password: hashedPassword, role, employeeId } as any,
    } as any);

    return { message: 'User registered successfully', userId: user.id };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    } as any) as any;

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokenPair({
      sub: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ?? null,
      tokenType: 'access',
    }, user.id);

    return {
      message: 'Login successful',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      role: user.role,
      employeeId: user.employeeId ?? null,
    };
  }

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: AuthTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AuthTokenPayload>(refreshToken, {
        secret: this.refreshTokenSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    } as any) as any;

    if (!user || !user.isActive || !user.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatches = this.matchesRefreshToken(refreshToken, user.refreshToken);
    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.issueTokenPair(
      {
        sub: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId ?? null,
        tokenType: 'access',
      },
      user.id,
    );

    return {
      message: 'Token refreshed successfully',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      role: user.role,
      employeeId: user.employeeId ?? null,
    };
  }

  private async issueTokenPair(payload: AuthTokenPayload, userId: number) {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.accessTokenSecret,
      expiresIn: this.accessTokenExpiresIn as any,
    });

    const refreshTokenPayload: AuthTokenPayload = {
      ...payload,
      tokenType: 'refresh',
      jti: randomUUID(),
    };

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.refreshTokenSecret,
      expiresIn: this.refreshTokenExpiresIn as any,
    });

    const hashedRefreshToken = this.hashRefreshToken(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken } as any,
    });

    return { accessToken, refreshToken };
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private matchesRefreshToken(refreshToken: string, storedHash: string): boolean {
    const computedHash = Buffer.from(this.hashRefreshToken(refreshToken), 'hex');
    const storedHashBuffer = Buffer.from(storedHash, 'hex');

    if (computedHash.length !== storedHashBuffer.length) {
      return false;
    }

    return timingSafeEqual(computedHash, storedHashBuffer);
  }

  private get accessTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      'SUPER_SECRET_KEY'
    );
  }

  private get refreshTokenSecret(): string {
    return this.configService.get<string>('JWT_REFRESH_SECRET') ?? 'SUPER_REFRESH_SECRET_KEY';
  }

  private get accessTokenExpiresIn(): string {
    return this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '1d';
  }

  private get refreshTokenExpiresIn(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
  }
}