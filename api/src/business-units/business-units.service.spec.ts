import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { BusinessUnitsService } from './business-units.service';
import { Role } from '../common/enums/role.enum';

function createPrismaMock() {
  return {
    organization: { findFirst: jest.fn() },
    businessUnit: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    businessUnitAdmin: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: { findFirst: jest.fn(), findMany: jest.fn() },
  } as any;
}

function user(role: Role, organizationId = 1) {
  return {
    id: 1,
    userId: 1,
    email: 'admin@example.com',
    name: 'Admin',
    role,
    roles: [role],
    permissions: [],
    employeeId: null,
    organizationId,
    tokenType: 'access',
    jti: null,
  };
}

describe('BusinessUnitsService', () => {
  it('rejects a tenant user listing another organization', async () => {
    const prisma = createPrismaMock();
    const service = new BusinessUnitsService(prisma);

    await expect(service.list(2, user(Role.HR, 1))).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('does not let an organization admin resolve another organization', async () => {
    const prisma = createPrismaMock();
    const service = new BusinessUnitsService(prisma);

    await expect(service.resolveScope(user(Role.ADMIN, 1), 2)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('limits a BU administrator to assigned units and their descendants', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findFirst.mockResolvedValue({ id: 1 });
    prisma.businessUnitAdmin.findMany.mockResolvedValue([
      { businessUnitId: 10 },
    ]);
    prisma.businessUnit.findMany.mockImplementation(({ where }: any) => {
      if (where.id?.in) return [{ id: 10 }];
      if (where.parentId === 10) return [{ id: 11 }];
      return [];
    });
    const service = new BusinessUnitsService(prisma);
    const buAdmin = user(Role.MANAGER);

    const scope = await service.resolveScope(buAdmin);

    expect(scope).toEqual({
      organizationId: 1,
      allUnits: false,
      unitIds: [10, 11],
      assignedUnitId: null,
    });
    expect(service.buildDirectBUWhere(scope)).toEqual({
      organizationId: 1,
      businessUnitId: { in: [10, 11] },
    });
  });

  it('rejects a selected BU outside a BU administrator assignment', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findFirst.mockResolvedValue({ id: 1 });
    prisma.businessUnitAdmin.findMany.mockResolvedValue([
      { businessUnitId: 10 },
    ]);
    prisma.businessUnit.findMany.mockImplementation(({ where }: any) => {
      if (where.id?.in) return [{ id: 10 }];
      if (where.parentId === 10) return [{ id: 11 }];
      if (where.parentId === 11) return [];
      return [];
    });
    const service = new BusinessUnitsService(prisma);

    await expect(
      service.resolveScope({
        ...user(Role.MANAGER),
        businessUnitId: 20,
        allBusinessUnits: false,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns no BU admin access for a user without an assignment', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findFirst.mockResolvedValue({ id: 1 });
    prisma.businessUnitAdmin.findMany.mockResolvedValue([]);
    prisma.businessUnit.findMany.mockResolvedValue([]);
    const service = new BusinessUnitsService(prisma);

    await expect(
      service.getAccessibleBusinessUnitsForUser(user(Role.MANAGER), 1),
    ).resolves.toEqual({
      units: [],
      canSelectAll: false,
      assignedUnitId: null,
      isBusinessUnitAdmin: false,
    });
    expect(prisma.businessUnit.findMany).not.toHaveBeenCalled();
  });

  it('reports an active BU administrator assignment to the authenticated user', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findFirst.mockResolvedValue({ id: 1 });
    prisma.businessUnitAdmin.findMany.mockResolvedValue([
      { businessUnitId: 10 },
    ]);
    prisma.businessUnit.findMany.mockImplementation(({ where }: any) => {
      if (where.id?.in) {
        return [
          {
            id: 10,
            name: 'North',
            code: 'NORTH',
            parentId: null,
            status: 'ACTIVE',
          },
        ];
      }
      return [];
    });
    const service = new BusinessUnitsService(prisma);

    await expect(
      service.getAccessibleBusinessUnitsForUser(user(Role.MANAGER), 1),
    ).resolves.toMatchObject({
      units: [{ id: 10, name: 'North' }],
      isBusinessUnitAdmin: true,
    });
  });

  it('rejects null-BU records for a restricted BU scope', async () => {
    const prisma = createPrismaMock();
    const service = new BusinessUnitsService(prisma);

    await expect(
      service.assertRecordAccessible(
        {
          organizationId: 1,
          allUnits: false,
          unitIds: [10],
          assignedUnitId: 10,
        },
        null,
        'employee',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not assign a BU admin to a user in another organization', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findFirst.mockResolvedValue({ id: 1 });
    prisma.businessUnit.findFirst.mockResolvedValue({ id: 10 });
    prisma.user.findFirst.mockResolvedValue(null);
    const service = new BusinessUnitsService(prisma);

    await expect(
      service.assignAdministrator(10, 1, 99, user(Role.ADMIN)),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.businessUnitAdmin.upsert).not.toHaveBeenCalled();
  });

  it('does not assign an organization-wide admin as a scoped BU administrator', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findFirst.mockResolvedValue({ id: 1 });
    prisma.businessUnit.findFirst.mockResolvedValue({ id: 10 });
    prisma.user.findFirst.mockResolvedValue({
      id: 99,
      role: Role.ADMIN,
      isActive: true,
    });
    const service = new BusinessUnitsService(prisma);

    await expect(
      service.assignAdministrator(10, 1, 99, user(Role.ADMIN)),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.businessUnitAdmin.upsert).not.toHaveBeenCalled();
  });

  it('rejects a scoped-role user who has an additional organization-wide RBAC role', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findFirst.mockResolvedValue({ id: 1 });
    prisma.businessUnit.findFirst.mockResolvedValue({ id: 10 });
    prisma.user.findFirst.mockResolvedValue({
      id: 99,
      role: Role.MANAGER,
      isActive: true,
      userRoles: [{ role: { name: Role.ADMIN } }],
    });
    const service = new BusinessUnitsService(prisma);

    await expect(
      service.assignAdministrator(10, 1, 99, user(Role.ADMIN)),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.businessUnitAdmin.upsert).not.toHaveBeenCalled();
  });

  it('lists only active, unassigned, non-wide-role candidates in the organization', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findFirst.mockResolvedValue({ id: 1 });
    prisma.businessUnit.findFirst.mockResolvedValue({ id: 10 });
    prisma.user.findMany.mockResolvedValue([]);
    const service = new BusinessUnitsService(prisma);

    await service.listAdministratorCandidates(10, 1, user(Role.ADMIN));

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 1,
          isActive: true,
          deletedAt: null,
          role: {
            notIn: [
              Role.SUPER_ADMIN,
              Role.ADMIN,
              Role.HR,
              Role.COMPLIANCE_MANAGER,
            ],
          },
          userRoles: {
            none: {
              role: {
                name: {
                  in: [
                    Role.SUPER_ADMIN,
                    Role.ADMIN,
                    Role.HR,
                    Role.COMPLIANCE_MANAGER,
                  ],
                },
              },
            },
          },
        }),
      }),
    );
  });

  it('audits BU administrator assignments with the target unit and actor', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findFirst.mockResolvedValue({ id: 1 });
    prisma.businessUnit.findFirst.mockResolvedValue({ id: 10 });
    prisma.user.findFirst.mockResolvedValue({
      id: 99,
      role: Role.MANAGER,
      isActive: true,
    });
    prisma.businessUnitAdmin.upsert.mockResolvedValue({ id: 4 });
    const auditLogs = { logCreate: jest.fn().mockResolvedValue(undefined) };
    const service = new BusinessUnitsService(prisma, auditLogs as any);
    const actor = user(Role.ADMIN);

    await service.assignAdministrator(10, 1, 99, actor);

    expect(auditLogs.logCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'BusinessUnit',
        entityId: 10,
        action: 'BUSINESS_UNIT_ADMIN_ASSIGNED',
      }),
      actor,
    );
  });

  it('rejects a parent from another organization', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findFirst.mockResolvedValue({ id: 1 });
    prisma.businessUnit.findFirst.mockResolvedValue(null);
    const service = new BusinessUnitsService(prisma);

    await expect(
      service.create(
        1,
        { name: 'Pune', code: 'PUNE', parentId: 99 },
        user(Role.ADMIN),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.businessUnit.create).not.toHaveBeenCalled();
  });

  it('rejects circular parent updates', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findFirst.mockResolvedValue({ id: 1 });
    prisma.businessUnit.findFirst
      .mockResolvedValueOnce({ id: 2, parentId: null })
      .mockResolvedValueOnce({ id: 2, parentId: 1 });
    const service = new BusinessUnitsService(prisma);

    await expect(
      service.update(1, 1, { parentId: 2 }, user(Role.ADMIN)),
    ).rejects.toThrow(ConflictException);
  });

  it('does not delete a Business Unit that has children', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findFirst.mockResolvedValue({ id: 1 });
    prisma.businessUnit.findFirst.mockResolvedValue({ id: 1, parentId: null });
    prisma.businessUnit.count.mockResolvedValue(1);
    const service = new BusinessUnitsService(prisma);

    await expect(service.remove(1, 1, user(Role.ADMIN))).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.businessUnit.delete).not.toHaveBeenCalled();
  });
});
