import {
  Inject,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/types/auth';
import { NotificationsService } from '../notifications/notifications.service';
import { DealStatusUpdatedEvent } from './events/deal-status-updated.event';
import { DASHBOARD_CACHE_KEY } from '../common/utils/cache-keys';

const STAGES = ['NEW', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const;

const includeRelations: Prisma.DealInclude = {
  lead: { select: { id: true, name: true, company: true } },
  linkedContact: { select: { id: true, contactName: true, company: true } },
};

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private async invalidateDashboardCache() {
    await this.cacheManager.del(DASHBOARD_CACHE_KEY);
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

  private async resolveEmployeeScope(user?: AuthUser) {
    if (!user || this.isPlatformAdmin(user)) {
      return null;
    }

    const employeeId = user.employeeId ?? null;
    if (employeeId) {
      return this.prisma.employee.findFirst({
        where: { id: employeeId, deletedAt: null },
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

  async create(dto: CreateDealDto, user: AuthUser) {
    const organizationId = this.requireWriteOrganization(user);
    const data: Prisma.DealCreateInput = {
      organization: { connect: { id: organizationId } },
      title: dto.title,
      value: dto.value,
      stage: dto.stage ?? 'NEW',
      probability: dto.probability,
      closeDate: dto.closeDate ? new Date(dto.closeDate) : undefined,
      actualCloseDate: dto.actualCloseDate
        ? new Date(dto.actualCloseDate)
        : undefined,
      contact: dto.contact,
      owner: dto.owner,
      assignedEmployee: dto.employeeId
        ? { connect: { id: dto.employeeId } }
        : undefined,
      pipeline: dto.pipeline,
      lead: dto.leadId ? { connect: { id: dto.leadId } } : undefined,
      linkedContact: dto.contactId
        ? { connect: { id: dto.contactId } }
        : undefined,
    };

    const result = await this.prisma.deal.create({
      data,
      include: includeRelations,
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async findAll(user: AuthUser) {
    const orgScope = this.resolveReadScope(user);
    const employee = await this.resolveEmployeeScope(user);
    return this.prisma.deal.findMany({
      where: {
        ...(orgScope !== null ? { organizationId: orgScope } : {}),
        deletedAt: null,
        ...(employee
          ? {
              OR: [{ assignedToId: employee.id }, { owner: employee.name }],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: includeRelations,
    });
  }

  async findOne(id: number, user: AuthUser) {
    const orgScope = this.resolveReadScope(user);
    const employee = await this.resolveEmployeeScope(user);

    const deal = await this.prisma.deal.findFirst({
      where: {
        id,
        ...(orgScope !== null ? { organizationId: orgScope } : {}),
        deletedAt: null,
      },
      include: includeRelations,
    });
    if (!deal) throw new NotFoundException(`Deal #${id} not found`);
    if (
      employee &&
      deal.assignedToId !== employee.id &&
      deal.owner !== employee.name
    ) {
      throw new ForbiddenException('You can only access assigned deals');
    }
    return deal;
  }

  async update(id: number, dto: UpdateDealDto, user: AuthUser) {
    const organizationId = this.requireWriteOrganization(user);
    const currentDeal = await this.findOne(id, user);

    const data: Prisma.DealUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.stage !== undefined) data.stage = dto.stage;
    if (dto.probability !== undefined) data.probability = dto.probability;
    if (dto.contact !== undefined) data.contact = dto.contact;
    if (dto.owner !== undefined) data.owner = dto.owner;
    if (dto.employeeId !== undefined) {
      data.assignedEmployee =
        dto.employeeId === null
          ? { disconnect: true }
          : { connect: { id: dto.employeeId } };
    }
    if (dto.pipeline !== undefined) data.pipeline = dto.pipeline;
    if (dto.closeDate !== undefined) {
      data.closeDate = dto.closeDate ? new Date(dto.closeDate) : null;
    }
    if (dto.actualCloseDate !== undefined) {
      data.actualCloseDate = dto.actualCloseDate
        ? new Date(dto.actualCloseDate)
        : null;
    }
    if (dto.leadId !== undefined) {
      data.lead =
        dto.leadId === null
          ? { disconnect: true }
          : { connect: { id: dto.leadId } };
    }
    if (dto.contactId !== undefined) {
      data.linkedContact =
        dto.contactId === null
          ? { disconnect: true }
          : { connect: { id: dto.contactId } };
    }

    const updatedDeal = await this.prisma.deal.update({
      where: { id, organizationId },
      data,
      include: includeRelations,
    });

    // Emit status change event if stage was updated
    if (dto.stage !== undefined && dto.stage !== currentDeal.stage) {
      this.eventEmitter.emit(
        'deal.status_updated',
        new DealStatusUpdatedEvent(id, currentDeal.stage, dto.stage),
      );
    }

    await this.invalidateDashboardCache();

    return updatedDeal;
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.requireWriteOrganization(user);
    await this.findOne(id, user);
    const result = await this.prisma.deal.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
    await this.invalidateDashboardCache();
    return result;
  }

  async importRecords(
    records: Array<Record<string, unknown>>,
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    const organizationId = this.requireWriteOrganization(user);
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const title = typeof r.title === 'string' ? r.title : '';
      if (!title) {
        errors.push(`Row ${i + 1}: 'title' is required`);
        continue;
      }
      const value = r.value;
      if (value === undefined || value === '') {
        errors.push(`Row ${i + 1}: 'value' is required`);
        continue;
      }
      try {
        const data: Prisma.DealCreateInput = {
          organization: { connect: { id: organizationId } },
          title,
          value: Number(value),
          stage: typeof r.stage === 'string' ? r.stage : 'NEW',
          probability:
            typeof r.probability === 'number' ? r.probability : undefined,
          closeDate:
            typeof r.closeDate === 'string' || r.closeDate instanceof Date
              ? new Date(String(r.closeDate))
              : undefined,
          actualCloseDate:
            typeof r.actualCloseDate === 'string' ||
            r.actualCloseDate instanceof Date
              ? new Date(String(r.actualCloseDate))
              : undefined,
          contact: typeof r.contact === 'string' ? r.contact : undefined,
          owner: typeof r.owner === 'string' ? r.owner : undefined,
          assignedEmployee:
            typeof r.assignedToId === 'number'
              ? { connect: { id: r.assignedToId } }
              : undefined,
          pipeline: typeof r.pipeline === 'string' ? r.pipeline : undefined,
          lead:
            typeof r.leadId === 'number'
              ? { connect: { id: r.leadId } }
              : undefined,
          linkedContact:
            typeof r.contactId === 'number'
              ? { connect: { id: r.contactId } }
              : undefined,
        };

        await this.prisma.deal.create({
          data,
        });
        imported++;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Row ${i + 1}: ${message}`);
      }
    }
    return { imported, errors };
  }

  async getPipeline(user: AuthUser) {
    const orgScope = this.resolveReadScope(user);
    const employee = await this.resolveEmployeeScope(user);

    const deals = await this.prisma.deal.findMany({
      where: {
        ...(orgScope !== null ? { organizationId: orgScope } : {}),
        deletedAt: null,
        ...(employee
          ? {
              OR: [{ assignedToId: employee.id }, { owner: employee.name }],
            }
          : {}),
      },
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
    });

    const pipeline = Object.fromEntries(
      STAGES.map((stage) => [stage.toLowerCase(), []]),
    ) as Record<
      string,
      Array<Prisma.DealGetPayload<{ include: typeof includeRelations }>>
    >;

    for (const deal of deals) {
      const key = deal.stage.toLowerCase();
      if (key in pipeline) pipeline[key].push(deal);
    }

    return pipeline;
  }

  /**
   * Handle Deal Won workflow - marked as deprecated
   * Use the normal update() method with stage='WON' instead
   * This delegates to the event-driven DealWonListener so the same atomic workflow
   * is used for both the explicit endpoint and stage updates.
   */
  async handleDealWon(dealId: string, user: AuthUser) {
    const dealIdNum = parseInt(dealId, 10);
    if (isNaN(dealIdNum)) {
      throw new NotFoundException(`Invalid deal ID: ${dealId}`);
    }
    // Use the standard update flow which will emit the deal.status_updated event
    return this.update(dealIdNum, { stage: 'WON' }, user);
  }
}
