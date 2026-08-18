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

  const setupConfigForTests = (
    overrides: Record<string, string | null> = {},
  ) => {
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
        case 'NODE_ENV':
          return overrides.NODE_ENV ?? 'development';
        case 'BOOTSTRAP_ADMIN_PASSWORD':
          return overrides.BOOTSTRAP_ADMIN_PASSWORD ?? null;
        case 'BOOTSTRAP_SUPER_ADMIN_PASSWORD':
          return overrides.BOOTSTRAP_SUPER_ADMIN_PASSWORD ?? null;
        default:
          return null;
      }
    });
  };

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockJwt = createMockJwtService();
    mockConfig = createMockConfigService();
    mockAudit = createMockAuditLogsService();
    mockMail = createMockMailService();

    setupConfigForTests();

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

  describe('bootstrap credentials', () => {
    it('fails in production when the bootstrap admin password is missing', async () => {
      setupConfigForTests({
        NODE_ENV: 'production',
        BOOTSTRAP_ADMIN_PASSWORD: null,
      });
      const userDelegate = getMockPrismaDelegate(mockPrisma, 'user');
      userDelegate.findFirst.mockResolvedValue(null);
      const orgDelegate = getMockPrismaDelegate(mockPrisma, 'organization');
      orgDelegate.findFirst.mockResolvedValue({ id: 7, code: 'DEFAULT' });
      const appRoleDelegate = getMockPrismaDelegate(mockPrisma, 'appRole');
      appRoleDelegate.upsert.mockResolvedValue({ id: 21, name: Role.ADMIN });
      const userRoleDelegate = getMockPrismaDelegate(mockPrisma, 'userRole');
      userRoleDelegate.upsert.mockResolvedValue({ userId: 3, roleId: 21 });
      const permissionDelegate = getMockPrismaDelegate(
        mockPrisma,
        'permission',
      );
      permissionDelegate.count.mockResolvedValue(1);

      await expect(service.bootstrapAdmin()).rejects.toThrow(
        'Production environment requires BOOTSTRAP_ADMIN_PASSWORD to be set explicitly.',
      );
      expect(userDelegate.create).not.toHaveBeenCalled();
    });

    it('fails in production when the bootstrap admin password is a placeholder', async () => {
      setupConfigForTests({
        NODE_ENV: 'production',
        BOOTSTRAP_ADMIN_PASSWORD: 'replace-with-secure-bootstrap-password',
      });
      const userDelegate = getMockPrismaDelegate(mockPrisma, 'user');
      userDelegate.findFirst.mockResolvedValue(null);
      const orgDelegate = getMockPrismaDelegate(mockPrisma, 'organization');
      orgDelegate.findFirst.mockResolvedValue({ id: 7, code: 'DEFAULT' });

      await expect(service.bootstrapAdmin()).rejects.toThrow(
        'Production environment requires BOOTSTRAP_ADMIN_PASSWORD to be a non-placeholder value.',
      );
    });

    it('does not log generated bootstrap admin credentials in development', async () => {
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      setupConfigForTests({ BOOTSTRAP_ADMIN_PASSWORD: null });
      const userDelegate = getMockPrismaDelegate(mockPrisma, 'user');
      userDelegate.findFirst.mockResolvedValue(null);
      const orgDelegate = getMockPrismaDelegate(mockPrisma, 'organization');
      orgDelegate.findFirst.mockResolvedValue({ id: 7, code: 'DEFAULT' });
      const appRoleDelegate = getMockPrismaDelegate(mockPrisma, 'appRole');
      appRoleDelegate.upsert.mockResolvedValue({ id: 21, name: Role.ADMIN });
      const userRoleDelegate = getMockPrismaDelegate(mockPrisma, 'userRole');
      userRoleDelegate.upsert.mockResolvedValue({ userId: 3, roleId: 21 });
      const permissionDelegate = getMockPrismaDelegate(
        mockPrisma,
        'permission',
      );
      permissionDelegate.count.mockResolvedValue(1);
      const hashMock = jest.mocked(bcrypt.hash);
      hashMock.mockResolvedValue('hashed-bootstrap-password' as never);
      userDelegate.create.mockResolvedValue({
        id: 3,
        email: 'admin@erp.local',
        role: Role.ADMIN,
      });

      await service.bootstrapAdmin();

      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('password'),
      );
      warnSpy.mockRestore();
    });

    it('does not overwrite an existing Super Admin password when bootstrapping', async () => {
      setupConfigForTests({
        NODE_ENV: 'production',
        BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'StrongSup3rAdminPass!123',
      });
      const userDelegate = getMockPrismaDelegate(mockPrisma, 'user');
      const existingSuperAdmin = {
        id: 99,
        name: 'Existing Super Admin',
        email: 'superadmin@erp.local',
        role: Role.SUPER_ADMIN,
        isActive: true,
        organizationId: null,
      };
      userDelegate.findFirst.mockResolvedValue(existingSuperAdmin);
      userDelegate.update.mockResolvedValue({
        ...existingSuperAdmin,
        password: 'existing-password-hash',
      });
      const appRoleDelegate = getMockPrismaDelegate(mockPrisma, 'appRole');
      appRoleDelegate.upsert.mockResolvedValue({
        id: 42,
        name: Role.SUPER_ADMIN,
      });
      const userRoleDelegate = getMockPrismaDelegate(mockPrisma, 'userRole');
      userRoleDelegate.upsert.mockResolvedValue({ userId: 99, roleId: 42 });
      const permissionDelegate = getMockPrismaDelegate(
        mockPrisma,
        'permission',
      );
      permissionDelegate.count.mockResolvedValue(1);

      await service.bootstrapSuperAdmin();

      expect(userDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: existingSuperAdmin.id },
          data: expect.objectContaining({
            name: 'Super Admin User',
            email: 'superadmin@erp.local',
            role: Role.SUPER_ADMIN,
            isActive: true,
            organizationId: null,
          }),
        }),
      );
      expect(bcrypt.hash).not.toHaveBeenCalledWith(
        'StrongSup3rAdminPass!123',
        10,
      );
    });
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

    it('does not emit noisy console logging during successful login', async () => {
      const user = createLoginUser(null);
      const userDelegate = getMockPrismaDelegate(mockPrisma, 'user');
      const logSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

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

      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

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
