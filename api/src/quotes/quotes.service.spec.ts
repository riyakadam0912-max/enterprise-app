import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthUser } from '../common/types/auth';
import { QuotesService } from './quotes.service';

const user: AuthUser = {
  id: 1,
  userId: 1,
  email: 'seller@example.com',
  name: 'Seller',
  role: Role.EMPLOYEE,
  roles: [Role.EMPLOYEE],
  permissions: [],
  employeeId: null,
  organizationId: 10,
  tokenType: 'access',
  jti: null,
};

function createPrismaMock() {
  return {
    deal: { findFirst: jest.fn() },
    contact: { findFirst: jest.fn() },
    customer: { findFirst: jest.fn() },
    product: { findFirst: jest.fn() },
    quote: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    quoteStatusHistory: { create: jest.fn() },
    invoice: { create: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('QuotesService', () => {
  it('creates a quote without a deal or contact and records its initial status', async () => {
    const prisma = createPrismaMock();
    const quote = { id: 42, status: 'DRAFT' };
    prisma.customer.findFirst.mockResolvedValue({ id: 7, organizationId: 10 });
    prisma.quote.create.mockResolvedValue(quote);
    const service = new QuotesService(prisma as never);

    await expect(
      service.create(
        {
          customerId: 7,
          validTill: '2026-12-31T00:00:00.000Z',
          items: [{ name: 'Consulting', quantity: 2, price: 100 }],
        },
        user,
      ),
    ).resolves.toEqual(quote);

    expect(prisma.deal.findFirst).not.toHaveBeenCalled();
    expect(prisma.contact.findFirst).not.toHaveBeenCalled();
    expect(prisma.quote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dealId: undefined,
          contactId: undefined,
          customerId: 7,
          subtotal: 200,
          taxAmount: 0,
          total: 200,
        }),
      }),
    );
    expect(prisma.quoteStatusHistory.create).toHaveBeenCalledWith({
      data: { quoteId: 42, status: 'DRAFT', source: 'SYSTEM' },
    });
  });

  it.each([
    ['customer', 'customerId', 'customer'],
    ['product', 'productId', 'product'],
  ] as const)(
    'rejects a %s owned by another organization',
    async (_label, field, delegate) => {
      const prisma = createPrismaMock();
      if (field === 'productId') {
        prisma.customer.findFirst.mockResolvedValue({
          id: 7,
          organizationId: 10,
        });
      }
      prisma[delegate].findFirst.mockResolvedValue(null);
      const service = new QuotesService(prisma as never);
      const payload = {
        customerId: 7,
        validTill: '2026-12-31T00:00:00.000Z',
        items: [
          {
            name: 'Service',
            quantity: 1,
            price: 100,
            ...(field === 'productId' ? { productId: 99 } : {}),
          },
        ],
        ...(field === 'productId' ? {} : {}),
      };

      await expect(service.create(payload as never, user)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma[delegate].findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          organizationId: delegate === 'customer' ? { in: [10] } : 10,
        }),
      });
    },
  );

  it('accepts a customer owned by a sibling organization in the same family', async () => {
    const prisma = createPrismaMock();
    const organizationScope = {
      getRelatedOrganizationIds: jest.fn().mockResolvedValue([10, 11, 12]),
    };
    prisma.customer.findFirst.mockResolvedValue({ id: 7, organizationId: 11 });
    prisma.quote.create.mockResolvedValue({ id: 42, status: 'DRAFT' });
    const service = new QuotesService(
      prisma as never,
      organizationScope as never,
    );

    await service.create(
      {
        customerId: 7,
        validTill: '2026-12-31T00:00:00.000Z',
        items: [{ name: 'Consulting', quantity: 1, price: 100 }],
      },
      user,
    );

    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 7, organizationId: { in: [10, 11, 12] }, deletedAt: null },
    });
  });

  it('rejects a customer outside the organization family', async () => {
    const prisma = createPrismaMock();
    const organizationScope = {
      getRelatedOrganizationIds: jest.fn().mockResolvedValue([10, 11, 12]),
    };
    prisma.customer.findFirst.mockResolvedValue(null);
    const service = new QuotesService(
      prisma as never,
      organizationScope as never,
    );

    await expect(
      service.create(
        {
          customerId: 99,
          validTill: '2026-12-31T00:00:00.000Z',
          items: [{ name: 'Consulting', quantity: 1, price: 100 }],
        },
        user,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 99, organizationId: { in: [10, 11, 12] }, deletedAt: null },
    });
  });

  it('calculates line discounts, tax, quote discount, and adjustment', async () => {
    const prisma = createPrismaMock();
    prisma.quote.create.mockImplementation(
      async ({
        data,
      }: {
        data: {
          total: number;
          subtotal: number;
          taxAmount: number;
          discountAmount: number;
          adjustmentAmount: number;
        };
      }) => ({ id: 1, status: 'DRAFT', ...data }),
    );
    const service = new QuotesService(prisma as never);

    await service.create(
      {
        validTill: '2026-12-31T00:00:00.000Z',
        discountAmount: 25,
        adjustmentAmount: 10,
        items: [
          {
            name: 'A',
            quantity: 2,
            price: 100,
            discountAmount: 20,
            taxRate: 10,
          },
          { name: 'B', quantity: 1, price: 50, discountAmount: 5, taxRate: 20 },
        ],
      },
      user,
    );

    expect(prisma.quote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 225,
          taxAmount: 27,
          discountAmount: 25,
          adjustmentAmount: 10,
          total: 237,
        }),
      }),
    );
  });

  it('uses an explicit tax amount instead of recalculating tax', async () => {
    const prisma = createPrismaMock();
    prisma.quote.create.mockResolvedValue({ id: 1, status: 'DRAFT' });
    const service = new QuotesService(prisma as never);

    await service.create(
      {
        validTill: '2026-12-31T00:00:00.000Z',
        taxAmount: 99,
        items: [{ name: 'A', quantity: 1, price: 100, taxRate: 20 }],
      },
      user,
    );

    expect(prisma.quote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ taxAmount: 99, total: 199 }),
      }),
    );
  });

  it('generates a PDF for an organization-owned quote', async () => {
    const prisma = createPrismaMock();
    prisma.quote.findUnique.mockResolvedValue({
      id: 5,
      name: 'Proposal',
      quoteDate: new Date('2026-10-01'),
      validTill: new Date('2026-11-01'),
      customerAddress: 'Mumbai',
      total: 110,
      subtotal: 100,
      discountAmount: 0,
      taxAmount: 10,
      adjustmentAmount: 0,
      termsAndConditions: 'Net 30',
      customer: {
        customerName: 'Acme',
        addressLine1: 'Main',
        addressLine2: null,
        city: 'Mumbai',
        state: 'MH',
        zipCode: '400001',
      },
      items: [{ name: 'Service', quantity: 1, price: 100, discountAmount: 0 }],
    });
    const service = new QuotesService(prisma as never);

    const pdf = await service.generatePdf(5, user);

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(prisma.quote.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5, organizationId: 10 } }),
    );
  });

  it('converts an organization-owned quote into an invoice', async () => {
    const prisma = createPrismaMock();
    prisma.quote.findUnique.mockResolvedValue({
      id: 5,
      total: 250,
      validTill: new Date('2026-11-01'),
      notes: 'Terms',
      customer: { customerName: 'Acme' },
      contact: null,
    });
    prisma.invoice.create.mockResolvedValue({ id: 9, invoiceNo: 'INV-Q5-1' });
    prisma.quote.update.mockResolvedValue({ id: 5, status: 'CONVERTED' });
    const service = new QuotesService(prisma as never);

    await expect(service.convertToInvoice(5, 1, user)).resolves.toEqual({
      id: 9,
      invoiceNo: 'INV-Q5-1',
    });
    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 10,
          customer: 'Acme',
          totalAmount: 250,
        }),
      }),
    );
    expect(prisma.quote.update).toHaveBeenCalledWith({
      where: { id: 5, organizationId: 10 },
      data: { status: 'CONVERTED' },
    });
    expect(prisma.quoteStatusHistory.create).toHaveBeenCalledWith({
      data: { quoteId: 5, status: 'CONVERTED', source: 'DASHBOARD' },
    });
  });
});
