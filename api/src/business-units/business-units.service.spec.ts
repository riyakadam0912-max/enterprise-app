import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
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

    await expect(service.list(2, user(Role.HR, 1))).rejects.toThrow(ForbiddenException);
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a parent from another organization', async () => {
    const prisma = createPrismaMock();
    prisma.organization.findFirst.mockResolvedValue({ id: 1 });
    prisma.businessUnit.findFirst.mockResolvedValue(null);
    const service = new BusinessUnitsService(prisma);

    await expect(
      service.create(1, { name: 'Pune', code: 'PUNE', parentId: 99 }, user(Role.ADMIN)),
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

    await expect(service.remove(1, 1, user(Role.ADMIN))).rejects.toThrow(ConflictException);
    expect(prisma.businessUnit.delete).not.toHaveBeenCalled();
  });
});
