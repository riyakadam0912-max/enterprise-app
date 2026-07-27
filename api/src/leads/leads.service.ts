import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { Role } from '../common/enums/role.enum';
import type { LeadDetailDto } from './dto/lead-detail.dto';
import type { AuthUser } from '../common/types/auth';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  private async resolveEmployeeScope(
    user?: AuthUser,
  ): Promise<Prisma.EmployeeGetPayload<{
    select: { id: true; name: true };
  }> | null> {
    if (!user || user.role === Role.ADMIN) {
      return null;
    }

    const employeeId = user.employeeId ?? null;
    if (employeeId) {
      return this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true },
      });
    }

    const linked = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        employeeId: true,
        employee: { select: { id: true, name: true } },
      },
    });
    if (!linked?.employeeId || !linked.employee) {
      throw new ForbiddenException('Employee account is not linked to a user');
    }
    return linked.employee;
  }

  async create(dto: CreateLeadDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.lead.create({
      data: {
        organization: { connect: { id: organizationId } },
        name: dto.name,
        company: dto.company,
        email: dto.email,
        phone: dto.phone,
        status: dto.status ?? 'New',
        source: dto.source,
        notes: dto.notes,
        leadOwner: dto.leadOwner,
        contactedDate: dto.contactedDate
          ? new Date(dto.contactedDate)
          : undefined,
        nextFollowUp: dto.nextFollowUp ? new Date(dto.nextFollowUp) : undefined,
        assignedTo: dto.assignedTo,
        assignedEmployee: dto.assignedEmployeeId
          ? { connect: { id: dto.assignedEmployeeId } }
          : undefined,
        leadScore: dto.leadScore,
        createdBy: dto.createdBy,
      },
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const employee = await this.resolveEmployeeScope(user);

    const where: Prisma.LeadWhereInput = {
      organizationId,
      deletedAt: null,
      ...(employee
        ? {
            OR: [{ assignedToId: employee.id }, { assignedTo: employee.name }],
          }
        : {}),
    };

    return this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const employee = await this.resolveEmployeeScope(user);

    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!lead) throw new NotFoundException(`Lead #${id} not found`);
    if (
      employee &&
      lead.assignedToId !== employee.id &&
      lead.assignedTo !== employee.name
    ) {
      throw new ForbiddenException('You can only access assigned leads');
    }
    return lead;
  }

  async getDetail(id: number, user: AuthUser): Promise<LeadDetailDto> {
    const organizationId = this.validateOrganization(user);
    const lead = await this.findOne(id, user);
    const employee = await this.resolveEmployeeScope(user);
    const assignedToUserId = user?.userId;

    const taskWhere: Prisma.TaskWhereInput = {
      leadId: id,
      organizationId,
    };

    if (user?.role === Role.MANAGER) {
      taskWhere.projectRef = {
        managerId: user.userId,
      } as Prisma.ProjectWhereInput;
    } else if (employee) {
      if (assignedToUserId !== undefined)
        taskWhere.assignedToUserId = assignedToUserId;
    }

    const [activities, tasks] = await Promise.all([
      this.prisma.activity.findMany({
        where: { leadId: id, organizationId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.task.findMany({
        where: taskWhere,
        orderBy: { dueDate: 'asc' },
        include: {
          projectRef: {
            select: { id: true, projectName: true, managerId: true },
          },
          assignedToUser: { select: { id: true, name: true, email: true } },
          assignedByUser: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return { lead, activities, tasks };
  }

  async findByStatus(user: AuthUser): Promise<Record<string, any[]>> {
    const organizationId = this.validateOrganization(user);
    const leads = await this.prisma.lead.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    const grouped: Record<string, any[]> = {};
    for (const lead of leads) {
      const key = lead.status ?? 'Unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(lead);
    }
    return grouped;
  }

  async update(id: number, dto: UpdateLeadDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);

    const data: Prisma.LeadUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.company !== undefined) data.company = dto.company;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.source !== undefined) data.source = dto.source;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.leadOwner !== undefined) data.leadOwner = dto.leadOwner;
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;
    if (dto.assignedEmployeeId !== undefined) {
      data.assignedEmployee =
        dto.assignedEmployeeId === null
          ? { disconnect: true }
          : { connect: { id: dto.assignedEmployeeId } };
    }
    if (dto.leadScore !== undefined) data.leadScore = dto.leadScore;
    if (dto.createdBy !== undefined) data.createdBy = dto.createdBy;
    if (dto.contactedDate !== undefined)
      data.contactedDate = dto.contactedDate
        ? new Date(dto.contactedDate)
        : null;
    if (dto.nextFollowUp !== undefined)
      data.nextFollowUp = dto.nextFollowUp ? new Date(dto.nextFollowUp) : null;

    return this.prisma.lead.update({
      where: { id, organizationId },
      data,
    });
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.lead.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async convertLead(id: number, userId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const lead = await this.findOne(id, user);

    const result = await this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          organization: { connect: { id: organizationId } },
          contactName: lead.name,
          email: lead.email,
          phoneNumber: lead.phone,
          company: lead.company,
          leadSource: lead.source,
          contactStatus: 'Active',
        },
      });

      const deal = await tx.deal.create({
        data: {
          organization: { connect: { id: organizationId } },
          title: `${lead.name} Opportunity`,
          value: 0,
          stage: 'NEW',
          lead: { connect: { id: lead.id } },
          linkedContact: { connect: { id: contact.id } },
          contact: contact.contactName,
          owner: lead.assignedTo,
          pipeline: 'Sales',
        },
      });

      await tx.lead.update({
        where: { id: lead.id, organizationId },
        data: { status: 'CONVERTED' },
      });

      // Create activities using separate creates since createMany doesn't support nested connects
      await tx.activity.create({
        data: {
          organization: { connect: { id: organizationId } },
          type: 'DEAL_CREATED',
          description: `Deal created from lead ${lead.name}`,
          user: { connect: { id: userId } },
          lead: { connect: { id: lead.id } },
          deal: { connect: { id: deal.id } },
          contact: { connect: { id: contact.id } },
        },
      });
      await tx.activity.create({
        data: {
          organization: { connect: { id: organizationId } },
          type: 'LEAD_CONVERTED',
          description: `Lead ${lead.name} converted to deal`,
          user: { connect: { id: userId } },
          lead: { connect: { id: lead.id } },
          deal: { connect: { id: deal.id } },
          contact: { connect: { id: contact.id } },
        },
      });

      return { dealId: deal.id, contactId: contact.id };
    });

    return {
      message: 'Lead converted successfully',
      ...result,
    };
  }

  async importRecords(
    records: Record<string, any>[],
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    const organizationId = this.validateOrganization(user);
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.name) {
        errors.push(`Row ${i + 1}: 'name' is required`);
        continue;
      }
      try {
        await this.prisma.lead.create({
          data: {
            organization: { connect: { id: organizationId } },
            name: String(r.name),
            company: r.company ? String(r.company) : undefined,
            email: r.email ? String(r.email) : undefined,
            phone: r.phone ? String(r.phone) : undefined,
            status: r.status ? String(r.status) : 'New',
            source: r.source ? String(r.source) : undefined,
            notes: r.notes ? String(r.notes) : undefined,
            leadOwner: r.leadOwner ? String(r.leadOwner) : undefined,
            contactedDate: r.contactedDate
              ? new Date(String(r.contactedDate))
              : undefined,
            nextFollowUp: r.nextFollowUp
              ? new Date(String(r.nextFollowUp))
              : undefined,
            assignedTo: r.assignedTo ? String(r.assignedTo) : undefined,
            assignedEmployee: r.assignedToId
              ? { connect: { id: Number(r.assignedToId) } }
              : undefined,
            leadScore: r.leadScore ? Number(r.leadScore) : undefined,
            createdBy: r.createdBy ? String(r.createdBy) : undefined,
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
}
