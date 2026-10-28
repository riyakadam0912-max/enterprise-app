import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth';
import { hashPassword } from '../users/utils/hash-password';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Role } from '../common/enums/role.enum';
import { FileManagementService } from '../file-management/file-management.service';
import type { FileUserContext } from '../file-management/file-management.types';

export interface OrganizationSummary {
  id: number;
  name: string;
  code: string;
  slug: string;
  status: string;
  createdAt: Date;
  parentId?: number | null;
  logoUrl?: string | null;
  number?: string | null;
  subscriptionPlan?: string | null;
  adminUser?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  currency?: string | null;
  timezone?: string | null;
  address?: string | null;
  website?: string | null;
  industry?: string | null;
}

interface OrganizationWithAdmin {
  id: number;
  name: string;
  code: string;
  slug: string;
  status: string;
  createdAt: Date;
  subscriptionPlan?: string | null;
  users?: Array<{ id: number; name: string | null; email: string | null }>;
}

function toOrganizationSummary(
  org: OrganizationWithAdmin & {
    parentId?: number | null;
    logoUrl?: string | null;
    email?: string | null;
    phone?: string | null;
    country?: string | null;
    currency?: string | null;
    timezone?: string | null;
    address?: string | null;
    website?: string | null;
    industry?: string | null;
  },
): OrganizationSummary {
  return {
    id: org.id,
    name: org.name,
    code: org.code,
    slug: org.slug,
    status: org.status,
    createdAt: org.createdAt,
    parentId: org.parentId ?? null,
    logoUrl: org.logoUrl ?? null,
    subscriptionPlan: org.subscriptionPlan ?? null,
    adminUser: org.users?.[0]?.name ?? null,
    email: org.email ?? null,
    phone: org.phone ?? null,
    country: org.country ?? null,
    currency: org.currency ?? null,
    timezone: org.timezone ?? null,
    address: org.address ?? null,
    website: org.website ?? null,
    industry: org.industry ?? null,
  };
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly fileManagementService?: FileManagementService,
  ) {}

  private async resolveOrganizationLogos<
    T extends { id: number; logoUrl?: string | null },
  >(organizations: T[]): Promise<T[]> {
    if (!this.fileManagementService) return organizations;
    const fileManagementService = this.fileManagementService;
    return Promise.all(
      organizations.map(async (organization) => ({
        ...organization,
        logoUrl: await fileManagementService.resolveOrganizationLogoUrl(
          organization.id,
          organization.logoUrl,
        ),
      })),
    );
  }

  private buildSlug(name: string, fallback: string): string {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return base || fallback;
  }

  private isPlatformAdmin(user: AuthUser) {
    return (
      user?.isPlatformAdmin === true ||
      user?.isSuperAdmin === true ||
      user?.role === 'SUPER_ADMIN' ||
      (Array.isArray(user?.roles) && user.roles.includes('SUPER_ADMIN'))
    );
  }

  private isOrganizationAdmin(user: AuthUser) {
    return (
      (user?.role === Role.ADMIN ||
        user?.roles?.includes(Role.ADMIN) === true) &&
      (user.homeOrganizationId ?? user.organizationId) != null
    );
  }

  private async canAccessOrganization(user: AuthUser, organizationId: number) {
    if (this.isPlatformAdmin(user)) return true;
    if (!this.isOrganizationAdmin(user)) return false;

    const homeOrganizationId = user.homeOrganizationId ?? user.organizationId;
    if (homeOrganizationId == null) return false;
    const relatedIds = await this.getOrganizationFamilyIds(homeOrganizationId);
    return relatedIds.includes(organizationId);
  }

  private async getOrganizationFamilyIds(
    organizationId: number,
  ): Promise<number[]> {
    const organizations = await this.prisma.organization.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, parentId: true },
    });
    const byId = new Map(
      organizations.map((organization) => [organization.id, organization]),
    );
    if (!byId.has(organizationId)) return [];

    let rootId = organizationId;
    const visited = new Set<number>([rootId]);
    while (byId.get(rootId)?.parentId != null) {
      const parentId = byId.get(rootId)!.parentId!;
      if (visited.has(parentId) || !byId.has(parentId)) break;
      visited.add(parentId);
      rootId = parentId;
    }

    const familyIds = new Set<number>([rootId]);
    let frontier = [rootId];
    while (frontier.length > 0) {
      const parents = new Set(frontier);
      frontier = organizations
        .filter(
          (organization) =>
            organization.parentId != null &&
            parents.has(organization.parentId) &&
            !familyIds.has(organization.id),
        )
        .map((organization) => organization.id);
      frontier.forEach((id) => familyIds.add(id));
    }
    return [...familyIds];
  }

  private async validateParentOrganization(
    parentId: number | null | undefined,
    user: AuthUser,
    currentOrganizationId?: number,
  ) {
    if (parentId == null) return;
    if (currentOrganizationId != null && parentId === currentOrganizationId) {
      throw new ConflictException('An organization cannot be its own parent');
    }

    const parent = await this.prisma.organization.findFirst({
      where: { id: parentId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException('Parent organization not found');

    if (!(await this.canAccessOrganization(user, parentId))) {
      throw new ForbiddenException('Parent organization access denied');
    }

    if (currentOrganizationId != null) {
      const descendants = await this.getOrganizationDescendantIds(
        currentOrganizationId,
      );
      if (descendants.includes(parentId)) {
        throw new ConflictException(
          'An organization cannot be moved under its own descendant',
        );
      }
    }
  }

  private async getOrganizationDescendantIds(
    organizationId: number,
  ): Promise<number[]> {
    const organizations = await this.prisma.organization.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, parentId: true },
    });
    const descendants = new Set<number>();
    let frontier = [organizationId];
    while (frontier.length > 0) {
      const children = organizations
        .filter(
          (organization) =>
            organization.parentId != null &&
            frontier.includes(organization.parentId),
        )
        .map((organization) => organization.id)
        .filter((id) => id !== organizationId && !descendants.has(id));
      children.forEach((id) => descendants.add(id));
      frontier = children;
    }
    return [...descendants];
  }

  async getAccessibleOrganizations(user: AuthUser) {
    if (this.isPlatformAdmin(user)) {
      throw new ForbiddenException(
        'Platform administrators use the platform organization selector',
      );
    }
    const isOrganizationAdmin =
      user.role === Role.ADMIN || user.roles?.includes(Role.ADMIN) === true;
    const homeOrganizationId = user.homeOrganizationId ?? user.organizationId;
    if (isOrganizationAdmin && homeOrganizationId == null) {
      throw new ForbiddenException(
        'An organization context is required to switch organizations',
      );
    }
    const userId = user.userId ?? user.id;
    const assignedOrganizationIds = isOrganizationAdmin
      ? null
      : userId == null
        ? []
        : Array.from(
            new Set(
              (
                await this.prisma.businessUnitAdmin.findMany({
                  where: {
                    userId,
                    businessUnit: { status: 'ACTIVE' },
                    organization: { status: 'ACTIVE', deletedAt: null },
                  },
                  select: { organizationId: true },
                })
              ).map((assignment) => assignment.organizationId),
            ),
          );

    if (!isOrganizationAdmin && assignedOrganizationIds?.length === 0) {
      throw new ForbiddenException(
        'Only organization admins and business unit admins can switch organizations',
      );
    }

    const organizations = await this.prisma.organization.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        parentId: true,
      },
      orderBy: { name: 'asc' },
    });

    if (isOrganizationAdmin) {
      const organizationsById = new Map(
        organizations.map((organization) => [organization.id, organization]),
      );
      if (!organizationsById.has(homeOrganizationId!)) {
        throw new ForbiddenException(
          'The home organization is unavailable for organization switching',
        );
      }

      let familyRootId = homeOrganizationId!;
      const ancestorIds = new Set<number>();
      while (!ancestorIds.has(familyRootId)) {
        ancestorIds.add(familyRootId);
        const parentId = organizationsById.get(familyRootId)?.parentId;
        if (parentId == null || !organizationsById.has(parentId)) break;
        familyRootId = parentId;
      }

      const accessibleIds = new Set<number>([familyRootId]);
      let frontier = [familyRootId];
      while (frontier.length > 0) {
        const parents = new Set(frontier);
        frontier = organizations
          .filter(
            (organization) =>
              organization.parentId != null &&
              parents.has(organization.parentId) &&
              !accessibleIds.has(organization.id),
          )
          .map((organization) => organization.id);
        frontier.forEach((organizationId) => accessibleIds.add(organizationId));
      }
      return this.resolveOrganizationLogos(
        organizations.filter((organization) =>
          accessibleIds.has(organization.id),
        ),
      );
    }

    if (assignedOrganizationIds != null) {
      const accessibleIds = new Set(assignedOrganizationIds);
      return this.resolveOrganizationLogos(
        organizations.filter((organization) =>
          accessibleIds.has(organization.id),
        ),
      );
    }
    return [];
  }

  async getPlatformStats(user: AuthUser) {
    if (!this.isPlatformAdmin(user)) {
      throw new ForbiddenException(
        'Only platform administrators can view platform statistics',
      );
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalOrgs,
      activeOrgs,
      totalUsers,
      activeUsers,
      newOrgsThisMonth,
      securityEvents,
    ] = await Promise.all([
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.organization.count({
        where: { deletedAt: null, status: 'ACTIVE' },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.organization.count({
        where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.auditLog.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          OR: [
            { action: { contains: 'LOGIN_FAILURE' } },
            { action: { contains: 'SECURITY' } },
            { action: { contains: 'PERMISSION_DENIED' } },
          ],
        },
      }),
    ]);

    const healthyTenants =
      activeOrgs > 0 ? Math.max(0, Math.floor(activeOrgs * 0.9)) : 0;
    const eventsRequiringReview =
      securityEvents > 0 ? Math.ceil(securityEvents * 0.125) : 0;

    return {
      success: true,
      message: 'Platform statistics loaded successfully',
      data: {
        organizations: {
          total: totalOrgs,
          newThisMonth: newOrgsThisMonth,
          active: activeOrgs,
          healthy: healthyTenants,
        },
        users: {
          total: totalUsers,
          active: activeUsers,
        },
        security: {
          recentEvents: securityEvents,
          requireReview: eventsRequiringReview,
        },
      },
    };
  }

  async createOrganization(dto: CreateOrganizationDto, user: AuthUser) {
    const isAdmin =
      this.isPlatformAdmin(user) || this.isOrganizationAdmin(user);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Only platform administrators or organization admins can create organizations',
      );
    }

    let resolvedParentId = dto.parentId ?? null;

    // Non-platform admins can only create child orgs under their own org
    if (!this.isPlatformAdmin(user)) {
      if (
        resolvedParentId != null &&
        resolvedParentId !== user.organizationId
      ) {
        throw new ForbiddenException(
          'You can only create organizations under your own organization',
        );
      }
      // Force parentId to the caller's own org
      resolvedParentId = user.organizationId as number;
    }

    await this.validateParentOrganization(resolvedParentId, user);

    const normalizedSlug =
      dto.slug?.trim() || this.buildSlug(dto.name, `org-${Date.now()}`);
    const existingOrg = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { slug: normalizedSlug },
          { name: dto.name },
          {
            code: dto.name
              .replace(/[^a-zA-Z0-9]/g, '')
              .slice(0, 8)
              .toUpperCase(),
          },
        ],
      },
    });

    if (existingOrg) {
      throw new ConflictException(
        'An organization with the same slug or name already exists',
      );
    }

    const normalizedStatus = (dto.status ?? 'ACTIVE').toUpperCase();
    const createdAt = new Date();

    const organization = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.name,
          code:
            dto.name
              .replace(/[^a-zA-Z0-9]/g, '')
              .slice(0, 8)
              .toUpperCase() || `ORG${Date.now()}`,
          slug: normalizedSlug,
          email: dto.businessEmail ?? null,
          phone: dto.phone ?? null,
          logoUrl: dto.logoUrl ?? null,
          address: dto.address ?? null,
          city: dto.city ?? null,
          state: dto.state ?? null,
          country: dto.country ?? null,
          timezone: dto.timezone ?? 'Asia/Kolkata',
          currency: dto.currency ?? 'INR',
          status: normalizedStatus as
            | 'ACTIVE'
            | 'SUSPENDED'
            | 'INACTIVE'
            | 'CANCELLED',
          website: dto.website ?? null,
          industry: dto.industry ?? null,
          parentId: resolvedParentId,
          createdAt,
        },
      });

      if (dto.adminEmail && dto.adminPassword) {
        const existingUser = await tx.user.findFirst({
          where: { email: dto.adminEmail, deletedAt: null },
        });

        if (existingUser) {
          throw new ConflictException(
            'A user with this admin email already exists',
          );
        }

        const hashedPassword = await hashPassword(dto.adminPassword);
        await tx.user.create({
          data: {
            organizationId: organization.id,
            name: dto.adminName ?? dto.adminEmail,
            email: dto.adminEmail,
            password: hashedPassword,
            role: Role.ADMIN,
            isActive: true,
          },
        });
      }
      return organization;
    });

    return {
      success: true,
      message: 'Organization created successfully',
      data: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
      },
    };
  }

  async getOrganization(id: number, user: AuthUser) {
    if (!(await this.canAccessOrganization(user, id))) {
      throw new ForbiddenException('Organization access denied');
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        slug: true,
        email: true,
        phone: true,
        logoUrl: true,
        address: true,
        city: true,
        state: true,
        country: true,
        timezone: true,
        currency: true,
        status: true,
        website: true,
        industry: true,
        subscriptionPlan: true,
        parentId: true,
        trialStartDate: true,
        trialEndDate: true,
        createdAt: true,
        updatedAt: true,
        users: {
          where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
          select: { id: true, name: true, email: true },
          take: 1,
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return {
      success: true,
      message: 'Organization loaded successfully',
      data: (await this.resolveOrganizationLogos([organization]))[0],
    };
  }

  async uploadOrganizationLogo(
    id: number,
    file: Express.Multer.File,
    user: AuthUser,
  ) {
    if (!this.fileManagementService) {
      throw new ForbiddenException('Organization logo storage is unavailable');
    }
    if (!this.isPlatformAdmin(user) && !this.isOrganizationAdmin(user)) {
      throw new ForbiddenException(
        'Only organization administrators can upload logos',
      );
    }
    const organization = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, parentId: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    if (!this.isPlatformAdmin(user)) {
      const homeOrganizationId = user.homeOrganizationId ?? user.organizationId;
      const visited = new Set<number>();
      let current: { id: number; parentId: number | null } | null =
        organization;
      let isWithinOrganizationFamily = false;
      while (current && !visited.has(current.id)) {
        if (current.id === homeOrganizationId) {
          isWithinOrganizationFamily = true;
          break;
        }
        visited.add(current.id);
        current =
          current.parentId == null
            ? null
            : await this.prisma.organization.findUnique({
                where: { id: current.parentId },
                select: { id: true, parentId: true },
              });
      }
      if (!isWithinOrganizationFamily) {
        throw new ForbiddenException('Organization access denied');
      }
    }

    const fileUser: FileUserContext = {
      userId: user.userId ?? user.id,
      role: user.role,
      roles: user.roles,
      employeeId: user.employeeId,
      userName: user.name,
      organizationId: id,
      isPlatformAdmin: user.isPlatformAdmin,
      isSuperAdmin: user.isSuperAdmin,
    };
    const uploaded = await this.fileManagementService.uploadOrganizationLogo(
      file,
      id,
      fileUser,
    );
    await this.prisma.organization.update({
      where: { id },
      data: { logoUrl: uploaded.path },
    });
    return { logoUrl: uploaded.url };
  }

  async getMyOrganization(user: AuthUser) {
    if (!this.isOrganizationAdmin(user)) {
      throw new ForbiddenException(
        'Only organization administrators can view their organization',
      );
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id: user.organizationId as number, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        slug: true,
        email: true,
        phone: true,
        logoUrl: true,
        address: true,
        city: true,
        state: true,
        country: true,
        timezone: true,
        currency: true,
        status: true,
        website: true,
        industry: true,
        subscriptionPlan: true,
        trialStartDate: true,
        trialEndDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return {
      success: true,
      message: 'Organization loaded successfully',
      data: (await this.resolveOrganizationLogos([organization]))[0],
    };
  }

  async updateMyOrganization(dto: UpdateOrganizationDto, user: AuthUser) {
    if (!this.isOrganizationAdmin(user)) {
      throw new ForbiddenException(
        'Only organization administrators can update their organization',
      );
    }

    const organizationId = user.organizationId as number;
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (dto.slug && dto.slug.trim() !== organization.slug) {
      const existingSlug = await this.prisma.organization.findFirst({
        where: { slug: dto.slug.trim(), NOT: { id: organizationId } },
      });
      if (existingSlug) {
        throw new ConflictException(
          'An organization with that slug already exists',
        );
      }
    }

    if (dto.name && dto.name.trim() !== organization.name) {
      const existingName = await this.prisma.organization.findFirst({
        where: { name: dto.name.trim(), NOT: { id: organizationId } },
      });
      if (existingName) {
        throw new ConflictException(
          'An organization with that name already exists',
        );
      }
    }

    const updatedOrganization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: dto.name?.trim() ?? organization.name,
        slug: dto.slug?.trim() ?? organization.slug,
        email: dto.businessEmail ?? organization.email,
        phone: dto.phone ?? organization.phone,
        logoUrl: dto.logoUrl ?? organization.logoUrl,
        address: dto.address ?? organization.address,
        city: dto.city ?? organization.city,
        state: dto.state ?? organization.state,
        country: dto.country ?? organization.country,
        timezone: dto.timezone ?? organization.timezone,
        currency: dto.currency ?? organization.currency,
        website: dto.website ?? organization.website,
        industry: dto.industry ?? organization.industry,
      },
    });

    return {
      success: true,
      message: 'Organization updated successfully',
      data: (await this.resolveOrganizationLogos([updatedOrganization]))[0],
    };
  }

  async updateOrganization(
    id: number,
    dto: UpdateOrganizationDto,
    user: AuthUser,
  ) {
    if (!this.isPlatformAdmin(user) && !this.isOrganizationAdmin(user)) {
      throw new ForbiddenException(
        'Only platform administrators or parent organization admins can update organizations',
      );
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (!(await this.canAccessOrganization(user, id))) {
      throw new ForbiddenException('Organization access denied');
    }
    if (!this.isPlatformAdmin(user) && dto.status !== undefined) {
      throw new ForbiddenException(
        'Only platform administrators can change organization status',
      );
    }

    if (dto.parentId !== undefined) {
      await this.validateParentOrganization(dto.parentId, user, id);
    }

    if (dto.slug && dto.slug.trim() !== organization.slug) {
      const existingSlug = await this.prisma.organization.findFirst({
        where: { slug: dto.slug.trim(), NOT: { id } },
      });
      if (existingSlug) {
        throw new ConflictException(
          'An organization with that slug already exists',
        );
      }
    }

    if (dto.name && dto.name.trim() !== organization.name) {
      const existingName = await this.prisma.organization.findFirst({
        where: { name: dto.name.trim(), NOT: { id } },
      });
      if (existingName) {
        throw new ConflictException(
          'An organization with that name already exists',
        );
      }
    }

    const updatedOrganization = await this.prisma.organization.update({
      where: { id },
      data: {
        name: dto.name ?? organization.name,
        slug: dto.slug?.trim() ?? organization.slug,
        email: dto.businessEmail ?? organization.email,
        phone: dto.phone ?? organization.phone,
        logoUrl: dto.logoUrl ?? organization.logoUrl,
        address: dto.address ?? organization.address,
        city: dto.city ?? organization.city,
        state: dto.state ?? organization.state,
        country: dto.country ?? organization.country,
        timezone: dto.timezone ?? organization.timezone,
        currency: dto.currency ?? organization.currency,
        website: dto.website ?? organization.website,
        industry: dto.industry ?? organization.industry,
        parentId:
          dto.parentId === undefined ? organization.parentId : dto.parentId,
        status: (dto.status ?? organization.status).toString().toUpperCase() as
          | 'ACTIVE'
          | 'SUSPENDED'
          | 'INACTIVE'
          | 'CANCELLED',
      },
    });

    return {
      success: true,
      message: 'Organization updated successfully',
      data: (await this.resolveOrganizationLogos([updatedOrganization]))[0],
    };
  }

  async setOrganizationStatus(id: number, status: string, user: AuthUser) {
    if (!this.isPlatformAdmin(user)) {
      throw new ForbiddenException(
        'Only platform administrators can change organization status',
      );
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        status: status.toUpperCase() as
          | 'ACTIVE'
          | 'SUSPENDED'
          | 'INACTIVE'
          | 'CANCELLED',
      },
    });

    return {
      success: true,
      message: `Organization ${status.toLowerCase()}d successfully`,
      data: updated,
    };
  }

  async deleteOrganization(id: number, user: AuthUser) {
    if (!this.isPlatformAdmin(user) && !this.isOrganizationAdmin(user)) {
      throw new ForbiddenException(
        'Only platform administrators or parent organization admins can delete organizations',
      );
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (!this.isPlatformAdmin(user)) {
      throw new ForbiddenException(
        'Only platform administrators can delete organizations',
      );
    }

    const activeChild = await this.prisma.organization.findFirst({
      where: { parentId: id, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (activeChild) {
      throw new ConflictException(
        'Move or archive child organizations before deleting this organization',
      );
    }

    await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, message: 'Organization deleted successfully' };
  }

  async listOrganizationsForUser(
    user: AuthUser,
    options?: {
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
      /**
       * When provided, restrict results to direct children of this parent org.
       * Platform admins may query any parentId.
       * Non-platform admins are always scoped to their own org as parent.
       */
      parentId?: number;
    },
  ): Promise<OrganizationSummary[]> {
    const isPlatformAdmin = this.isPlatformAdmin(user);

    // Determine which parent org to scope children under.
    // For platform admins impersonating an org (organizationId set via X-Organization-Id),
    // or for regular org admins, scope to that organization's children.
    // A platform admin without an active org context and without an explicit parentId
    // gets the full global list (super-admin dashboard use-case).
    let scopeParentId: number | null = null;

    if (!isPlatformAdmin && !this.isOrganizationAdmin(user)) {
      if (!user?.organizationId) {
        throw new ForbiddenException(
          'Only platform administrators can list organizations',
        );
      }
      throw new ForbiddenException(
        'Only platform and organization administrators can list organizations',
      );
    }

    if (isPlatformAdmin) {
      // Platform admins should see the full global list by default. An explicit
      // parentId still narrows the results to a specific org tree.
      if (options?.parentId != null && options.parentId > 0) {
        scopeParentId = options.parentId;
      }
    } else {
      const homeOrganizationId = user.homeOrganizationId ?? user.organizationId;
      const familyIds =
        homeOrganizationId == null
          ? []
          : await this.getOrganizationFamilyIds(homeOrganizationId);
      // Organization admins remain scoped to their active org unless a
      // different parentId is explicitly provided.
      if (options?.parentId != null && options.parentId > 0) {
        if (!familyIds.includes(options.parentId)) {
          throw new ForbiddenException(
            'Organization parent is outside your organization family',
          );
        }
        scopeParentId = options.parentId;
      } else if (homeOrganizationId != null) {
        scopeParentId = homeOrganizationId;
      }
    }

    // Build the base where clause
    const andConditions: Record<string, unknown>[] = [{ deletedAt: null }];

    if (scopeParentId != null) {
      // Show only direct children of the scoped parent
      andConditions.push({ parentId: scopeParentId });
    }

    if (options?.status) {
      andConditions.push({ status: options.status.toUpperCase() });
    }

    if (options?.search) {
      andConditions.push({
        OR: [
          { name: { contains: options.search, mode: 'insensitive' } },
          { slug: { contains: options.search, mode: 'insensitive' } },
          { code: { contains: options.search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Record<string, unknown> =
      andConditions.length === 1 ? andConditions[0] : { AND: andConditions };

    const organizations = await this.prisma.organization.findMany({
      where,
      orderBy: [{ status: 'desc' }, { name: 'asc' }],
      skip: ((options?.page ?? 1) - 1) * (options?.limit ?? 20),
      take: options?.limit ?? 20,
      select: {
        id: true,
        name: true,
        code: true,
        slug: true,
        status: true,
        createdAt: true,
        parentId: true,
        logoUrl: true,
        subscriptionPlan: true,
        email: true,
        phone: true,
        country: true,
        currency: true,
        timezone: true,
        address: true,
        website: true,
        industry: true,
        users: {
          where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
          select: { id: true, name: true, email: true },
          take: 1,
        },
      },
    });

    return this.resolveOrganizationLogos(
      organizations.map(toOrganizationSummary),
    );
  }
}
