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
  const organizationScope = {
    getRelatedOrganizationIds: jest.fn().mockResolvedValue([10, 11, 12]),
  } as any;
  const service = new CustomersService(prisma, organizationScope);

  beforeEach(() => jest.clearAllMocks());

  it('lists customers across the authenticated organization family', async () => {
    prisma.customer.findMany.mockResolvedValueOnce([]);
    await service.findAll(admin);
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: { in: [10, 11, 12] }, deletedAt: null },
      }),
    );
    expect(organizationScope.getRelatedOrganizationIds).toHaveBeenCalledWith(
      10,
    );
  });

  it('allows reading a customer owned by a sibling organization', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({
      id: 44,
      organizationId: 11,
    });
    await service.findOne(44, admin);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 44,
          organizationId: { in: [10, 11, 12] },
          deletedAt: null,
        },
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
        shortName: ' AC ',
        customerType: CustomerType.BUSINESS,
        addressLine1: ' Main Street ',
        city: ' Mumbai ',
        state: ' MH ',
        country: ' India ',
        zipCode: ' 400001 ',
        webAddress: ' https://acme.test ',
        email: ' SALES@ACME.TEST ',
      },
      admin,
    );
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerName: 'Acme',
          shortName: 'AC',
          addressLine1: 'Main Street',
          webAddress: 'https://acme.test',
          email: 'sales@acme.test',
          organizationId: 10,
        }),
      }),
    );
  });

  it('creates a customer with only its required name', async () => {
    prisma.customer.create.mockResolvedValueOnce({ id: 2 });
    await service.create({ customerName: ' Acme ' }, admin);

    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerName: 'Acme',
          shortName: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          state: null,
          country: null,
          zipCode: null,
        }),
      }),
    );
  });

  it('keeps customer updates restricted to the owning organization', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.update(44, { customerName: 'Changed' }, admin),
    ).rejects.toThrow('Customer not found');
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 44, organizationId: 10, deletedAt: null },
    });
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });
});
