import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AuthUser } from '../common/types/auth';

const EVENT_TYPES = [
  'Training',
  'Networking',
  'Webinar',
  'Workshop',
  'Conference',
  'Other',
] as const;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  async create(dto: CreateEventDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.event.create({
      data: {
        organization: { connect: { id: organizationId } },
        eventName: dto.eventName,
        eventCode: dto.eventCode,
        startDateTime: dto.startDateTime
          ? new Date(dto.startDateTime)
          : undefined,
        endDateTime: dto.endDateTime ? new Date(dto.endDateTime) : undefined,
        location: dto.location,
        organizer: dto.organizer,
        status: dto.status,
        capacity: dto.capacity,
        description: dto.description,
        eventType: dto.eventType,
      },
    });
  }

  async findAll(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    return this.prisma.event.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const event = await this.prisma.event.findUnique({
      where: { id, organizationId },
    });
    if (!event) throw new NotFoundException(`Event #${id} not found`);
    return event;
  }

  async update(id: number, dto: UpdateEventDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.event.update({
      where: { id, organizationId },
      data: {
        ...(dto.eventName !== undefined && { eventName: dto.eventName }),
        ...(dto.eventCode !== undefined && { eventCode: dto.eventCode }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.organizer !== undefined && { organizer: dto.organizer }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.eventType !== undefined && { eventType: dto.eventType }),
        ...(dto.startDateTime !== undefined && {
          startDateTime: dto.startDateTime ? new Date(dto.startDateTime) : null,
        }),
        ...(dto.endDateTime !== undefined && {
          endDateTime: dto.endDateTime ? new Date(dto.endDateTime) : null,
        }),
      },
    });
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    await this.findOne(id, user);
    return this.prisma.event.update({
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
      if (typeof r.eventName !== 'string' || !r.eventName) {
        errors.push(`Row ${i + 1}: 'eventName' is required`);
        continue;
      }
      try {
        const data: Prisma.EventCreateInput = {
          organization: { connect: { id: organizationId } },
          eventName: String(r.eventName),
          eventCode: typeof r.eventCode === 'string' ? r.eventCode : undefined,
          startDateTime:
            typeof r.startDateTime === 'string' ||
            r.startDateTime instanceof Date
              ? new Date(String(r.startDateTime))
              : undefined,
          endDateTime:
            typeof r.endDateTime === 'string' || r.endDateTime instanceof Date
              ? new Date(String(r.endDateTime))
              : undefined,
          location: typeof r.location === 'string' ? r.location : undefined,
          organizer: typeof r.organizer === 'string' ? r.organizer : undefined,
          status: typeof r.status === 'string' ? r.status : undefined,
          capacity:
            typeof r.capacity === 'number'
              ? r.capacity
              : typeof r.capacity === 'string'
                ? Number(r.capacity)
                : undefined,
          description:
            typeof r.description === 'string' ? r.description : undefined,
          eventType: typeof r.eventType === 'string' ? r.eventType : undefined,
        };

        await this.prisma.event.create({ data });
        imported++;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Row ${i + 1}: ${message}`);
      }
    }
    return { imported, errors };
  }

  async getByEventType(user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const events = await this.prisma.event.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
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
