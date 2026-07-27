import { Injectable, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryTimesheetDto } from './dto/query-timesheet.dto';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import type { AuthUser } from '../common/types/auth';

@Injectable()
export class TimesheetsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveOrganizationId(user: AuthUser): Promise<number> {
    if (
      typeof user.organizationId === 'number' &&
      Number.isInteger(user.organizationId) &&
      user.organizationId > 0
    ) {
      return user.organizationId;
    }
    const userId = user.userId ?? user.id;
    if (!userId) {
      throw new ForbiddenException('User has no associated organization');
    }
    const userRow = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!userRow) {
      throw new ForbiddenException('User has no associated organization');
    }
    const organizationId = userRow.organizationId;
    if (
      typeof organizationId !== 'number' ||
      !Number.isInteger(organizationId) ||
      organizationId <= 0
    ) {
      throw new ForbiddenException('User has no associated organization');
    }
    return organizationId;
  }

  async getReport(query: QueryTimesheetDto, user: AuthUser) {
    const {
      page = 1,
      limit = 10,
      status,
      project,
      dateFrom,
      dateTo,
      search,
    } = query;

    const skip = (+page - 1) * +limit;
    const organizationId = await this.resolveOrganizationId(user);
    const where: Prisma.TimesheetWhereInput = { organizationId };

    if (status) where.status = status;

    if (project) {
      where.project = { contains: project, mode: 'insensitive' };
    }

    if (dateFrom || dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.date = dateFilter;
    }

    if (search) {
      where.OR = [
        { task: { contains: search, mode: 'insensitive' } },
        { project: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.timesheet.findMany({
        where,
        skip,
        take: +limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.timesheet.count({ where }),
    ]);

    return {
      data: rows.map((t) => ({
        id: t.id,
        task: t.task,
        date: t.date.toISOString().split('T')[0],
        hours: t.hours,
        status: t.status,
        project: t.project ?? null,
        notes: t.notes ?? null,
        employee: null,
      })),
      total,
      page: +page,
      limit: +limit,
    };
  }

  async create(dto: CreateTimesheetDto, user: AuthUser) {
    const organizationId = await this.resolveOrganizationId(user);
    return this.prisma.timesheet.create({
      data: {
        organizationId,
        task: dto.task,
        project: dto.project,
        date: new Date(dto.date),
        hours: dto.hours,
        status: dto.status ?? 'PENDING',
        notes: dto.notes,
      },
    });
  }

  async importRecords(
    records: Record<string, unknown>[],
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    const organizationId = await this.resolveOrganizationId(user);
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const task = typeof r.task === 'string' ? r.task : '';
      const project = typeof r.project === 'string' ? r.project : undefined;
      const date = typeof r.date === 'string' ? r.date : '';
      const hours = typeof r.hours === 'number' ? r.hours : Number(r.hours);
      const status = typeof r.status === 'string' ? r.status : 'PENDING';
      const notes = typeof r.notes === 'string' ? r.notes : undefined;

      if (!task) {
        errors.push(`Row ${i + 1}: 'task' is required`);
        continue;
      }
      if (!date) {
        errors.push(`Row ${i + 1}: 'date' is required`);
        continue;
      }
      if (!hours) {
        errors.push(`Row ${i + 1}: 'hours' is required`);
        continue;
      }
      try {
        await this.prisma.timesheet.create({
          data: {
            organizationId,
            task,
            project,
            date: new Date(date),
            hours,
            status,
            notes,
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
}
