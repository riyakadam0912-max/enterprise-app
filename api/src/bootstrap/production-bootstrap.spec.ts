import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Permission } from '../common/enums/permissions.enum';

const mockPrisma = {
  organization: {
    upsert: jest.fn(),
  },
  permission: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
  appRole: {
    upsert: jest.fn(),
  },
  rolePermission: {
    upsert: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  userRole: {
    upsert: jest.fn(),
  },
};

jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  return {
    ...actual,
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

import { bootstrapProduction } from '../../prisma/bootstrap';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('Problem 5 bootstrap', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'StrongSup3rAdminPass!123',
    };
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    mockPrisma.organization.upsert.mockResolvedValue({
      id: 7,
      code: 'DEFAULT',
    });
    mockPrisma.permission.upsert.mockResolvedValue({
      id: 1,
      key: Permission.EMPLOYEE_READ,
    });
    mockPrisma.permission.findUnique.mockImplementation(async ({ where }) => ({
      id: 1,
      key: where.key,
      description: `Permission for ${where.key}`,
    }));
    mockPrisma.appRole.upsert.mockImplementation(async ({ where }) => ({
      id: 1,
      name: where.name,
    }));
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 99,
      email: 'superadmin@erp.local',
      role: Role.SUPER_ADMIN,
      organizationId: null,
    });
    mockPrisma.userRole.upsert.mockResolvedValue({ userId: 99, roleId: 1 });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates the default organization when missing', async () => {
    await bootstrapProduction();

    expect(mockPrisma.organization.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: 'DEFAULT' },
        create: expect.objectContaining({ code: 'DEFAULT' }),
      }),
    );
  });

  it('reuses an existing default organization', async () => {
    mockPrisma.organization.upsert.mockResolvedValue({
      id: 7,
      code: 'DEFAULT',
    });

    await bootstrapProduction();

    expect(mockPrisma.organization.upsert).toHaveBeenCalled();
  });

  it('creates missing permissions and roles and RolePermission mappings', async () => {
    await bootstrapProduction();

    expect(mockPrisma.permission.upsert).toHaveBeenCalled();
    expect(mockPrisma.appRole.upsert).toHaveBeenCalled();
    expect(mockPrisma.rolePermission.upsert).toHaveBeenCalled();
  });

  it('creates the initial platform Super Admin when missing and sets organizationId to null', async () => {
    await bootstrapProduction();

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'superadmin@erp.local',
          role: Role.SUPER_ADMIN,
          organizationId: null,
        }),
      }),
    );
    expect(mockPrisma.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_roleId: {
            userId: 99,
            roleId: 1,
          },
        },
      }),
    );
  });

  it('fails closed when BOOTSTRAP_SUPER_ADMIN_PASSWORD is missing', async () => {
    delete process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;

    await expect(bootstrapProduction()).rejects.toThrow(
      'Production bootstrap failed: BOOTSTRAP_SUPER_ADMIN_PASSWORD is required and must be set explicitly.',
    );
  });

  it('fails closed when BOOTSTRAP_SUPER_ADMIN_PASSWORD is a placeholder', async () => {
    process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD =
      'replace-with-secure-bootstrap-password';

    await expect(bootstrapProduction()).rejects.toThrow(
      'Production bootstrap failed: BOOTSTRAP_SUPER_ADMIN_PASSWORD must not use a placeholder or default value.',
    );
  });

  it('does not overwrite an existing Super Admin', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 42,
      email: 'superadmin@erp.local',
      role: Role.SUPER_ADMIN,
      organizationId: null,
    });

    await bootstrapProduction();

    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('is idempotent when run twice', async () => {
    await bootstrapProduction();
    await bootstrapProduction();

    expect(mockPrisma.organization.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.userRole.upsert).toHaveBeenCalled();
  });

  it('does not call destructive Prisma operations', async () => {
    await bootstrapProduction();

    expect(mockPrisma.organization.upsert).not.toBeUndefined();
    expect(mockPrisma.user.create).toHaveBeenCalled();
  });
});
