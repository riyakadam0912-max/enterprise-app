import { Invoice, Prisma } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';
import { UserFactory } from './user.factory';

export class InvoiceFactory {
  static async create(
    overrides: Partial<Prisma.InvoiceUncheckedCreateInput> = {},
  ): Promise<Invoice> {
    const prisma = DatabaseHelper.getPrismaClient();
    let organizationId = overrides.organizationId;
    let userId = overrides.userId;
    if (!userId) {
      const user = await UserFactory.create({ organizationId });
      userId = user.id;
      organizationId = user.organizationId ?? undefined;
    } else if (!organizationId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (user) {
        organizationId = user.organizationId ?? undefined;
      }
    }

    return prisma.invoice.create({
      data: {
        organizationId: organizationId ?? 0,
        userId: userId ?? 0,
        invoiceNo: overrides.invoiceNo || `INV-${Date.now()}`,
        totalAmount: overrides.totalAmount ?? 1000,
        ...overrides,
      },
    });
  }

  static async createMany(
    count: number,
    organizationId: number,
    userId: number,
  ): Promise<Invoice[]> {
    const invoices: Invoice[] = [];
    for (let i = 0; i < count; i++) {
      invoices.push(
        await this.create({
          organizationId,
          userId,
          invoiceNo: `INV-${Date.now()}-${i}`,
          totalAmount: 1000 + i * 500,
        }),
      );
    }
    return invoices;
  }
}
