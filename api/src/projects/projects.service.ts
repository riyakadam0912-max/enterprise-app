import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { isPlatformAdministrator } from '../common/utils/platform-admin';
import { Role } from '../common/enums/role.enum';
import { CreateProjectLinkDto } from './dto/create-project-link.dto';
import { AuthUser } from '../common/types/auth';
import { BusinessUnitsService } from '../business-units/business-units.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Optional } from '@nestjs/common';
import { OrganizationScopeService } from '../organizations/organization-scope.service';
import { ProjectQueryDto } from './dto/project-query.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { CreateTaskListDto } from './dto/create-task-list.dto';
import { UpdateTaskListDto } from './dto/update-task-list.dto';
import { CreateTaskDependencyDto } from './dto/create-task-dependency.dto';
import { CreateProjectIssueDto } from './dto/create-project-issue.dto';
import { UpdateProjectIssueDto } from './dto/update-project-issue.dto';
import { CreateProjectBaselineDto } from './dto/create-project-baseline.dto';

const PROJECT_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'IN_APPROVAL',
  'BLOCKED_CANCELLED',
  'POSTPONED',
  'COMPLETED',
] as const;
const TASK_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'COMPLETED',
  'REJECTED',
] as const;
@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly businessUnitsService: BusinessUnitsService,
    private readonly organizationScopeService: OrganizationScopeService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  private get db() {
    return this.prisma;
  }

  private isPlatformAdmin(user: AuthUser): boolean {
    return isPlatformAdministrator(user);
  }

  private async notifyProjectChange(
    projectId: number,
    organizationId: number,
    actorUserId: number,
    action: string,
    details: string,
    additionalRecipientIds: number[] = [],
  ) {
    if (!this.notificationsService) return;
    const recipients = await this.db.user.findMany({
      where: {
        isActive: true,
        OR: [{ role: Role.SUPER_ADMIN }, { role: Role.ADMIN, organizationId }],
      },
      select: { id: true },
    });
    const recipientIds = Array.from(
      new Set([
        ...recipients.map(({ id }) => id),
        ...additionalRecipientIds.filter(
          (id) => Number.isInteger(id) && id > 0,
        ),
      ]),
    );
    if (recipientIds.length === 0) return;
    await this.notificationsService.sendNotification({
      recipientIds,
      organizationId,
      createdBy: actorUserId,
      title: `Project ${action}: #${projectId}`,
      message: details,
      module: 'Projects',
      entityType: 'Project',
      entityId: projectId,
      actionUrl: `/dashboard/projects?projectId=${projectId}`,
      type: 'INFO',
      priority: 'MEDIUM',
      category: 'PROJECT',
      channels: ['IN_APP', 'EMAIL'],
    });
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

  private async resolveEmployeeId(
    user: AuthUser,
    scopedUser: { employeeId: number | null },
  ): Promise<number | null> {
    if (scopedUser.employeeId != null) {
      return scopedUser.employeeId;
    }

    const employee = await this.db.employee.findFirst({
      where: {
        organizationId: this.validateOrganization(user),
        user: { id: user.userId },
        deletedAt: null,
      },
      select: { id: true },
    });
    return employee?.id ?? null;
  }

  async getProjectAccessWhere(
    user: AuthUser,
  ): Promise<Prisma.ProjectWhereInput> {
    const local = await this.getLocalProjectAccessWhere(user);
    if (user.role !== Role.MANAGER && user.role !== Role.EMPLOYEE) return local;
    const organizationId = this.validateOrganization(user);
    const related = (
      await this.organizationScopeService.getRelatedOrganizationIds(
        organizationId,
      )
    ).filter((id) => id !== organizationId);
    if (!related.length) return local;
    const shared: Prisma.ProjectWhereInput[] =
      user.role === Role.MANAGER
        ? [
            { managerId: user.userId },
            { coManagers: { some: { id: user.userId } } },
          ]
        : [];
    const employeeId =
      user.employeeId ??
      (await this.resolveEmployeeId(user, await this.getScopedUser(user)));
    if (employeeId)
      shared.push({ assignedEmployees: { some: { id: employeeId } } });
    if (!shared.length) return local;
    return {
      OR: [
        local,
        { organizationId: { in: related }, deletedAt: null, OR: shared },
      ],
    };
  }

  private async getLocalProjectAccessWhere(
    user: AuthUser,
  ): Promise<Prisma.ProjectWhereInput> {
    if (this.isPlatformAdmin(user) && user.organizationId == null) {
      return { deletedAt: null };
    }

    const projectOrganizationIds =
      (await this.getProjectOrganizationIds(user)) ?? [];
    const scope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildDirectBUWhere(scope);
    const baseWhere: Prisma.ProjectWhereInput = {
      organizationId: { in: projectOrganizationIds },
      deletedAt: null,
    };
    const otherOrganizationIds = projectOrganizationIds.filter(
      (id) => id !== scope.organizationId,
    );
    const scopedBUWhere: Prisma.ProjectWhereInput =
      otherOrganizationIds.length > 0
        ? { OR: [buWhere, { organizationId: { in: otherOrganizationIds } }] }
        : buWhere;

    let roleWhere: Prisma.ProjectWhereInput;
    let assignedEmployeeWhere: Prisma.ProjectWhereInput | null = null;
    let managerProjectWhere: Prisma.ProjectWhereInput | null = null;

    if (
      isPlatformAdministrator(user) ||
      user.role === Role.ADMIN ||
      user.role === Role.HR
    ) {
      roleWhere = baseWhere;
    } else if (user.role === Role.MANAGER) {
      roleWhere = {
        ...baseWhere,
        OR: [
          { managerId: user.userId },
          { coManagers: { some: { id: user.userId } } },
        ],
      };
    } else {
      const scopedUser = await this.getScopedUser(user);
      const employeeId = await this.resolveEmployeeId(user, scopedUser);
      if (!employeeId) {
        roleWhere = { ...baseWhere, id: -1 };
      } else {
        assignedEmployeeWhere = {
          assignedEmployees: { some: { id: employeeId } },
        };
        managerProjectWhere = {
          OR: [
            { managerUser: { teamMembers: { some: { id: user.userId } } } },
            {
              managerUser: {
                reportingEmployees: { some: { employeeId: user.userId } },
              },
            },
          ],
        };
        roleWhere = {
          ...baseWhere,
          OR: [
            { assignedEmployees: { some: { id: employeeId } } },
            { managerUser: { teamMembers: { some: { id: user.userId } } } },
            {
              managerUser: {
                reportingEmployees: { some: { employeeId: user.userId } },
              },
            },
            {
              tasks: {
                some: {
                  OR: [
                    { assignedToUserId: user.userId },
                    { assignedToId: employeeId },
                  ],
                },
              },
            },
          ],
        };
      }
    }

    if (assignedEmployeeWhere) {
      return {
        AND: [
          roleWhere,
          {
            OR: [
              assignedEmployeeWhere,
              ...(managerProjectWhere ? [managerProjectWhere] : []),
              scopedBUWhere,
            ],
          },
        ],
      };
    }

    if (user.role === Role.MANAGER) {
      return {
        AND: [
          baseWhere,
          {
            OR: [
              { managerId: user.userId },
              { coManagers: { some: { id: user.userId } } },
              scopedBUWhere,
            ],
          },
        ],
      };
    }

    return { AND: [roleWhere, scopedBUWhere] };
  }

  private normalizeProjectStatus(
    status?: string | null,
  ): (typeof PROJECT_STATUSES)[number] {
    if (!status) return 'NOT_STARTED';

    const normalized = status.trim().toUpperCase();
    if (
      normalized === 'NOT_STARTED' ||
      normalized === 'PLANNED' ||
      normalized === 'PLANNING'
    )
      return 'NOT_STARTED';
    if (
      normalized === 'IN_PROGRESS' ||
      normalized === 'IN PROGRESS' ||
      normalized === 'ACTIVE'
    )
      return 'IN_PROGRESS';
    if (normalized === 'IN_APPROVAL' || normalized === 'IN APPROVAL')
      return 'IN_APPROVAL';
    if (
      normalized === 'BLOCKED_CANCELLED' ||
      normalized === 'BLOCKED/CANCELLED' ||
      normalized === 'ON HOLD'
    )
      return 'BLOCKED_CANCELLED';
    if (normalized === 'POSTPONED' || normalized === 'POSTPONDED')
      return 'POSTPONED';
    if (normalized === 'COMPLETED') return 'COMPLETED';

    return 'NOT_STARTED';
  }

  private async validateOwners(
    ownerIds: number[],
    organizationIds: number | number[],
  ) {
    const uniqueOwnerIds = [...new Set(ownerIds)];
    if (uniqueOwnerIds.length === 0) return [];
    const allowedOrganizationIds = Array.isArray(organizationIds)
      ? organizationIds
      : [organizationIds];

    const owners = await this.db.user.findMany({
      where: {
        id: { in: uniqueOwnerIds },
        isActive: true,
        organizationId: { in: allowedOrganizationIds },
        role: { in: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER] },
      },
      select: { id: true, name: true, role: true, organizationId: true },
    });
    const allowedOwnerRoles: Role[] = [
      Role.SUPER_ADMIN,
      Role.ADMIN,
      Role.MANAGER,
    ];
    if (
      owners.length !== uniqueOwnerIds.length ||
      owners.some((owner) => !allowedOwnerRoles.includes(owner.role))
    ) {
      throw new NotFoundException(
        'One or more project owners were not found or have an invalid role',
      );
    }
    return owners;
  }

  private async getProjectScope(
    user: AuthUser,
  ): Promise<Prisma.ProjectWhereInput> {
    return this.getProjectAccessWhere(user);
  }

  private async getProjectOrganizationIds(
    user: AuthUser,
  ): Promise<number[] | null> {
    if (this.isPlatformAdmin(user) && user.organizationId == null) return null;
    const organizationId = this.validateOrganization(user);
    if (this.isPlatformAdmin(user)) {
      return this.organizationScopeService.getOrganizationIds(user);
    }
    const isHierarchyAdmin =
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      user.role === Role.SUPER_ADMIN ||
      user.roles?.includes(Role.ADMIN) === true ||
      user.roles?.includes(Role.HR) === true;
    return isHierarchyAdmin
      ? this.organizationScopeService.getRelatedOrganizationIds(
          user.homeOrganizationId ?? organizationId,
        )
      : [organizationId];
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

  private async getAccessibleProject(projectId: number, user: AuthUser) {
    this.validateOrganization(user);
    const project = await this.db.project.findFirst({
      where: { id: projectId, ...(await this.getProjectAccessWhere(user)) },
      select: { id: true, organizationId: true },
    });
    if (!project)
      throw new ForbiddenException('You can only access allowed projects');
    return project;
  }

  private async canManageProject(
    projectId: number,
    user: AuthUser,
  ): Promise<boolean> {
    if (
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      user.role === Role.SUPER_ADMIN ||
      user.isPlatformAdmin === true ||
      user.isSuperAdmin === true ||
      user.roles.includes(Role.SUPER_ADMIN)
    ) {
      return true;
    }
    if (user.role !== Role.MANAGER) {
      return false;
    }

    this.validateOrganization(user);
    const project = await this.db.project.findFirst({
      where: {
        id: projectId,
        AND: [await this.getProjectAccessWhere(user)],
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
    if (
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      user.role === Role.SUPER_ADMIN ||
      user.isPlatformAdmin === true ||
      user.isSuperAdmin === true ||
      user.roles.includes(Role.SUPER_ADMIN)
    ) {
      return true;
    }
    if (user.role !== Role.MANAGER) {
      return false;
    }

    this.validateOrganization(user);
    const project = await this.db.project.findFirst({
      where: {
        id: projectId,
        AND: [await this.getProjectAccessWhere(user)],
        managerId: user.userId,
      },
      select: { id: true },
    });
    return Boolean(project);
  }

  private async getAssignableProjectOrganizationIds(
    projectOrganizationId: number,
    user: AuthUser,
  ): Promise<number[]> {
    const relatedOrganizationIds =
      await this.organizationScopeService.getRelatedOrganizationIds(
        projectOrganizationId,
      );
    const accessibleOrganizationIds =
      await this.getProjectOrganizationIds(user);
    if (accessibleOrganizationIds === null) return relatedOrganizationIds;
    return relatedOrganizationIds.filter((id) =>
      accessibleOrganizationIds.includes(id),
    );
  }

  private async getAssignableEmployeeOrganizationIds(
    projectOrganizationId: number,
    user: AuthUser,
  ): Promise<number[]> {
    const relatedOrganizationIds =
      await this.organizationScopeService.getRelatedOrganizationIds(
        projectOrganizationId,
      );
    const accessibleOrganizationIds =
      await this.organizationScopeService.getOrganizationIds(user);
    if (accessibleOrganizationIds === null) return relatedOrganizationIds;
    return relatedOrganizationIds.filter((id) =>
      accessibleOrganizationIds.includes(id),
    );
  }

  private async assertManager(
    managerId: number,
    organizationIds: number | number[],
  ): Promise<
    Prisma.UserGetPayload<{
      select: { id: true; name: true; role: true };
    }>
  > {
    const allowedOrganizationIds = Array.isArray(organizationIds)
      ? organizationIds
      : [organizationIds];
    const managerWhere = {
      id: managerId,
      isActive: true,
      organizationId:
        allowedOrganizationIds.length === 1
          ? allowedOrganizationIds[0]
          : { in: allowedOrganizationIds },
    };
    const manager =
      allowedOrganizationIds.length === 1
        ? await this.db.user.findUnique({ where: managerWhere })
        : await this.db.user.findFirst({ where: managerWhere });
    const managerRole = manager?.role as Role | undefined;
    if (!manager || managerRole !== Role.MANAGER) {
      throw new NotFoundException('Assigned manager not found or invalid role');
    }
    return manager;
  }

  async create(dto: CreateProjectDto, user: AuthUser) {
    if (
      !this.isPlatformAdmin(user) &&
      user.role !== Role.ADMIN &&
      user.role !== Role.MANAGER
    ) {
      throw new ForbiddenException(
        'Only administrators or managers can create projects',
      );
    }
    const organizationId = this.validateOrganization(user);
    const assignableOrganizationIds =
      await this.getAssignableProjectOrganizationIds(organizationId, user);
    const scope = await this.businessUnitsService.resolveScope(user as any);
    const dtoAny = dto as any;
    if (dtoAny.businessUnitId != null) {
      await this.businessUnitsService.assertRecordAccessible(
        scope,
        dtoAny.businessUnitId,
        'project',
      );
    }
    const resolvedName = dto.projectName?.trim() || dto.name?.trim();
    if (!resolvedName) {
      throw new ForbiddenException('Project name is required');
    }

    const owners = await this.validateOwners(
      dto.ownerIds ?? [],
      assignableOrganizationIds,
    );
    const managerId =
      dto.managerId ?? (user.role === Role.MANAGER ? user.userId : undefined);
    const manager = managerId
      ? await this.assertManager(managerId, assignableOrganizationIds)
      : null;
    const managerName = dto.manager ?? manager?.name ?? null;

    if (dto.customerId != null) {
      const customer = await this.db.customer.findFirst({
        where: { id: dto.customerId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!customer) throw new NotFoundException('Customer not found');
    }

    const project = await this.db.project.create({
      data: {
        organizationId,
        projectName: resolvedName,
        projectCode: dto.projectCode,
        clientName: dto.clientName ?? dto.client,
        customerId: dto.customerId ?? null,
        tags: dto.tags ?? [],
        category: dto.category,
        projectType: dto.projectType,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate:
          dto.deadline || dto.endDate
            ? new Date(dto.deadline || dto.endDate!)
            : undefined,
        manager: managerName,
        managerId: managerId,
        managerAssignedById: managerId != null ? user.userId : null,
        owners: {
          connect: [
            ...new Set([user.userId, ...owners.map((owner) => owner.id)]),
          ].map((id) => ({ id })),
        },
        createdById: user.userId,
        status: this.normalizeProjectStatus(dto.status),
        budget: dto.budget,
        description: dto.description,
        specificTask: dto.specificTask,
        priority: dto.priority,
        remarks: dto.remarks,
        finalDeliverablesLink: dto.finalDeliverablesLink,
        driveLink: dto.driveLink,
        client: dto.client,
        projectLead: dto.projectLead,
        ...(dtoAny.businessUnitId != null && {
          businessUnitId: dtoAny.businessUnitId,
        }),
      },
      include: {
        _count: { select: { tasks: true, clientAccess: true } },
        managerUser: { select: { id: true, name: true, email: true } },
        managerAssignedBy: { select: { id: true, name: true, email: true } },
        owners: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
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
        customer: {
          select: { id: true, customerName: true, customerType: true },
        },
      },
    });
    try {
      await this.notifyProjectChange(
        project.id,
        organizationId,
        user.userId,
        'created',
        `Project ${project.projectName} was created.`,
      );
    } catch (error) {
      this.logger.error(
        `Project notification failed for #${project.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    return project;
  }

  async assignManager(projectId: number, managerId: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const projectOrganizationIds = await this.getProjectOrganizationIds(user);
    const projectScope = await this.getProjectScope(user);
    const existing =
      projectOrganizationIds?.length === 1 &&
      projectOrganizationIds[0] === organizationId
        ? await this.db.project.findUnique({
            where: { id: projectId, organizationId },
            select: { id: true, organizationId: true },
          })
        : await this.db.project.findFirst({
            where: { id: projectId, ...projectScope },
            select: { id: true, organizationId: true },
          });
    if (!existing)
      throw new NotFoundException(`Project #${projectId} not found`);

    const assignableManagerOrganizationIds =
      await this.getAssignableProjectOrganizationIds(
        existing.organizationId,
        user,
      );
    const manager = await this.assertManager(
      managerId,
      assignableManagerOrganizationIds,
    );
    const updated = await this.db.project.update({
      where: { id: projectId },
      data: {
        managerId,
        manager: manager.name,
        managerAssignedById: user.userId,
      },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        managerAssignedBy: { select: { id: true, name: true, email: true } },
        owners: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
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
    await this.notifyProjectChange(
      updated.id,
      organizationId,
      user.userId,
      'owner updated',
      `Project manager changed to ${manager.name}.`,
    );
    return updated;
  }

  async findAll(user: AuthUser) {
    const where = await this.getProjectScope(user);
    return this.db.project.findMany({
      where,
      include: {
        _count: { select: { tasks: true, clientAccess: true } },
        managerUser: { select: { id: true, name: true, email: true } },
        managerAssignedBy: { select: { id: true, name: true, email: true } },
        owners: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true } },
        coManagers: {
          where: { deletedAt: null },
          select: { id: true, name: true, email: true },
        },
        assignedEmployees: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        links: { where: { deletedAt: null } },
        customer: {
          select: { id: true, customerName: true, customerType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async query(query: ProjectQueryDto, user: AuthUser) {
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(query.pageSize ?? '25', 10) || 25),
    );
    const and: Prisma.ProjectWhereInput[] = [await this.getProjectScope(user)];
    const numberFilter = (value?: string) => {
      const parsed = value == null ? NaN : Number.parseInt(value, 10);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    };
    const managerId = numberFilter(query.managerId);
    if (query.search?.trim()) {
      const search = query.search.trim();
      and.push({
        OR: [
          { projectName: { contains: search, mode: 'insensitive' } },
          { projectCode: { contains: search, mode: 'insensitive' } },
          { clientName: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (query.status) and.push({ status: query.status });
    if (query.priority) and.push({ priority: query.priority });
    if (managerId) and.push({ managerId });
    if (query.startFrom || query.endTo) {
      and.push({
        startDate: {
          ...(query.startFrom ? { gte: new Date(query.startFrom) } : {}),
          ...(query.endTo ? { lte: new Date(query.endTo) } : {}),
        },
      });
    }
    const where: Prisma.ProjectWhereInput = { AND: and };
    const allowedSorts = new Set(['createdAt', 'updatedAt', 'projectName', 'startDate', 'endDate', 'priority', 'status']);
    const sortBy = allowedSorts.has(query.sortBy ?? '') ? query.sortBy! : 'createdAt';
    const sortDirection = query.sortDirection === 'asc' ? 'asc' : 'desc';
    const [total, items] = await this.db.$transaction([
      this.db.project.count({ where }),
      this.db.project.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy]: sortDirection } as Prisma.ProjectOrderByWithRelationInput,
        select: {
          id: true,
          projectName: true,
          projectCode: true,
          status: true,
          priority: true,
          startDate: true,
          endDate: true,
          managerId: true,
          clientName: true,
          budget: true,
          createdAt: true,
          updatedAt: true,
          managerUser: { select: { id: true, name: true, email: true } },
          _count: { select: { tasks: true, issues: true, milestones: true } },
        },
      }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: number, user: AuthUser) {
    const organizationId = user.organizationId;
    const hasAccess = await this.canViewProject(id, user);
    if (!hasAccess) {
      throw new ForbiddenException('You can only access allowed projects');
    }

    const tasksWhere =
      user.role === Role.EMPLOYEE
        ? {
            projectId: id,
            OR: [
              { assignedToUserId: user.userId },
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
          }
        : {
            projectId: id,
          };

    const project = await this.db.project.findUnique({
      where: { id },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        managerAssignedBy: { select: { id: true, name: true, email: true } },
        owners: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true } },
        coManagers: {
          where: { deletedAt: null },
          select: { id: true, name: true, email: true },
        },
        assignedEmployees: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        links: { where: { deletedAt: null } },
      },
    });
    if (!project) throw new NotFoundException(`Project #${id} not found`);

    const tasks = await this.db.task.findMany({
      where: tasksWhere,
      include: {
        timerSessions: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const teamMembers = project.managerId
      ? await this.db.user.findMany({
          where: {
            ...(organizationId == null ? {} : { organizationId }),
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

  async getWorkspace(id: number, user: AuthUser) {
    const hasAccess = await this.canViewProject(id, user);
    if (!hasAccess) throw new ForbiddenException('You can only access allowed projects');
    const project = await this.db.project.findFirst({
      where: { id, ...(await this.getProjectAccessWhere(user)) },
      select: { id: true, projectName: true, status: true, organizationId: true },
    });
    if (!project) throw new NotFoundException(`Project #${id} not found`);
    const taskScope = user.role === Role.EMPLOYEE
      ? {
          projectId: id,
          OR: [
            { assignedToUserId: user.userId },
            ...(user.employeeId ? [{ assignedToId: user.employeeId }] : []),
            ...(user.employeeId
              ? [{ projectRef: { assignedEmployees: { some: { id: user.employeeId } } } }]
              : []),
          ],
        }
      : { projectId: id };
    const [milestones, taskLists, issues] = await this.db.$transaction([
      this.db.projectMilestone.findMany({ where: { projectId: id }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.db.taskList.findMany({ where: { projectId: id }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.db.projectIssue.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          reportedBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);
    const tasks = await this.db.task.findMany({
      where: taskScope,
      select: {
        id: true, taskName: true, status: true, priority: true, startDate: true, dueDate: true,
        completionPercent: true, milestoneId: true, taskListId: true, parentTaskId: true,
        assignedToUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ taskListId: 'asc' }, { createdAt: 'asc' }],
    });
    return { project, milestones, taskLists, tasks, issues };
  }

  async createMilestone(projectId: number, dto: CreateMilestoneDto, user: AuthUser) {
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) throw new ForbiddenException('Only project managers can manage milestones');
    const project = await this.getAccessibleProject(projectId, user);
    if (!dto.name.trim()) throw new BadRequestException('Milestone name is required');
    return this.db.projectMilestone.create({
      data: {
        projectId,
        organizationId: project.organizationId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: dto.status ?? 'NOT_STARTED',
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateMilestone(projectId: number, milestoneId: number, dto: UpdateMilestoneDto, user: AuthUser) {
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) throw new ForbiddenException('Only project managers can manage milestones');
    const project = await this.getAccessibleProject(projectId, user);
    const existing = await this.db.projectMilestone.findFirst({ where: { id: milestoneId, projectId, organizationId: project.organizationId } });
    if (!existing) throw new NotFoundException('Milestone not found');
    return this.db.projectMilestone.update({
      where: { id: milestoneId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async removeMilestone(projectId: number, milestoneId: number, user: AuthUser) {
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) throw new ForbiddenException('Only project managers can manage milestones');
    const project = await this.getAccessibleProject(projectId, user);
    const existing = await this.db.projectMilestone.findFirst({ where: { id: milestoneId, projectId, organizationId: project.organizationId } });
    if (!existing) throw new NotFoundException('Milestone not found');
    return this.db.$transaction(async (tx) => {
      await tx.task.updateMany({ where: { milestoneId }, data: { milestoneId: null } });
      return tx.projectMilestone.delete({ where: { id: milestoneId } });
    });
  }

  async createTaskList(projectId: number, dto: CreateTaskListDto, user: AuthUser) {
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) throw new ForbiddenException('Only project managers can manage task lists');
    const project = await this.getAccessibleProject(projectId, user);
    if (!dto.name.trim()) throw new BadRequestException('Task list name is required');
    return this.db.taskList.create({
      data: { projectId, organizationId: project.organizationId, name: dto.name.trim(), description: dto.description?.trim() || null, sortOrder: dto.sortOrder ?? 0 },
    });
  }

  async updateTaskList(projectId: number, taskListId: number, dto: UpdateTaskListDto, user: AuthUser) {
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) throw new ForbiddenException('Only project managers can manage task lists');
    const project = await this.getAccessibleProject(projectId, user);
    const existing = await this.db.taskList.findFirst({ where: { id: taskListId, projectId, organizationId: project.organizationId } });
    if (!existing) throw new NotFoundException('Task list not found');
    return this.db.taskList.update({ where: { id: taskListId }, data: { ...(dto.name !== undefined && { name: dto.name.trim() }), ...(dto.description !== undefined && { description: dto.description?.trim() || null }), ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }) } });
  }

  async removeTaskList(projectId: number, taskListId: number, user: AuthUser) {
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) throw new ForbiddenException('Only project managers can manage task lists');
    const project = await this.getAccessibleProject(projectId, user);
    const existing = await this.db.taskList.findFirst({ where: { id: taskListId, projectId, organizationId: project.organizationId } });
    if (!existing) throw new NotFoundException('Task list not found');
    return this.db.$transaction(async (tx) => {
      await tx.task.updateMany({ where: { taskListId }, data: { taskListId: null } });
      return tx.taskList.delete({ where: { id: taskListId } });
    });
  }

  async createDependency(projectId: number, dto: CreateTaskDependencyDto, user: AuthUser) {
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) throw new ForbiddenException('Only project managers can manage dependencies');
    const project = await this.getAccessibleProject(projectId, user);
    if (dto.predecessorId === dto.successorId) throw new BadRequestException('A task cannot depend on itself');
    const tasks = await this.db.task.findMany({ where: { id: { in: [dto.predecessorId, dto.successorId] }, projectId, organizationId: project.organizationId, deletedAt: null }, select: { id: true } });
    if (tasks.length !== 2) throw new NotFoundException('Both dependency tasks must belong to the project');
    const duplicate = await this.db.taskDependency.findFirst({ where: { predecessorId: dto.predecessorId, successorId: dto.successorId } });
    if (duplicate) throw new BadRequestException('Dependency already exists');
    const visited = new Set<number>();
    const pending = [dto.successorId];
    while (pending.length) {
      const current = pending.pop()!;
      if (current === dto.predecessorId) throw new BadRequestException('Dependency would create a cycle');
      if (visited.has(current)) continue;
      visited.add(current);
      const edges = await this.db.taskDependency.findMany({ where: { predecessorId: current, projectId }, select: { successorId: true } });
      pending.push(...edges.map((edge) => edge.successorId));
    }
    return this.db.taskDependency.create({ data: { projectId, organizationId: project.organizationId, predecessorId: dto.predecessorId, successorId: dto.successorId, dependencyType: dto.dependencyType ?? 'FINISH_TO_START', lagDays: dto.lagDays ?? 0 } });
  }

  async removeDependency(projectId: number, dependencyId: number, user: AuthUser) {
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) throw new ForbiddenException('Only project managers can manage dependencies');
    const project = await this.getAccessibleProject(projectId, user);
    const existing = await this.db.taskDependency.findFirst({ where: { id: dependencyId, projectId, organizationId: project.organizationId } });
    if (!existing) throw new NotFoundException('Dependency not found');
    return this.db.taskDependency.delete({ where: { id: dependencyId } });
  }

  async createIssue(projectId: number, dto: CreateProjectIssueDto, user: AuthUser) {
    const project = await this.getAccessibleProject(projectId, user);
    if (!dto.title.trim()) throw new BadRequestException('Issue title is required');
    if (dto.taskId != null) {
      const task = await this.db.task.findFirst({ where: { id: dto.taskId, projectId, organizationId: project.organizationId, deletedAt: null }, select: { id: true } });
      if (!task) throw new NotFoundException('Issue task not found');
    }
    if (dto.assignedToId != null) {
      const assignee = await this.db.user.findFirst({ where: { id: dto.assignedToId, organizationId: project.organizationId, isActive: true }, select: { id: true } });
      if (!assignee) throw new NotFoundException('Issue assignee not found');
    }
    return this.db.projectIssue.create({ data: { projectId, organizationId: project.organizationId, title: dto.title.trim(), description: dto.description?.trim() || null, status: dto.status ?? 'OPEN', priority: dto.priority ?? 'MEDIUM', severity: dto.severity?.trim() || null, taskId: dto.taskId ?? null, assignedToId: dto.assignedToId ?? null, reportedById: user.userId, dueDate: dto.dueDate ? new Date(dto.dueDate) : null } });
  }

  async updateIssue(projectId: number, issueId: number, dto: UpdateProjectIssueDto, user: AuthUser) {
    const project = await this.getAccessibleProject(projectId, user);
    const issue = await this.db.projectIssue.findFirst({ where: { id: issueId, projectId, organizationId: project.organizationId } });
    if (!issue) throw new NotFoundException('Issue not found');
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage && issue.reportedById !== user.userId && issue.assignedToId !== user.userId) throw new ForbiddenException('You cannot update this issue');
    if (dto.title !== undefined && !dto.title.trim()) throw new BadRequestException('Issue title is required');
    if (dto.taskId != null) {
      const task = await this.db.task.findFirst({ where: { id: dto.taskId, projectId, organizationId: project.organizationId, deletedAt: null }, select: { id: true } });
      if (!task) throw new NotFoundException('Issue task not found');
    }
    if (dto.assignedToId != null) {
      const assignee = await this.db.user.findFirst({ where: { id: dto.assignedToId, organizationId: project.organizationId, isActive: true }, select: { id: true } });
      if (!assignee) throw new NotFoundException('Issue assignee not found');
    }
    return this.db.projectIssue.update({ where: { id: issueId }, data: { ...(dto.title !== undefined && { title: dto.title.trim() }), ...(dto.description !== undefined && { description: dto.description?.trim() || null }), ...(dto.status !== undefined && { status: dto.status, resolvedAt: ['RESOLVED', 'CLOSED'].includes(dto.status) ? new Date() : null }), ...(dto.priority !== undefined && { priority: dto.priority }), ...(dto.severity !== undefined && { severity: dto.severity?.trim() || null }), ...(dto.taskId !== undefined && { taskId: dto.taskId ?? null }), ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId ?? null }), ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }) } });
  }

  async removeIssue(projectId: number, issueId: number, user: AuthUser) {
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) throw new ForbiddenException('Only project managers can remove issues');
    const project = await this.getAccessibleProject(projectId, user);
    const issue = await this.db.projectIssue.findFirst({ where: { id: issueId, projectId, organizationId: project.organizationId } });
    if (!issue) throw new NotFoundException('Issue not found');
    return this.db.projectIssue.delete({ where: { id: issueId } });
  }

  async addCoManager(
    projectId: number,
    userId: number,
    requestingUser: AuthUser,
  ) {
    this.validateOrganization(requestingUser);
    const projectScope = await this.getProjectAccessWhere(requestingUser);
    const project = await this.db.project.findFirst({
      where: { id: projectId, ...projectScope },
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

    const coManagersArray = Array.isArray(project.coManagers)
      ? project.coManagers
      : [];
    const alreadyAssigned = coManagersArray.some(
      (coManager) => coManager.id === userId,
    );
    if (alreadyAssigned) {
      return this.findOne(projectId, requestingUser);
    }

    const assignableOrganizationIds =
      await this.getAssignableProjectOrganizationIds(
        project.organizationId,
        requestingUser,
      );
    const manager = await this.assertManager(userId, assignableOrganizationIds);

    const updated = await this.db.project.update({
      where: { id: projectId, organizationId: project.organizationId },
      data: { coManagers: { connect: { id: manager.id } } },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        owners: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        coManagers: {
          where: { organizationId: { in: assignableOrganizationIds } },
          select: { id: true, name: true, email: true },
        },
        assignedEmployees: {
          where: { organizationId: { in: assignableOrganizationIds } },
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        links: { where: { organizationId: project.organizationId } },
      },
    });
    await this.notifyProjectChange(
      updated.id,
      project.organizationId,
      requestingUser.userId,
      'team updated',
      `Co-manager ${manager.name} added to the project.`,
    );
    return updated;
  }

  async removeCoManager(
    projectId: number,
    userId: number,
    requestingUser: AuthUser,
  ) {
    this.validateOrganization(requestingUser);
    const projectScope = await this.getProjectAccessWhere(requestingUser);
    const project = await this.db.project.findFirst({
      where: { id: projectId, ...projectScope },
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

    const assignableOrganizationIds =
      await this.getAssignableProjectOrganizationIds(
        project.organizationId,
        requestingUser,
      );
    const coManager = await this.assertManager(
      userId,
      assignableOrganizationIds,
    );

    const updated = await this.db.project.update({
      where: { id: projectId, organizationId: project.organizationId },
      data: { coManagers: { disconnect: { id: userId } } },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        owners: { select: { id: true, name: true, email: true, role: true } },
        coManagers: {
          where: { organizationId: { in: assignableOrganizationIds } },
          select: { id: true, name: true, email: true },
        },
        assignedEmployees: {
          where: { organizationId: { in: assignableOrganizationIds } },
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        links: { where: { organizationId: project.organizationId } },
      },
    });
    await this.notifyProjectChange(
      updated.id,
      project.organizationId,
      requestingUser.userId,
      'team updated',
      `Co-manager ${coManager.name} removed from the project.`,
    );
    return updated;
  }

  async assignEmployee(
    projectId: number,
    employeeId: number,
    requestingUser: AuthUser,
    driveLink?: string,
  ) {
    this.validateOrganization(requestingUser);
    const allowed = await this.canManageProject(projectId, requestingUser);
    if (!allowed) {
      throw new ForbiddenException(
        'Only project managers or admin can assign employees',
      );
    }

    const projectScope = await this.getProjectScope(requestingUser);
    const project = await this.db.project.findFirst({
      where: { id: projectId, ...projectScope },
      include: { assignedEmployees: { select: { id: true } } },
    });
    if (!project) {
      throw new NotFoundException(`Project #${projectId} not found`);
    }

    const assignableOrganizationIds =
      await this.getAssignableEmployeeOrganizationIds(
        project.organizationId,
        requestingUser,
      );
    if (assignableOrganizationIds.length === 0) {
      throw new NotFoundException('Employee not found');
    }
    const employeeScope = await this.businessUnitsService.resolveScope(
      requestingUser as any,
    );
    const sameOrganizationEmployeeWhere = {
      ...this.businessUnitsService.buildEmployeeBUWhere(employeeScope),
      id: employeeId,
      organizationId: employeeScope.organizationId,
    };
    const otherAssignableOrganizationIds = assignableOrganizationIds.filter(
      (id) => id !== employeeScope.organizationId,
    );
    const employeeWhere: Prisma.EmployeeWhereInput = {
      OR: [
        sameOrganizationEmployeeWhere,
        ...(otherAssignableOrganizationIds.length > 0
          ? [
              {
                id: employeeId,
                organizationId: { in: otherAssignableOrganizationIds },
                deletedAt: null,
              },
            ]
          : []),
      ],
    };
    const employee = await this.db.employee.findFirst({
      where: employeeWhere,
      include: { user: { select: { id: true } } },
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

    const updated = await this.db.project.update({
      where: { id: projectId },
      data: {
        assignedEmployees: { connect: { id: employeeId } },
        owners: { connect: { id: requestingUser.userId } },
        ...(driveLink !== undefined && { driveLink }),
      },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        owners: { select: { id: true, name: true, email: true, role: true } },
        coManagers: {
          where: { organizationId: { in: assignableOrganizationIds } },
          select: { id: true, name: true, email: true },
        },
        assignedEmployees: {
          where: { organizationId: { in: assignableOrganizationIds } },
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        links: { where: { organizationId: project.organizationId } },
      },
    });
    await this.notifyProjectChange(
      updated.id,
      project.organizationId,
      requestingUser.userId,
      'team updated',
      `Employee ${employee.name || `#${employee.id}`} assigned to the project.`,
      employee.user?.id ? [employee.user.id] : [],
    );
    return updated;
  }

  async removeEmployee(
    projectId: number,
    employeeId: number,
    requestingUser: AuthUser,
  ) {
    this.validateOrganization(requestingUser);
    const allowed = await this.canManageProject(projectId, requestingUser);
    if (!allowed) {
      throw new ForbiddenException(
        'Only project managers or admin can remove employees',
      );
    }

    const { organizationId } = await this.getAccessibleProject(
      projectId,
      requestingUser,
    );

    const employee = await this.db.employee.findFirst({
      where: {
        id: employeeId,
        assignedProjects: { some: { id: projectId } },
        deletedAt: null,
      },
      select: { id: true, name: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const updated = await this.db.project.update({
      where: { id: projectId, organizationId },
      data: { assignedEmployees: { disconnect: { id: employeeId } } },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        owners: { select: { id: true, name: true, email: true, role: true } },
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
    await this.notifyProjectChange(
      updated.id,
      organizationId,
      requestingUser.userId,
      'team updated',
      `Employee ${employee.name || `#${employee.id}`} removed from the project.`,
    );
    return updated;
  }

  async update(id: number, dto: UpdateProjectDto, user: AuthUser) {
    this.validateOrganization(user);
    const canManage = await this.canManageProject(id, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project manager or admin can update this project',
      );
    }

    const { organizationId } = await this.getAccessibleProject(id, user);

    const scope = await this.businessUnitsService.resolveScope(user as any);
    const dtoAny = dto as any;
    if (dtoAny.businessUnitId != null) {
      const unit = await this.db.businessUnit.findFirst({
        where: { id: dtoAny.businessUnitId, organizationId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!unit) throw new NotFoundException('Business unit not found');
    }
    if (
      dtoAny.businessUnitId !== undefined &&
      organizationId === user.organizationId
    ) {
      await this.businessUnitsService.assertRecordAccessible(
        scope,
        dtoAny.businessUnitId,
        'project',
      );
    }

    if (dto.customerId != null) {
      const customer = await this.db.customer.findFirst({
        where: { id: dto.customerId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!customer) throw new NotFoundException('Customer not found');
    }

    let managerName = dto.manager;
    if (dto.managerId) {
      const assignableOrganizationIds =
        await this.getAssignableProjectOrganizationIds(organizationId, user);
      const manager = await this.assertManager(
        dto.managerId,
        assignableOrganizationIds,
      );
      managerName = manager.name;
    }

    let ownersToSet: number[] | undefined;
    if (dto.ownerIds !== undefined) {
      const project = await this.db.project.findUnique({
        where: { id, organizationId },
        select: { createdById: true },
      });
      if (!project) throw new NotFoundException(`Project #${id} not found`);
      const assignableOrganizationIds =
        await this.getAssignableProjectOrganizationIds(organizationId, user);
      const owners = await this.validateOwners(
        dto.ownerIds,
        assignableOrganizationIds,
      );
      ownersToSet = [
        ...new Set([
          ...(project.createdById == null ? [] : [project.createdById]),
          ...owners.map((owner) => owner.id),
        ]),
      ];
    }

    const updated = await this.db.project.update({
      where: { id, organizationId },
      data: {
        ...((dto.projectName !== undefined || dto.name !== undefined) && {
          projectName: dto.projectName ?? dto.name,
        }),
        ...(dto.clientName !== undefined && { clientName: dto.clientName }),
        ...(dto.customerId !== undefined && { customerId: dto.customerId }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.projectType !== undefined && { projectType: dto.projectType }),
        ...(dto.specificTask !== undefined && {
          specificTask: dto.specificTask,
        }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
        ...(dto.finalDeliverablesLink !== undefined && {
          finalDeliverablesLink: dto.finalDeliverablesLink,
        }),
        ...(dto.driveLink !== undefined && { driveLink: dto.driveLink }),
        ...(ownersToSet !== undefined && {
          owners: { set: ownersToSet.map((ownerId) => ({ id: ownerId })) },
        }),
        ...(dto.projectCode !== undefined && { projectCode: dto.projectCode }),
        ...(dto.managerId !== undefined && { managerId: dto.managerId }),
        ...(dto.managerId !== undefined && {
          managerAssignedById: dto.managerId ? user.userId : null,
        }),
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
        ...(dtoAny.businessUnitId !== undefined && {
          businessUnitId: dtoAny.businessUnitId,
        }),
      },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        managerAssignedBy: { select: { id: true, name: true, email: true } },
        owners: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        links: { where: { organizationId } },
      },
    });
    await this.notifyProjectChange(
      updated.id,
      organizationId,
      user.userId,
      'updated',
      'Project details were updated.',
    );
    return updated;
  }

  async updateStatus(id: number, status: string, user: AuthUser) {
    this.validateOrganization(user);
    const canManage = await this.canManageProject(id, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project manager or admin can update this project status',
      );
    }

    const { organizationId } = await this.getAccessibleProject(id, user);

    const updated = await this.db.project.update({
      where: { id, organizationId },
      data: { status: this.normalizeProjectStatus(status) },
      include: {
        managerUser: { select: { id: true, name: true, email: true } },
        managerAssignedBy: { select: { id: true, name: true, email: true } },
        owners: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    await this.notifyProjectChange(
      updated.id,
      organizationId,
      user.userId,
      'status changed',
      `Project status updated to ${this.normalizeProjectStatus(status)}.`,
    );
    return updated;
  }

  async remove(id: number, user: AuthUser) {
    this.validateOrganization(user);
    const canManage = await this.canManageProject(id, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project manager or admin can delete this project',
      );
    }
    const { organizationId } = await this.getAccessibleProject(id, user);

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
            managerAssignedById: importedManager ? user.userId : null,
            createdById: user.userId,
            owners: { connect: { id: user.userId } },
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
    if (
      user.role !== Role.ADMIN &&
      user.role !== Role.MANAGER &&
      user.role !== Role.SUPER_ADMIN &&
      user.role !== Role.EMPLOYEE
    ) {
      throw new ForbiddenException(
        'Only employees, managers, or administrators can view grouped status report',
      );
    }

    const where = await this.getProjectAccessWhere(user);
    const projects = await this.db.project.findMany({
      where,
      include: {
        owners: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        managerUser: { select: { id: true, name: true, email: true } },
        managerAssignedBy: { select: { id: true, name: true, email: true } },
      },
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

  async getEligibleManagers(user: AuthUser, projectId?: number) {
    let organizationId = user.organizationId;
    if (projectId !== undefined) {
      if (!Number.isInteger(projectId) || projectId <= 0) {
        throw new BadRequestException('Project ID must be a positive integer');
      }
      const project = await this.db.project.findFirst({
        where: { id: projectId, ...(await this.getProjectScope(user)) },
        select: { organizationId: true },
      });
      if (!project) {
        throw new NotFoundException(`Project #${projectId} not found`);
      }
      organizationId = project.organizationId;
    }
    if (organizationId == null && !this.isPlatformAdmin(user)) {
      throw new ForbiddenException('User has no associated organization');
    }
    if (organizationId == null) {
      throw new BadRequestException(
        'A project ID is required to scope platform-level assignment options',
      );
    }
    const assignableOrganizationIds =
      await this.getAssignableProjectOrganizationIds(organizationId, user);
    return this.db.user.findMany({
      where: {
        isActive: true,
        organizationId: { in: assignableOrganizationIds },
        role: { in: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER] },
      },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        organization: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getLinks(projectId: number, user: AuthUser) {
    const { organizationId } = await this.getAccessibleProject(projectId, user);
    return this.db.projectLink.findMany({
      where: { projectId, organizationId, deletedAt: null },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLink(
    projectId: number,
    dto: CreateProjectLinkDto,
    user: AuthUser,
  ) {
    this.validateOrganization(user);
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project manager or admin can add links',
      );
    }

    const { organizationId } = await this.getAccessibleProject(projectId, user);

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
    this.validateOrganization(user);
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project manager or admin can remove links',
      );
    }

    const { organizationId } = await this.getAccessibleProject(projectId, user);

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
    this.validateOrganization(user);
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) {
      throw new ForbiddenException(
        'Only project manager or admin can view project progress',
      );
    }

    const projectScope = await this.getProjectAccessWhere(user);
    const project = await this.db.project.findFirst({
      where: { id: projectId, ...projectScope },
      select: {
        id: true,
        organizationId: true,
        projectName: true,
        status: true,
      },
    });
    if (!project)
      throw new NotFoundException(`Project #${projectId} not found`);

    const tasks = await this.db.task.findMany({
      where: {
        projectId,
        organizationId: project.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        taskType: true,
        completionPercent: true,
        estimatedHours: true,
        actualHours: true,
        milestoneId: true,
        taskListId: true,
      },
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
    const completedTasks = byStatus.APPROVED + byStatus.COMPLETED;
    const progressPercent =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const plannedHours = tasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);
    const actualHours = tasks.reduce((sum, task) => sum + (task.actualHours ?? 0), 0);
    const milestoneRollups = new Map<number, { totalTasks: number; completedTasks: number; progressPercent: number }>();
    const taskListRollups = new Map<number, { totalTasks: number; completedTasks: number; progressPercent: number }>();
    for (const task of tasks) {
      const completed = ['APPROVED', 'COMPLETED'].includes(String(task.status ?? '').toUpperCase()) ? 1 : 0;
      for (const [groupId, rollups] of [[task.milestoneId, milestoneRollups], [task.taskListId, taskListRollups]] as const) {
        if (groupId == null) continue;
        const current = rollups.get(groupId) ?? { totalTasks: 0, completedTasks: 0, progressPercent: 0 };
        current.totalTasks += 1;
        current.completedTasks += completed;
        current.progressPercent = Math.round((current.completedTasks / current.totalTasks) * 100);
        rollups.set(groupId, current);
      }
    }

    return {
      projectId: project.id,
      projectName: project.projectName,
      projectStatus: this.normalizeProjectStatus(project.status),
      totalTasks,
      completedTasks,
      progressPercent,
      byStatus,
      plannedHours,
      actualHours,
      remainingHours: Math.max(0, plannedHours - actualHours),
      milestoneRollups: Object.fromEntries(milestoneRollups),
      taskListRollups: Object.fromEntries(taskListRollups),
    };
  }

  async getCriticalPath(projectId: number, user: AuthUser) {
    const project = await this.getAccessibleProject(projectId, user);
    const tasks = await this.db.task.findMany({
      where: { projectId, organizationId: project.organizationId, deletedAt: null },
      select: { id: true, taskName: true, status: true, startDate: true, dueDate: true, estimatedHours: true, completionPercent: true, assignedToUser: { select: { id: true, name: true } } },
    });
    const taskIds = new Set(tasks.map((task) => task.id));
    const dependencies = await this.db.taskDependency.findMany({ where: { projectId, organizationId: project.organizationId }, select: { predecessorId: true, successorId: true, dependencyType: true, lagDays: true } });
    const incoming = new Map<number, number[]>();
    const outgoing = new Map<number, number[]>();
    dependencies.forEach((edge) => {
      if (!taskIds.has(edge.predecessorId) || !taskIds.has(edge.successorId)) return;
      incoming.set(edge.successorId, [...(incoming.get(edge.successorId) ?? []), edge.predecessorId]);
      outgoing.set(edge.predecessorId, [...(outgoing.get(edge.predecessorId) ?? []), edge.successorId]);
    });
    const durations = new Map(tasks.map((task) => {
      const start = task.startDate?.getTime();
      const end = task.dueDate?.getTime();
      const duration = start != null && end != null && end > start ? end - start : Math.max(1, task.estimatedHours ?? 1) * 3600000;
      return [task.id, duration] as const;
    }));
    const memo = new Map<number, { duration: number; path: number[] }>();
    const visiting = new Set<number>();
    const longest = (taskId: number): { duration: number; path: number[] } => {
      const cached = memo.get(taskId);
      if (cached) return cached;
      if (visiting.has(taskId)) return { duration: durations.get(taskId) ?? 0, path: [taskId] };
      visiting.add(taskId);
      let best = { duration: 0, path: [] as number[] };
      for (const predecessorId of incoming.get(taskId) ?? []) {
        const candidate = longest(predecessorId);
        if (candidate.duration > best.duration) best = candidate;
      }
      visiting.delete(taskId);
      const result = { duration: best.duration + (durations.get(taskId) ?? 0), path: [...best.path, taskId] };
      memo.set(taskId, result);
      return result;
    };
    let critical = { duration: 0, path: [] as number[] };
    tasks.forEach((task) => {
      const candidate = longest(task.id);
      if (candidate.duration > critical.duration) critical = candidate;
    });
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    return {
      projectId,
      taskIds: critical.path,
      durationHours: Math.round((critical.duration / 3600000) * 100) / 100,
      tasks: critical.path.map((id) => taskById.get(id)).filter(Boolean),
      dependencies: dependencies.filter((edge) => critical.path.includes(edge.predecessorId) && critical.path.includes(edge.successorId)),
    };
  }

  async getWorkload(projectId: number, user: AuthUser) {
    const project = await this.getAccessibleProject(projectId, user);
    const tasks = await this.db.task.findMany({
      where: { projectId, organizationId: project.organizationId, deletedAt: null },
      select: { id: true, status: true, estimatedHours: true, actualHours: true, assignedToUserId: true, assignedToUser: { select: { id: true, name: true, email: true } } },
    });
    const grouped = new Map<number, { user: { id: number; name: string; email: string } | null; taskCount: number; openTasks: number; estimatedHours: number; actualHours: number }>();
    for (const task of tasks) {
      const key = task.assignedToUserId ?? 0;
      const current = grouped.get(key) ?? { user: task.assignedToUser, taskCount: 0, openTasks: 0, estimatedHours: 0, actualHours: 0 };
      current.taskCount += 1;
      if (!['APPROVED', 'COMPLETED'].includes(String(task.status ?? '').toUpperCase())) current.openTasks += 1;
      current.estimatedHours += task.estimatedHours ?? 0;
      current.actualHours += task.actualHours ?? 0;
      grouped.set(key, current);
    }
    return { projectId, members: [...grouped.values()].map((member) => ({ ...member, remainingHours: Math.max(0, member.estimatedHours - member.actualHours) })).sort((a, b) => b.remainingHours - a.remainingHours) };
  }

  async createBaseline(projectId: number, dto: CreateProjectBaselineDto, user: AuthUser) {
    const canManage = await this.canManageProject(projectId, user);
    if (!canManage) throw new ForbiddenException('Only project managers can create baselines');
    const project = await this.getAccessibleProject(projectId, user);
    const tasks = await this.db.task.findMany({
      where: { projectId, organizationId: project.organizationId, deletedAt: null },
      select: { id: true, taskName: true, status: true, startDate: true, dueDate: true, estimatedHours: true, completionPercent: true, milestoneId: true, taskListId: true },
    });
    const data = {
      projectId,
      capturedAt: new Date().toISOString(),
      tasks: tasks.map((task) => ({ ...task, startDate: task.startDate?.toISOString() ?? null, dueDate: task.dueDate?.toISOString() ?? null })),
    };
    return (this.db as any).projectBaseline.create({
      data: { projectId, organizationId: project.organizationId, name: dto.name?.trim() || `Baseline ${new Date().toLocaleDateString('en-GB')}`, data, createdById: user.userId },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
  }

  async listBaselines(projectId: number, user: AuthUser) {
    const project = await this.getAccessibleProject(projectId, user);
    return (this.db as any).projectBaseline.findMany({
      where: { projectId, organizationId: project.organizationId },
      orderBy: { snapshotAt: 'desc' },
      select: { id: true, projectId: true, name: true, snapshotAt: true, createdAt: true, createdBy: { select: { id: true, name: true, email: true } } },
    });
  }

  async getBaselineVariance(projectId: number, baselineId: number, user: AuthUser) {
    const project = await this.getAccessibleProject(projectId, user);
    const baseline = await (this.db as any).projectBaseline.findFirst({ where: { id: baselineId, projectId, organizationId: project.organizationId } });
    if (!baseline) throw new NotFoundException('Project baseline not found');
    const currentTasks = await this.db.task.findMany({ where: { projectId, organizationId: project.organizationId, deletedAt: null }, select: { id: true, status: true, startDate: true, dueDate: true, completionPercent: true } });
    const baselineTasks = Array.isArray(baseline.data?.tasks) ? baseline.data.tasks as Array<{ id: number; status?: string; startDate?: string | null; dueDate?: string | null; completionPercent?: number }> : [];
    const currentById = new Map(currentTasks.map((task) => [task.id, task]));
    const taskVariance = baselineTasks.map((original) => {
      const current = currentById.get(original.id);
      const baselineDue = original.dueDate ? new Date(original.dueDate).getTime() : null;
      const currentDue = current?.dueDate ? current.dueDate.getTime() : null;
      return { taskId: original.id, statusChanged: original.status !== current?.status, completionDelta: (current?.completionPercent ?? 0) - (original.completionPercent ?? 0), dueDateDeltaDays: baselineDue != null && currentDue != null ? Math.round((currentDue - baselineDue) / 86400000) : null, missing: !current };
    });
    return { baselineId, projectId, baselineName: baseline.name, taskVariance, addedTasks: currentTasks.filter((task) => !baselineTasks.some((original) => original.id === task.id)).map((task) => task.id) };
  }
}
