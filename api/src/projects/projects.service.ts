import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Role } from '../common/enums/role.enum';
import { CreateProjectLinkDto } from './dto/create-project-link.dto';
import { AuthUser } from '../common/types/auth';

const PROJECT_STATUSES = [
  'ACTIVE',
  'PLANNED',
  'IN PROGRESS',
  'ON HOLD',
  'COMPLETED',
] as const;
const TASK_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
] as const;
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma;
  }

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  private async getScopedUser(user: AuthUser): Promise<
    Prisma.UserGetPayload<{
      select: { id: true; role: true; managerId: true; employeeId: true };
    }>
  > {
    const organizationId = this.validateOrganization(user);
    const scopedUser = await this.db.user.findUnique({
      where: { id: user.userId, organizationId },
      select: { id: true, role: true, managerId: true, employeeId: true },
    });
    if (!scopedUser) {
      throw new ForbiddenException('User not found');
    }
    return scopedUser;
  }

  private async getProjectAccessWhere(
    user: AuthUser,
  ): Promise<Prisma.ProjectWhereInput> {
    const organizationId = this.validateOrganization(user);
    const baseWhere = { organizationId };

    if (user.role === Role.ADMIN) {
      return baseWhere;
    }

    if (user.role === Role.MANAGER) {
      const where = {
        ...baseWhere,
        OR: [
          { managerId: user.userId },
          { coManagers: { some: { id: user.userId } } },
        ],
      };
      return where;
    }

    const scopedUser = await this.getScopedUser(user);
    if (!scopedUser.employeeId) {
      return { ...baseWhere, id: -1 };
    }

    const where = {
      ...baseWhere,
      OR: [
        { managerId: scopedUser.managerId },
        { assignedEmployees: { some: { id: scopedUser.employeeId } } },
        {
          tasks: {
            some: {
              OR: [
                { assignedToUserId: user.userId },
                { assignedToId: scopedUser.employeeId },
              ],
            },
          },
        },
      ],
    };
    return where;
  }

  private normalizeProjectStatus(
    status?: string | null,
  ): (typeof PROJECT_STATUSES)[number] {
    if (!status) return 'PLANNED';

    const normalized = status.trim().toUpperCase();
    if (normalized === 'ACTIVE') return 'ACTIVE';
    if (normalized === 'COMPLETED') return 'COMPLETED';
    if (normalized === 'PLANNED') return 'PLANNED';
    if (normalized === 'PLANNING') return 'PLANNED';
    if (normalized === 'IN PROGRESS' || normalized === 'IN_PROGRESS')
      return 'IN PROGRESS';
    if (normalized === 'ON HOLD' || normalized === 'ONHOLD') return 'ON HOLD';

    return 'PLANNED';
  }

  private async getProjectScope(
    user: AuthUser,
  ): Promise<Prisma.ProjectWhereInput> {
    return this.getProjectAccessWhere(user);
  }

  private async canViewProject(
    projectId: number,
    user: AuthUser,
  ): Promise<boolean> {
    const scope = await this.getProjectScope(user);
    const project = await this.db.project.findFirst({
      where: { id: projectId, ...scope },
      select: { id: true },
    });
    return Boolean(project);
  }

  private async canManageProject(
    projectId: number,
    user: AuthUser,
  ): Promise<boolean> {
    if (user.role === Role.ADMIN) {
      return true;
    }
    if (user.role !== Role.MANAGER) {
      return false;
    }

    const organizationId = this.validateOrganization(user);
    const project = await this.db.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        OR: [
          { managerId: user.userId },
          { coManagers: { some: { id: user.userId } } },
        ],
      },
      select: { id: true },
    });
    return Boolean(project);
  }

  private async canAdminOrPrimaryManager(
    projectId: number,
    user: AuthUser,
  ): Promise<boolean> {
    if (user.role === Role.ADMIN) {
      return true;
    }
    if (user.role !== Role.MANAGER) {
      return false;
    }

    const organizationId = this.validateOrganization(user);
    const project = await this.db.project.findFirst({
      where: { id: projectId, organizationId, managerId: user.userId },
      select: { id: true },
    });
    return Boolean(project);
  }

  private async assertManager(
    managerId: number,
    organizationId: number,
  ): Promise<
    Prisma.UserGetPayload<{
      select: { id: true; name: true; role: true };
    }>
  > {
    const manager = await this.db.user.findUnique({
      where: { id: managerId, organizationId },
      select: { id: true, name: true, role: true },
    });
    const managerRole = manager?.role as Role | undefined;
    if (!manager || managerRole !== Role.MANAGER) {
      throw new NotFoundException('Assigned manager not found or invalid role');
    }
    return manager;
  }

  async create(dto: CreateProjectDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const resolvedName = dto.projectName?.trim() || dto.name?.trim();
    if (!resolvedName) {
      throw new ForbiddenException('Project name is required');
    }

    const managerId =
      dto.managerId ?? (user.role === Role.MANAGER ? user.userId : undefined);
    if (!managerId) {
      throw new ForbiddenException('Project manager is required');
    }

    const manager = await this.assertManager(managerId, organizationId);
    const managerName = manager.name;

    return this.db.project.create({
      data: {
        organizationId,
        projectName: resolvedName,
        projectCode: dto.projectCode,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate:
          dto.deadline || dto.endDate
            ? new Date(dto.deadline || dto.endDate!)
            : undefined,
        manager: dto.manager ?? managerName,
        managerId: managerId,
        status: this.normalizeProjectStatus(dto.status),
        budget: dto.budget,
        description: dto.description,
        client: dto.client,
        projectLead: dto.projectLead,
      },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        coManagers: {
          where: { organizationId },
          select: { id: true, name: true, email: true },
        },
        assignedEmployees: {
          where: { organizationId },
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        links: { where: { organizationId } },
      },
    });
  }

  async assignManager(projectId: number, managerId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const project = await this.db.project.findUnique({
      where: { id: projectId, organizationId },
    });
    if (!project)
      throw new NotFoundException(`Project #${projectId} not found`);

    const manager = await this.assertManager(managerId, organizationId);
    return this.db.project.update({
      where: { id: projectId, organizationId },
      data: {
        managerId,
        manager: manager.name,
      },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        coManagers: {
          where: { organizationId },
          select: { id: true, name: true, email: true },
        },
        assignedEmployees: {
          where: { organizationId },
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        links: { where: { organizationId } },
      },
    });
  }

  async findAll(user: AuthUser) {
    const where = await this.getProjectScope(user);

    return this.db.project.findMany({
      where,
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        coManagers: {
          where: { organizationId: this.validateOrganization(user) },
          select: { id: true, name: true, email: true },
        },
        assignedEmployees: {
          where: { organizationId: this.validateOrganization(user) },
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        links: { where: { organizationId: this.validateOrganization(user) } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const hasAccess = await this.canViewProject(id, user);
    if (!hasAccess) {
      throw new ForbiddenException('You can only access allowed projects');
    }

    const tasksWhere =
      user.role === Role.EMPLOYEE
        ? {
            organizationId,
            projectId: id,
            OR: [
              { assignedToUserId: user.userId },
              ...(user.employeeId ? [{ assignedToId: user.employeeId }] : []),
            ],
          }
        : { organizationId, projectId: id };

    const project = await this.db.project.findUnique({
      where: { id, organizationId },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        coManagers: {
          where: { organizationId },
          select: { id: true, name: true, email: true },
        },
        assignedEmployees: {
          where: { organizationId },
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        links: { where: { organizationId } },
      },
    });
    if (!project) throw new NotFoundException(`Project #${id} not found`);

    const tasks = await this.db.task.findMany({
      where: tasksWhere,
      include: {
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const teamMembers = project.managerId
      ? await this.db.user.findMany({
          where: {
            organizationId,
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
        })
      : [];

    return {
      ...project,
      status: this.normalizeProjectStatus(project.status),
      tasks,
      teamMembers,
    };
  }

  async addCoManager(
    projectId: number,
    userId: number,
    requestingUser: AuthUser,
  ) {
    const organizationId = this.validateOrganization(requestingUser);
    const project = await this.db.project.findUnique({
      where: { id: projectId, organizationId },
      include: { coManagers: { select: { id: true } } },
    });
    if (!project) {
      throw new NotFoundException(`Project #${projectId} not found`);
    }

    const allowed = await this.canAdminOrPrimaryManager(
      projectId,
      requestingUser,
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Only admin or the primary manager can add co-managers',
      );
    }

    if (project.managerId === userId) {
      throw new ForbiddenException(
        'Primary manager is already assigned to this project',
      );
    }

    const manager = await this.assertManager(userId, organizationId);
    const coManagersArray = Array.isArray(project.coManagers)
      ? project.coManagers
      : [];
    const alreadyAssigned = coManagersArray.some(
      (coManager) => coManager.id === userId,
    );
    if (alreadyAssigned) {
      return this.findOne(projectId, requestingUser);
    }

    return this.db.project.update({
      where: { id: projectId, organizationId },
      data: { coManagers: { connect: { id: manager.id } } },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        coManagers: {
          where: { organizationId },
          select: { id: true, name: true, email: true },
        },
        assignedEmployees: {
          where: { organizationId },
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        links: { where: { organizationId } },
      },
    });
  }

  async removeCoManager(
    projectId: number,
    userId: number,
    requestingUser: AuthUser,
  ) {
    const organizationId = this.validateOrganization(requestingUser);
    const project = await this.db.project.findUnique({
      where: { id: projectId, organizationId },
      include: { coManagers: { select: { id: true } } },
    });
    if (!project) {
      throw new NotFoundException(`Project #${projectId} not found`);
    }

    const allowed = await this.canAdminOrPrimaryManager(
      projectId,
      requestingUser,
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Only admin or the primary manager can remove co-managers',
      );
    }

    if (project.managerId === userId) {
      throw new ForbiddenException(
        'Primary manager cannot be removed as a co-manager',
      );
    }

    await this.assertManager(userId, organizationId);

    return this.db.project.update({
      where: { id: projectId, organizationId },
      data: { coManagers: { disconnect: { id: userId } } },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        coManagers: {
          where: { organizationId },
          select: { id: true, name: true, email: true },
        },
        assignedEmployees: {
          where: { organizationId },
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        links: { where: { organizationId } },
      },
    });
  }

  async assignEmployee(
    projectId: number,
    employeeId: number,
    requestingUser: AuthUser,
  ) {
    const organizationId = this.validateOrganization(requestingUser);
    const allowed = await this.canManageProject(projectId, requestingUser);
    if (!allowed) {
      throw new ForbiddenException(
        'Only project managers or admin can assign employees',
      );
    }

    const project = await this.db.project.findUnique({
      where: { id: projectId, organizationId },
      include: { assignedEmployees: { select: { id: true } } },
    });
    if (!project) {
      throw new NotFoundException(`Project #${projectId} not found`);
    }

    const employee = await this.db.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const alreadyAssigned = project.assignedEmployees?.some(
      (item: { id: number }) => item.id === employeeId,
    );
    if (alreadyAssigned) {
      return this.findOne(projectId, requestingUser);
    }

    return this.db.project.update({
      where: { id: projectId, organizationId },
      data: { assignedEmployees: { connect: { id: employeeId } } },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        coManagers: {
          where: { organizationId },
          select: { id: true, name: true, email: true },
        },
        assignedEmployees: {
          where: { organizationId },
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        links: { where: { organizationId } },
      },
    });
  }

  async removeEmployee(
    projectId: number,
    employeeId: number,
    requestingUser: AuthUser,
  ) {
    const organizationId = this.validateOrganization(requestingUser);
    const allowed = await this.canManageProject(projectId, requestingUser);
    if (!allowed) {
      throw new ForbiddenException(
        'Only project managers or admin can remove employees',
      );
    }

    const employee = await this.db.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.db.project.update({
      where: { id: projectId, organizationId },
      data: { assignedEmployees: { disconnect: { id: employeeId } } },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        coManagers: {
          where: { organizationId },
          select: { id: true, name: true, email: true },
        },
        assignedEmployees: {
          where: { organizationId },
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        links: { where: { organizationId } },
      },
    });
  }

  async update(id: number, dto: UpdateProjectDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const canManage = await this.canManageProject(id, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project manager or admin can update this project',
      );
    }

    let managerName = dto.manager;
    if (dto.managerId) {
      const manager = await this.assertManager(dto.managerId, organizationId);
      managerName = manager.name;
    }

    return this.db.project.update({
      where: { id, organizationId },
      data: {
        ...((dto.projectName !== undefined || dto.name !== undefined) && {
          projectName: dto.projectName ?? dto.name,
        }),
        ...(dto.projectCode !== undefined && { projectCode: dto.projectCode }),
        ...(dto.managerId !== undefined && { managerId: dto.managerId }),
        ...(managerName !== undefined && { manager: managerName }),
        ...(dto.status !== undefined && {
          status: this.normalizeProjectStatus(dto.status),
        }),
        ...(dto.budget !== undefined && { budget: dto.budget }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.client !== undefined && { client: dto.client }),
        ...(dto.projectLead !== undefined && { projectLead: dto.projectLead }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...((dto.endDate !== undefined || dto.deadline !== undefined) && {
          endDate:
            dto.deadline || dto.endDate
              ? new Date(dto.deadline || dto.endDate!)
              : null,
        }),
      },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        links: { where: { organizationId } },
      },
    });
  }

  async updateStatus(id: number, status: string, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const canManage = await this.canManageProject(id, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project manager or admin can update this project status',
      );
    }

    return this.db.project.update({
      where: { id, organizationId },
      data: { status: this.normalizeProjectStatus(status) },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const canManage = await this.canManageProject(id, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project manager or admin can delete this project',
      );
    }
    return this.db.project.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async importRecords(
    records: unknown[],
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    const organizationId = this.validateOrganization(user);
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (typeof r !== 'object' || r === null) {
        errors.push(`Row ${i + 1}: Invalid record format`);
        continue;
      }
      const rec = r as Record<string, unknown>;
      if (!rec.projectName) {
        errors.push(`Row ${i + 1}: 'projectName' is required`);
        continue;
      }
      try {
        const importedManagerId = rec.managerId
          ? Number(rec.managerId)
          : undefined;
        const importedManager = importedManagerId
          ? await this.assertManager(importedManagerId, organizationId)
          : null;

        const projectNameStr =
          typeof rec.projectName === 'string' ? rec.projectName : '';
        const projectCodeStr =
          rec.projectCode && typeof rec.projectCode === 'string'
            ? rec.projectCode
            : undefined;
        const startDateStr =
          rec.startDate && typeof rec.startDate === 'string'
            ? rec.startDate
            : undefined;
        const endDateStr =
          rec.endDate && typeof rec.endDate === 'string'
            ? rec.endDate
            : undefined;
        const managerStr =
          rec.manager && typeof rec.manager === 'string'
            ? rec.manager
            : undefined;
        const statusStr =
          rec.status && typeof rec.status === 'string' ? rec.status : 'PLANNED';
        const descriptionStr =
          rec.description && typeof rec.description === 'string'
            ? rec.description
            : undefined;
        const clientStr =
          rec.client && typeof rec.client === 'string' ? rec.client : undefined;
        const projectLeadStr =
          rec.projectLead && typeof rec.projectLead === 'string'
            ? rec.projectLead
            : undefined;

        await this.db.project.create({
          data: {
            organizationId,
            projectName: projectNameStr,
            projectCode: projectCodeStr,
            startDate: startDateStr ? new Date(startDateStr) : undefined,
            endDate: endDateStr ? new Date(endDateStr) : undefined,
            manager: importedManager?.name ?? managerStr,
            managerId: importedManager?.id,
            status: statusStr,
            budget: rec.budget ? Number(rec.budget) : undefined,
            description: descriptionStr,
            client: clientStr,
            projectLead: projectLeadStr,
          },
        });
        imported++;
      } catch (e: unknown) {
        const message =
          e instanceof Error
            ? e.message
            : typeof e === 'string'
              ? e
              : 'Unknown error';
        errors.push(`Row ${i + 1}: ${message}`);
      }
    }
    return { imported, errors };
  }

  async getByStatus(user: AuthUser) {
    if (user.role !== Role.ADMIN && user.role !== Role.MANAGER) {
      throw new ForbiddenException(
        'Only admin or manager can view grouped status report',
      );
    }

    const where = await this.getProjectAccessWhere(user);
    const projects = await this.db.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    const scopedProjects = projects;
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
    const organizationId = this.validateOrganization(user);
    const hasAccess = await this.canViewProject(projectId, user);
    if (!hasAccess) {
      throw new ForbiddenException(
        'You can only access links for allowed projects',
      );
    }

    return this.db.projectLink.findMany({
      where: { projectId, project: { organizationId } },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLink(
    projectId: number,
    dto: CreateProjectLinkDto,
    user: AuthUser,
  ) {
    const organizationId = this.validateOrganization(user);
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project manager or admin can add links',
      );
    }

    await this.findOne(projectId, user);

    return this.db.projectLink.create({
      data: {
        projectId,
        title: dto.title,
        url: dto.url,
        createdById: user.userId,
        organizationId,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
  }

  async removeLink(projectId: number, linkId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project manager or admin can remove links',
      );
    }

    const link = await this.db.projectLink.findFirst({
      where: { id: linkId, projectId, organizationId },
      select: { id: true, projectId: true },
    });
    if (!link || link.projectId !== projectId) {
      throw new NotFoundException('Project link not found');
    }

    return this.db.projectLink.update({
      where: { id: linkId, organizationId },
      data: { deletedAt: new Date() },
    });
  }

  async getProgress(projectId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project manager or admin can view project progress',
      );
    }

    const project = await this.db.project.findUnique({
      where: { id: projectId, organizationId },
      select: { id: true, projectName: true, status: true },
    });
    if (!project)
      throw new NotFoundException(`Project #${projectId} not found`);

    const tasks = await this.db.task.findMany({
      where: { projectId, organizationId },
      select: { id: true, status: true },
    });

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
    const progressPercent =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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
