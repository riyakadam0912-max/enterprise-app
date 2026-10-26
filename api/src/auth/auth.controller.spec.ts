import {
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { VercelThrottlerGuard } from './vercel-throttler.guard';
import {
  createMockPrismaService,
  createMockJwtService,
  createMockConfigService,
  createMockAuditLogsService,
  createMockMailService,
} from '../../test/helpers/mocks.helper';

describe('AuthController', () => {
  let controller: AuthController;
  const mockPrisma = createMockPrismaService();
  const mockJwt = createMockJwtService();
  const mockConfig = createMockConfigService();
  const mockAudit = createMockAuditLogsService();
  const mockMail = createMockMailService();

  beforeEach(async () => {
    mockConfig.get = jest.fn((key: string) => {
      switch (key) {
        case 'JWT_ACCESS_SECRET':
          return 'test-access-secret';
        case 'JWT_REFRESH_SECRET':
          return 'test-refresh-secret';
        case 'JWT_ISSUER':
          return 'test-issuer';
        case 'JWT_AUDIENCE':
          return 'test-audience';
        case 'JWT_ACCESS_EXPIRES_IN':
          return '1d';
        case 'JWT_REFRESH_EXPIRES_IN':
          return '7d';
        default:
          return null;
      }
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuditLogsService, useValue: mockAudit },
        { provide: MailService, useValue: mockMail },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(VercelThrottlerGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  it('clears rejected refresh credentials and logs only a categorical reason', async () => {
    const service = controller['authService'];
    jest
      .spyOn(service, 'refreshTokens')
      .mockRejectedValueOnce(
        new UnauthorizedException('Refresh token is required'),
      );
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const req = {
      cookies: {},
      headers: { 'x-request-id': 'ERR-TEST' },
      hostname: 'example.test',
    } as unknown as Request;
    const res = { clearCookie: jest.fn() } as unknown as Response;
    try {
      await expect(controller.refresh(req, res)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith({
        event: 'auth_refresh_rejected',
        reason: 'MISSING_REFRESH_CREDENTIAL',
        requestId: 'ERR-TEST',
      });
    } finally {
      warn.mockRestore();
    }
  });

  it('preserves authentication cookies on a temporary refresh service failure', async () => {
    jest
      .spyOn(controller['authService'], 'refreshTokens')
      .mockRejectedValueOnce(
        new ServiceUnavailableException('Temporarily unavailable'),
      );
    const req = {
      cookies: { enterprise_refresh_token: 'fixture-refresh' },
      headers: {},
      hostname: 'example.test',
    } as unknown as Request;
    const res = { clearCookie: jest.fn() } as unknown as Response;
    await expect(controller.refresh(req, res)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(res.clearCookie).not.toHaveBeenCalled();
  });
  it('retains the successful refresh response and secure cookie contract', async () => {
    jest
      .spyOn(controller['authService'], 'refreshTokens')
      .mockResolvedValueOnce({
        access_token: 'fixture-access',
        refresh_token: 'fixture-new-refresh',
        user: { id: 1 },
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN'],
        permissions: [],
        employeeId: null,
        organizationId: 1,
      } as any);
    const req = {
      cookies: { enterprise_refresh_token: 'fixture-old-refresh' },
      headers: {},
      hostname: 'example.test',
    } as unknown as Request;
    const res = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response;
    const result = await controller.refresh(req, res);
    expect(result).toMatchObject({
      success: true,
      data: {
        access_token: 'fixture-access',
        refresh_token: 'fixture-new-refresh',
        role: 'SUPER_ADMIN',
      },
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'enterprise_access_token',
      'fixture-access',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'enterprise_refresh_token',
      'fixture-new-refresh',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(res.clearCookie).not.toHaveBeenCalled();
  });
});
