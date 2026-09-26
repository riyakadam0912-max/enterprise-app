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
      findMany: jest.fn(({ where }: any) =>
        where.userId === 1 ? [{ businessUnitId: 101 }] : [],
      ),
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
  it('grants all active BUs in the assigned organization', async () => {
    const service = makeService();

    const scope = await service.resolveScope(makeUser());

    expect(scope.allUnits).toBe(true);
    expect(scope.unitIds).toEqual([]);
    expect(service.buildDirectBUWhere(scope)).toEqual({
      organizationId: 1,
    });
  });

  it('rejects a selected BU outside the administrator organization', async () => {
    const service = makeService();

    await expect(
      service.resolveScope({
        ...makeUser(),
        businessUnitId: 999,
        allBusinessUnits: false,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows an assigned BU admin to select all units in their organization', async () => {
    const service = makeService();

    const scope = await service.resolveScope({
      ...makeUser(),
      allBusinessUnits: true,
    });

    expect(scope.allUnits).toBe(true);
    expect(scope.unitIds).toEqual([]);
  });

  it('keeps restricted users without a BU-admin assignment fail-closed', async () => {
    const service = makeService();

    const scope = await service.resolveScope({
      ...makeUser(),
      userId: 999,
    });
    expect(scope.allUnits).toBe(false);
    expect(scope.unitIds).toEqual([]);
    await expect(
      service.assertRecordAccessible(scope, null, 'employee'),
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