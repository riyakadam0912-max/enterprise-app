import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Permission } from '../common/enums/permissions.enum';

const mockPrisma = {
  organization: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  permission: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  appRole: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  rolePermission: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  userRole: {
    upsert: jest.fn(),
  },
  shift: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  $disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  return {
    ...actual,
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

// Import after mocks are set up
import { bootstrapProduction } from '../../prisma/seed.production';

describe('Production Bootstrap (seed.production.ts)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      BOOTSTRAP_ORGANIZATION_CODE: 'PROD',
      BOOTSTRAP_ORGANIZATION_NAME: 'Production Organization',
      BOOTSTRAP_ORGANIZATION_SLUG: 'production',
      BOOTSTRAP_ORGANIZATION_TIMEZONE: 'Asia/Kolkata',
      BOOTSTRAP_ORGANIZATION_CURRENCY: 'INR',
      BOOTSTRAP_SUPER_ADMIN_EMAIL: 'admin@production.local',
      BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'SecurePassword123!@#',
    };

    // Default mock implementations
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    mockPrisma.organization.upsert.mockResolvedValue({
      id: 1,
      code: 'PROD',
      name: 'Production Organization',
      slug: 'production',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      status: 'ACTIVE',
    });

    mockPrisma.permission.upsert.mockResolvedValue({
      id: 1,
      key: Permission.EMPLOYEE_READ,
    });

    mockPrisma.permission.findMany.mockResolvedValue(
      Object.values(Permission).map((key, id) => ({
        id: id + 1,
        key,
      })),
    );

    mockPrisma.appRole.upsert.mockResolvedValue({
      id: 1,
      name: Role.SUPER_ADMIN,
    });

    mockPrisma.appRole.findUnique.mockResolvedValue({
      id: 1,
      name: Role.SUPER_ADMIN,
    });

    mockPrisma.user.findFirst.mockResolvedValue(null);

    mockPrisma.user.create.mockResolvedValue({
      id: 99,
      email: 'admin@production.local',
      role: Role.SUPER_ADMIN,
      organizationId: null,
    });

    mockPrisma.shift.findFirst.mockResolvedValue(null);

    mockPrisma.shift.create.mockResolvedValue({
      id: 1,
      name: 'Default Shift',
      startTime: '09:00',
      endTime: '18:00',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Validation', () => {
    it('should fail if NODE_ENV is not production', async () => {
      process.env.NODE_ENV = 'development';

      await expect(bootstrapProduction()).rejects.toThrow(
        'NODE_ENV=production',
      );
    });

    it('should fail if BOOTSTRAP_SUPER_ADMIN_EMAIL is missing', async () => {
      delete process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;

      await expect(bootstrapProduction()).rejects.toThrow(
        'BOOTSTRAP_SUPER_ADMIN_EMAIL is required',
      );
    });

    it('should fail if BOOTSTRAP_SUPER_ADMIN_PASSWORD is missing', async () => {
      delete process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;

      await expect(bootstrapProduction()).rejects.toThrow(
        'BOOTSTRAP_SUPER_ADMIN_PASSWORD is required',
      );
    });

    it('should fail if BOOTSTRAP_SUPER_ADMIN_PASSWORD is a placeholder', async () => {
      process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD =
        'replace-with-secure-bootstrap-password';

      await expect(bootstrapProduction()).rejects.toThrow(
        'must not use a placeholder or default value',
      );
    });

    it('should fail if BOOTSTRAP_SUPER_ADMIN_PASSWORD is "admin123"', async () => {
      process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD = 'admin123';

      await expect(bootstrapProduction()).rejects.toThrow(
        'must not use a placeholder or default value',
      );
    });
  });

  describe('Organization Bootstrap', () => {
    it('should create production organization with correct defaults', async () => {
      await bootstrapProduction();

      expect(mockPrisma.organization.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: 'PROD' },
          create: expect.objectContaining({
            name: 'Production Organization',
            code: 'PROD',
            slug: 'production',
            timezone: 'Asia/Kolkata',
            currency: 'INR',
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('should use custom organization values from environment', async () => {
      process.env.BOOTSTRAP_ORGANIZATION_CODE = 'CUSTOM';
      process.env.BOOTSTRAP_ORGANIZATION_NAME = 'Custom Org';
      process.env.BOOTSTRAP_ORGANIZATION_SLUG = 'custom-org';
      process.env.BOOTSTRAP_ORGANIZATION_TIMEZONE = 'America/New_York';
      process.env.BOOTSTRAP_ORGANIZATION_CURRENCY = 'USD';

      await bootstrapProduction();

      expect(mockPrisma.organization.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: 'CUSTOM' },
          create: expect.objectContaining({
            code: 'CUSTOM',
            name: 'Custom Org',
            slug: 'custom-org',
            timezone: 'America/New_York',
            currency: 'USD',
          }),
        }),
      );
    });

    it('should be idempotent (upsert should handle existing org)', async () => {
      mockPrisma.organization.upsert.mockResolvedValue({
        id: 1,
        code: 'PROD',
      });

      await bootstrapProduction();
      await bootstrapProduction();

      expect(mockPrisma.organization.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('RBAC Bootstrap', () => {
    it('should create all permissions', async () => {
      await bootstrapProduction();

      expect(mockPrisma.permission.upsert).toHaveBeenCalled();
      const permissionCalls = (mockPrisma.permission.upsert as jest.Mock).mock
        .calls;
      expect(permissionCalls.length).toBeGreaterThan(0);
    });

    it('should create SUPER_ADMIN role with all permissions', async () => {
      mockPrisma.appRole.upsert.mockResolvedValue({
        id: 1,
        name: Role.SUPER_ADMIN,
      });

      await bootstrapProduction();

      expect(mockPrisma.appRole.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: Role.SUPER_ADMIN },
          create: expect.objectContaining({
            name: Role.SUPER_ADMIN,
            description: expect.stringContaining('Platform Super Admin'),
          }),
        }),
      );
    });

    it('should create ADMIN role with appropriate permissions', async () => {
      await bootstrapProduction();

      expect(mockPrisma.appRole.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: Role.ADMIN },
        }),
      );
    });

    it('should create HR role', async () => {
      await bootstrapProduction();

      expect(mockPrisma.appRole.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: Role.HR },
        }),
      );
    });

    it('should create MANAGER role', async () => {
      await bootstrapProduction();

      expect(mockPrisma.appRole.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: Role.MANAGER },
        }),
      );
    });

    it('should create EMPLOYEE role', async () => {
      await bootstrapProduction();

      expect(mockPrisma.appRole.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: Role.EMPLOYEE },
        }),
      );
    });

    it('should be idempotent for RBAC (upsert should handle existing roles)', async () => {
      await bootstrapProduction();
      await bootstrapProduction();

      // Each run creates 5 roles with upsert, so 10 calls total
      expect(mockPrisma.appRole.upsert).toHaveBeenCalledTimes(10);
    });
  });

  describe('Super Admin Bootstrap', () => {
    it('should create platform super admin with correct data', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await bootstrapProduction();

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Super Admin User',
            email: 'admin@production.local',
            password: 'hashed-password',
            role: Role.SUPER_ADMIN,
            isActive: true,
            organizationId: null, // Platform-level
          }),
        }),
      );
    });

    it('should hash the super admin password with bcrypt', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await bootstrapProduction();

      expect(bcrypt.hash).toHaveBeenCalledWith(
        'SecurePassword123!@#',
        expect.any(Number),
      );
    });

    it('should assign SUPER_ADMIN AppRole to super admin user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.appRole.findUnique.mockResolvedValue({
        id: 1,
        name: Role.SUPER_ADMIN,
      });

      await bootstrapProduction();

      expect(mockPrisma.userRole.upsert).toHaveBeenCalled();
    });

    it('should skip super admin creation if already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 99,
        email: 'admin@production.local',
        role: Role.SUPER_ADMIN,
      });

      await bootstrapProduction();

      // Should not create a new user
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should be idempotent (multiple runs should not create duplicate admins)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await bootstrapProduction();

      // Second run should find the user
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 99,
        email: 'admin@production.local',
      });

      await bootstrapProduction();

      // Only one user.create call
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Organization Admin Bootstrap (Optional)', () => {
    it('should skip organization admin creation if email not provided', async () => {
      delete process.env.BOOTSTRAP_ADMIN_EMAIL;

      await bootstrapProduction();

      // Should not call user.create for admin (only for super admin)
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1); // Only super admin
    });

    it('should fail if admin email provided but password missing', async () => {
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'org-admin@production.local';
      delete process.env.BOOTSTRAP_ADMIN_PASSWORD;

      await expect(bootstrapProduction()).rejects.toThrow(
        'BOOTSTRAP_ADMIN_PASSWORD is required',
      );
    });

    it('should create organization admin if both email and password provided', async () => {
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'org-admin@production.local';
      process.env.BOOTSTRAP_ADMIN_PASSWORD = 'SecureAdminPass456!@#';

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await bootstrapProduction();

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'org-admin@production.local',
            role: Role.ADMIN,
            organizationId: 1, // Belongs to production org
          }),
        }),
      );
    });

    it('should assign ADMIN AppRole to organization admin', async () => {
      process.env.BOOTSTRAP_ADMIN_EMAIL = 'org-admin@production.local';
      process.env.BOOTSTRAP_ADMIN_PASSWORD = 'SecureAdminPass456!@#';

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.appRole.findUnique.mockResolvedValue({
        id: 2,
        name: Role.ADMIN,
      });

      await bootstrapProduction();

      expect(mockPrisma.userRole.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_roleId: expect.objectContaining({
              roleId: 2, // ADMIN role
            }),
          },
        }),
      );
    });
  });

  describe('System Defaults', () => {
    it('should create a default shift with correct times', async () => {
      mockPrisma.shift.findFirst.mockResolvedValue(null);

      await bootstrapProduction();

      expect(mockPrisma.shift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Default Shift',
            type: 'FIXED',
            startTime: '09:00',
            endTime: '18:00',
            requiredHours: 8,
            gracePeriodMinutes: 15,
            isActive: true,
            organizationId: 1,
          }),
        }),
      );
    });

    it('should skip shift creation if already exists', async () => {
      mockPrisma.shift.findFirst.mockResolvedValue({
        id: 1,
        name: 'Default Shift',
      });

      await bootstrapProduction();

      expect(mockPrisma.shift.create).not.toHaveBeenCalled();
    });
  });

  describe('Returned Bootstrap Result', () => {
    it('should return organization and admin details', async () => {
      mockPrisma.organization.upsert.mockResolvedValue({
        id: 1,
        code: 'PROD',
      });

      mockPrisma.user.findFirst.mockResolvedValue(null);

      mockPrisma.user.create.mockResolvedValue({
        id: 99,
        email: 'admin@production.local',
      });

      const result = await bootstrapProduction();

      expect(result).toMatchObject({
        organizationId: 1,
        organizationCode: 'PROD',
        superAdminId: 99,
        superAdminEmail: 'admin@production.local',
      });
    });
  });

  describe('Safety Constraints', () => {
    it('should use organizationId from the bootstrap result (not hardcoded)', async () => {
      // Mock with a different organizationId
      mockPrisma.organization.upsert.mockResolvedValue({
        id: 42,
        code: 'PROD',
      });

      await bootstrapProduction();

      // Check shift creation uses the organizationId from result (42, not hardcoded 1)
      const shiftCalls = (mockPrisma.shift.create as jest.Mock).mock.calls;
      expect(shiftCalls[0][0].data.organizationId).toBe(42);
    });

    it('should not call any destructive operations (no TRUNCATE, DELETE, RESET)', async () => {
      await bootstrapProduction();

      // Verify no raw SQL calls that could be destructive
      const rawCalls = (mockPrisma as any).$executeRawUnsafe?.mock?.calls || [];
      const sqlText = rawCalls
        .map((call: any) => call[0])
        .join(' ')
        .toUpperCase();

      expect(sqlText).not.toMatch(/TRUNCATE/);
      expect(sqlText).not.toMatch(/DELETE FROM/);
      expect(sqlText).not.toMatch(/RESTART IDENTITY/);
    });

    it('should be safe to run multiple times without error', async () => {
      await bootstrapProduction();
      await bootstrapProduction(); // Second run

      // Should complete without error
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });
  });
});
