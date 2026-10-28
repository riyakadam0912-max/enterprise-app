import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { DASHBOARD_CACHE_KEY } from '../common/utils/cache-keys';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { BulkUpdateTasksDto } from './dto/bulk-update-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Role } from '../common/enums/role.enum';
import { SubmitTaskWorkDto } from './dto/submit-task-work.dto';
import { ReviewTaskDto } from './dto/review-task.dto';
import { canTransition, validateTransition } from './task-workflow';
import { WorkflowEngineService } from '../workflows/workflow-engine.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUser } from '../common/types/auth';
import { BusinessUnitsService } from '../business-units/business-units.service';
import { CreateTaskMessageDto } from './dto/create-task-message.dto';
import { UpdateTaskTimerDto } from './dto/update-task-timer.dto';
import { Optional } from '@nestjs/common';
import { OrganizationScopeService } from '../organizations/organization-scope.service';
import { AttendanceTaskHoursService } from '../timesheets/attendance-task-hours.service';
import {
  dateKeyInTimezone,
  localMidnightAfterDateInTimezone,
  localMidnightAtDateInTimezone,
} from '../attendance/attendance-time.utils';

const PRIORITIES = ['High', 'Low', 'Medium', 'Critical'] as const;
const TASK_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
] as const;
const SHOOT_ASSIGNABLE_ROLES = [
  Role.EMPLOYEE,
  Role.MANAGER,
  Role.HR,
  Role.ADMIN,
  Role.SUPER_ADMIN,
];
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly notificationsService: NotificationsService,
    private readonly businessUnitsService: BusinessUnitsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly attendanceTaskHours: AttendanceTaskHoursService,
    @Optional()
    private readonly organizationScopeService?: OrganizationScopeService,
  ) {}

  private get db() {
    return this.transaction ?? this.prisma;
  }

  private transaction?: Prisma.TransactionClient;
  private afterCommit?: Array<() => Promise<unknown>>;
  private readonly logger = new Logger(TasksService.name);

  private async inTaskTransaction<T>(
    id: number | null,
    action: (service: TasksService) => Promise<T>,
  ): Promise<T> {
    const afterCommit: Array<() => Promise<unknown>> = [];
    const result = await this.prisma.$transaction(async (tx) => {
      if (id != null) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(137702::integer, ${id}::integer)`;
      }
      const scoped = new TasksService(
        this.prisma,
        this.workflowEngine.forTransaction(tx, afterCommit),
        this.notificationsService,
        this.businessUnitsService,
        this.cacheManager,
        this.attendanceTaskHours,
        this.organizationScopeService,
      );
      scoped.transaction = tx;
      scoped.afterCommit = afterCommit;
      return action(scoped);
    });
    for (const effect of afterCommit) {
      try {
        await effect();
      } catch (error) {
        this.logger.error('Task post-commit notification/audit failed', error);
      }
    }
    return result;
  }

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  private async canManageTask(
    taskId: number,
    user: AuthUser,
  ): Promise<boolean> {
    if (
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      user.role === Role.SUPER_ADMIN
    ) {
      return true;
    }
    if (user.role !== Role.MANAGER) return false;
    const accessWhere = await this.getTaskAccessWhere(user);
    const task = await this.db.task.findFirst({
      where: { id: taskId, ...accessWhere },
      select: { id: true },
    });
    return Boolean(task);
  }

  private normalizeTaskStatus(
    status?: string | null,
  ): (typeof TASK_STATUSES)[number] {
    if (!status) return 'PENDING';

    const normalized = status.trim().toUpperCase();
    if ((TASK_STATUSES as readonly string[]).includes(normalized)) {
      return normalized as (typeof TASK_STATUSES)[number];
    }

    // Backward compatibility with legacy status values.
    if (normalized === 'NOT STARTED') return 'PENDING';
    if (normalized === 'IN PROGRESS') return 'IN_PROGRESS';
    if (normalized === 'COMPLETED') return 'COMPLETED';

    return 'PENDING';
  }

  private async getTaskAccessWhere(
    user: AuthUser,
  ): Promise<Prisma.TaskWhereInput> {
    const scope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildDirectBUWhere(scope);
    const relatedOrganizationIds =
      (await this.organizationScopeService?.getRelatedOrganizationIds(
        user.homeOrganizationId ?? user.organizationId ?? scope.organizationId,
      )) ?? [scope.organizationId];

    let roleWhere: Prisma.TaskWhereInput;
    if (
      user.role === Role.SUPER_ADMIN ||
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      user.isSuperAdmin === true ||
      user.isPlatformAdmin === true
    ) {
      roleWhere = {};
    } else if (user.role === Role.MANAGER) {
      roleWhere = {
        OR: [
          { assignedToUserId: user.userId },
          { assignedByUserId: user.userId },
          { shootCrew: { some: { userId: user.userId } } },
          { projectRef: { managerId: user.userId } },
          { projectRef: { coManagers: { some: { id: user.userId } } } },
        ],
      };
    } else {
      roleWhere = {
        OR: [
          { assignedToUserId: user.userId },
          { assignedByUserId: user.userId },
          { shootCrew: { some: { userId: user.userId } } },
          ...(user.employeeId ? [{ assignedToId: user.employeeId }] : []),
          ...(user.employeeId
            ? [
                {
                  projectRef: {
                    assignedEmployees: { some: { id: user.employeeId } },
                  },
                },
              ]
            : []),
        ],
      } as Prisma.TaskWhereInput;
    }

    const otherOrganizationIds = relatedOrganizationIds.filter(
      (id) => id !== scope.organizationId,
    );
    const ownOrganizationWhere: Prisma.TaskWhereInput = {
      AND: [{ organizationId: scope.organizationId, ...roleWhere }, buWhere],
    };
    if (otherOrganizationIds.length === 0) return ownOrganizationWhere;

    return {
      OR: [
        ownOrganizationWhere,
        {
          organizationId: { in: otherOrganizationIds },
          ...roleWhere,
        },
      ],
    };
  }

  private async resolveAssignee(
    organizationIds: number | number[],
    employeeId?: number | null,
    assignedToUserId?: number | null,
  ): Promise<
    Prisma.UserGetPayload<{
      select: {
        id: true;
        name: true;
        employeeId: true;
        role: true;
        managerId: true;
      };
    }>
  > {
    const allowedOrganizationIds = Array.isArray(organizationIds)
      ? organizationIds
      : [organizationIds];
    if (assignedToUserId) {
      const where = {
        id: assignedToUserId,
        organizationId:
          allowedOrganizationIds.length === 1
            ? allowedOrganizationIds[0]
            : { in: allowedOrganizationIds },
      };
      const assigneeUser =
        allowedOrganizationIds.length === 1
          ? await this.db.user.findUnique({ where })
          : await this.db.user.findFirst({ where });
      if (!assigneeUser) throw new NotFoundException('Assigned user not found');
      return assigneeUser;
    }

    if (employeeId) {
      const where = {
        employeeId,
        organizationId:
          allowedOrganizationIds.length === 1
            ? allowedOrganizationIds[0]
            : { in: allowedOrganizationIds },
      };
      const assigneeUser =
        allowedOrganizationIds.length === 1
          ? await this.db.user.findUnique({ where })
          : await this.db.user.findFirst({ where });
      if (!assigneeUser)
        throw new NotFoundException(
          'No user account found for selected employee',
        );
      return assigneeUser;
    }

    throw new ForbiddenException('Task must be assigned to a user');
  }

  private async validateParentTask(
    parentTaskId: number | null | undefined,
    organizationId: number,
    projectId: number | null,
    taskId?: number,
  ) {
    if (parentTaskId == null) return;
    if (taskId === parentTaskId) {
      throw new BadRequestException('A task cannot be its own parent');
    }

    const parent = await this.db.task.findFirst({
      where: { id: parentTaskId, organizationId, deletedAt: null },
      select: { id: true, projectId: true, parentTaskId: true },
    });
    if (!parent) throw new NotFoundException('Parent task not found');
    if (parent.projectId !== projectId) {
      throw new BadRequestException(
        'Parent and child tasks must belong to the same project',
      );
    }

    const visited = new Set<number>();
    let ancestorId = parent.parentTaskId;
    while (ancestorId != null) {
      if (ancestorId === taskId) {
        throw new BadRequestException('Task hierarchy cannot contain a cycle');
      }
      if (visited.has(ancestorId)) break;
      visited.add(ancestorId);
      const ancestor = await this.db.task.findFirst({
        where: { id: ancestorId, organizationId, deletedAt: null },
        select: { parentTaskId: true },
      });
      ancestorId = ancestor?.parentTaskId ?? null;
    }
  }

  private assertManagerAssigneePolicy(
    user: AuthUser,
    assignee: {
      id: number;
      employeeId: number | null;
      role: string;
      managerId: number | null;
    },
    project: { assignedEmployees: { id: number }[] } | null,
    taskType: string,
    shootCrewUserIds: number[] = [],
  ) {
    if (user.role !== Role.MANAGER) return;

    const isSelf = assignee.id === user.userId;
    const isProjectMember = Boolean(
      project?.assignedEmployees?.some(
        (employee) => employee.id === assignee.employeeId,
      ),
    );
    const isShootCrew =
      taskType === 'SHOOT' && shootCrewUserIds.includes(assignee.id);
    const isProjectlessDirectReport =
      !project && assignee.managerId === user.userId;
    const isAllowed =
      isSelf ||
      isShootCrew ||
      (String(assignee.role) === String(Role.EMPLOYEE) &&
        (project ? isProjectMember : isProjectlessDirectReport));

    if (!isAllowed) {
      throw new ForbiddenException(
        'Managers can assign project tasks only to project members and projectless tasks only to their employees',
      );
    }
  }

  private ensureTransitionAllowed(from: string, to: string, role: Role) {
    if (!canTransition(from, to, role)) {
      try {
        validateTransition(from, to, role);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Invalid task transition';
        throw new ForbiddenException(msg);
      }
    }
  }

  private async resolveShootCrew(
    userIds: number[],
    allowedOrganizationIds: number[],
    actor: AuthUser,
  ) {
    if (!userIds.length) return [];
    if (
      actor.role !== Role.ADMIN &&
      actor.role !== Role.HR &&
      actor.role !== Role.SUPER_ADMIN &&
      actor.role !== Role.MANAGER
    ) {
      throw new ForbiddenException('You cannot assign a shoot crew');
    }

    const users = await this.db.user.findMany({
      where: {
        id: { in: userIds },
        organizationId: { in: allowedOrganizationIds },
        isActive: true,
        role: { in: SHOOT_ASSIGNABLE_ROLES },
      },
      select: {
        id: true,
        role: true,
        managerId: true,
        employeeId: true,
        organizationId: true,
      },
    });
    if (users.length !== userIds.length) {
      throw new ForbiddenException(
        'Every shoot crew member must be active and within your organization scope',
      );
    }
    if (
      actor.role === Role.MANAGER &&
      users.some(
        (member) =>
          member.role !== Role.EMPLOYEE || member.managerId !== actor.userId,
      )
    ) {
      throw new ForbiddenException(
        'Managers can assign shoots only to their employees',
      );
    }
    return users;
  }

  private shootDay(shootDate: Date) {
    return new Date(
      Date.UTC(
        shootDate.getUTCFullYear(),
        shootDate.getUTCMonth(),
        shootDate.getUTCDate(),
      ),
    );
  }

  private dateKeyInTimezone(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  }

  private async syncShootAttendance(employeeIds: number[], shootDate: Date) {
    const date = this.shootDay(shootDate);
    for (const employeeId of new Set(employeeIds)) {
      const employee = await this.db.employee.findUnique({
        where: { id: employeeId },
        select: {
          organizationId: true,
          shiftId: true,
          organization: { select: { timezone: true } },
        },
      });
      if (!employee) continue;
      const dueDateKey = date.toISOString().slice(0, 10);
      const shootDateIsDue =
        dueDateKey <=
        this.dateKeyInTimezone(
          new Date(),
          employee.organization?.timezone ?? 'UTC',
        );
      const assignedToAnotherShoot = await this.db.taskCrewAssignment.findFirst(
        {
          where: {
            user: { employeeId },
            task: {
              taskType: 'SHOOT',
              shootDate: date,
              deletedAt: null,
            },
          },
          select: { id: true },
        },
      );
      let attendance = await this.db.attendance.findUnique({
        where: { employeeId_date: { employeeId, date } },
      });
      if (assignedToAnotherShoot) {
        if (!attendance) {
          attendance = await this.db.attendance.upsert({
            where: { employeeId_date: { employeeId, date } },
            create: {
              employeeId,
              organizationId: employee.organizationId,
              shiftId: employee.shiftId,
              date,
              status: shootDateIsDue ? 'PRESENT' : 'UPCOMING',
              isShootDay: true,
              remarks: 'Shoot day credit',
            },
            update: {},
          });
        }
        if (
          attendance.status !== 'LEAVE' &&
          attendance.status !== 'HOLIDAY' &&
          attendance.status !== 'WEEKLY_OFF'
        ) {
          const shouldCountAsPresent =
            shootDateIsDue &&
            ['ABSENT', 'UPCOMING', 'NOT_STARTED', 'NOT_SCHEDULED'].includes(
              attendance.status,
            );
          const shouldScheduleAsUpcoming =
            !shootDateIsDue &&
            ['ABSENT', 'NOT_STARTED', 'NOT_SCHEDULED'].includes(
              attendance.status,
            );
          if (
            shouldCountAsPresent ||
            shouldScheduleAsUpcoming ||
            !attendance.isShootDay
          ) {
            await this.db.attendance.update({
              where: { id: attendance.id },
              data: {
                status: shouldCountAsPresent
                  ? 'PRESENT'
                  : shouldScheduleAsUpcoming
                    ? 'UPCOMING'
                    : attendance.status,
                isShootDay: true,
                remarks: attendance.remarks ?? 'Shoot day credit',
              },
            });
          }
        }
      } else if (attendance?.isShootDay) {
        const hasPunches = attendance.checkIn || attendance.checkOut;
        await this.db.attendance.update({
          where: { id: attendance.id },
          data: {
            isShootDay: false,
            ...(!hasPunches &&
              attendance.status === 'PRESENT' && {
                status: 'ABSENT',
                remarks: null,
              }),
          },
        });
      }
    }
  }

  private assertShootCompletionAllowed(
    task: {
      taskType: string;
      assignedToUserId: number | null;
      shootCrew?: { userId: number }[];
    },
    status: string,
    user: AuthUser,
  ) {
    if (status !== 'COMPLETED') return;
    if (task.taskType !== 'SHOOT') {
      throw new BadRequestException(
        'Only shoot tasks can be completed this way',
      );
    }
    if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only an assigned admin or super admin can complete a shoot',
      );
    }
    if (
      task.assignedToUserId !== user.userId &&
      !task.shootCrew?.some((member) => member.userId === user.userId)
    ) {
      throw new ForbiddenException(
        'Only an assigned admin or super admin can complete a shoot',
      );
    }
  }

  async create(dto: CreateTaskDto, user: AuthUser) {
    if (!this.transaction && dto.status === 'SUBMITTED') {
      return this.inTaskTransaction(null, (service) =>
        service.create(dto, user),
      );
    }
    const organizationId = this.validateOrganization(user);
    if (
      dto.status === 'APPROVED' ||
      dto.status === 'REJECTED' ||
      dto.status === 'COMPLETED'
    ) {
      throw new ForbiddenException(
        'Tasks cannot be created in a reviewed status',
      );
    }
    const resolvedTaskName = dto.taskName?.trim() || dto.title?.trim();
    if (!resolvedTaskName) {
      throw new ForbiddenException('Task title is required');
    }

    const callerScope = await this.businessUnitsService.resolveScope(
      user as any,
    );
    const employeeBUWhere =
      this.businessUnitsService.buildEmployeeBUWhere(callerScope);
    const relatedOrganizationIds =
      await this.organizationScopeService?.getRelatedOrganizationIds(
        user.homeOrganizationId ?? organizationId,
      );
    const projectOrganizationIds = relatedOrganizationIds?.length
      ? relatedOrganizationIds
      : [organizationId];

    const projectWhere = {
      id: dto.projectId!,
      organizationId:
        projectOrganizationIds.length === 1
          ? projectOrganizationIds[0]
          : { in: projectOrganizationIds },
    };
    const project = dto.projectId
      ? projectOrganizationIds.length === 1
        ? await this.db.project.findUnique({
            where: projectWhere,
            select: {
              id: true,
              organizationId: true,
              projectName: true,
              businessUnitId: true,
              managerId: true,
              coManagers: { select: { id: true } },
              assignedEmployees: { select: { id: true } },
            },
          })
        : await this.db.project.findFirst({
            where: projectWhere,
            select: {
              id: true,
              organizationId: true,
              projectName: true,
              businessUnitId: true,
              managerId: true,
              coManagers: { select: { id: true } },
              assignedEmployees: { select: { id: true } },
            },
          })
      : null;
    if (dto.projectId && !project) {
      throw new NotFoundException('Project not found');
    }

    await this.validateParentTask(
      dto.parentTaskId,
      organizationId,
      project?.id ?? null,
    );

    if (dto.milestoneId != null || dto.taskListId != null) {
      const planningRecords = await Promise.all([
        dto.milestoneId == null ? null : this.db.projectMilestone.findFirst({ where: { id: dto.milestoneId, projectId: project?.id ?? undefined, organizationId }, select: { id: true } }),
        dto.taskListId == null ? null : this.db.taskList.findFirst({ where: { id: dto.taskListId, projectId: project?.id ?? undefined, organizationId }, select: { id: true } }),
      ]);
      if (dto.milestoneId != null && !planningRecords[0]) throw new NotFoundException('Milestone not found for task project');
      if (dto.taskListId != null && !planningRecords[1]) throw new NotFoundException('Task list not found for task project');
    }

    if (
      user.role === Role.MANAGER &&
      project &&
      project.managerId !== user.userId &&
      !(project.coManagers ?? []).some((manager) => manager.id === user.userId)
    ) {
      throw new ForbiddenException(
        'Managers can create tasks only for projects they manage',
      );
    }

    if (
      project?.businessUnitId != null &&
      project.organizationId === organizationId
    ) {
      await this.businessUnitsService.assertRecordAccessible(
        callerScope,
        project.businessUnitId,
        'project business unit',
      );
    }

    if (user.role === Role.EMPLOYEE) {
      if (
        (dto.assignedToUserId != null &&
          dto.assignedToUserId !== user.userId) ||
        (dto.employeeId != null && dto.employeeId !== user.employeeId)
      ) {
        throw new ForbiddenException(
          'Employees can only create tasks assigned to themselves',
        );
      }
      if (!project) {
        throw new ForbiddenException(
          'Employees can create tasks only in projects they belong to',
        );
      }
      if (
        user.employeeId == null ||
        !project.assignedEmployees.some(
          (employee) => employee.id === user.employeeId,
        )
      ) {
        throw new ForbiddenException(
          'You must be an assigned project member before creating tasks',
        );
      }
    }

    const assignableOrganizationIds = projectOrganizationIds;
    const taskType = dto.taskType ?? 'GENERAL';
    if (
      taskType === 'SHOOT' &&
      (!dto.shootClientName?.trim() ||
        !dto.shootLocation?.trim() ||
        !dto.shootDate ||
        !dto.shootReportingTime?.trim() ||
        dto.shootEstimatedHours == null ||
        dto.shootEstimatedHours <= 0 ||
        !dto.shootCrewUserIds?.length)
    ) {
      throw new BadRequestException(
        'Shoot tasks require client, location, date, reporting time, estimated duration, and at least one crew member',
      );
    }
    if (taskType === 'GENERAL' && dto.shootCrewUserIds?.length) {
      throw new BadRequestException(
        'Crew members can only be assigned to shoot tasks',
      );
    }
    const shootCrew =
      taskType === 'SHOOT'
        ? await this.resolveShootCrew(
            dto.shootCrewUserIds ?? [],
            assignableOrganizationIds,
            user,
          )
        : [];
    const assignee =
      dto.assignedToUserId || dto.employeeId
        ? await this.resolveAssignee(
            assignableOrganizationIds,
            dto.employeeId ?? null,
            dto.assignedToUserId ?? null,
          )
        : await this.db.user.findUniqueOrThrow({
            where: { id: user.userId },
            select: {
              id: true,
              name: true,
              employeeId: true,
              role: true,
              managerId: true,
            },
          });

    this.assertManagerAssigneePolicy(
      user,
      assignee,
      project,
      taskType,
      shootCrew.map(({ id }) => id),
    );

    let assigneeEmployeeBU: number | null = null;
    if (assignee.employeeId) {
      const employeeWhere =
        assignableOrganizationIds.length > 1
          ? {
              id: assignee.employeeId,
              organizationId: { in: assignableOrganizationIds },
              deletedAt: null,
            }
          : { id: assignee.employeeId, ...employeeBUWhere };
      const employee = await this.db.employee.findFirst({
        where: employeeWhere,
        select: { id: true, businessUnitId: true },
      });
      if (!employee) {
        throw new ForbiddenException(
          'Assigned employee is not within authorized Business Unit scope',
        );
      }
      assigneeEmployeeBU = employee.businessUnitId ?? null;
    }

    const taskBusinessUnitId = project?.businessUnitId ?? assigneeEmployeeBU;
    if (
      taskBusinessUnitId != null &&
      (!project || project.organizationId === organizationId)
    ) {
      await this.businessUnitsService.assertRecordAccessible(
        callerScope,
        taskBusinessUnitId,
        'task business unit',
      );
    }

    const createdTask = await this.db.task.create({
      data: {
        organizationId: project?.organizationId ?? organizationId,
        businessUnitId: taskBusinessUnitId,
        taskType,
        ...(taskType === 'SHOOT' && {
          shootClientName: dto.shootClientName?.trim(),
          shootLocation: dto.shootLocation?.trim(),
          shootDate: this.shootDay(new Date(dto.shootDate!)),
          shootReportingTime: dto.shootReportingTime?.trim(),
          shootEstimatedHours: dto.shootEstimatedHours,
          shootCrew: {
            create: shootCrew.map(({ id }) => ({ userId: id })),
          },
        }),
        taskName: resolvedTaskName,
        project: dto.project ?? project?.projectName,
        projectId: project?.id,
        parentTaskId: dto.parentTaskId ?? null,
        milestoneId: dto.milestoneId ?? null,
        taskListId: dto.taskListId ?? null,
        description: dto.description ?? dto.notes,
        category: dto.category,
        links: dto.links,
        driveLink: dto.driveLink,
        assignee: dto.assignee ?? assignee.name,
        assignedToId: assignee.employeeId ?? undefined,
        assignedToUserId: assignee.id,
        assignedByUserId: user.userId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        completionPercent: dto.completionPercent ?? 0,
        priority: dto.priority,
        status:
          dto.status === 'SUBMITTED'
            ? 'IN_PROGRESS'
            : this.normalizeTaskStatus(dto.status),
        estimatedHours: dto.estimatedHours,
        actualHours: dto.actualHours,
        submissionLink: dto.submissionLink,
        reviewComment: dto.reviewComment,
        leadId: dto.leadId,
        dealId: dto.dealId,
      },
      include: {
        shootCrew: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });
    if (taskType === 'SHOOT' && dto.shootDate) {
      await this.syncShootAttendance(
        shootCrew.flatMap((member) =>
          member.employeeId == null ? [] : [member.employeeId],
        ),
        new Date(dto.shootDate),
      );
    }
    if (dto.status === 'SUBMITTED') {
      await this.submitWork(
        createdTask.id,
        { submissionLink: dto.submissionLink ?? '', note: '' },
        user,
        false,
      );
      return { ...createdTask, status: 'SUBMITTED' };
    }
    return createdTask;
  }

  private async assertTaskMessageAccess(taskId: number, user: AuthUser) {
    const accessWhere = await this.getScopedWhere(user);
    const task = await this.db.task.findFirst({
      where: { id: taskId, ...accessWhere },
      select: { id: true, organizationId: true },
    });
    if (!task) {
      throw new ForbiddenException(
        'You can only access messages for allowed tasks',
      );
    }
    return task.organizationId;
  }

  async getMessages(taskId: number, user: AuthUser) {
    const organizationId = await this.assertTaskMessageAccess(taskId, user);
    return this.db.taskMessage.findMany({
      where: { taskId, organizationId },
      include: { sender: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(taskId: number, dto: CreateTaskMessageDto, user: AuthUser) {
    const organizationId = await this.assertTaskMessageAccess(taskId, user);
    return this.db.taskMessage.create({
      data: {
        taskId,
        organizationId,
        senderId: user.userId,
        content: dto.content.trim(),
      },
      include: { sender: { select: { id: true, name: true, email: true } } },
    });
  }

  private async assertTaskTimerAccess(taskId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const accessWhere =
      typeof this.businessUnitsService.resolveScope === 'function'
        ? await this.getScopedWhere(user)
        : { organizationId };
    const task = await this.db.task.findFirst({
      where: { id: taskId, ...accessWhere, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        taskName: true,
        project: true,
        projectId: true,
        estimatedHours: true,
        assignedToUserId: true,
        assignedByUserId: true,
        assignedToId: true,
        projectRef: {
          select: {
            managerId: true,
            coManagers: { where: { organizationId }, select: { id: true } },
            assignedEmployees: {
              where: { organizationId },
              select: { id: true },
            },
          },
        },
      },
    });
    if (!task) throw new NotFoundException(`Task #${taskId} not found`);

    const canManage = await this.canManageTask(taskId, user);
    const isDirectlyAssigned =
      task.assignedToUserId === user.userId ||
      task.assignedByUserId === user.userId;
    const isManagerOnProject =
      user.role === Role.MANAGER &&
      (task.projectRef?.managerId === user.userId ||
        task.projectRef?.coManagers.some(
          (manager) => manager.id === user.userId,
        ));
    const isEmployeeOnProject =
      user.role === Role.EMPLOYEE &&
      user.employeeId != null &&
      (task.assignedToId === user.employeeId ||
        task.projectRef?.assignedEmployees.some(
          (employee) => employee.id === user.employeeId,
        ));
    if (
      !canManage &&
      !isDirectlyAssigned &&
      !isManagerOnProject &&
      !isEmployeeOnProject
    ) {
      throw new ForbiddenException('You cannot track time for this task');
    }
    return task;
  }

  private async findTaskWithTimerSessions(
    taskId: number,
    organizationId: number,
  ) {
    return this.db.task.findFirstOrThrow({
      where: { id: taskId, organizationId },
      include: {
        organization: { select: { id: true, name: true } },
        timerSessions: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async updateTimer(taskId: number, dto: UpdateTaskTimerDto, user: AuthUser) {
    const task = await this.assertTaskTimerAccess(taskId, user);
    const organizationId = task.organizationId;
    const userId = user.userId;
    const now = new Date();
    const session = await this.db.taskTimerSession.findFirst({
      where: {
        taskId,
        userId,
        organizationId,
        status: { in: ['RUNNING', 'PAUSED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session && dto.action === 'stop') {
      return this.findTaskWithTimerSessions(taskId, organizationId);
    }

    if (dto.action === 'start') {
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.lockTimerAndAttendanceStateForUser(user, tx);
          const activeSession = await tx.taskTimerSession.findFirst({
            where: {
              taskId,
              userId,
              organizationId,
              status: { in: ['RUNNING', 'PAUSED'] },
            },
          });
          if (activeSession) {
            throw new ConflictException(
              'You already have an active timer for this task',
            );
          }
          await this.assertUserIsWorking(user, tx);
          await this.stopAllOpenTimersForUser(user, now, tx);
          await tx.taskTimerSession.create({
            data: {
              taskId,
              userId,
              organizationId,
              status: 'RUNNING',
              durationSeconds: 0,
              remainingSeconds: 0,
              startedAt: now,
            },
          });
        });
      } catch (error) {
        if (this.isTimerUniquenessConflict(error)) {
          throw new ConflictException('You already have an active task timer');
        }
        throw error;
      }
      await this.cacheManager.del(DASHBOARD_CACHE_KEY);
      return this.findTaskWithTimerSessions(taskId, organizationId);
    }

    if (!session) {
      throw new BadRequestException(
        'You do not have an active timer for this task',
      );
    }

    if (dto.action === 'pause') {
      if (session.status !== 'RUNNING' || !session.startedAt) {
        throw new BadRequestException('Only a running timer can be paused');
      }
      const startedAt = session.startedAt;
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now.getTime() - startedAt.getTime()) / 1000),
      );
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.taskTimerSession.updateMany({
          where: {
            id: session.id,
            status: 'RUNNING',
            startedAt,
          },
          data: {
            status: 'PAUSED',
            startedAt: null,
            totalSeconds: session.totalSeconds + elapsedSeconds,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException('Timer changed; refresh and try again');
        }
        if (elapsedSeconds > 0) {
          await tx.taskTimerInterval.create({
            data: {
              timerSessionId: session.id,
              startedAt,
              endedAt: new Date(startedAt.getTime() + elapsedSeconds * 1000),
            },
          });
        }
      });
      return this.findTaskWithTimerSessions(taskId, organizationId);
    }

    if (dto.action === 'resume') {
      if (session.status !== 'PAUSED') {
        throw new BadRequestException('Only a paused timer can be resumed');
      }
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.lockTimerAndAttendanceStateForUser(user, tx);
          await this.assertUserIsWorking(user, tx);
          const otherRunningTimer = await tx.taskTimerSession.findFirst({
            where: { userId, status: 'RUNNING', id: { not: session.id } },
            include: { task: { select: { taskName: true } } },
          });
          if (otherRunningTimer) {
            throw new ConflictException(
              `Your timer is already running for task: ${otherRunningTimer.task.taskName}`,
            );
          }
          const updated = await tx.taskTimerSession.updateMany({
            where: { id: session.id, status: 'PAUSED' },
            data: { status: 'RUNNING', startedAt: now },
          });
          if (updated.count !== 1) {
            throw new ConflictException('Timer changed; refresh and try again');
          }
        });
      } catch (error) {
        if (this.isTimerUniquenessConflict(error)) {
          throw new ConflictException('You already have an active task timer');
        }
        throw error;
      }
      return this.findTaskWithTimerSessions(taskId, organizationId);
    }

    if (session.status !== 'RUNNING' && session.status !== 'PAUSED') {
      throw new BadRequestException('There is no active timer to stop');
    }
    await this.finishTaskTimerSession(
      session,
      task,
      user.userId,
      now,
      dto.notes,
    );
    return this.findTaskWithTimerSessions(taskId, organizationId);
  }

  async pauseActiveTimerForUser(
    user: AuthUser,
    now = new Date(),
    transaction?: Prisma.TransactionClient,
  ) {
    this.validateOrganization(user);
    const db = transaction ?? this.db;
    const session = await db.taskTimerSession.findFirst({
      where: {
        userId: user.userId,
        status: 'RUNNING',
      },
      include: { task: true },
    });
    if (!session) return null;

    const elapsedSeconds = session.startedAt
      ? Math.max(
          0,
          Math.floor((now.getTime() - session.startedAt.getTime()) / 1000),
        )
      : 0;
    const pause = async (tx: Prisma.TransactionClient) => {
      const updated = await tx.taskTimerSession.updateMany({
        where: {
          id: session.id,
          status: 'RUNNING',
          startedAt: session.startedAt,
        },
        data: {
          status: 'PAUSED',
          startedAt: null,
          totalSeconds: session.totalSeconds + elapsedSeconds,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Timer changed; refresh and try again');
      }
      if (session.startedAt && elapsedSeconds > 0) {
        await tx.taskTimerInterval.create({
          data: {
            timerSessionId: session.id,
            startedAt: session.startedAt,
            endedAt: new Date(
              session.startedAt.getTime() + elapsedSeconds * 1000,
            ),
          },
        });
      }
    };
    if (transaction) await pause(transaction);
    else await this.prisma.$transaction(pause);
    return session.id;
  }

  async stopActiveTimerForUser(
    user: Pick<AuthUser, 'userId' | 'organizationId'>,
    now = new Date(),
  ) {
    if (user.organizationId == null) {
      throw new ForbiddenException('User has no associated organization');
    }
    return this.stopActiveTimerForUserId(user.userId, user.organizationId, now);
  }

  async stopAllOpenTimersForUser(
    user: Pick<AuthUser, 'userId' | 'organizationId'>,
    now = new Date(),
    transaction?: Prisma.TransactionClient,
  ) {
    if (user.organizationId == null) {
      throw new ForbiddenException('User has no associated organization');
    }
    const db = transaction ?? this.db;
    const sessions = await db.taskTimerSession.findMany({
      where: {
        userId: user.userId,
        status: { in: ['RUNNING', 'PAUSED'] },
      },
      include: { task: true },
      orderBy: { createdAt: 'desc' },
    });

    for (const session of sessions) {
      await this.finishTaskTimerSession(
        session,
        session.task,
        user.userId,
        now,
        undefined,
        transaction,
      );
    }

    return sessions.map((session) => session.id);
  }

  async stopRunningTimersForUser(
    user: Pick<AuthUser, 'userId' | 'organizationId'>,
    now: Date,
    transaction: Prisma.TransactionClient,
  ) {
    if (user.organizationId == null) {
      throw new ForbiddenException('User has no associated organization');
    }
    const sessions = await transaction.taskTimerSession.findMany({
      where: {
        userId: user.userId,
        status: 'RUNNING',
      },
      include: { task: true },
      orderBy: { createdAt: 'desc' },
    });

    for (const session of sessions) {
      await this.finishTaskTimerSession(
        session,
        session.task,
        user.userId,
        now,
        undefined,
        transaction,
      );
    }

    return sessions.map((session) => session.id);
  }

  async lockTimerAndAttendanceStateForUser(
    user: Pick<AuthUser, 'userId' | 'organizationId'>,
    transaction: Prisma.TransactionClient,
  ) {
    if (user.organizationId == null) {
      throw new ForbiddenException('User has no associated organization');
    }
    await transaction.$queryRaw<Array<{ locked: number }>>`
      WITH lock_result AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(
          137701::integer,
          ${user.userId}::integer
        )
      )
      SELECT 1 AS locked
      FROM lock_result
    `;
  }

  async stopActiveTimerForEmployee(
    employeeId: number,
    organizationId: number,
    now = new Date(),
    transaction?: Prisma.TransactionClient,
  ) {
    const db = transaction ?? this.db;
    const user = await db.user.findFirst({
      where: { employeeId, employee: { organizationId } },
      select: { id: true },
    });
    if (!user) return null;
    return this.stopActiveTimerForUserId(
      user.id,
      organizationId,
      now,
      transaction,
    );
  }

  private async stopActiveTimerForUserId(
    userId: number,
    organizationId: number,
    now: Date,
    transaction?: Prisma.TransactionClient,
  ) {
    const db = transaction ?? this.db;
    const session = await db.taskTimerSession.findFirst({
      where: {
        userId,
        status: { in: ['RUNNING', 'PAUSED'] },
      },
      include: { task: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) return null;
    await this.finishTaskTimerSession(
      session,
      session.task,
      userId,
      now,
      undefined,
      transaction,
    );
    return session.id;
  }

  private async assertUserIsWorking(
    user: AuthUser,
    transaction?: Prisma.TransactionClient,
  ) {
    const db = transaction ?? this.db;
    if (user.employeeId == null) {
      throw new ForbiddenException(
        'Link your account to an employee to track work time',
      );
    }
    const employee = await db.employee.findFirst({
      where: {
        id: user.employeeId,
        user: { id: user.userId },
        deletedAt: null,
      },
      select: {
        organizationId: true,
        shift: { select: { type: true } },
      },
    });
    if (!employee) {
      throw new ForbiddenException(
        'Link your account to an active employee to track work time',
      );
    }
    const employeeOrganizationId = employee.organizationId;
    const activeSession = await db.attendanceSession.findFirst({
      where: {
        employeeId: user.employeeId,
        organizationId: employeeOrganizationId,
        endedAt: null,
      },
      include: { breaks: true },
    });
    if (activeSession?.breaks.some((item) => !item.endedAt)) {
      throw new BadRequestException(
        'End your break before starting or resuming a task timer',
      );
    }
    const openAttendance = await db.attendance.findFirst({
      where: {
        employeeId: user.employeeId,
        organizationId: employeeOrganizationId,
        checkIn: { not: null },
        checkOut: null,
      },
      include: { breaks: true, shift: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    if (activeSession) {
      if (openAttendance?.breaks.some((item) => !item.endedAt)) {
        throw new BadRequestException(
          'End your break before starting or resuming a task timer',
        );
      }
      return;
    }
    const flexibleAttendance =
      employee?.shift?.type === 'FLEXIBLE' ||
      openAttendance?.shift?.type === 'FLEXIBLE';
    if (flexibleAttendance) {
      if (!openAttendance) {
        throw new BadRequestException(
          'Check in and end any break before starting a task timer',
        );
      }
      if (openAttendance.breaks.some((item) => !item.endedAt)) {
        throw new BadRequestException(
          'End your break before starting or resuming a task timer',
        );
      }
      return;
    }

    if (
      !openAttendance ||
      openAttendance.breaks.some((item) => !item.endedAt)
    ) {
      throw new BadRequestException(
        'Check in and end any break before starting a task timer',
      );
    }
  }

  private async finishTaskTimerSession(
    session: {
      id: number;
      status: string;
      startedAt: Date | null;
      durationSeconds: number;
      remainingSeconds: number;
      totalSeconds: number;
      createdAt: Date;
      task?: {
        id: number;
        organizationId: number;
        taskName: string;
        project: string | null;
        projectId: number | null;
      };
    },
    task: {
      id: number;
      organizationId: number;
      taskName: string;
      project: string | null;
      projectId: number | null;
    },
    userId: number,
    now: Date,
    notes?: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const elapsedSeconds =
      session.status === 'RUNNING' && session.startedAt
        ? Math.max(
            0,
            Math.floor((now.getTime() - session.startedAt.getTime()) / 1000),
          )
        : 0;
    const totalSeconds = session.totalSeconds + elapsedSeconds;
    const finish = async (tx: Prisma.TransactionClient) => {
      const updated = await tx.taskTimerSession.updateMany({
        where: {
          id: session.id,
          status: session.status,
          startedAt: session.startedAt,
        },
        data: {
          status: 'STOPPED',
          remainingSeconds: 0,
          startedAt: null,
          totalSeconds,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Timer changed; refresh and try again');
      }
      if (
        session.status === 'RUNNING' &&
        session.startedAt &&
        elapsedSeconds > 0
      ) {
        await tx.taskTimerInterval.create({
          data: {
            timerSessionId: session.id,
            startedAt: session.startedAt,
            endedAt: new Date(
              session.startedAt.getTime() + elapsedSeconds * 1000,
            ),
          },
        });
      }
      if (totalSeconds > 0) {
        const timesheetOwner = await tx.user.findFirst({
          where: { id: userId },
          select: {
            employeeId: true,
            employee: {
              select: {
                organizationId: true,
                organization: { select: { timezone: true } },
              },
            },
          },
        });
        if (timesheetOwner?.employeeId == null || !timesheetOwner.employee) {
          throw new BadRequestException(
            'Link your account to an employee before recording task time',
          );
        }
        await tx.timesheet.create({
          data: {
            organizationId: timesheetOwner.employee.organizationId,
            task: task.taskName,
            project: task.project,
            taskId: task.id,
            projectId: task.projectId,
            timerSessionId: session.id,
            date: session.createdAt,
            hours: totalSeconds / 3600,
            employeeId: timesheetOwner.employeeId,
            status: 'PENDING',
            source: 'TASK_TIMER',
            notes: notes?.trim() || 'Tracked with task timer',
            createdByUserId: userId,
          },
        });
        const timezone =
          timesheetOwner.employee.organization?.timezone ?? 'UTC';
        const intervals = await tx.taskTimerInterval.findMany({
          where: { timerSessionId: session.id },
          select: { startedAt: true, endedAt: true },
        });
        const affectedDateKeys = new Set<string>();
        for (const interval of intervals) {
          let cursor = interval.startedAt;
          while (cursor < interval.endedAt) {
            const dateKey = dateKeyInTimezone(cursor, timezone);
            affectedDateKeys.add(dateKey);
            const nextDay = localMidnightAfterDateInTimezone(dateKey, timezone);
            if (!nextDay || nextDay <= cursor) {
              throw new BadRequestException(
                'Unable to calculate task time in the employee organization timezone',
              );
            }
            cursor = new Date(
              Math.min(nextDay.getTime(), interval.endedAt.getTime()),
            );
          }
        }
        if (affectedDateKeys.size === 0) {
          affectedDateKeys.add(dateKeyInTimezone(session.createdAt, timezone));
        }
        for (const dateKey of [...affectedDateKeys].sort()) {
          const date = localMidnightAtDateInTimezone(dateKey, timezone);
          if (!date) {
            throw new BadRequestException(
              'Unable to calculate task time in the employee organization timezone',
            );
          }
          await this.attendanceTaskHours.recomputeTimesheetHours(
            timesheetOwner.employeeId,
            timesheetOwner.employee.organizationId,
            date,
            tx,
          );
        }
      }
    };
    if (transaction) return finish(transaction);
    return this.prisma.$transaction(finish);
  }

  private isTimerUniquenessConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  async update(id: number, dto: UpdateTaskDto, user: AuthUser) {
    if (!this.transaction)
      return this.inTaskTransaction(id, (service) =>
        service.update(id, dto, user),
      );
    const organizationId = this.validateOrganization(user);
    const canManage = await this.canManageTask(id, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only admin or project manager can update this task',
      );
    }

    const callerScope = await this.businessUnitsService.resolveScope(
      user as any,
    );
    const employeeBUWhere =
      this.businessUnitsService.buildEmployeeBUWhere(callerScope);

    const taskScope = await this.getScopedWhere(user);
    const existingTask = await this.db.task.findFirst({
      where: { id, ...taskScope },
      include: {
        shootCrew: { include: { user: { select: { employeeId: true } } } },
      },
    });
    if (!existingTask) throw new NotFoundException(`Task #${id} not found`);
    const existingShootCrew = existingTask.shootCrew ?? [];
    const nextTaskType = dto.taskType ?? existingTask.taskType ?? 'GENERAL';
    const nextShootDate =
      dto.shootDate !== undefined
        ? dto.shootDate
          ? this.shootDay(new Date(dto.shootDate))
          : null
        : existingTask.shootDate;
    const nextShootCrewIds =
      dto.shootCrewUserIds ??
      existingShootCrew.map((assignment) => assignment.userId);
    const nextShootEstimatedHours =
      dto.shootEstimatedHours ?? existingTask.shootEstimatedHours;
    if (
      nextTaskType === 'SHOOT' &&
      (!(dto.shootClientName ?? existingTask.shootClientName)?.trim() ||
        !(dto.shootLocation ?? existingTask.shootLocation)?.trim() ||
        !nextShootDate ||
        !(dto.shootReportingTime ?? existingTask.shootReportingTime)?.trim() ||
        nextShootEstimatedHours == null ||
        nextShootEstimatedHours <= 0 ||
        !nextShootCrewIds.length)
    ) {
      throw new BadRequestException(
        'Shoot tasks require client, location, date, reporting time, estimated duration, and at least one crew member',
      );
    }
    const actorOrganizationIds =
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      user.role === Role.SUPER_ADMIN
        ? ((await this.organizationScopeService?.getRelatedOrganizationIds(
            user.homeOrganizationId ?? organizationId,
          )) ?? [organizationId])
        : user.role === Role.MANAGER
          ? ((await this.organizationScopeService?.getRelatedOrganizationIds(
              user.homeOrganizationId ?? organizationId,
            )) ?? [organizationId])
          : [organizationId];
    const newShootCrew =
      nextTaskType === 'SHOOT' && dto.shootCrewUserIds !== undefined
        ? await this.resolveShootCrew(
            dto.shootCrewUserIds,
            actorOrganizationIds,
            user,
          )
        : null;
    const shootCrewUserIds = newShootCrew
      ? newShootCrew.map(({ id }) => id)
      : existingShootCrew.map(({ userId }) => userId);

    const targetProjectId =
      dto.projectId === undefined ? existingTask.projectId : dto.projectId;
    const assignmentProject = targetProjectId
      ? await this.db.project.findFirst({
          where: {
            id: targetProjectId,
            organizationId: existingTask.organizationId,
            deletedAt: null,
          },
          select: { assignedEmployees: { select: { id: true } } },
        })
      : null;

    let assigneeData: {
      assignedToUserId?: number;
      assignedToId?: number | null;
      assignedByUserId?: number;
      assignee?: string;
    } = {};
    if (dto.assignedToUserId || dto.employeeId) {
      const assignee = await this.resolveAssignee(
        actorOrganizationIds,
        dto.employeeId ?? null,
        dto.assignedToUserId ?? null,
      );
      this.assertManagerAssigneePolicy(
        user,
        assignee,
        assignmentProject,
        nextTaskType,
        shootCrewUserIds,
      );
      if (assignee.employeeId) {
        const employeeWhere =
          actorOrganizationIds.length > 1
            ? {
                id: assignee.employeeId,
                organizationId: { in: actorOrganizationIds },
                deletedAt: null,
              }
            : { id: assignee.employeeId, ...employeeBUWhere };
        const validEmp = await this.db.employee.findFirst({
          where: employeeWhere,
          select: { id: true },
        });
        if (!validEmp) {
          throw new ForbiddenException(
            'Reassigned employee is not within authorized Business Unit scope',
          );
        }
      }
      const newAssigneeData: {
        assignedToUserId?: number;
        assignedToId?: number | null;
        assignedByUserId?: number;
        assignee?: string;
      } = {
        assignedToUserId: Number(assignee.id),
        assignedToId:
          assignee.employeeId === undefined
            ? null
            : Number(assignee.employeeId),
        assignee: String(assignee.name),
      };
      if (Number(assignee.id) !== existingTask.assignedToUserId) {
        newAssigneeData.assignedByUserId = user.userId;
      }
      assigneeData = newAssigneeData;
    }

    let projectData: {
      projectId?: number | null;
      project?: string | null;
      businessUnitId?: number | null;
    } = {};
    if (
      user.role === Role.MANAGER &&
      targetProjectId !== existingTask.projectId &&
      existingTask.assignedToUserId != null
    ) {
      const currentAssignee = await this.resolveAssignee(
        actorOrganizationIds,
        existingTask.assignedToId,
        existingTask.assignedToUserId,
      );
      this.assertManagerAssigneePolicy(
        user,
        currentAssignee,
        assignmentProject,
        nextTaskType,
        shootCrewUserIds,
      );
    }
    if (dto.projectId !== undefined) {
      const project = dto.projectId
        ? await this.db.project.findUnique({
            where: {
              id: dto.projectId,
              organizationId: existingTask.organizationId,
              deletedAt: null,
            },
            select: {
              id: true,
              projectName: true,
              businessUnitId: true,
              managerId: true,
              coManagers: { select: { id: true } },
            },
          })
        : null;
      if (dto.projectId && !project)
        throw new NotFoundException(
          'Destination project must belong to the task organization',
        );
      if (targetProjectId !== existingTask.projectId) {
        const tracked = await this.db.taskTimerSession.findFirst({
          where: { taskId: id },
          select: { id: true },
        });
        const logged = await this.db.timesheet.findFirst({
          where: { taskId: id },
          select: { id: true },
        });
        const activeWorkflow = await this.db.workflowInstance.findFirst({
          where: {
            entityType: 'Task',
            entityId: id,
            organizationId: existingTask.organizationId,
            status: { notIn: ['REJECTED', 'COMPLETED', 'CANCELLED'] },
          },
          select: { id: true },
        });
        if (
          tracked ||
          logged ||
          activeWorkflow ||
          ['SUBMITTED', 'APPROVED', 'REJECTED'].includes(existingTask.status)
        ) {
          throw new ConflictException(
            'Tasks with tracked time or review history cannot be moved',
          );
        }
      }
      if (project) {
        if (
          user.role === Role.MANAGER &&
          project.managerId !== user.userId &&
          !project.coManagers.some((manager) => manager.id === user.userId)
        ) {
          throw new ForbiddenException(
            'Managers can only move tasks within their projects',
          );
        }
        if (project.businessUnitId != null) {
          await this.businessUnitsService.assertRecordAccessible(
            callerScope,
            project.businessUnitId,
            'project business unit',
          );
        }
        projectData = {
          projectId: project.id,
          project: project.projectName,
          businessUnitId: project.businessUnitId ?? existingTask.businessUnitId,
        };
      } else {
        projectData = {
          projectId: null,
          project: null,
          businessUnitId: existingTask.businessUnitId,
        };
      }
    }

    if (dto.status !== undefined) {
      const nextStatus = this.normalizeTaskStatus(dto.status);
      this.assertShootCompletionAllowed(existingTask, nextStatus, user);
      if (nextStatus !== 'COMPLETED') {
        this.ensureTransitionAllowed(
          existingTask.status,
          this.normalizeTaskStatus(dto.status),
          user.role,
        );
      }
    }

    if (dto.parentTaskId !== undefined) {
      await this.validateParentTask(
        dto.parentTaskId,
        existingTask.organizationId,
        projectData.projectId ?? existingTask.projectId ?? null,
        id,
      );
    }

    if (dto.milestoneId !== undefined || dto.taskListId !== undefined) {
      const projectId = projectData.projectId ?? existingTask.projectId ?? undefined;
      if (dto.milestoneId != null) {
        const milestone = await this.db.projectMilestone.findFirst({ where: { id: dto.milestoneId, projectId, organizationId: existingTask.organizationId }, select: { id: true } });
        if (!milestone) throw new NotFoundException('Milestone not found for task project');
      }
      if (dto.taskListId != null) {
        const taskList = await this.db.taskList.findFirst({ where: { id: dto.taskListId, projectId, organizationId: existingTask.organizationId }, select: { id: true } });
        if (!taskList) throw new NotFoundException('Task list not found for task project');
      }
    }

    const updated = await this.db.task.update({
      where: { id, organizationId: existingTask.organizationId },
      data: {
        ...((dto.taskName !== undefined || dto.title !== undefined) && {
          taskName: dto.taskName ?? dto.title,
        }),
        ...(dto.project !== undefined && { project: dto.project }),
        ...projectData,
        ...(dto.parentTaskId !== undefined && {
          parentTaskId: dto.parentTaskId,
        }),
        ...(dto.milestoneId !== undefined && { milestoneId: dto.milestoneId }),
        ...(dto.taskListId !== undefined && { taskListId: dto.taskListId }),
        ...(dto.assignee !== undefined && { assignee: dto.assignee }),
        ...(dto.driveLink !== undefined && { driveLink: dto.driveLink }),
        ...assigneeData,
        taskType: nextTaskType,
        ...(nextTaskType === 'SHOOT'
          ? {
              shootClientName:
                dto.shootClientName ?? existingTask.shootClientName,
              shootLocation: dto.shootLocation ?? existingTask.shootLocation,
              shootDate: nextShootDate,
              shootReportingTime:
                dto.shootReportingTime ?? existingTask.shootReportingTime,
              shootEstimatedHours: nextShootEstimatedHours,
              ...(newShootCrew && {
                shootCrew: {
                  deleteMany: {},
                  create: newShootCrew.map(({ id }) => ({ userId: id })),
                },
              }),
            }
          : {
              shootClientName: null,
              shootLocation: null,
              shootDate: null,
              shootReportingTime: null,
              shootEstimatedHours: null,
              shootCrew: { deleteMany: {} },
            }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.status !== undefined && {
          status: existingTask.status,
        }),
        ...(dto.estimatedHours !== undefined && {
          estimatedHours: dto.estimatedHours,
        }),
        ...(dto.actualHours !== undefined && { actualHours: dto.actualHours }),
        ...((dto.notes !== undefined || dto.description !== undefined) && {
          notes: dto.description ?? dto.notes,
        }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.links !== undefined && { links: dto.links }),
        ...(dto.submissionLink !== undefined && {
          submissionLink: dto.submissionLink,
        }),
        ...(dto.reviewComment !== undefined && {
          reviewComment: dto.reviewComment,
        }),
        ...(dto.leadId !== undefined && { leadId: dto.leadId }),
        ...(dto.dealId !== undefined && { dealId: dto.dealId }),
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.completionPercent !== undefined && {
          completionPercent: dto.completionPercent,
        }),
      },
      include: {
        projectRef: {
          select: { id: true, projectName: true, managerId: true },
        },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
        reviewedByUser: { select: { id: true, name: true, email: true } },
        shootCrew: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });
    const affectedShootEmployeeIds = [
      ...existingShootCrew.map((assignment) => assignment.user.employeeId),
      ...(newShootCrew ?? []).map((member) => member.employeeId),
    ].filter((employeeId): employeeId is number => employeeId != null);
    const affectedShootDates = new Set<string>();
    if (existingTask.shootDate) {
      affectedShootDates.add(
        this.shootDay(existingTask.shootDate).toISOString(),
      );
    }
    if (nextShootDate) {
      affectedShootDates.add(nextShootDate.toISOString());
    }
    for (const date of affectedShootDates) {
      await this.syncShootAttendance(affectedShootEmployeeIds, new Date(date));
    }
    if (
      dto.status !== undefined &&
      this.normalizeTaskStatus(dto.status) !==
        this.normalizeTaskStatus(existingTask.status)
    ) {
      return this.updateStatus(id, dto.status, user);
    }
    return updated;
  }

  async remove(id: number, user: AuthUser) {
    this.validateOrganization(user);
    const canManage = await this.canManageTask(id, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only admin or project manager can delete this task',
      );
    }
    const taskScope = await this.getScopedWhere(user);
    const existing = await this.db.task.findFirst({
      where: { id, ...taskScope },
      include: {
        shootCrew: { include: { user: { select: { employeeId: true } } } },
      },
    });
    if (!existing) throw new NotFoundException(`Task #${id} not found`);
    const removed = await this.db.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    if (existing.taskType === 'SHOOT' && existing.shootDate) {
      await this.syncShootAttendance(
        (existing.shootCrew ?? []).flatMap((assignment) =>
          assignment.user.employeeId == null
            ? []
            : [assignment.user.employeeId],
        ),
        existing.shootDate,
      );
    }
    return removed;
  }

  async importRecords(
    records: Record<string, unknown>[],
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    const organizationId = this.validateOrganization(user);
    const callerScope = await this.businessUnitsService.resolveScope(
      user as any,
    );
    const employeeBUWhere =
      this.businessUnitsService.buildEmployeeBUWhere(callerScope);

    const getString = (obj: Record<string, unknown>, key: string) => {
      const v = obj[key];
      return typeof v === 'string' ? v : undefined;
    };
    const getNumber = (obj: Record<string, unknown>, key: string) => {
      const v = obj[key];
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(v);
        return Number.isNaN(n) ? undefined : n;
      }
      return undefined;
    };

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const taskNameValue = getString(r, 'taskName') ?? getString(r, 'title');
      if (!taskNameValue) {
        errors.push(`Row ${i + 1}: 'taskName' (or 'title') is required`);
        continue;
      }

      try {
        const projectId = getNumber(r, 'projectId');
        const assignedToId = getNumber(r, 'assignedToId');
        const assignedToUserId = getNumber(r, 'assignedToUserId');

        let inferredBU: number | null = null;
        if (projectId) {
          const project = await this.db.project.findFirst({
            where: { id: projectId, organizationId },
            select: { id: true, businessUnitId: true },
          });
          if (project && project.businessUnitId != null) {
            inferredBU = project.businessUnitId;
          }
        }
        if (inferredBU == null && assignedToId) {
          const emp = await this.db.employee.findFirst({
            where: { id: assignedToId, ...employeeBUWhere },
            select: { id: true, businessUnitId: true },
          });
          if (emp) inferredBU = emp.businessUnitId ?? null;
          else {
            errors.push(
              `Row ${i + 1}: Assigned employee #${assignedToId} not in authorized BU scope`,
            );
            continue;
          }
        }
        if (inferredBU != null) {
          await this.businessUnitsService.assertRecordAccessible(
            callerScope,
            inferredBU,
            'imported task business unit',
          );
        }

        await this.db.task.create({
          data: {
            organizationId,
            businessUnitId: inferredBU,
            taskName: taskNameValue,
            project: getString(r, 'project'),
            projectId,
            assignee: getString(r, 'assignee'),
            assignedToId,
            assignedToUserId,
            dueDate: getString(r, 'dueDate')
              ? new Date(getString(r, 'dueDate')!)
              : undefined,
            priority: getString(r, 'priority'),
            status: this.normalizeTaskStatus(getString(r, 'status')),
            estimatedHours: getNumber(r, 'estimatedHours'),
            actualHours: getNumber(r, 'actualHours'),
            notes:
              getString(r, 'description') ?? getString(r, 'notes') ?? undefined,
            submissionLink: getString(r, 'submissionLink'),
            reviewComment: getString(r, 'reviewComment'),
            leadId: getNumber(r, 'leadId'),
            dealId: getNumber(r, 'dealId'),
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

  async getByPriority(user: AuthUser) {
    const accessWhere = await this.getTaskAccessWhere(user);
    const tasks = await this.db.task.findMany({
      where: accessWhere,
      orderBy: { createdAt: 'desc' },
    });
    const grouped: Record<string, typeof tasks> = {};

    for (const p of PRIORITIES) grouped[p] = [];
    for (const t of tasks) {
      const key = t.priority ?? 'Unknown';
      if (grouped[key]) grouped[key].push(t);
      else grouped[key] = [t];
    }

    return grouped;
  }

  async getUpcoming(user: AuthUser) {
    const where = await this.getScopedWhere(user);
    const now = new Date();
    return this.db.task.findMany({
      where: {
        ...where,
        dueDate: { gte: now },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });
  }

  async getByLead(leadId: number, user: AuthUser) {
    const where = await this.getScopedWhere(user);
    return this.db.task.findMany({
      where: {
        leadId,
        ...where,
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getByDeal(dealId: number, user: AuthUser) {
    const where = await this.getScopedWhere(user);
    return this.db.task.findMany({
      where: {
        dealId,
        ...where,
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async updateStatus(id: number, status: string, user: AuthUser) {
    if (!this.transaction)
      return this.inTaskTransaction(id, (service) =>
        service.updateStatus(id, status, user),
      );
    const taskScope = await this.getScopedWhere(user);
    const task = await this.db.task.findFirst({
      where: { id, ...taskScope },
      select: {
        id: true,
        organizationId: true,
        status: true,
        assignedToUserId: true,
        assignedToId: true,
        projectId: true,
        taskType: true,
        shootCrew: { select: { userId: true } },
      },
    });
    if (!task) {
      throw new NotFoundException(`Task #${id} not found`);
    }

    if (user.role === Role.EMPLOYEE) {
      const isAssignedToCurrentUser =
        task.assignedToUserId === user.userId ||
        (user.employeeId != null && task.assignedToId === user.employeeId);

      if (!isAssignedToCurrentUser) {
        throw new ForbiddenException(
          'Employees can only update their assigned tasks',
        );
      }
    } else {
      const canManage = await this.canManageTask(id, user);
      if (!canManage) {
        throw new ForbiddenException(
          'Only admin or project manager can update task status',
        );
      }
    }

    const normalizedStatus = this.normalizeTaskStatus(status);
    if (normalizedStatus === 'SUBMITTED')
      return this.submitWork(id, { submissionLink: '', note: '' }, user, false);
    if (normalizedStatus === 'APPROVED' || normalizedStatus === 'REJECTED') {
      if (task.status !== 'SUBMITTED') {
        this.ensureTransitionAllowed(task.status, normalizedStatus, user.role);
        await this.submitWork(
          id,
          { submissionLink: '', note: '' },
          user,
          false,
        );
      }
      return this.reviewTask(
        id,
        { status: normalizedStatus, decision: normalizedStatus },
        user,
      );
    }
    this.assertShootCompletionAllowed(task, normalizedStatus, user);
    if (normalizedStatus !== 'COMPLETED') {
      this.ensureTransitionAllowed(task.status, normalizedStatus, user.role);
    }

    return this.db.task.update({
      where: { id, organizationId: task.organizationId },
      data: {
        status: normalizedStatus,
      },
      include: {
        projectRef: {
          select: { id: true, projectName: true, managerId: true },
        },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
        reviewedByUser: { select: { id: true, name: true, email: true } },
        shootCrew: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });
  }

  async submitWork(
    id: number,
    dto: SubmitTaskWorkDto,
    user: AuthUser,
    requireAssignee = true,
  ) {
    if (!this.transaction)
      return this.inTaskTransaction(id, (service) =>
        service.submitWork(id, dto, user, requireAssignee),
      );
    if (
      !requireAssignee &&
      user.role !== Role.EMPLOYEE &&
      !(await this.canManageTask(id, user))
    ) {
      throw new ForbiddenException(
        'Only authorized managers can submit this task',
      );
    }
    const taskScope = await this.getScopedWhere(user);
    const task = await this.db.task.findFirst({
      where: {
        id,
        AND: [
          taskScope,
          ...(requireAssignee || user.role === Role.EMPLOYEE
            ? [
                {
                  OR: [
                    { assignedToUserId: user.userId },
                    ...(user.employeeId
                      ? [{ assignedToId: user.employeeId }]
                      : []),
                  ],
                },
              ]
            : []),
        ],
      },
      include: {
        projectRef: { select: { managerId: true } },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found for current employee');
    }

    const currentStatus = this.normalizeTaskStatus(task.status);
    if (currentStatus === 'SUBMITTED') {
      const existingWorkflow = await this.workflowEngine.getInstanceByEntity(
        'Task',
        id,
        task.organizationId,
      );
      if (
        existingWorkflow &&
        ['SUBMITTED', 'PENDING_APPROVAL'].includes(existingWorkflow.status)
      ) {
        return this.findOne(id, user);
      }
      throw new ConflictException(
        'Task submission has no active workflow; review its history before retrying',
      );
    }
    this.ensureTransitionAllowed(currentStatus, 'SUBMITTED', user.role);
    const taskOrganizationId = task.organizationId;

    const updated = (await this.db.task.update({
      where: { id, organizationId: taskOrganizationId },
      data: {
        submissionLink: dto.submissionLink || task.submissionLink,
        submissionNotes: dto.note || task.submissionNotes,
        status: 'SUBMITTED',
      },
      include: {
        projectRef: {
          select: { id: true, projectName: true, managerId: true },
        },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
        reviewedByUser: { select: { id: true, name: true, email: true } },
        shootCrew: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    })) as Prisma.TaskGetPayload<{
      include: {
        projectRef: true;
        assignedToUser: true;
        assignedByUser: true;
        reviewedByUser: true;
      };
    }>;

    await this.workflowEngine.submitWorkflow({
      definitionKey: 'task-review',
      entityType: 'Task',
      entityId: id,
      initiatedBy: user.userId,
      organizationId: taskOrganizationId,
      context: {
        projectId: task.projectId,
        taskId: id,
        submittedByUserId: user.userId,
      },
      metadata: {
        submissionLink: dto.submissionLink ?? null,
        note: dto.note ?? null,
      },
    });

    return updated;
  }

  async reviewTask(id: number, dto: ReviewTaskDto, user: AuthUser) {
    if (!this.transaction)
      return this.inTaskTransaction(id, (service) =>
        service.reviewTask(id, dto, user),
      );
    this.validateOrganization(user);

    const canManage = await this.canManageTask(id, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only admin or project manager can review submitted work',
      );
    }

    const taskScope = await this.getScopedWhere(user);
    const task = await this.db.task.findFirst({
      where: { id, ...taskScope },
    });
    if (!task) {
      throw new NotFoundException(`Task #${id} not found`);
    }
    const taskOrganizationId = task.organizationId;

    const currentStatus = this.normalizeTaskStatus(task.status);

    const nextStatus =
      (dto.status ?? dto.decision) === 'APPROVED' ? 'APPROVED' : 'REJECTED';

    if (currentStatus === 'APPROVED') {
      throw new BadRequestException('Task is already approved');
    }

    if (currentStatus === 'REJECTED') {
      throw new BadRequestException('Task is already rejected');
    }

    if (currentStatus !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted tasks can be reviewed');
    }

    const remarks: string | null =
      typeof dto.remarks === 'string'
        ? dto.remarks
        : typeof dto.comment === 'string'
          ? dto.comment
          : typeof task.reviewComment === 'string'
            ? task.reviewComment
            : null;
    this.ensureTransitionAllowed(currentStatus, nextStatus, user.role);

    const updated = (await this.db.task.update({
      where: { id, organizationId: taskOrganizationId },
      data: {
        status: nextStatus,
        reviewComment: remarks,
        reviewedAt: new Date(),
        reviewedBy: user.userId,
      },
      include: {
        projectRef: {
          select: { id: true, projectName: true, managerId: true },
        },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
        reviewedByUser: { select: { id: true, name: true, email: true } },
        shootCrew: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    })) as Prisma.TaskGetPayload<{
      include: {
        projectRef: true;
        assignedToUser: true;
        assignedByUser: true;
        reviewedByUser: true;
      };
    }>;

    // Send notification to assigned employee
    if (updated.assignedToUserId) {
      let reviewerName = 'Reviewer';
      if (
        updated.reviewedByUser &&
        typeof updated.reviewedByUser.name === 'string'
      ) {
        reviewerName = String(updated.reviewedByUser.name);
      }

      let taskTitle = `Task #${id}`;
      if (typeof updated.taskName === 'string') {
        taskTitle = String(updated.taskName);
      }
      const notificationTitle =
        nextStatus === 'APPROVED'
          ? 'Task Approved!'
          : 'Task Rejected - Please Revise';
      const notificationMessage =
        nextStatus === 'APPROVED'
          ? `${reviewerName} approved your task "${taskTitle}".`
          : `${reviewerName} rejected your task "${taskTitle}". ${remarks ? `Feedback: ${remarks}` : ''}`;

      const recipientId: number | undefined =
        typeof updated.assignedToUserId === 'number'
          ? updated.assignedToUserId
          : undefined;

      if (recipientId) {
        const notify = () =>
          this.notificationsService.sendNotification({
            recipientIds: [recipientId],
            title: notificationTitle,
            message: notificationMessage,
            module: 'Tasks',
            entityType: 'Task',
            entityId: id,
            actionUrl: '/dashboard/tasks',
            organizationId: taskOrganizationId,
            type: nextStatus === 'APPROVED' ? 'SUCCESS' : 'ERROR',
            priority: 'HIGH',
            category: 'TASK',
            createdBy: user.userId,
          });
        if (this.afterCommit) this.afterCommit.push(notify);
        else await notify();
      }
    }

    if (nextStatus === 'APPROVED') {
      await this.workflowEngine.approveWorkflow({
        definitionKey: 'task-review',
        entityType: 'Task',
        entityId: id,
        userId: user.userId,
        businessStatus: 'APPROVED',
        approvedByLabel: `REVIEW:${user.userId}`,
        comment: remarks ?? undefined,
        organizationId: taskOrganizationId,
      });
    } else {
      await this.workflowEngine.rejectWorkflow({
        definitionKey: 'task-review',
        entityType: 'Task',
        entityId: id,
        userId: user.userId,
        businessStatus: 'REJECTED',
        reason: remarks ?? undefined,
        organizationId: taskOrganizationId,
      });
    }

    return updated;
  }

  private async getScopedWhere(user: AuthUser): Promise<Prisma.TaskWhereInput> {
    return this.getTaskAccessWhere(user);
  }

  private async getCollaborativeTask(id: number, user: AuthUser) {
    const task = await this.db.task.findFirst({
      where: { id, ...(await this.getTaskAccessWhere(user)) },
      select: { id: true, organizationId: true },
    });
    if (!task) throw new NotFoundException(`Task #${id} not found`);
    return task;
  }

  async getChecklist(taskId: number, user: AuthUser) {
    await this.getCollaborativeTask(taskId, user);
    return (this.db as any).taskChecklistItem.findMany({
      where: { taskId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { completedBy: { select: { id: true, name: true, email: true } } },
    });
  }

  async createChecklistItem(taskId: number, dto: CreateChecklistItemDto, user: AuthUser) {
    const task = await this.getCollaborativeTask(taskId, user);
    if (!dto.title.trim()) throw new BadRequestException('Checklist title is required');
    return (this.db as any).taskChecklistItem.create({
      data: { taskId, organizationId: task.organizationId, title: dto.title.trim(), sortOrder: dto.sortOrder ?? 0 },
      include: { completedBy: { select: { id: true, name: true, email: true } } },
    });
  }

  async updateChecklistItem(taskId: number, itemId: number, dto: UpdateChecklistItemDto, user: AuthUser) {
    await this.getCollaborativeTask(taskId, user);
    const item = await (this.db as any).taskChecklistItem.findFirst({ where: { id: itemId, taskId } });
    if (!item) throw new NotFoundException('Checklist item not found');
    if (dto.title !== undefined && !dto.title.trim()) throw new BadRequestException('Checklist title is required');
    return (this.db as any).taskChecklistItem.update({
      where: { id: itemId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.completed !== undefined && { completed: dto.completed, completedById: dto.completed ? user.userId : null, completedAt: dto.completed ? new Date() : null }),
      },
      include: { completedBy: { select: { id: true, name: true, email: true } } },
    });
  }

  async deleteChecklistItem(taskId: number, itemId: number, user: AuthUser) {
    await this.getCollaborativeTask(taskId, user);
    const item = await (this.db as any).taskChecklistItem.findFirst({ where: { id: itemId, taskId }, select: { id: true } });
    if (!item) throw new NotFoundException('Checklist item not found');
    return (this.db as any).taskChecklistItem.delete({ where: { id: itemId } });
  }

  async getWatchers(taskId: number, user: AuthUser) {
    await this.getCollaborativeTask(taskId, user);
    return (this.db as any).taskWatcher.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  async addWatcher(taskId: number, requestedUserId: number | undefined, user: AuthUser) {
    const task = await this.getCollaborativeTask(taskId, user);
    const canManage = ([Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER] as Role[]).includes(user.role);
    const targetUserId = requestedUserId ?? user.userId;
    if (!canManage && targetUserId !== user.userId) throw new ForbiddenException('You can only watch a task for yourself');
    const target = await this.db.user.findFirst({ where: { id: targetUserId, organizationId: task.organizationId, isActive: true }, select: { id: true } });
    if (!target) throw new NotFoundException('Watcher user not found');
    return (this.db as any).taskWatcher.upsert({
      where: { taskId_userId: { taskId, userId: targetUserId } },
      create: { taskId, userId: targetUserId, organizationId: task.organizationId },
      update: {},
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  async removeWatcher(taskId: number, targetUserId: number, user: AuthUser) {
    await this.getCollaborativeTask(taskId, user);
    const canManage = ([Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER] as Role[]).includes(user.role);
    if (!canManage && targetUserId !== user.userId) throw new ForbiddenException('You can only remove yourself as a watcher');
    const watcher = await (this.db as any).taskWatcher.findUnique({ where: { taskId_userId: { taskId, userId: targetUserId } } });
    if (!watcher) throw new NotFoundException('Watcher not found');
    return (this.db as any).taskWatcher.delete({ where: { taskId_userId: { taskId, userId: targetUserId } } });
  }

  async query(query: TaskQueryDto, user: AuthUser) {
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(query.pageSize ?? '25', 10) || 25),
    );
    const baseWhere = await this.getScopedWhere(user);
    const and: Prisma.TaskWhereInput[] = [baseWhere];
    const numberFilter = (value?: string) => {
      const parsed = value == null ? NaN : Number.parseInt(value, 10);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    };
    const projectId = numberFilter(query.projectId);
    const milestoneId = numberFilter(query.milestoneId);
    const taskListId = numberFilter(query.taskListId);
    const assignedToUserId = numberFilter(query.assignedToUserId);

    if (query.search?.trim()) {
      const search = query.search.trim();
      and.push({
        OR: [
          { taskName: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (projectId) and.push({ projectId });
    if (milestoneId) and.push({ milestoneId });
    if (taskListId) and.push({ taskListId });
    if (assignedToUserId) and.push({ assignedToUserId });
    if (query.status) and.push({ status: query.status });
    if (query.priority) and.push({ priority: query.priority });
    if (query.dueFrom || query.dueTo) {
      and.push({
        dueDate: {
          ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
          ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
        },
      });
    }

    const where: Prisma.TaskWhereInput = { AND: and };
    const allowedSorts = new Set(['createdAt', 'updatedAt', 'dueDate', 'startDate', 'taskName', 'priority', 'status']);
    const sortBy = allowedSorts.has(query.sortBy ?? '') ? query.sortBy! : 'createdAt';
    const sortDirection = query.sortDirection === 'asc' ? 'asc' : 'desc';
    const db = this.prisma;
    const [total, items] = await db.$transaction([
      db.task.count({ where }),
      db.task.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortDirection } as Prisma.TaskOrderByWithRelationInput,
        select: {
          id: true,
          taskType: true,
          taskName: true,
          status: true,
          priority: true,
          startDate: true,
          dueDate: true,
          completionPercent: true,
          projectId: true,
          parentTaskId: true,
          milestoneId: true,
          taskListId: true,
          assignedToUserId: true,
          estimatedHours: true,
          actualHours: true,
          createdAt: true,
          updatedAt: true,
          projectRef: { select: { id: true, projectName: true } },
          milestone: { select: { id: true, name: true } },
          taskList: { select: { id: true, name: true } },
          assignedToUser: { select: { id: true, name: true, email: true } },
          _count: { select: { childTasks: true } },
        },
      }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async bulkUpdate(dto: BulkUpdateTasksDto, user: AuthUser) {
    if (dto.taskIds.length > 200) throw new BadRequestException('Bulk updates are limited to 200 tasks');
    const uniqueTaskIds = [...new Set(dto.taskIds)];
    const scope = await this.getTaskAccessWhere(user);
    const tasks = await this.db.task.findMany({ where: { AND: [{ id: { in: uniqueTaskIds } }, scope] }, select: { id: true, organizationId: true } });
    if (tasks.length !== uniqueTaskIds.length) throw new ForbiddenException('One or more tasks are not accessible');
    if (dto.assignedToUserId != null) {
      const organizations = [...new Set(tasks.map((task) => task.organizationId))];
      const assignee = await this.db.user.findFirst({ where: { id: dto.assignedToUserId, organizationId: { in: organizations }, isActive: true }, select: { id: true } });
      if (!assignee) throw new NotFoundException('Assigned user not found');
    }
    if (dto.status == null && dto.priority == null && dto.assignedToUserId == null && dto.dueDate === undefined) {
      throw new BadRequestException('At least one task field must be provided');
    }
    const data = {
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.assignedToUserId !== undefined && { assignedToUserId: dto.assignedToUserId }),
      ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
    };
    const updated = await this.db.task.updateMany({ where: { id: { in: uniqueTaskIds } }, data });
    return { updated: updated.count, taskIds: uniqueTaskIds };
  }

  async findAll(user: AuthUser) {
    const where = await this.getScopedWhere(user);
    return this.db.task.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        timerSessions: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        projectRef: {
          select: { id: true, projectName: true, managerId: true },
        },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
        reviewedByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const where = await this.getScopedWhere(user);
    const task = await this.db.task.findFirst({
      where: { id, ...where },
      include: {
        organization: { select: { id: true, name: true } },
        timerSessions: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        projectRef: {
          select: { id: true, projectName: true, managerId: true },
        },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
        reviewedByUser: { select: { id: true, name: true, email: true } },
        parentTask: { select: { id: true, taskName: true, status: true } },
        childTasks: {
          where: { deletedAt: null },
          select: { id: true, taskName: true, status: true, completionPercent: true, dueDate: true },
          orderBy: { createdAt: 'asc' },
        },
        outgoingDependencies: {
          select: { id: true, dependencyType: true, lagDays: true, successor: { select: { id: true, taskName: true, status: true } } },
        },
        incomingDependencies: {
          select: { id: true, dependencyType: true, lagDays: true, predecessor: { select: { id: true, taskName: true, status: true } } },
        },
        projectIssues: {
          select: { id: true, title: true, status: true, priority: true, dueDate: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!task) throw new NotFoundException(`Task #${id} not found`);
    return task;
  }
}
