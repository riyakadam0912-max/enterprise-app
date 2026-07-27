import { Lead, Prisma } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';
import { OrganizationFactory } from './organization.factory';

export class LeadFactory {
  static async create(
    overrides: Partial<Prisma.LeadUncheckedCreateInput> = {},
  ): Promise<Lead> {
    const prisma = DatabaseHelper.getPrismaClient();
    let organizationId = overrides.organizationId;
    if (!organizationId) {
      const org = await OrganizationFactory.create();
      organizationId = org.id;
    }

    return prisma.lead.create({
      data: {
        name: `Test Lead ${Date.now()}`,
        organizationId,
        status: 'New',
        ...overrides,
      },
    });
  }

  static async createMany(
    count: number,
    organizationId: number,
  ): Promise<Lead[]> {
    const leads: Lead[] = [];
    for (let i = 0; i < count; i++) {
      leads.push(
        await this.create({
          organizationId,
          name: `Test Lead ${i} ${Date.now()}`,
        }),
      );
    }
    return leads;
  }
}
