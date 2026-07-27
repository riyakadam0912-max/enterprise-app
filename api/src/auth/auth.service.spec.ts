import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import { Role } from '../common/enums/role.enum';
import {
  createMockPrismaService,
  createMockJwtService,
  createMockConfigService,
  createMockAuditLogsService,
  createMockMailService,
  getMockPrismaDelegate,
} from '../../test/helpers/mocks.helper';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockJwt: ReturnType<typeof createMockJwtService>;
  let mockConfig: ReturnType<typeof createMockConfigService>;
  let mockAudit: ReturnType<typeof createMockAuditLogsService>;
  let mockMail: ReturnType<typeof createMockMailService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockJwt = createMockJwtService();
    mockConfig = createMockConfigService();
    mockAudit = createMockAuditLogsService();
    mockMail = createMockMailService();

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
        default:
          return null;
      }
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuditLogsService, useValue: mockAudit },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const compareMock = jest.mocked(bcrypt.compare);

    afterEach(() => {
      compareMock.mockReset();
    });

    function createLoginUser(organizationId: number | null) {
      return {
        id: organizationId === null ? 1 : 2,
        name: organizationId === null ? 'Global Admin' : 'Tenant Admin',
        email:
          organizationId === null ? 'global@example.com' : 'tenant@example.com',
        password: 'hashed-password',
        isActive: true,
        role: organizationId === null ? Role.SUPER_ADMIN : Role.ADMIN,
        employeeId: null,
        organizationId,
        refreshToken: null,
        userRoles: [
          {
            role: {
              name: organizationId === null ? Role.SUPER_ADMIN : Role.ADMIN,
              rolePermissions: [
                {
                  permission: {
                    key: 'audit.read',
                  },
                },
              ],
            },
          },
        ],
      };
    }

    it('allows a platform user with null organizationId to log in', async () => {
      const user = createLoginUser(null);
      const userDelegate = getMockPrismaDelegate(mockPrisma, 'user');

      userDelegate.findUnique.mockResolvedValue(user);
      userDelegate.update.mockResolvedValue({
        id: user.id,
        refreshToken: 'hashed-refresh-token',
      });
      mockJwt.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      mockAudit.logLogin.mockResolvedValue(undefined);
      compareMock.mockResolvedValue(true);

      const result = await service.login(user.email, 'password');

      expect(result.organizationId).toBeNull();
      expect(mockAudit.logLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          success: true,
        }),
        expect.objectContaining({
          organizationId: null,
        }),
      );
    });

    it('keeps tenant organizationId on tenant login audit events', async () => {
      const user = createLoginUser(7);
      const userDelegate = getMockPrismaDelegate(mockPrisma, 'user');

      userDelegate.findUnique.mockResolvedValue(user);
      userDelegate.update.mockResolvedValue({
        id: user.id,
        refreshToken: 'hashed-refresh-token',
      });
      mockJwt.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      mockAudit.logLogin.mockResolvedValue(undefined);
      compareMock.mockResolvedValue(true);

      const result = await service.login(user.email, 'password');

      expect(result.organizationId).toBe(7);
      expect(mockAudit.logLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          success: true,
        }),
        expect.objectContaining({
          organizationId: 7,
        }),
      );
    });

    it('includes super-admin platform claims in the access token payload', async () => {
      const user = createLoginUser(null);
      const userDelegate = getMockPrismaDelegate(mockPrisma, 'user');

      userDelegate.findUnique.mockResolvedValue(user);
      userDelegate.update.mockResolvedValue({
        id: user.id,
        refreshToken: 'hashed-refresh-token',
      });
      mockJwt.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      mockAudit.logLogin.mockResolvedValue(undefined);
      compareMock.mockResolvedValue(true);

      await service.login(user.email, 'password');

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          role: Role.SUPER_ADMIN,
          roles: [Role.SUPER_ADMIN],
          permissions: ['audit.read'],
          organizationId: null,
          organizationSlug: null,
          isSuperAdmin: true,
          isPlatformAdmin: true,
        }),
        expect.anything(),
      );
    });
  });
});
