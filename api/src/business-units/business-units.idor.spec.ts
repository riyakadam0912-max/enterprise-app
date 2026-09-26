import { ForbiddenException } from '@nestjs/common';
import { BusinessUnitsService } from './business-units.service';
import type { AuthUser } from '../common/types/auth';
import { Role } from '../common/enums/role.enum';

const units = [
  { id: 101, parentId: null },
  { id: 102, parentId: 101 },
  { id: 202, parentId: null },
];

function makeUser(role: Role = Role.MANAGER): AuthUser {
  return {
    id: 1,
    userId: 1,
    email: 'bu-admin@example.com',
    name: 'BU Admin',
    role,
    roles: [role],
    permissions: [],
    employeeId: 11,
    organizationId: 1,
    tokenType: 'access',
    jti: null,
  };
}

function makeService() {
  const prisma = {
    organization: {
      findFirst: jest.fn(({ where }: any) =>
        where.id === 1 ? { id: 1 } : null,
      ),
    },
    businessUnitAdmin: {
      findMany: jest.fn().mockResolvedValue([{ businessUnitId: 101 }]),
    },
    businessUnit: {
      findFirst: jest.fn(({ where }: any) =>
        units.find(
          (unit) =>
            unit.id === where.id &&
            where.organizationId === 1 &&
            where.status === 'ACTIVE',
        ) ?? null,
      ),
      findMany: jest.fn(({ where }: any) => {
        if (where.id?.in) return units.filter((unit) => where.id.in.includes(unit.id));
        if (where.parentId !== undefined) return units.filter((unit) => unit.parentId === where.parentId);
        return [];
      }),
    },
  } as any;

  return new BusinessUnitsService(prisma);
}

describe('Business Unit IDOR authorization', () => {
  it('limits an assigned BU admin to the assigned unit and active descendants', async () => {
    const service = makeService();

    const scope = await service.resolveScope(makeUser());

    expect(scope.unitIds).toEqual([101, 102]);
    expect(service.buildDirectBUWhere(scope)).toEqual({
      organizationId: 1,
      businessUnitId: { in: [101, 102] },
    });
  });

  it('rejects a forged selected BU outside the administrator assignment', async () => {
    const service = makeService();

    await expect(
      service.resolveScope({
        ...makeUser(),
        businessUnitId: 202,
        allBusinessUnits: false,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not allow an ALL context flag to widen a scoped administrator', async () => {
    const service = makeService();

    const scope = await service.resolveScope({
      ...makeUser(),
      allBusinessUnits: true,
    });

    expect(scope.allUnits).toBe(false);
    expect(scope.unitIds).toEqual([101, 102]);
  });

  it('denies access to records without a BU for a restricted administrator', async () => {
    const service = makeService();

    await expect(
      service.assertRecordAccessible(
        {
          organizationId: 1,
          allUnits: false,
          unitIds: [101, 102],
          assignedUnitId: null,
        },
        null,
        'employee',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('keeps organization admins wide within their org but blocks another org', async () => {
    const service = makeService();
    const admin = makeUser(Role.ADMIN);

    await expect(service.resolveScope(admin)).resolves.toMatchObject({
      organizationId: 1,
      allUnits: true,
    });
    await expect(service.resolveScope(admin, 2)).rejects.toThrow(
      ForbiddenException,
    );
  });
});