import { Deal, Prisma } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';
import { OrganizationFactory } from './organization.factory';

export class DealFactory {
  static async create(
    overrides: Partial<Prisma.DealUncheckedCreateInput> = {},
  ): Promise<Deal> {
    const prisma = DatabaseHelper.getPrismaClient();
    let organizationId = overrides.organizationId;
    if (!organizationId) {
      const org = await OrganizationFactory.create();
      organizationId = org.id;
    }

    return prisma.deal.create({
      data: {
        title: `Test Deal ${Date.now()}`,
        value: 1000,
        organizationId,
        stage: 'NEW',
        ...overrides,
      },
    });
  }

  static async createMany(
    count: number,
    organizationId: number,
  ): Promise<Deal[]> {
    const deals: Deal[] = [];
    for (let i = 0; i < count; i++) {
      deals.push(
        await this.create({
          organizationId,
          title: `Test Deal ${i} ${Date.now()}`,
        }),
      );
    }
    return deals;
  }
}
