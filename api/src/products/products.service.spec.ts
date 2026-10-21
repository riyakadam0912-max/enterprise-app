import { ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../common/types/auth';
import { ProductsService } from './products.service';

const admin: AuthUser = {
  id: 1,
  userId: 1,
  email: 'admin@example.com',
  name: 'Admin',
  role: Role.ADMIN,
  roles: [Role.ADMIN],
  permissions: [],
  employeeId: null,
  organizationId: 10,
  tokenType: 'access',
  jti: null,
};

describe('ProductsService', () => {
  const prisma = {
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (operation: (transaction: typeof prisma) => Promise<unknown>) =>
      operation(prisma),
  );
  const service = new ProductsService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('rejects an item with a duplicate SKU regardless of letter case', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Existing',
        sku: 'VIDEO-01',
        type: 'SERVICE',
        unit: 'Day',
      },
    ]);

    await expect(
      service.create(
        {
          name: 'New item',
          sku: 'video-01',
          type: 'SERVICE',
          unit: 'Day',
          price: 100,
        },
        admin,
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate name, type, and unit when the new item has no SKU', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Videography',
        sku: null,
        type: 'SERVICE',
        unit: 'Per Day',
      },
    ]);

    await expect(
      service.create(
        { name: ' videography ', type: 'SERVICE', unit: 'per day', price: 100 },
        admin,
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('excludes soft-deleted items from the catalog', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.findAll(admin);

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 10, deletedAt: null },
      }),
    );
  });
});
