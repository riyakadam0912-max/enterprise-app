import {
  Controller,
  Post,
  Body,
  UseGuards,
  Res,
  Get,
  Logger,
  Patch,
  Req,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from '../common/types/request';

type ProfileUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  address?: string | null;
};

@ApiTags('System - Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private resolveCookieDomain(req: Request): string | undefined {
    const configured = (this.configService.get<string>('COOKIE_DOMAIN') ?? '')
      .trim()
      .toLowerCase();
    if (!configured) {
      return undefined;
    }

    const withoutProtocol = configured.replace(/^https?:\/\//, '');
    const hostWithOptionalPort = withoutProtocol.split('/')[0] ?? '';
    const hostOnly = (hostWithOptionalPort.split(':')[0] ?? '')
      .trim()
      .replace(/^\./, '');

    if (!hostOnly) {
      return undefined;
    }

    const requestHost = (req.hostname ?? '')
      .trim()
      .toLowerCase()
      .replace(/:\d+$/, '');

    if (!requestHost) {
      return undefined;
    }

    const matches =
      requestHost === hostOnly || requestHost.endsWith(`.${hostOnly}`);

    if (!matches) {
      return undefined;
    }

    return configured.startsWith('.') ? configured : `.${hostOnly}`;
  }

  private getCookieOptions(maxAgeMs: number, req: Request) {
    const secure =
      this.configService.get<boolean>('COOKIE_SECURE') ??
      process.env.NODE_ENV === 'production';
    const sameSite = (this.configService.get<string>('COOKIE_SAME_SITE') ??
      'lax') as 'lax' | 'strict' | 'none';
    const domain = this.resolveCookieDomain(req);

    return {
      httpOnly: true,
      secure,
      sameSite,
      domain,
      path: '/',
      maxAge: maxAgeMs,
    } as const;
  }

  private parseExpiresInMs(expiresIn: string): number {
    const normalized = expiresIn.trim().toLowerCase();
    const match = normalized.match(/^(\d+)([smhd])$/);
    if (match) {
      const value = Number(match[1]);
      const unit = match[2];
      switch (unit) {
        case 's':
          return value * 1000;
        case 'm':
          return value * 60 * 1000;
        case 'h':
          return value * 60 * 60 * 1000;
        case 'd':
          return value * 24 * 60 * 60 * 1000;
      }
    }

    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric * 1000 : 0;
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    req: Request,
  ) {
    const accessMaxAge = this.parseExpiresInMs(
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '1d',
    );
    const refreshMaxAge = this.parseExpiresInMs(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );

    res.cookie(
      'enterprise_access_token',
      accessToken,
      this.getCookieOptions(accessMaxAge, req),
    );
    res.cookie(
      'enterprise_refresh_token',
      refreshToken,
      this.getCookieOptions(refreshMaxAge, req),
    );
  }

  private clearAuthCookies(res: Response, req: Request) {
    res.clearCookie('enterprise_access_token', this.getCookieOptions(0, req));
    res.clearCookie('enterprise_refresh_token', this.getCookieOptions(0, req));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'POST register' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('register')
  register(
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      role?: Role;
      employeeId?: number;
    },
  ) {
    return this.authService.register(
      body.name,
      body.email,
      body.password,
      body.role,
      body.employeeId,
    );
  }

  @Throttle({ default: { limit: 1, ttl: 60 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'POST bootstrap admin' })
  @ApiResponse({ status: 201, description: 'Admin created successfully.' })
  @ApiResponse({ status: 409, description: 'Admin already exists.' })
  @Post('bootstrap-admin')
  async bootstrapAdmin() {
    return this.authService.bootstrapAdmin();
  }

  @Throttle({ default: { limit: 1, ttl: 60 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'POST bootstrap super admin' })
  @ApiResponse({
    status: 201,
    description: 'Super Admin created successfully.',
  })
  @ApiResponse({ status: 409, description: 'Super Admin already exists.' })
  @Post('bootstrap-super-admin')
  async bootstrapSuperAdmin() {
    return this.authService.bootstrapSuperAdmin();
  }

  @Throttle({ default: { limit: 5, ttl: 60 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'POST reset password' })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token.' })
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body.token, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'GET profile' })
  @Get('profile/me')
  async getProfile(@Req() req: AuthenticatedRequest) {
    const user = (await this.authService.getProfile(
      req.user.userId || req.user.id,
    )) as ProfileUser;
    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.name,
        role: user.role,
        phone: user.phone,
        address: user.address,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'PATCH profile' })
  @Patch('profile/me')
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: { name?: string; phone?: string; address?: string },
  ) {
    const user = (await this.authService.updateProfile(
      req.user.userId || req.user.id,
      body,
    )) as ProfileUser;
    return {
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
      },
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'POST login' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.email, body.password);
    this.setAuthCookies(
      res,
      result.access_token,
      result.refresh_token ?? result.access_token,
      req,
    );
    const data = {
      message: result.message,
      user: result.user,
      role: result.role,
      roles: result.roles,
      permissions: result.permissions,
      employeeId: result.employeeId,
      organizationId: result.organizationId,
      organizationSlug: result.organizationSlug,
      isSuperAdmin: result.isSuperAdmin,
      isPlatformAdmin: result.isPlatformAdmin,
    };
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'GET current user' })
  @ApiResponse({ status: 200, description: 'Current user retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @Get('me')
  getCurrentUser(@Req() req: AuthenticatedRequest) {
    const response = {
      user: {
        id: req.user.userId ?? req.user.id,
        email: req.user.email,
        name: req.user.name,
      },
      role: req.user.role ?? Role.EMPLOYEE,
      roles: req.user.roles ?? [],
      permissions: req.user.permissions ?? [],
      employeeId: req.user.employeeId ?? null,
      organizationId: req.user.organizationId ?? null,
      organizationSlug: req.user.organizationSlug ?? null,
      isSuperAdmin: req.user.isSuperAdmin ?? false,
      isPlatformAdmin: req.user.isPlatformAdmin ?? false,
    };
    return {
      success: true,
      data: response,
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'POST refresh' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      (req.cookies?.enterprise_refresh_token as string | undefined) ?? '';
    const result = await this.authService.refreshTokens(refreshToken);
    this.setAuthCookies(
      res,
      result.access_token,
      result.refresh_token ?? result.access_token,
      req,
    );
    const data = {
      message: result.message,
      user: result.user,
      role: result.role,
      roles: result.roles,
      permissions: result.permissions,
      employeeId: result.employeeId,
      organizationId: result.organizationId,
      organizationSlug: result.organizationSlug,
      isSuperAdmin: result.isSuperAdmin,
      isPlatformAdmin: result.isPlatformAdmin,
    };
    return { success: true, data };
  }

  @Throttle({ default: { limit: 5, ttl: 60 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'POST forgot password' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.requestPasswordReset(body.email);
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'POST logout' })
  @ApiResponse({ status: 201, description: 'POST request successful.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Resource not found.' })
  @Post('logout')
  logout(
    @Req() req: Request & { user: { userId?: number; id?: number } },
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearAuthCookies(res, req);
    return this.authService.logout(req.user.userId ?? req.user.id ?? 0);
  }
}
