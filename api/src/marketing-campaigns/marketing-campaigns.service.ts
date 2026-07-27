import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMarketingCampaignDto } from './dto/create-marketing-campaign.dto';
import { UpdateMarketingCampaignDto } from './dto/update-marketing-campaign.dto';
import type { AuthUser } from '../common/types/auth';

const CHANNELS = [
  'Email',
  'Social Media',
  'Website',
  'Event',
  'Direct Mail',
] as const;

@Injectable()
export class MarketingCampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async create(dto: CreateMarketingCampaignDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.marketingCampaign.create({
      data: {
        organizationId,
        campaignName: dto.campaignName,
        channel: dto.channel,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        objective: dto.objective,
        budget: dto.budget,
        status: dto.status ?? 'PLANNED',
        targetAudience: dto.targetAudience,
        createdBy: dto.createdBy,
        campaignOwner: dto.campaignOwner,
      },
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.marketingCampaign.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id, organizationId },
    });
    if (!campaign)
      throw new NotFoundException(`MarketingCampaign #${id} not found`);
    return campaign;
  }

  async update(id: number, dto: UpdateMarketingCampaignDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.marketingCampaign.update({
      where: { id, organizationId },
      data: {
        ...(dto.campaignName !== undefined && {
          campaignName: dto.campaignName,
        }),
        ...(dto.channel !== undefined && { channel: dto.channel }),
        ...(dto.objective !== undefined && { objective: dto.objective }),
        ...(dto.budget !== undefined && { budget: dto.budget }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.targetAudience !== undefined && {
          targetAudience: dto.targetAudience,
        }),
        ...(dto.createdBy !== undefined && { createdBy: dto.createdBy }),
        ...(dto.campaignOwner !== undefined && {
          campaignOwner: dto.campaignOwner,
        }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
      },
    });
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.marketingCampaign.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }
  async importRecords(
    records: Record<string, unknown>[],
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    const organizationId = this.validateOrganization(user);
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const campaignName = r['campaignName'];
      if (!campaignName) {
        errors.push(`Row ${i + 1}: 'campaignName' is required`);
        continue;
      }
      try {
        const toOptionalString = (v: unknown) => {
          if (v == null) return undefined;
          if (
            typeof v === 'string' ||
            typeof v === 'number' ||
            typeof v === 'boolean'
          ) {
            return String(v);
          }
          try {
            return JSON.stringify(v);
          } catch {
            return undefined;
          }
        };
        const campaignNameStr =
          typeof campaignName === 'string' ||
          typeof campaignName === 'number' ||
          typeof campaignName === 'boolean'
            ? String(campaignName)
            : JSON.stringify(campaignName);
        await this.prisma.marketingCampaign.create({
          data: {
            organizationId,
            campaignName: campaignNameStr,
            channel: toOptionalString(r['channel']),
            startDate: toOptionalString(r['startDate'])
              ? new Date(toOptionalString(r['startDate']) as string)
              : undefined,
            endDate: toOptionalString(r['endDate'])
              ? new Date(toOptionalString(r['endDate']) as string)
              : undefined,
            objective: toOptionalString(r['objective']),
            budget:
              r['budget'] != null ? Number(r['budget'] as unknown) : undefined,
            status: toOptionalString(r['status']) ?? 'PLANNED',
            targetAudience: toOptionalString(r['targetAudience']),
            createdBy: toOptionalString(r['createdBy']),
            campaignOwner: toOptionalString(r['campaignOwner']),
          },
        });
        imported++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Row ${i + 1}: ${msg ?? 'Unknown error'}`);
      }
    }
    return { imported, errors };
  }

  async getByChannel(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const campaigns = await this.prisma.marketingCampaign.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    const grouped: Record<string, typeof campaigns> = {};
    for (const ch of CHANNELS) grouped[ch] = [];
    for (const c of campaigns) {
      const key = c.channel ?? 'Other';
      if (grouped[key]) grouped[key].push(c);
      else grouped[key] = [c];
    }
    return grouped;
  }
}
