import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { CreateTaskDto } from './dto/create-task.dto';
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

const PRIORITIES = ['High', 'Low', 'Medium', 'Critical'] as const;
const TASK_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
] as const;
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly notificationsService: NotificationsService,
    private readonly businessUnitsService: BusinessUnitsService,
    @Optional()
    private readonly organizationScopeService?: OrganizationScopeService,
  ) {}

  private get db() {
    return this.prisma;
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
    if (normalized === 'COMPLETED') return 'APPROVED';

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
          { projectRef: { managerId: user.userId } },
          { projectRef: { coManagers: { some: { id: user.userId } } } },
        ],
      };
    } else {
      roleWhere = {
        OR: [
          { assignedToUserId: user.userId },
          { assignedByUserId: user.userId },
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

  async create(dto: CreateTaskDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    if (dto.status === 'APPROVED' || dto.status === 'REJECTED') {
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
    const isHierarchyAdmin = new Set<Role>([
      Role.ADMIN,
      Role.HR,
      Role.SUPER_ADMIN,
    ]).has(user.role);
    const relatedOrganizationIds = isHierarchyAdmin
      ? await this.organizationScopeService?.getRelatedOrganizationIds(
          user.homeOrganizationId ?? organizationId,
        )
      : [organizationId];
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
            },
          })
      : null;
    if (dto.projectId && !project) {
      throw new NotFoundException('Project not found');
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

    const actorOrganizationIds = isHierarchyAdmin
      ? await this.organizationScopeService?.getOrganizationIds(user)
      : [organizationId];
    const assignableOrganizationIds =
      project && actorOrganizationIds?.includes(project.organizationId)
        ? actorOrganizationIds
        : [organizationId];
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

    if (
      (dto.assignedToUserId || dto.employeeId) &&
      user.role === Role.MANAGER &&
      (String(assignee.role) !== String(Role.EMPLOYEE) ||
        assignee.managerId !== user.userId)
    ) {
      throw new ForbiddenException(
        'Managers can assign tasks only to their employees',
      );
    }

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

    return this.db.task.create({
      data: {
        organizationId: project?.organizationId ?? organizationId,
        businessUnitId: taskBusinessUnitId,
        taskName: resolvedTaskName,
        project: dto.project ?? project?.projectName,
        projectId: project?.id,
        description: dto.description ?? dto.notes,
        category: dto.category,
        links: dto.links,
        driveLink: dto.driveLink,
        assignee: dto.assignee ?? assignee.name,
        assignedToId: assignee.employeeId ?? undefined,
        assignedToUserId: assignee.id,
        assignedByUserId: user.userId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        priority: dto.priority,
        status: this.normalizeTaskStatus(dto.status),
        estimatedHours: dto.estimatedHours,
        actualHours: dto.actualHours,
        submissionLink: dto.submissionLink,
        reviewComment: dto.reviewComment,
        leadId: dto.leadId,
        dealId: dto.dealId,
      },
    });
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
      if (session) {
        throw new ConflictException(
          'You already have an active timer for this task',
        );
      }
      if (!task.estimatedHours || task.estimatedHours <= 0) {
        throw new BadRequestException(
          'Set a task estimate before starting its countdown',
        );
      }
      const otherRunningTimer = await this.db.taskTimerSession.findFirst({
        where: { organizationId, userId, status: 'RUNNING' },
        include: { task: { select: { taskName: true } } },
      });
      if (otherRunningTimer) {
        throw new ConflictException(
          `Your timer is already running for task: ${otherRunningTimer.task.taskName}`,
        );
      }
      try {
        await this.db.taskTimerSession.create({
          data: {
            taskId,
            userId,
            organizationId,
            status: 'RUNNING',
            durationSeconds: Math.max(
              1,
              Math.round(task.estimatedHours * 3600),
            ),
            remainingSeconds: Math.max(
              1,
              Math.round(task.estimatedHours * 3600),
            ),
            startedAt: now,
          },
        });
      } catch (error) {
        if (this.isTimerUniquenessConflict(error)) {
          throw new ConflictException('You already have an active task timer');
        }
        throw error;
      }
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
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now.getTime() - session.startedAt.getTime()) / 1000),
      );
      const remainingSeconds = Math.max(
        0,
        session.remainingSeconds - elapsedSeconds,
      );
      if (remainingSeconds === 0) {
        await this.finishTaskTimerSession(session, task, user, now, 0);
      } else {
        const updated = await this.db.taskTimerSession.updateMany({
          where: {
            id: session.id,
            status: 'RUNNING',
            startedAt: session.startedAt,
          },
          data: {
            status: 'PAUSED',
            remainingSeconds,
            startedAt: null,
            totalSeconds: session.totalSeconds + elapsedSeconds,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException('Timer changed; refresh and try again');
        }
      }
      return this.findTaskWithTimerSessions(taskId, organizationId);
    }

    if (dto.action === 'resume') {
      if (session.status !== 'PAUSED') {
        throw new BadRequestException('Only a paused timer can be resumed');
      }
      const otherRunningTimer = await this.db.taskTimerSession.findFirst({
        where: {
          organizationId,
          userId,
          status: 'RUNNING',
          id: { not: session.id },
        },
        include: { task: { select: { taskName: true } } },
      });
      if (otherRunningTimer) {
        throw new ConflictException(
          `Your timer is already running for task: ${otherRunningTimer.task.taskName}`,
        );
      }
      try {
        const updated = await this.db.taskTimerSession.updateMany({
          where: { id: session.id, status: 'PAUSED' },
          data: { status: 'RUNNING', startedAt: now },
        });
        if (updated.count !== 1) {
          throw new ConflictException('Timer changed; refresh and try again');
        }
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
    const remainingSeconds =
      session.status === 'RUNNING' && session.startedAt
        ? Math.max(
            0,
            session.remainingSeconds -
              Math.floor((now.getTime() - session.startedAt.getTime()) / 1000),
          )
        : session.remainingSeconds;
    await this.finishTaskTimerSession(
      session,
      task,
      user,
      now,
      remainingSeconds,
      dto.notes,
    );
    return this.findTaskWithTimerSessions(taskId, organizationId);
  }

  private async finishTaskTimerSession(
    session: {
      id: number;
      status: string;
      startedAt: Date | null;
      durationSeconds: number;
      remainingSeconds: number;
      totalSeconds: number;
    },
    task: {
      id: number;
      organizationId: number;
      taskName: string;
      project: string | null;
      projectId: number | null;
    },
    user: AuthUser,
    now: Date,
    remainingSeconds: number,
    notes?: string,
  ) {
    const elapsedSeconds =
      session.status === 'RUNNING' && session.startedAt
        ? Math.max(0, session.remainingSeconds - remainingSeconds)
        : 0;
    const totalSeconds = session.totalSeconds + elapsedSeconds;
    return this.db.$transaction(async (tx) => {
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
      await tx.timesheet.create({
        data: {
          organizationId: task.organizationId,
          task: task.taskName,
          project: task.project,
          taskId: task.id,
          projectId: task.projectId,
          timerSessionId: session.id,
          date: session.startedAt ?? now,
          hours: Math.max(1, totalSeconds) / 3600,
          status: 'PENDING',
          notes: notes?.trim() || 'Tracked with task countdown timer',
          createdByUserId: user.userId,
        },
      });
    });
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
    });
    if (!existingTask) throw new NotFoundException(`Task #${id} not found`);

    let assigneeData: {
      assignedToUserId?: number;
      assignedToId?: number | null;
      assignedByUserId?: number;
      assignee?: string;
    } = {};
    if (dto.assignedToUserId || dto.employeeId) {
      const assignee = await this.resolveAssignee(
        organizationId,
        dto.employeeId ?? null,
        dto.assignedToUserId ?? null,
      );
      if (
        user.role === Role.MANAGER &&
        (String(assignee.role) !== String(Role.EMPLOYEE) ||
          assignee.managerId !== user.userId)
      ) {
        throw new ForbiddenException(
          'Managers can assign tasks only to their employees',
        );
      }
      if (assignee.employeeId) {
        const validEmp = await this.db.employee.findFirst({
          where: { id: assignee.employeeId, ...employeeBUWhere },
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
      projectId?: number;
      project?: string;
      businessUnitId?: number | null;
    } = {};
    if (dto.projectId !== undefined) {
      const project = dto.projectId
        ? await this.db.project.findUnique({
            where: { id: dto.projectId, organizationId },
            select: {
              id: true,
              projectName: true,
              businessUnitId: true,
              managerId: true,
            },
          })
        : null;
      if (dto.projectId && !project)
        throw new NotFoundException('Project not found');
      if (project) {
        if (user.role === Role.MANAGER && project.managerId !== user.userId) {
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
        projectData = { projectId: undefined, project: undefined };
      }
    }

    if (dto.status !== undefined) {
      this.ensureTransitionAllowed(
        existingTask.status,
        this.normalizeTaskStatus(dto.status),
        user.role,
      );
    }

    return this.db.task.update({
      where: { id, organizationId: existingTask.organizationId },
      data: {
        ...((dto.taskName !== undefined || dto.title !== undefined) && {
          taskName: dto.taskName ?? dto.title,
        }),
        ...(dto.project !== undefined && { project: dto.project }),
        ...projectData,
        ...(dto.assignee !== undefined && { assignee: dto.assignee }),
        ...(dto.driveLink !== undefined && { driveLink: dto.driveLink }),
        ...assigneeData,
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.status !== undefined && {
          status: this.normalizeTaskStatus(dto.status),
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
      },
      include: {
        projectRef: {
          select: { id: true, projectName: true, managerId: true },
        },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
        reviewedByUser: { select: { id: true, name: true, email: true } },
      },
    });
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
    });
    if (!existing) throw new NotFoundException(`Task #${id} not found`);
    return this.db.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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
    this.ensureTransitionAllowed(task.status, normalizedStatus, user.role);

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
      },
    });
  }

  async submitWork(id: number, dto: SubmitTaskWorkDto, user: AuthUser) {
    const taskScope = await this.getScopedWhere(user);
    const task = await this.db.task.findFirst({
      where: {
        id,
        ...taskScope,
        OR: [
          { assignedToUserId: user.userId },
          ...(user.employeeId ? [{ assignedToId: user.employeeId }] : []),
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
    this.ensureTransitionAllowed(currentStatus, 'SUBMITTED', user.role);
    const taskOrganizationId = task.organizationId;

    // Check for existing workflow and delete if needed to reset
    const existingWorkflow = await this.workflowEngine.getInstanceByEntity(
      'Task',
      id,
      taskOrganizationId,
    );

    if (existingWorkflow) {
      // If workflow exists and is not SUBMITTED/PENDING, we need to clean it up
      await this.db.workflowInstance.delete({
        where: { id: existingWorkflow.id, organizationId: taskOrganizationId },
      });
    }

    const updated = (await this.db.task.update({
      where: { id, organizationId: taskOrganizationId },
      data: {
        submissionLink: dto.submissionLink,
        submissionNotes: dto.note,
        status: 'SUBMITTED',
      },
      include: {
        projectRef: {
          select: { id: true, projectName: true, managerId: true },
        },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
        reviewedByUser: { select: { id: true, name: true, email: true } },
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
        await this.notificationsService.sendNotification({
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
      },
    });
    if (!task) throw new NotFoundException(`Task #${id} not found`);
    return task;
  }
}
