import {
  ConflictException,
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

  private async resolveOwnerUserId(
    employeeId: number | null | undefined,
    organizationId: number,
  ): Promise<number | null> {
    if (!employeeId) return null;
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      select: { user: { select: { id: true } } },
    });
    return employee?.user?.id ?? null;
  }

  private isPlatformAdmin(user: AuthUser): boolean {
    return (
      user?.role === Role.SUPER_ADMIN ||
      user?.isSuperAdmin === true ||
      user?.isPlatformAdmin === true ||
      (Array.isArray(user?.roles) && user.roles.includes(Role.SUPER_ADMIN))
    );
  }

  private resolveReadScope(user: AuthUser): number | null {
    if (this.isPlatformAdmin(user) && !user.organizationId) {
      return null;
    }
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  private requireWriteOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      if (this.isPlatformAdmin(user)) {
        throw new ForbiddenException(
          'Select an organization before modifying data',
        );
      }
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  private async resolveEmployeeScope(
    user?: AuthUser,
  ): Promise<Prisma.EmployeeGetPayload<{
    select: { id: true; name: true };
  }> | null> {
    if (!user || user.role !== Role.EMPLOYEE || this.isPlatformAdmin(user)) {
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
    const organizationId = this.requireWriteOrganization(user);
    const ownerUserId = await this.resolveOwnerUserId(
      dto.assignedEmployeeId,
      organizationId,
    );
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
        ownerUser: ownerUserId ? { connect: { id: ownerUserId } } : undefined,
        leadScore: dto.leadScore,
        createdBy: dto.createdBy,
      },
    });
  }

  async findAll(user: AuthUser, scope?: string) {
    const orgScope = this.resolveReadScope(user);
    const employee = await this.resolveEmployeeScope(user);
    const normalizedScope = scope?.trim().toLowerCase();

    const where: Prisma.LeadWhereInput = {
      ...(orgScope !== null ? { organizationId: orgScope } : {}),
      deletedAt: null,
    };

    if (normalizedScope === 'unassigned') {
      where.ownerUserId = null;
      where.assignedToId = null;
      where.assignedTo = null;
      where.leadOwner = null;
    } else if (normalizedScope === 'mine') {
      where.OR = [
        { ownerUserId: user.userId },
        ...(employee
          ? [{ assignedToId: employee.id }, { assignedTo: employee.name }]
          : []),
      ];
    } else if (normalizedScope === 'my_team') {
      const team = await this.prisma.user.findMany({
        where: {
          ...(orgScope !== null ? { organizationId: orgScope } : {}),
          OR: [{ id: user.userId }, { managerId: user.userId }],
        },
        select: { id: true },
      });
      where.ownerUserId = { in: team.map((member) => member.id) };
    } else if (employee) {
      where.OR = [{ assignedToId: employee.id }, { assignedTo: employee.name }];
    }

    return this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const orgScope = this.resolveReadScope(user);
    const employee = await this.resolveEmployeeScope(user);

    const lead = await this.prisma.lead.findFirst({
      where: {
        id,
        ...(orgScope !== null ? { organizationId: orgScope } : {}),
        deletedAt: null,
      },
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
    const orgScope = this.resolveReadScope(user);
    const lead = await this.findOne(id, user);
    const employee = await this.resolveEmployeeScope(user);
    const assignedToUserId = user?.userId;

    const taskWhere: Prisma.TaskWhereInput = {
      leadId: id,
      ...(orgScope !== null ? { organizationId: orgScope } : {}),
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
        where: {
          leadId: id,
          ...(orgScope !== null ? { organizationId: orgScope } : {}),
        },
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
    const orgScope = this.resolveReadScope(user);
    const leads = await this.prisma.lead.findMany({
      where: {
        ...(orgScope !== null ? { organizationId: orgScope } : {}),
        deletedAt: null,
      },
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
    const organizationId = this.requireWriteOrganization(user);
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
      const ownerUserId = await this.resolveOwnerUserId(
        dto.assignedEmployeeId,
        organizationId,
      );
      data.ownerUser = ownerUserId
        ? { connect: { id: ownerUserId } }
        : { disconnect: true };
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
    const organizationId = this.requireWriteOrganization(user);
    await this.findOne(id, user);
    return this.prisma.lead.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async reassignOwner(id: number, ownerUserId: number | null, user: AuthUser) {
    const organizationId = this.requireWriteOrganization(user);
    await this.findOne(id, user);
    const owner = ownerUserId
      ? await this.prisma.user.findFirst({
          where: { id: ownerUserId, organizationId, deletedAt: null },
          select: { id: true, employee: { select: { id: true, name: true } } },
        })
      : null;
    if (ownerUserId && !owner) {
      throw new NotFoundException('Owner not found in this organization');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id, organizationId },
        data: {
          ownerUser: owner ? { connect: { id: owner.id } } : { disconnect: true },
          assignedEmployee: owner?.employee
            ? { connect: { id: owner.employee.id } }
            : { disconnect: true },
          assignedTo: owner?.employee?.name ?? null,
          leadOwner: owner?.employee?.name ?? null,
        },
      });
      await tx.activity.create({
        data: {
          organization: { connect: { id: organizationId } },
          type: 'LEAD_OWNER_REASSIGNED',
          description: owner
            ? `Lead ${updated.name} assigned to ${owner.employee?.name ?? owner.id}`
            : `Lead ${updated.name} unassigned`,
          user: { connect: { id: user.userId } },
          lead: { connect: { id } },
        },
      });
      return updated;
    });
  }

  async convertLead(id: number, userId: number, user: AuthUser) {
    const organizationId = this.requireWriteOrganization(user);
    const lead = await this.findOne(id, user);

    const result = await this.prisma.$transaction(async (tx) => {
      // Claim the conversion inside the transaction. This keeps the existing
      // endpoint idempotent and prevents concurrent requests from creating
      // duplicate contacts and deals for the same lead.
      const conversionClaim = await tx.lead.updateMany({
        where: {
          id: lead.id,
          organizationId,
          deletedAt: null,
          NOT: {
            status: { equals: 'CONVERTED', mode: 'insensitive' },
          },
        },
        data: { status: 'CONVERTED' },
      });

      if (conversionClaim.count === 0) {
        const existingDeal = await tx.deal.findFirst({
          where: {
            organizationId,
            leadId: lead.id,
            contactId: { not: null },
            deletedAt: null,
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true, contactId: true },
        });

        if (existingDeal?.contactId) {
          return {
            dealId: existingDeal.id,
            contactId: existingDeal.contactId,
          };
        }

        throw new ConflictException(
          `Lead #${lead.id} is marked as converted but has no converted deal`,
        );
      }

      const customerMatches: Prisma.CustomerWhereInput[] = [];
      const company = lead.company?.trim();
      const email = lead.email?.trim();
      if (company) {
        customerMatches.push({
          customerName: { equals: company, mode: 'insensitive' },
        });
      }
      if (email) {
        customerMatches.push({
          email: { equals: email, mode: 'insensitive' },
        });
      }
      const matchingCustomers = customerMatches.length
        ? await tx.customer.findMany({
            where: {
              organizationId,
              deletedAt: null,
              OR: customerMatches,
            },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
            take: 2,
          })
        : [];
      const existingCustomer = matchingCustomers.length === 1
        ? matchingCustomers[0]
        : null;

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
          ownerUser: lead.ownerUserId
            ? { connect: { id: lead.ownerUserId } }
            : undefined,
          assignedEmployee: lead.assignedToId
            ? { connect: { id: lead.assignedToId } }
            : undefined,
          pipeline: 'Sales',
        },
      });

      await tx.lead.update({
        where: { id: lead.id, organizationId },
        data: {
          convertedAt: new Date(),
          convertedBy: { connect: { id: userId } },
          convertedContact: { connect: { id: contact.id } },
          convertedDeal: { connect: { id: deal.id } },
          ...(existingCustomer
            ? { convertedCustomer: { connect: { id: existingCustomer.id } } }
            : {}),
        },
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
    const organizationId = this.requireWriteOrganization(user);
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.name) {
        errors.push(`Row ${i + 1}: 'name' is required`);
        continue;
      }
      try {
        const assignedEmployeeId = r.assignedToId
          ? Number(r.assignedToId)
          : null;
        const ownerUserId = await this.resolveOwnerUserId(
          assignedEmployeeId,
          organizationId,
        );
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
            assignedEmployee: assignedEmployeeId
              ? { connect: { id: assignedEmployeeId } }
              : undefined,
            ownerUser: ownerUserId
              ? { connect: { id: ownerUserId } }
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
