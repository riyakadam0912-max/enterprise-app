import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { Role } from '../common/enums/role.enum';



@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveEmployeeScope(user?: { userId: number; role: Role; employeeId?: number | null }) {
    if (!user || user.role === Role.ADMIN) {
      return null;
    }

    const employeeId = user.employeeId ?? null;
    if (employeeId) {
      return this.prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, name: true } });
    }

    const linked = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { employeeId: true, employee: { select: { id: true, name: true } } },
    } as any) as any;
    if (!linked?.employeeId || !linked.employee) {
      throw new ForbiddenException('Employee account is not linked to a user');
    }
    return linked.employee;
  }

  async create(dto: CreateLeadDto) {
    return this.prisma.lead.create({
      data: {
        name:          dto.name,
        company:       dto.company,
        email:         dto.email,
        phone:         dto.phone,
        status:        dto.status ?? 'New',
        source:        dto.source,
        notes:         dto.notes,
        leadOwner:     dto.leadOwner,
        contactedDate: dto.contactedDate ? new Date(dto.contactedDate) : undefined,
        nextFollowUp:  dto.nextFollowUp  ? new Date(dto.nextFollowUp)  : undefined,
        assignedTo:    dto.assignedTo,
        assignedToId:  dto.assignedEmployeeId,
        leadScore:     dto.leadScore,
        createdBy:     dto.createdBy,
      },
    } as any);
  }

  async findAll(user?: { userId: number; role: Role; employeeId?: number | null }) {
    const employee = await this.resolveEmployeeScope(user);

    const where = employee
      ? {
          OR: [
            { assignedToId: employee.id },
            { assignedTo: employee.name },
          ],
        }
      : undefined;

    return this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    } as any);
  }

  async findOne(id: number, user?: { userId: number; role: Role; employeeId?: number | null }) {
    const employee = await this.resolveEmployeeScope(user);

    const lead = await this.prisma.lead.findUnique({
      where: { id },
    } as any) as any;

    if (!lead) throw new NotFoundException(`Lead #${id} not found`);
    if (employee && lead.assignedToId !== employee.id && lead.assignedTo !== employee.name) {
      throw new ForbiddenException('You can only access assigned leads');
    }
    return lead;
  }

  async findByStatus(): Promise<Record<string, any[]>> {
    const leads = await this.prisma.lead.findMany({ orderBy: { name: 'asc' } });
    const grouped: Record<string, any[]> = {};
    for (const lead of leads) {
      const key = lead.status ?? 'Unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(lead);
    }
    return grouped;
  }

  async update(id: number, dto: UpdateLeadDto) {
    await this.findOne(id);

    const data: Record<string, any> = {};
    if (dto.name          !== undefined) data.name          = dto.name;
    if (dto.company       !== undefined) data.company       = dto.company;
    if (dto.email         !== undefined) data.email         = dto.email;
    if (dto.phone         !== undefined) data.phone         = dto.phone;
    if (dto.status        !== undefined) data.status        = dto.status;
    if (dto.source        !== undefined) data.source        = dto.source;
    if (dto.notes         !== undefined) data.notes         = dto.notes;
    if (dto.leadOwner     !== undefined) data.leadOwner     = dto.leadOwner;
    if (dto.assignedTo    !== undefined) data.assignedTo    = dto.assignedTo;
    if (dto.assignedEmployeeId !== undefined) data.assignedToId = dto.assignedEmployeeId;
    if (dto.leadScore     !== undefined) data.leadScore     = dto.leadScore;
    if (dto.createdBy     !== undefined) data.createdBy     = dto.createdBy;
    if (dto.contactedDate !== undefined) data.contactedDate = dto.contactedDate ? new Date(dto.contactedDate) : null;
    if (dto.nextFollowUp  !== undefined) data.nextFollowUp  = dto.nextFollowUp  ? new Date(dto.nextFollowUp)  : null;

    return this.prisma.lead.update({ where: { id }, data } as any);
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async convertLead(id: number, userId: number) {
    const lead = await this.findOne(id);

    const result = await this.prisma.$transaction(async (tx) => {
      const prismaTx = tx as any;
      const contact = await tx.contact.create({
        data: {
          contactName: lead.name,
          email: lead.email,
          phoneNumber: lead.phone,
          company: lead.company,
          leadSource: lead.source,
          contactStatus: 'Active',
        },
      });

      const deal = await prismaTx.deal.create({
        data: {
          title: `${lead.name} Opportunity`,
          value: 0,
          stage: 'NEW',
          leadId: lead.id,
          contactId: contact.id,
          contact: contact.contactName,
          owner: lead.assignedTo,
          pipeline: 'Sales',
        },
      } as any);

      await tx.lead.update({
        where: { id: lead.id },
        data: { status: 'CONVERTED' },
      });

      await prismaTx.activity.createMany({
        data: [
          {
            type: 'DEAL_CREATED',
            description: `Deal created from lead ${lead.name}`,
            userId,
            leadId: lead.id,
            dealId: deal.id,
            contactId: contact.id,
          },
          {
            type: 'LEAD_CONVERTED',
            description: `Lead ${lead.name} converted to deal`,
            userId,
            leadId: lead.id,
            dealId: deal.id,
            contactId: contact.id,
          },
        ],
      });

      return { dealId: deal.id, contactId: contact.id };
    });

    return {
      message: 'Lead converted successfully',
      ...result,
    };
  }

  async importRecords(records: Record<string, any>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.name) { errors.push(`Row ${i + 1}: 'name' is required`); continue; }
      try {
        await this.prisma.lead.create({
          data: {
            name:          String(r.name),
            company:       r.company       ? String(r.company)       : undefined,
            email:         r.email         ? String(r.email)         : undefined,
            phone:         r.phone         ? String(r.phone)         : undefined,
            status:        r.status        ? String(r.status)        : 'New',
            source:        r.source        ? String(r.source)        : undefined,
            notes:         r.notes         ? String(r.notes)         : undefined,
            leadOwner:     r.leadOwner     ? String(r.leadOwner)     : undefined,
            contactedDate: r.contactedDate ? new Date(String(r.contactedDate)) : undefined,
            nextFollowUp:  r.nextFollowUp  ? new Date(String(r.nextFollowUp))  : undefined,
            assignedTo:    r.assignedTo    ? String(r.assignedTo)    : undefined,
            assignedToId:  r.assignedToId  ? Number(r.assignedToId)  : undefined,
            leadScore:     r.leadScore     ? Number(r.leadScore)     : undefined,
            createdBy:     r.createdBy     ? String(r.createdBy)     : undefined,
          },
        } as any);
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message ?? 'Unknown error'}`);
      }
    }
    return { imported, errors };
  }
}

