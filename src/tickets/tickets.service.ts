import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';

const includeRelations = {
  ticketType: { select: { id: true, name: true, color: true } },
};

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Tickets ────────────────────────────────────────────────────────────────

  async create(dto: CreateTicketDto) {
    return this.prisma.ticket.create({
      data: {
        event:        dto.event,
        customer:     dto.customer,
        price:        dto.price,
        status:       dto.status ?? 'RESERVED',
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        qrCode:       dto.qrCode,
        notes:        dto.notes,
        ticketTypeId: dto.ticketTypeId,
      },
      include: includeRelations,
    });
  }

  async findAll() {
    return this.prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
      include:  includeRelations,
    });
  }

  async findOne(id: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where:   { id },
      include: includeRelations,
    });
    if (!ticket) throw new NotFoundException(`Ticket #${id} not found`);
    return ticket;
  }

  async update(id: number, dto: UpdateTicketDto) {
    await this.findOne(id);

    return this.prisma.ticket.update({
      where: { id },
      data: {
        ...(dto.event        !== undefined && { event:        dto.event }),
        ...(dto.customer     !== undefined && { customer:     dto.customer }),
        ...(dto.price        !== undefined && { price:        dto.price }),
        ...(dto.status       !== undefined && { status:       dto.status }),
        ...(dto.qrCode       !== undefined && { qrCode:       dto.qrCode }),
        ...(dto.notes        !== undefined && { notes:        dto.notes }),
        ...(dto.purchaseDate !== undefined && {
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        }),
        ...(dto.ticketTypeId !== undefined && {
          ticketType: dto.ticketTypeId === null
            ? { disconnect: true }
            : { connect: { id: dto.ticketTypeId } },
        }),
      },
      include: includeRelations,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.ticket.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async importRecords(records: Record<string, any>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      try {
        await this.prisma.ticket.create({
          data: {
            event:        r.event        ? String(r.event)        : undefined,
            customer:     r.customer     ? String(r.customer)     : undefined,
            price:        r.price        ? Number(r.price)        : undefined,
            status:       r.status       ? String(r.status)       : 'RESERVED',
            purchaseDate: r.purchaseDate ? new Date(String(r.purchaseDate)) : undefined,
            qrCode:       r.qrCode       ? String(r.qrCode)       : undefined,
            notes:        r.notes        ? String(r.notes)        : undefined,
            ticketTypeId: r.ticketTypeId ? Number(r.ticketTypeId) : undefined,
          },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message ?? 'Unknown error'}`);
      }
    }
    return { imported, errors };
  }

  async getByTicketType() {
    const types = await this.prisma.ticketType.findMany({
      include: {
        tickets: {
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
    return this.prisma.ticketType.create({ data: { name: dto.name, color: dto.color } });
  }

  async findAllTicketTypes() {
    return this.prisma.ticketType.findMany({ orderBy: { name: 'asc' } });
  }

  async removeTicketType(id: number) {
    const type = await this.prisma.ticketType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException(`TicketType #${id} not found`);
    return this.prisma.ticketType.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }
}
