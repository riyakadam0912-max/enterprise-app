import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMarketingCampaignDto } from './dto/create-marketing-campaign.dto';
import { UpdateMarketingCampaignDto } from './dto/update-marketing-campaign.dto';

const CHANNELS = ['Email', 'Social Media', 'Website', 'Event', 'Direct Mail'] as const;

@Injectable()
export class MarketingCampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMarketingCampaignDto) {
    return this.prisma.marketingCampaign.create({
      data: {
        campaignName:   dto.campaignName,
        channel:        dto.channel,
        startDate:      dto.startDate   ? new Date(dto.startDate)  : undefined,
        endDate:        dto.endDate     ? new Date(dto.endDate)    : undefined,
        objective:      dto.objective,
        budget:         dto.budget,
        status:         dto.status ?? 'PLANNED',
        targetAudience: dto.targetAudience,
        createdBy:      dto.createdBy,
        campaignOwner:  dto.campaignOwner,
      },
    });
  }

  async findAll() {
    return this.prisma.marketingCampaign.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const campaign = await this.prisma.marketingCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException(`MarketingCampaign #${id} not found`);
    return campaign;
  }

  async update(id: number, dto: UpdateMarketingCampaignDto) {
    await this.findOne(id);
    return this.prisma.marketingCampaign.update({
      where: { id },
      data: {
        ...(dto.campaignName   !== undefined && { campaignName:   dto.campaignName }),
        ...(dto.channel        !== undefined && { channel:        dto.channel }),
        ...(dto.objective      !== undefined && { objective:      dto.objective }),
        ...(dto.budget         !== undefined && { budget:         dto.budget }),
        ...(dto.status         !== undefined && { status:         dto.status }),
        ...(dto.targetAudience !== undefined && { targetAudience: dto.targetAudience }),
        ...(dto.createdBy      !== undefined && { createdBy:      dto.createdBy }),
        ...(dto.campaignOwner  !== undefined && { campaignOwner:  dto.campaignOwner }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.marketingCampaign.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async importRecords(records: Record<string, any>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.campaignName) { errors.push(`Row ${i + 1}: 'campaignName' is required`); continue; }
      try {
        await this.prisma.marketingCampaign.create({
          data: {
            campaignName:   String(r.campaignName),
            channel:        r.channel        ? String(r.channel)        : undefined,
            startDate:      r.startDate      ? new Date(String(r.startDate))   : undefined,
            endDate:        r.endDate        ? new Date(String(r.endDate))     : undefined,
            objective:      r.objective      ? String(r.objective)      : undefined,
            budget:         r.budget         ? Number(r.budget)         : undefined,
            status:         r.status         ? String(r.status)         : 'PLANNED',
            targetAudience: r.targetAudience ? String(r.targetAudience) : undefined,
            createdBy:      r.createdBy      ? String(r.createdBy)      : undefined,
            campaignOwner:  r.campaignOwner  ? String(r.campaignOwner)  : undefined,
          },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message ?? 'Unknown error'}`);
      }
    }
    return { imported, errors };
  }

  async getByChannel() {
    const campaigns = await this.prisma.marketingCampaign.findMany({
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
