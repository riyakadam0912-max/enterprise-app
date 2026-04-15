import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryTimesheetDto } from './dto/query-timesheet.dto';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';

@Injectable()
export class TimesheetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(query: QueryTimesheetDto) {
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
    const where: Prisma.TimesheetWhereInput = {};

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
        { task:    { contains: search, mode: 'insensitive' } },
        { project: { contains: search, mode: 'insensitive' } },
        { notes:   { contains: search, mode: 'insensitive' } },
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
        id:         t.id,
        task:       t.task,
        date:       t.date.toISOString().split('T')[0],
        hours:      t.hours,
        status:     t.status,
        project:    t.project    ?? null,
        notes:      t.notes      ?? null,
        employee:   null,
      })),
      total,
      page:  +page,
      limit: +limit,
    };
  }

  async create(dto: CreateTimesheetDto) {
    return this.prisma.timesheet.create({
      data: {
        task:       dto.task,
        project:    dto.project,
        date:       new Date(dto.date),
        hours:      dto.hours,
        status:     dto.status ?? 'PENDING',
        notes:      dto.notes,
      },
    });
  }

  async importRecords(records: Record<string, any>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.task)  { errors.push(`Row ${i + 1}: 'task' is required`);  continue; }
      if (!r.date)  { errors.push(`Row ${i + 1}: 'date' is required`);  continue; }
      if (!r.hours) { errors.push(`Row ${i + 1}: 'hours' is required`); continue; }
      try {
        await this.prisma.timesheet.create({
          data: {
            task:    String(r.task),
            project: r.project ? String(r.project) : undefined,
            date:    new Date(String(r.date)),
            hours:   Number(r.hours),
            status:  r.status  ? String(r.status)  : 'PENDING',
            notes:   r.notes   ? String(r.notes)   : undefined,
          },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message ?? 'Unknown error'}`);
      }
    }
    return { imported, errors };
  }
}
