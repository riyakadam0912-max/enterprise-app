import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignLeadDto } from './dto/create-campaign-lead.dto';
import { UpdateCampaignLeadDto } from './dto/update-campaign-lead.dto';
import { AuthUser } from '../common/types/auth';

const includeLead: Prisma.CampaignLeadInclude = {
  lead: { select: { id: true, name: true } },
};

@Injectable()
export class CampaignLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async create(dto: CreateCampaignLeadDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.campaignLead.create({
      data: {
        organization: { connect: { id: organizationId } },
        campaign: dto.campaign,
        lead: dto.leadId ? { connect: { id: dto.leadId } } : undefined,
        engagementScore: dto.engagementScore,
        sourceType: dto.sourceType,
        lastInteraction: dto.lastInteraction
          ? new Date(dto.lastInteraction)
          : undefined,
        status: dto.status ?? 'NEW',
        notes: dto.notes,
      },
      include: includeLead,
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.campaignLead.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: includeLead,
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const record = await this.prisma.campaignLead.findUnique({
      where: { id, organizationId },
      include: includeLead,
    });
    if (!record) throw new NotFoundException(`CampaignLead #${id} not found`);
    return record;
  }

  async update(id: number, dto: UpdateCampaignLeadDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.campaignLead.update({
      where: { id, organizationId },
      data: {
        ...(dto.campaign !== undefined && { campaign: dto.campaign }),
        ...(dto.leadId !== undefined && {
          lead: dto.leadId
            ? { connect: { id: dto.leadId } }
            : { disconnect: true },
        }),
        ...(dto.engagementScore !== undefined && {
          engagementScore: dto.engagementScore,
        }),
        ...(dto.sourceType !== undefined && { sourceType: dto.sourceType }),
        ...(dto.lastInteraction !== undefined && {
          lastInteraction: new Date(dto.lastInteraction),
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: includeLead,
    });
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.campaignLead.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async importRecords(
    records: Array<Record<string, unknown>>,
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    const organizationId = this.validateOrganization(user);
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (typeof r.campaign !== 'string' || !r.campaign) {
        errors.push(`Row ${i + 1}: 'campaign' is required`);
        continue;
      }
      try {
        const data: Prisma.CampaignLeadCreateInput = {
          organization: { connect: { id: organizationId } },
          campaign: String(r.campaign),
          engagementScore:
            typeof r.engagementScore === 'number'
              ? r.engagementScore
              : typeof r.engagementScore === 'string'
                ? Number(r.engagementScore)
                : undefined,
          sourceType:
            typeof r.sourceType === 'string' ? r.sourceType : undefined,
          lastInteraction:
            typeof r.lastInteraction === 'string' ||
            r.lastInteraction instanceof Date
              ? new Date(String(r.lastInteraction))
              : undefined,
          status: typeof r.status === 'string' ? r.status : 'NEW',
          notes: typeof r.notes === 'string' ? r.notes : undefined,
          lead:
            typeof r.leadId === 'number' || typeof r.leadId === 'string'
              ? { connect: { id: Number(r.leadId) } }
              : undefined,
        };

        await this.prisma.campaignLead.create({ data });
        imported++;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Row ${i + 1}: ${message}`);
      }
    }
    return { imported, errors };
  }
}
