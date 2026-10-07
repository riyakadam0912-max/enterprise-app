import { Injectable, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryTimesheetDto } from './dto/query-timesheet.dto';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto';
import type { AuthUser } from '../common/types/auth';
import { Role } from '../common/enums/role.enum';
import { OrganizationScopeService } from '../organizations/organization-scope.service';

@Injectable()
export class TimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationScopeService: OrganizationScopeService,
  ) {}

  private async getReadableOrganizationIds(user: AuthUser): Promise<number[]> {
    const organizationId = await this.resolveOrganizationId(user);
    if (
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      user.role === Role.SUPER_ADMIN
    ) {
      return (
        (await this.organizationScopeService.getOrganizationIds(user)) ?? [
          organizationId,
        ]
      );
    }
    return [organizationId];
  }

  private getTimesheetOwnerFilter(user: AuthUser): Prisma.TimesheetWhereInput {
    const userId = user.userId ?? user.id;
    if (user.role === Role.EMPLOYEE) return { createdByUserId: userId };
    if (user.role === Role.MANAGER) {
      return {
        OR: [
          { createdByUserId: userId },
          { projectRef: { managerId: userId } },
          { projectRef: { coManagers: { some: { id: userId } } } },
        ],
      };
    }
    return {};
  }

  private async validateRelatedRecords(
    projectId: number | null | undefined,
    taskId: number | null | undefined,
    organizationId: number,
  ) {
    if (projectId != null) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!project) {
        throw new ForbiddenException(
          'Project must belong to the timesheet organization',
        );
      }
    }
    if (taskId != null) {
      const task = await this.prisma.task.findFirst({
        where: { id: taskId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!task) {
        throw new ForbiddenException(
          'Task must belong to the timesheet organization',
        );
      }
    }
  }

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
      projectId,
      taskId,
      dateFrom,
      dateTo,
      search,
    } = query;

    const skip = (+page - 1) * +limit;
    const organizationIds = await this.getReadableOrganizationIds(user);
    const where: Prisma.TimesheetWhereInput = {
      deletedAt: null,
      organizationId:
        organizationIds.length === 1
          ? organizationIds[0]
          : { in: organizationIds },
      ...this.getTimesheetOwnerFilter(user),
    };

    if (status) where.status = status;

    if (projectId) {
      where.projectId = Number(projectId);
    } else if (project) {
      where.project = { contains: project, mode: 'insensitive' };
    }

    if (taskId) {
      where.taskId = Number(taskId);
    }

    if (dateFrom || dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.date = dateFilter;
    }

    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : []),
        {
          OR: [
            { task: { contains: search, mode: 'insensitive' } },
            { project: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.timesheet.findMany({
        where,
        skip,
        take: +limit,
        orderBy: { date: 'desc' },
        include: {
          createdByUser: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true } },
        },
      }),
      this.prisma.timesheet.count({ where }),
    ]);

    return {
      data: rows.map((t) => ({
        id: t.id,
        task: t.task,
        projectId: t.projectId ?? null,
        taskId: t.taskId ?? null,
        date: t.date.toISOString().split('T')[0],
        hours: t.hours,
        status: t.status,
        project: t.project ?? null,
        notes: t.notes ?? null,
        employee: t.createdByUser
          ? { id: t.createdByUser.id, name: t.createdByUser.name }
          : null,
        employeeId: t.createdByUserId ?? null,
        createdByUser: t.createdByUser ?? null,
        organization: t.organization,
      })),
      total,
      page: +page,
      limit: +limit,
    };
  }

  async create(dto: CreateTimesheetDto, user: AuthUser) {
    const organizationId = await this.resolveOrganizationId(user);
    await this.validateRelatedRecords(
      dto.projectId,
      dto.taskId,
      organizationId,
    );
    return this.prisma.timesheet.create({
      data: {
        organizationId,
        createdByUserId: user.userId,
        task: dto.task,
        project: dto.project,
        projectId: dto.projectId,
        taskId: dto.taskId,
        date: new Date(dto.date),
        hours: dto.hours,
        status: 'PENDING',
        notes: dto.notes,
      },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationIds = await this.getReadableOrganizationIds(user);
    const timesheet = await this.prisma.timesheet.findFirst({
      where: {
        id,
        deletedAt: null,
        ...this.getTimesheetOwnerFilter(user),
        organizationId:
          organizationIds.length === 1
            ? organizationIds[0]
            : { in: organizationIds },
      },
      include: { organization: { select: { id: true, name: true } } },
    });
    if (!timesheet)
      throw new ForbiddenException('Timesheet not found in your organization');
    return { ...timesheet, date: timesheet.date.toISOString().split('T')[0] };
  }

  async update(id: number, dto: UpdateTimesheetDto, user: AuthUser) {
    const existing = await this.findOne(id, user);
    await this.validateRelatedRecords(
      dto.projectId === undefined ? existing.projectId : dto.projectId,
      dto.taskId === undefined ? existing.taskId : dto.taskId,
      existing.organizationId,
    );
    const isApprover = new Set<Role>([
      Role.ADMIN,
      Role.HR,
      Role.SUPER_ADMIN,
    ]).has(user.role);
    if (
      user.role === Role.EMPLOYEE &&
      existing.createdByUserId !== (user.userId ?? user.id)
    ) {
      throw new ForbiddenException(
        'Employees can only edit their own timesheets',
      );
    }
    if (dto.status !== undefined && !isApprover) {
      throw new ForbiddenException(
        'Only administrators and HR can change timesheet status',
      );
    }
    if (existing.status === 'APPROVED')
      throw new ForbiddenException('Approved timesheets cannot be edited');
    return this.prisma.timesheet.update({
      where: { id, organizationId: existing.organizationId },
      data: {
        ...(dto.task !== undefined && { task: dto.task }),
        ...(dto.project !== undefined && { project: dto.project }),
        ...(dto.projectId !== undefined && { projectId: dto.projectId }),
        ...(dto.taskId !== undefined && { taskId: dto.taskId }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.hours !== undefined && { hours: dto.hours }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
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
      const projectId =
        typeof r.projectId === 'number' ? r.projectId : Number(r.projectId);
      const taskId = typeof r.taskId === 'number' ? r.taskId : Number(r.taskId);
      const date = typeof r.date === 'string' ? r.date : '';
      const hours = typeof r.hours === 'number' ? r.hours : Number(r.hours);
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
            projectId: Number.isFinite(projectId) ? projectId : undefined,
            taskId: Number.isFinite(taskId) ? taskId : undefined,
            date: new Date(date),
            hours,
            status: 'PENDING',
            notes,
            createdByUserId: user.userId,
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
