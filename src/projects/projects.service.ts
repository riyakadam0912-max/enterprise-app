import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Role } from '../common/enums/role.enum';
import { CreateProjectLinkDto } from './dto/create-project-link.dto';

const PROJECT_STATUSES = ['ACTIVE', 'COMPLETED'] as const;
const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;
type AuthUser = { userId: number; role: Role; employeeId?: number | null };

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  private async getScopedUser(user: AuthUser) {
    const scopedUser = await this.db.user.findUnique({
      where: { id: user.userId },
      select: { id: true, role: true, managerId: true },
    } as any);
    if (!scopedUser) {
      throw new ForbiddenException('User not found');
    }
    return scopedUser;
  }

  private normalizeProjectStatus(status?: string | null): (typeof PROJECT_STATUSES)[number] {
    if (!status) return 'ACTIVE';

    const normalized = status.trim().toUpperCase();
    if (normalized === 'COMPLETED') return 'COMPLETED';
    if (normalized === 'ACTIVE') return 'ACTIVE';

    // Backward compatibility with legacy status values.
    if (normalized === 'IN PROGRESS' || normalized === 'PLANNED' || normalized === 'ON HOLD') {
      return 'ACTIVE';
    }

    return 'ACTIVE';
  }

  private async getProjectScope(user: AuthUser): Promise<Record<string, any> | undefined> {
    if (user.role === Role.ADMIN) {
      return undefined;
    }

    if (user.role === Role.MANAGER) {
      return { managerId: user.userId };
    }

    const scopedUser = await this.getScopedUser(user);
    if (!scopedUser.managerId) {
      return { id: -1 };
    }

    return { managerId: scopedUser.managerId };
  }

  private async canViewProject(projectId: number, user: AuthUser): Promise<boolean> {
    const scope = await this.getProjectScope(user);
    const project = await this.db.project.findFirst({
      where: { id: projectId, ...(scope ?? {}) },
      select: { id: true },
    } as any);
    return Boolean(project);
  }

  private async canManageProject(projectId: number, user: AuthUser): Promise<boolean> {
    if (user.role === Role.ADMIN) {
      return true;
    }
    if (user.role !== Role.MANAGER) {
      return false;
    }

    const project = await this.db.project.findFirst({
      where: { id: projectId, managerId: user.userId },
      select: { id: true },
    });
    return Boolean(project);
  }

  private async assertManager(managerId: number) {
    const manager = await this.db.user.findUnique({ where: { id: managerId } });
    if (!manager || manager.role !== Role.MANAGER) {
      throw new NotFoundException('Assigned manager not found or invalid role');
    }
    return manager;
  }

  async create(dto: CreateProjectDto) {
    const resolvedName = dto.projectName?.trim() || dto.name?.trim();
    if (!resolvedName) {
      throw new ForbiddenException('Project name is required');
    }

    let managerName: string | undefined;
    if (dto.managerId) {
      const manager = await this.assertManager(dto.managerId);
      managerName = manager.name;
    }

    return this.db.project.create({
      data: {
        projectName: resolvedName,
        projectCode: dto.projectCode,
        startDate:   dto.startDate ? new Date(dto.startDate) : undefined,
        endDate:     (dto.deadline || dto.endDate) ? new Date(dto.deadline || dto.endDate!) : undefined,
        manager:     dto.manager ?? managerName,
        managerId:   dto.managerId,
        status:      this.normalizeProjectStatus(dto.status),
        budget:      dto.budget,
        description: dto.description,
        client:      dto.client,
        projectLead: dto.projectLead,
      },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        links: true,
      },
    });
  }

  async assignManager(projectId: number, managerId: number) {
    const project = await this.db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project #${projectId} not found`);

    const manager = await this.assertManager(managerId);
    return this.db.project.update({
      where: { id: projectId },
      data: {
        managerId,
        manager: manager.name,
      },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findAll(user: AuthUser) {
    const where = await this.getProjectScope(user);

    return this.db.project.findMany({
      where,
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        links: true,
      },
      orderBy: { createdAt: 'desc' },
    } as any);
  }

  async findOne(id: number, user: AuthUser) {
    const hasAccess = await this.canViewProject(id, user);
    if (!hasAccess) {
      throw new ForbiddenException('You can only access allowed projects');
    }

    const project = await this.db.project.findUnique({
      where: { id },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        links: true,
      },
    } as any);
    if (!project) throw new NotFoundException(`Project #${id} not found`);

    const tasks = await this.db.task.findMany({
      where: { projectId: id },
      include: {
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    } as any);

    const teamMembers = project.managerId
      ? await this.db.user.findMany({
          where: {
            managerId: project.managerId,
            role: Role.EMPLOYEE,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            managerId: true,
          },
          orderBy: { name: 'asc' },
        } as any)
      : [];

    return {
      ...project,
      status: this.normalizeProjectStatus(project.status),
      tasks,
      teamMembers,
    };
  }

  async update(id: number, dto: UpdateProjectDto, user: AuthUser) {
    const canManage = await this.canManageProject(id, user);
    if (!canManage) {
      throw new ForbiddenException('Only project manager or admin can update this project');
    }

    let managerName = dto.manager;
    if (dto.managerId) {
      const manager = await this.assertManager(dto.managerId);
      managerName = manager.name;
    }

    return this.db.project.update({
      where: { id },
      data: {
        ...((dto.projectName !== undefined || dto.name !== undefined) && {
          projectName: dto.projectName ?? dto.name,
        }),
        ...(dto.projectCode !== undefined && { projectCode: dto.projectCode }),
        ...(dto.managerId    !== undefined && { managerId:   dto.managerId }),
        ...(managerName      !== undefined && { manager:     managerName }),
        ...(dto.status      !== undefined && { status:      this.normalizeProjectStatus(dto.status) }),
        ...(dto.budget      !== undefined && { budget:      dto.budget }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.client      !== undefined && { client:      dto.client }),
        ...(dto.projectLead !== undefined && { projectLead: dto.projectLead }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...((dto.endDate !== undefined || dto.deadline !== undefined) && {
          endDate: dto.deadline || dto.endDate ? new Date(dto.deadline || dto.endDate!) : null,
        }),
      },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        links: true,
      },
    });
  }

  async updateStatus(id: number, status: string, user: AuthUser) {
    const canManage = await this.canManageProject(id, user);
    if (!canManage) {
      throw new ForbiddenException('Only project manager or admin can update this project status');
    }

    return this.db.project.update({
      where: { id },
      data: { status: this.normalizeProjectStatus(status) },
      include: { managerUser: { select: { id: true, name: true, email: true } } },
    });
  }

  async remove(id: number, user: AuthUser) {
    const canManage = await this.canManageProject(id, user);
    if (!canManage) {
      throw new ForbiddenException('Only project manager or admin can delete this project');
    }
    return this.db.project.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async importRecords(records: Record<string, any>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.projectName) { errors.push(`Row ${i + 1}: 'projectName' is required`); continue; }
      try {
        await this.db.project.create({
          data: {
            projectName: String(r.projectName),
            projectCode: r.projectCode ? String(r.projectCode) : undefined,
            startDate:   r.startDate   ? new Date(String(r.startDate)) : undefined,
            endDate:     r.endDate     ? new Date(String(r.endDate))   : undefined,
            manager:     r.manager     ? String(r.manager)     : undefined,
            managerId:   r.managerId   ? Number(r.managerId)   : undefined,
            status:      r.status      ? String(r.status)      : 'PLANNED',
            budget:      r.budget      ? Number(r.budget)      : undefined,
            description: r.description ? String(r.description) : undefined,
            client:      r.client      ? String(r.client)      : undefined,
            projectLead: r.projectLead ? String(r.projectLead) : undefined,
          },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message ?? 'Unknown error'}`);
      }
    }
    return { imported, errors };
  }

  async getByStatus(user: AuthUser) {
    if (user.role !== Role.ADMIN && user.role !== Role.MANAGER) {
      throw new ForbiddenException('Only admin or manager can view grouped status report');
    }

    const where = user.role === Role.MANAGER ? { managerId: user.userId } : undefined;
    const projects = await this.db.project.findMany({ orderBy: { createdAt: 'desc' } });
    const scopedProjects = where
      ? projects.filter((project) => project.managerId === where.managerId)
      : projects;
    const grouped: Record<string, typeof projects> = {};
    for (const s of PROJECT_STATUSES) grouped[s] = [];
    for (const p of scopedProjects) {
      const key = this.normalizeProjectStatus(p.status);
      if (grouped[key]) grouped[key].push(p);
      else grouped[key] = [p];
    }
    return grouped;
  }

  async getLinks(projectId: number, user: AuthUser) {
    const hasAccess = await this.canViewProject(projectId, user);
    if (!hasAccess) {
      throw new ForbiddenException('You can only access links for allowed projects');
    }

    return this.db.projectLink.findMany({
      where: { projectId },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    } as any);
  }

  async createLink(projectId: number, dto: CreateProjectLinkDto, user: AuthUser) {
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) {
      throw new ForbiddenException('Only project manager or admin can add links');
    }

    await this.findOne(projectId, user);

    return this.db.projectLink.create({
      data: {
        projectId,
        title: dto.title,
        url: dto.url,
        createdById: user.userId,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    } as any);
  }

  async removeLink(projectId: number, linkId: number, user: AuthUser) {
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) {
      throw new ForbiddenException('Only project manager or admin can remove links');
    }

    const link = await this.db.projectLink.findUnique({ where: { id: linkId } });
    if (!link || link.projectId !== projectId) {
      throw new NotFoundException('Project link not found');
    }

    return this.db.projectLink.update({ where: { id: linkId }, data: { deletedAt: new Date() } as any });
  }

  async getProgress(projectId: number, user: AuthUser) {
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) {
      throw new ForbiddenException('Only project manager or admin can view project progress');
    }

    const project = await this.db.project.findUnique({
      where: { id: projectId },
      select: { id: true, projectName: true, status: true },
    } as any);
    if (!project) throw new NotFoundException(`Project #${projectId} not found`);

    const tasks = await this.db.task.findMany({
      where: { projectId },
      select: { id: true, status: true },
    } as any);

    const byStatus: Record<string, number> = {};
    for (const status of TASK_STATUSES) {
      byStatus[status] = 0;
    }

    for (const task of tasks) {
      const key = String(task.status || '').toUpperCase();
      if (key in byStatus) {
        byStatus[key] += 1;
      }
    }

    const totalTasks = tasks.length;
    const completedTasks = byStatus.APPROVED;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      projectId: project.id,
      projectName: project.projectName,
      projectStatus: this.normalizeProjectStatus(project.status),
      totalTasks,
      completedTasks,
      progressPercent,
      byStatus,
    };
  }
}
