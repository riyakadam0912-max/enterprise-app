import { Inject, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { Role } from '../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { DealStatusUpdatedEvent } from './events/deal-status-updated.event';
import { DASHBOARD_CACHE_KEY } from '../common/utils/cache-keys';

const STAGES = ['NEW', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const;
type Stage = (typeof STAGES)[number];

const includeRelations = {
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

  async create(dto: CreateDealDto) {
    const result = await this.prisma.deal.create({
      data: {
        title:           dto.title,
        value:           dto.value,
        stage:           dto.stage ?? 'NEW',
        probability:     dto.probability,
        closeDate:       dto.closeDate       ? new Date(dto.closeDate)       : undefined,
        actualCloseDate: dto.actualCloseDate ? new Date(dto.actualCloseDate) : undefined,
        contact:         dto.contact,
        owner:           dto.owner,
        assignedToId:    dto.employeeId,
        pipeline:        dto.pipeline,
        leadId: dto.leadId,
        contactId: dto.contactId,
      },
      include: includeRelations,
    } as any);

    await this.invalidateDashboardCache();
    return result;
  }

  async findAll(user?: { userId: number; role: Role; employeeId?: number | null }) {
    const employee = await this.resolveEmployeeScope(user);
    return this.prisma.deal.findMany({
      where: employee
        ? {
            OR: [
              { assignedToId: employee.id },
              { owner: employee.name },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include:  includeRelations,
    } as any);
  }

  async findOne(id: number, user?: { userId: number; role: Role; employeeId?: number | null }) {
    const employee = await this.resolveEmployeeScope(user);

    const deal = await this.prisma.deal.findUnique({
      where:   { id },
      include: includeRelations,
    } as any) as any;
    if (!deal) throw new NotFoundException(`Deal #${id} not found`);
    if (employee && deal.assignedToId !== employee.id && deal.owner !== employee.name) {
      throw new ForbiddenException('You can only access assigned deals');
    }
    return deal;
  }

  async update(id: number, dto: UpdateDealDto) {
    const currentDeal = await this.findOne(id);

    const data: Record<string, any> = {};
    if (dto.title       !== undefined) data.title       = dto.title;
    if (dto.value       !== undefined) data.value       = dto.value;
    if (dto.stage       !== undefined) data.stage       = dto.stage;
    if (dto.probability !== undefined) data.probability = dto.probability;
    if (dto.contact     !== undefined) data.contact     = dto.contact;
    if (dto.owner       !== undefined) data.owner       = dto.owner;
    if (dto.employeeId  !== undefined) data.assignedToId = dto.employeeId;
    if (dto.pipeline    !== undefined) data.pipeline    = dto.pipeline;
    if (dto.closeDate !== undefined) {
      data.closeDate = dto.closeDate ? new Date(dto.closeDate) : null;
    }
    if (dto.actualCloseDate !== undefined) {
      data.actualCloseDate = dto.actualCloseDate ? new Date(dto.actualCloseDate) : null;
    }
    if (dto.leadId !== undefined) {
      data.lead = dto.leadId === null
        ? { disconnect: true }
        : { connect: { id: dto.leadId } };
    }
    if (dto.contactId !== undefined) {
      data.linkedContact = dto.contactId === null
        ? { disconnect: true }
        : { connect: { id: dto.contactId } };
    }

    const updatedDeal = await this.prisma.deal.update({
      where:   { id },
      data,
      include: includeRelations,
    } as any);

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

  async remove(id: number) {
    await this.findOne(id);
    const result = await this.prisma.deal.update({ where: { id }, data: { deletedAt: new Date() } as any });
    await this.invalidateDashboardCache();
    return result;
  }

  async importRecords(records: Record<string, any>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.title) { errors.push(`Row ${i + 1}: 'title' is required`); continue; }
      if (r.value === undefined || r.value === '') { errors.push(`Row ${i + 1}: 'value' is required`); continue; }
      try {
        await this.prisma.deal.create({
          data: {
            title:           String(r.title),
            value:           Number(r.value),
            stage:           r.stage           ? String(r.stage)           : 'NEW',
            probability:     r.probability     ? Number(r.probability)     : undefined,
            closeDate:       r.closeDate       ? new Date(String(r.closeDate))       : undefined,
            actualCloseDate: r.actualCloseDate ? new Date(String(r.actualCloseDate)) : undefined,
            contact:         r.contact         ? String(r.contact)         : undefined,
            owner:           r.owner           ? String(r.owner)           : undefined,
            assignedToId:    r.assignedToId    ? Number(r.assignedToId)    : undefined,
            pipeline:        r.pipeline        ? String(r.pipeline)        : undefined,
            leadId:          r.leadId          ? Number(r.leadId)          : undefined,
            contactId:       r.contactId       ? Number(r.contactId)       : undefined,
          },
        } as any);
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message ?? 'Unknown error'}`);
      }
    }
    return { imported, errors };
  }

  async getPipeline(user?: { userId: number; role: Role; employeeId?: number | null }) {
    const employee = await this.resolveEmployeeScope(user);

    const deals = await this.prisma.deal.findMany({
      where: employee
        ? {
            OR: [
              { assignedToId: employee.id },
              { owner: employee.name },
            ],
          }
        : undefined,
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
    } as any);

    const pipeline = Object.fromEntries(STAGES.map((s) => [s.toLowerCase(), []])) as Record<
      string,
      typeof deals
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
  async handleDealWon(dealId: string) {
    const dealIdNum = parseInt(dealId, 10);
    if (isNaN(dealIdNum)) {
      throw new NotFoundException(`Invalid deal ID: ${dealId}`);
    }
    // Use the standard update flow which will emit the deal.status_updated event
    return this.update(dealIdNum, { stage: 'WON' });
  }
}
