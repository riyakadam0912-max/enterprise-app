import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import type { AuthUser } from '../common/types/auth';

const includeRelations = {
  ticketType: { select: { id: true, name: true, color: true } },
};

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new Error('User has no associated organization');
    }
    return user.organizationId;
  }

  // ── Tickets ────────────────────────────────────────────────────────────────

  async create(dto: CreateTicketDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);

    return this.prisma.ticket.create({
      data: {
        organizationId,
        event: dto.event,
        customer: dto.customer,
        price: dto.price,
        status: dto.status ?? 'RESERVED',
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        qrCode: dto.qrCode,
        notes: dto.notes,
        ticketTypeId: dto.ticketTypeId,
      },
      include: includeRelations,
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);

    return this.prisma.ticket.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: includeRelations,
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, organizationId },
      include: includeRelations,
    });
    if (!ticket) throw new NotFoundException(`Ticket #${id} not found`);
    return ticket;
  }

  async update(id: number, dto: UpdateTicketDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);

    return this.prisma.ticket.update({
      where: { id, organizationId },
      data: {
        ...(dto.event !== undefined && { event: dto.event }),
        ...(dto.customer !== undefined && { customer: dto.customer }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.qrCode !== undefined && { qrCode: dto.qrCode }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.purchaseDate !== undefined && {
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        }),
        ...(dto.ticketTypeId !== undefined && {
          ticketType:
            dto.ticketTypeId === null
              ? { disconnect: true }
              : { connect: { id: dto.ticketTypeId } },
        }),
      },
      include: includeRelations,
    });
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.ticket.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async importRecords(
    records: Record<string, unknown>[],
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    const organizationId = this.validateOrganization(user);
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      try {
        await this.prisma.ticket.create({
          data: {
            organizationId,
            event: typeof r.event === 'string' ? r.event : undefined,
            customer: typeof r.customer === 'string' ? r.customer : undefined,
            price: typeof r.price === 'number' ? r.price : undefined,
            status: typeof r.status === 'string' ? r.status : 'RESERVED',
            purchaseDate:
              typeof r.purchaseDate === 'string'
                ? new Date(r.purchaseDate)
                : undefined,
            qrCode: typeof r.qrCode === 'string' ? r.qrCode : undefined,
            notes: typeof r.notes === 'string' ? r.notes : undefined,
            ticketTypeId:
              typeof r.ticketTypeId === 'number' ? r.ticketTypeId : undefined,
          },
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

  async getByTicketType(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const types = await this.prisma.ticketType.findMany({
      include: {
        tickets: {
          where: { organizationId },
          include: includeRelations,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    return types;
  }

  // ── Ticket Types ──────────────────────────────────────────────────────────

  async createTicketType(dto: CreateTicketTypeDto) {
    return this.prisma.ticketType.create({
      data: { name: dto.name, color: dto.color },
    });
  }

  async findAllTicketTypes() {
    return this.prisma.ticketType.findMany({ orderBy: { name: 'asc' } });
  }

  async removeTicketType(id: number) {
    const type = await this.prisma.ticketType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException(`TicketType #${id} not found`);
    return this.prisma.ticketType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
