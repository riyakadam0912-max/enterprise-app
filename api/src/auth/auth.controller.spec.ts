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
import { ThrottlerGuard } from '@nestjs/throttler';
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
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
