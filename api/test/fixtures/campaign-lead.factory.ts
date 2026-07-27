import { CampaignLead, Prisma } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';
import { OrganizationFactory } from './organization.factory';

export class CampaignLeadFactory {
  static async create(
    overrides: Partial<Prisma.CampaignLeadUncheckedCreateInput> = {},
  ): Promise<CampaignLead> {
    const prisma = DatabaseHelper.getPrismaClient();
    let organizationId = overrides.organizationId;
    if (!organizationId) {
      const org = await OrganizationFactory.create();
      organizationId = org.id;
    }

    return prisma.campaignLead.create({
      data: {
        campaign: `Test Campaign ${Date.now()}`,
        organizationId,
        ...overrides,
      },
    });
  }

  static async createMany(
    count: number,
    organizationId: number,
  ): Promise<CampaignLead[]> {
    const campaignLeads: CampaignLead[] = [];
    for (let i = 0; i < count; i++) {
      campaignLeads.push(
        await this.create({
          organizationId,
          campaign: `Test Campaign ${i} ${Date.now()}`,
        }),
      );
    }
    return campaignLeads;
  }
}
