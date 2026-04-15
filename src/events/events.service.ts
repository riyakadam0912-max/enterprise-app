import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const EVENT_TYPES = ['Training', 'Networking', 'Webinar', 'Workshop', 'Conference', 'Other'] as const;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        eventName:     dto.eventName,
        eventCode:     dto.eventCode,
        startDateTime: dto.startDateTime ? new Date(dto.startDateTime) : undefined,
        endDateTime:   dto.endDateTime   ? new Date(dto.endDateTime)   : undefined,
        location:      dto.location,
        organizer:     dto.organizer,
        status:        dto.status,
        capacity:      dto.capacity,
        description:   dto.description,
        eventType:     dto.eventType,
      },
    });
  }

  async findAll() {
    return this.prisma.event.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: number) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException(`Event #${id} not found`);
    return event;
  }

  async update(id: number, dto: UpdateEventDto) {
    await this.findOne(id);
    return this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.eventName   !== undefined && { eventName:   dto.eventName }),
        ...(dto.eventCode   !== undefined && { eventCode:   dto.eventCode }),
        ...(dto.location    !== undefined && { location:    dto.location }),
        ...(dto.organizer   !== undefined && { organizer:   dto.organizer }),
        ...(dto.status      !== undefined && { status:      dto.status }),
        ...(dto.capacity    !== undefined && { capacity:    dto.capacity }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.eventType   !== undefined && { eventType:   dto.eventType }),
        ...(dto.startDateTime !== undefined && { startDateTime: dto.startDateTime ? new Date(dto.startDateTime) : null }),
        ...(dto.endDateTime   !== undefined && { endDateTime:   dto.endDateTime   ? new Date(dto.endDateTime)   : null }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.event.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async importRecords(records: Record<string, any>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.eventName) { errors.push(`Row ${i + 1}: 'eventName' is required`); continue; }
      try {
        await this.prisma.event.create({
          data: {
            eventName:     String(r.eventName),
            eventCode:     r.eventCode     ? String(r.eventCode)     : undefined,
            startDateTime: r.startDateTime ? new Date(String(r.startDateTime)) : undefined,
            endDateTime:   r.endDateTime   ? new Date(String(r.endDateTime))   : undefined,
            location:      r.location      ? String(r.location)      : undefined,
            organizer:     r.organizer     ? String(r.organizer)     : undefined,
            status:        r.status        ? String(r.status)        : undefined,
            capacity:      r.capacity      ? Number(r.capacity)      : undefined,
            description:   r.description   ? String(r.description)   : undefined,
            eventType:     r.eventType     ? String(r.eventType)     : undefined,
          },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message ?? 'Unknown error'}`);
      }
    }
    return { imported, errors };
  }

  async getByEventType() {
    const events = await this.prisma.event.findMany({ orderBy: { createdAt: 'desc' } });
    const grouped: Record<string, typeof events> = {};
    for (const t of EVENT_TYPES) grouped[t] = [];
    for (const e of events) {
      const key = e.eventType ?? 'Other';
      if (grouped[key]) grouped[key].push(e);
      else grouped[key] = [e];
    }
    return grouped;
  }
}
