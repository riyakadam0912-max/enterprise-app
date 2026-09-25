import { ForbiddenException } from '@nestjs/common';
import { Role, CustomerType } from '@prisma/client';
import type { AuthUser } from '../common/types/auth';
import { CustomersService } from './customers.service';

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

describe('CustomersService', () => {
  const prisma = {
    customer: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  } as any;
  const service = new CustomersService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('lists customers only from the authenticated organization', async () => {
    prisma.customer.findMany.mockResolvedValueOnce([]);
    await service.findAll(admin);
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 10, deletedAt: null },
      }),
    );
  });

  it('requires an organization for customer access', async () => {
    await expect(
      service.findAll({ ...admin, organizationId: null }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates a normalized business customer', async () => {
    prisma.customer.create.mockResolvedValueOnce({ id: 1 });
    await service.create(
      {
        customerName: ' Acme ',
        customerType: CustomerType.BUSINESS,
        addressLine1: ' Main Street ',
        city: ' Mumbai ',
        state: ' MH ',
        country: ' India ',
        zipCode: ' 400001 ',
        email: ' SALES@ACME.TEST ',
      },
      admin,
    );
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerName: 'Acme',
          email: 'sales@acme.test',
          organizationId: 10,
        }),
      }),
    );
  });
});
