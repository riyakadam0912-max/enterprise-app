import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Role } from '../common/enums/role.enum';
import { SubmitTaskWorkDto } from './dto/submit-task-work.dto';
import { ReviewTaskDto } from './dto/review-task.dto';

const PRIORITIES = ['High', 'Low', 'Medium', 'Critical'] as const;
const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;
type AuthUser = { userId: number; role: Role; employeeId?: number | null };

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  private async canManageTask(taskId: number, user: AuthUser): Promise<boolean> {
    if (user.role === Role.ADMIN) return true;
    if (user.role !== Role.MANAGER) return false;

    const task = await this.db.task.findFirst({
      where: { id: taskId, projectRef: { managerId: user.userId } },
      select: { id: true },
    });
    return Boolean(task);
  }

  private normalizeTaskStatus(status?: string | null): (typeof TASK_STATUSES)[number] {
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

  private async getTaskAccessWhere(user: AuthUser): Promise<Record<string, any> | undefined> {
    if (user.role === Role.ADMIN) return undefined;
    if (user.role === Role.MANAGER) {
      return { projectRef: { managerId: user.userId } };
    }
    return { assignedToUserId: user.userId };
  }

  private async resolveAssignee(employeeId?: number | null, assignedToUserId?: number | null) {
    if (assignedToUserId) {
      const assigneeUser = await this.db.user.findUnique({
        where: { id: assignedToUserId },
        select: { id: true, name: true, employeeId: true, role: true, managerId: true },
      });
      if (!assigneeUser) throw new NotFoundException('Assigned user not found');
      return assigneeUser;
    }

    if (employeeId) {
      const assigneeUser = await this.db.user.findFirst({
        where: { employeeId },
        select: { id: true, name: true, employeeId: true, role: true, managerId: true },
      });
      if (!assigneeUser) throw new NotFoundException('No user account found for selected employee');
      return assigneeUser;
    }

    throw new ForbiddenException('Task must be assigned to a user');
  }

  async create(dto: CreateTaskDto, user: AuthUser) {
    if (user.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot create tasks');
    }

    const resolvedTaskName = dto.taskName?.trim() || dto.title?.trim();
    if (!resolvedTaskName) {
      throw new ForbiddenException('Task title is required');
    }

    if (!dto.projectId) {
      throw new ForbiddenException('projectId is required');
    }

    const project = await this.db.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');

    if (user.role === Role.MANAGER && project.managerId !== user.userId) {
      throw new ForbiddenException('Managers can only create tasks in their assigned projects');
    }

    const assignee = await this.resolveAssignee(dto.employeeId ?? null, dto.assignedToUserId ?? null);
    if (user.role === Role.MANAGER && (assignee.role !== Role.EMPLOYEE || assignee.managerId !== user.userId)) {
      throw new ForbiddenException('Managers can assign tasks only to their employees');
    }

    return this.db.task.create({
      data: {
        taskName: resolvedTaskName,
        project: dto.project ?? project.projectName,
        projectId: project.id,
        assignee: dto.assignee ?? assignee.name,
        assignedToId: assignee.employeeId ?? undefined,
        assignedToUserId: assignee.id,
        assignedByUserId: user.userId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        priority: dto.priority,
        status: this.normalizeTaskStatus(dto.status),
        estimatedHours: dto.estimatedHours,
        actualHours: dto.actualHours,
        notes: dto.description ?? dto.notes,
        submissionLink: dto.submissionLink,
        reviewComment: dto.reviewComment,
        leadId: dto.leadId,
        dealId: dto.dealId,
      },
    });
  }

  async findAll(user: AuthUser) {
    const where = await this.getTaskAccessWhere(user);
    return this.db.task.findMany({
      where,
      include: {
        projectRef: { select: { id: true, projectName: true, managerId: true } },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const where = await this.getTaskAccessWhere(user);
    const task = await this.db.task.findFirst({
      where: { id, ...(where ?? {}) },
      include: {
        projectRef: { select: { id: true, projectName: true, managerId: true } },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
      },
    });

    if (!task) throw new NotFoundException(`Task #${id} not found`);
    return task;
  }

  async update(id: number, dto: UpdateTaskDto, user: AuthUser) {
    const canManage = await this.canManageTask(id, user);
    if (!canManage) {
      throw new ForbiddenException('Only admin or project manager can update this task');
    }

    const existingTask = await this.db.task.findUnique({ where: { id } });
    if (!existingTask) throw new NotFoundException(`Task #${id} not found`);

    let assigneeData: { assignedToUserId?: number; assignedToId?: number | null; assignee?: string } = {};
    if (dto.assignedToUserId || dto.employeeId) {
      const assignee = await this.resolveAssignee(dto.employeeId ?? null, dto.assignedToUserId ?? null);
      if (user.role === Role.MANAGER && (assignee.role !== Role.EMPLOYEE || assignee.managerId !== user.userId)) {
        throw new ForbiddenException('Managers can assign tasks only to their employees');
      }
      assigneeData = {
        assignedToUserId: assignee.id,
        assignedToId: assignee.employeeId ?? null,
        assignee: assignee.name,
      };
    }

    let projectData: { projectId?: number; project?: string } = {};
    if (dto.projectId !== undefined) {
      const project = await this.db.project.findUnique({ where: { id: dto.projectId } });
      if (!project) throw new NotFoundException('Project not found');
      if (user.role === Role.MANAGER && project.managerId !== user.userId) {
        throw new ForbiddenException('Managers can only move tasks within their projects');
      }
      projectData = { projectId: project.id, project: project.projectName };
    }

    return this.db.task.update({
      where: { id },
      data: {
        ...((dto.taskName !== undefined || dto.title !== undefined) && {
          taskName: dto.taskName ?? dto.title,
        }),
        ...(dto.project !== undefined && { project: dto.project }),
        ...projectData,
        ...(dto.assignee !== undefined && { assignee: dto.assignee }),
        ...assigneeData,
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.status !== undefined && { status: this.normalizeTaskStatus(dto.status) }),
        ...(dto.estimatedHours !== undefined && { estimatedHours: dto.estimatedHours }),
        ...(dto.actualHours !== undefined && { actualHours: dto.actualHours }),
        ...((dto.notes !== undefined || dto.description !== undefined) && {
          notes: dto.description ?? dto.notes,
        }),
        ...(dto.submissionLink !== undefined && { submissionLink: dto.submissionLink }),
        ...(dto.reviewComment !== undefined && { reviewComment: dto.reviewComment }),
        ...(dto.leadId !== undefined && { leadId: dto.leadId }),
        ...(dto.dealId !== undefined && { dealId: dto.dealId }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
      },
      include: {
        projectRef: { select: { id: true, projectName: true, managerId: true } },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async remove(id: number, user: AuthUser) {
    const canManage = await this.canManageTask(id, user);
    if (!canManage) {
      throw new ForbiddenException('Only admin or project manager can delete this task');
    }
    return this.db.task.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async importRecords(records: Record<string, any>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.taskName && !r.title) {
        errors.push(`Row ${i + 1}: 'taskName' (or 'title') is required`);
        continue;
      }

      try {
        await this.db.task.create({
          data: {
            taskName: String(r.taskName ?? r.title),
            project: r.project ? String(r.project) : undefined,
            projectId: r.projectId ? Number(r.projectId) : undefined,
            assignee: r.assignee ? String(r.assignee) : undefined,
            assignedToId: r.assignedToId ? Number(r.assignedToId) : undefined,
            assignedToUserId: r.assignedToUserId ? Number(r.assignedToUserId) : undefined,
            dueDate: r.dueDate ? new Date(String(r.dueDate)) : undefined,
            priority: r.priority ? String(r.priority) : undefined,
            status: this.normalizeTaskStatus(r.status ? String(r.status) : undefined),
            estimatedHours: r.estimatedHours ? Number(r.estimatedHours) : undefined,
            actualHours: r.actualHours ? Number(r.actualHours) : undefined,
            notes: r.description ? String(r.description) : r.notes ? String(r.notes) : undefined,
            submissionLink: r.submissionLink ? String(r.submissionLink) : undefined,
            reviewComment: r.reviewComment ? String(r.reviewComment) : undefined,
            leadId: r.leadId ? Number(r.leadId) : undefined,
            dealId: r.dealId ? Number(r.dealId) : undefined,
          },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message ?? 'Unknown error'}`);
      }
    }

    return { imported, errors };
  }

  async getByPriority(user: AuthUser) {
    if (user.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot view global priority report');
    }

    const where = user.role === Role.MANAGER ? { projectRef: { managerId: user.userId } } : undefined;
    const tasks = await this.db.task.findMany({ where, orderBy: { createdAt: 'desc' } });
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
    const where = await this.getTaskAccessWhere(user);
    const now = new Date();
    return this.db.task.findMany({
      where: {
        ...(where ?? {}),
        dueDate: { gte: now },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });
  }

  async getByLead(leadId: number, user: AuthUser) {
    const where = await this.getTaskAccessWhere(user);
    return this.db.task.findMany({
      where: {
        leadId,
        ...(where ?? {}),
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getByDeal(dealId: number, user: AuthUser) {
    const where = await this.getTaskAccessWhere(user);
    return this.db.task.findMany({
      where: {
        dealId,
        ...(where ?? {}),
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async updateStatus(id: number, status: string, user: AuthUser) {
    const canManage = await this.canManageTask(id, user);
    if (!canManage) {
      throw new ForbiddenException('Only admin or project manager can update task status');
    }

    return this.db.task.update({
      where: { id },
      data: {
        status: this.normalizeTaskStatus(status),
      },
      include: {
        projectRef: { select: { id: true, projectName: true, managerId: true } },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async submitWork(id: number, dto: SubmitTaskWorkDto, user: AuthUser) {
    const task = await this.db.task.findFirst({
      where: {
        id,
        assignedToUserId: user.userId,
      },
      include: {
        projectRef: { select: { managerId: true } },
      },
    } as any);

    if (!task) {
      throw new NotFoundException('Task not found for current employee');
    }

    const currentStatus = this.normalizeTaskStatus(task.status);
    if (currentStatus === 'APPROVED') {
      throw new ForbiddenException('Approved tasks cannot be resubmitted');
    }

    return this.db.task.update({
      where: { id },
      data: {
        submissionLink: dto.submissionLink,
        reviewComment: dto.note,
        status: 'SUBMITTED',
      },
      include: {
        projectRef: { select: { id: true, projectName: true, managerId: true } },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async reviewTask(id: number, dto: ReviewTaskDto, user: AuthUser) {
    const canManage = await this.canManageTask(id, user);
    if (!canManage) {
      throw new ForbiddenException('Only admin or project manager can review submitted work');
    }

    const task = await this.db.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task #${id} not found`);
    }

    const nextStatus = dto.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    return this.db.task.update({
      where: { id },
      data: {
        status: nextStatus,
        reviewComment: dto.comment ?? task.reviewComment,
      },
      include: {
        projectRef: { select: { id: true, projectName: true, managerId: true } },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
