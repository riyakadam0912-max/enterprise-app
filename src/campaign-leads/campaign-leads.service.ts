import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignLeadDto } from './dto/create-campaign-lead.dto';
import { UpdateCampaignLeadDto } from './dto/update-campaign-lead.dto';

const includeLead = {
  lead: { select: { id: true, name: true } },
} as const;

@Injectable()
export class CampaignLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCampaignLeadDto) {
    return this.prisma.campaignLead.create({
      data: {
        campaign: dto.campaign,
        leadId: dto.leadId,
        engagementScore: dto.engagementScore,
        sourceType: dto.sourceType,
        lastInteraction: dto.lastInteraction ? new Date(dto.lastInteraction) : undefined,
        status: dto.status ?? 'NEW',
        notes: dto.notes,
      },
      include: includeLead,
    });
  }

  async findAll() {
    return this.prisma.campaignLead.findMany({
      orderBy: { createdAt: 'desc' },
      include: includeLead,
    });
  }

  async findOne(id: number) {
    const record = await this.prisma.campaignLead.findUnique({
      where: { id },
      include: includeLead,
    });
    if (!record) throw new NotFoundException(`CampaignLead #${id} not found`);
    return record;
  }

  async update(id: number, dto: UpdateCampaignLeadDto) {
    await this.findOne(id);
    return this.prisma.campaignLead.update({
      where: { id },
      data: {
        ...(dto.campaign !== undefined && { campaign: dto.campaign }),
        ...(dto.leadId !== undefined && { leadId: dto.leadId }),
        ...(dto.engagementScore !== undefined && { engagementScore: dto.engagementScore }),
        ...(dto.sourceType !== undefined && { sourceType: dto.sourceType }),
        ...(dto.lastInteraction !== undefined && { lastInteraction: new Date(dto.lastInteraction) }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: includeLead,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.campaignLead.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async importRecords(records: Record<string, any>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.campaign) { errors.push(`Row ${i + 1}: 'campaign' is required`); continue; }
      try {
        await this.prisma.campaignLead.create({
          data: {
            campaign:        String(r.campaign),
            engagementScore: r.engagementScore ? Number(r.engagementScore) : undefined,
            sourceType:      r.sourceType      ? String(r.sourceType)      : undefined,
            lastInteraction: r.lastInteraction  ? new Date(String(r.lastInteraction))  : undefined,
            status:          r.status           ? String(r.status)           : 'NEW',
            notes:           r.notes            ? String(r.notes)            : undefined,
            leadId:          r.leadId           ? Number(r.leadId)           : undefined,
          },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message ?? 'Unknown error'}`);
      }
    }
    return { imported, errors };
  }
}
