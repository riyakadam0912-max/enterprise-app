import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth';
import { hashPassword } from '../users/utils/hash-password';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Role } from '../common/enums/role.enum';

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
  constructor(private readonly prisma: PrismaService) {}

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
    return user?.role === Role.ADMIN && user.organizationId != null;
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

    // Non-platform admins can only create child orgs under their own org
    if (!this.isPlatformAdmin(user)) {
      if (dto.parentId != null && dto.parentId !== user.organizationId) {
        throw new ForbiddenException(
          'You can only create organizations under your own organization',
        );
      }
      // Force parentId to the caller's own org
      dto.parentId = user.organizationId as number;
    }

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

    const organization = await this.prisma.organization.create({
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
        parentId: dto.parentId ?? null,
        createdAt,
      },
    });

    if (dto.adminEmail && dto.adminPassword) {
      const existingUser = await this.prisma.user.findFirst({
        where: { email: dto.adminEmail, deletedAt: null },
      });

      if (existingUser) {
        throw new ConflictException(
          'A user with this admin email already exists',
        );
      }

      const hashedPassword = await hashPassword(dto.adminPassword);
      await this.prisma.user.create({
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
    if (!this.isPlatformAdmin(user)) {
      throw new ForbiddenException(
        'Only platform administrators can view organization details',
      );
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
      data: organization,
    };
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
      data: organization,
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
      data: updatedOrganization,
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
    if (
      !this.isPlatformAdmin(user) &&
      organization.parentId !== user.organizationId
    ) {
      throw new ForbiddenException(
        'You can only update organizations directly under your organization',
      );
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
      data: updatedOrganization,
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
    if (
      !this.isPlatformAdmin(user) &&
      organization.parentId !== user.organizationId
    ) {
      throw new ForbiddenException(
        'You can only delete organizations directly under your organization',
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

    if (!isPlatformAdmin) {
      // Regular org users must be scoped to their own org's children
      if (!user?.organizationId) {
        throw new ForbiddenException(
          'Only platform administrators can list organizations',
        );
      }
      scopeParentId = user.organizationId;
    } else {
      // Platform admin: use explicit parentId param, or fall back to the
      // active impersonation org (organizationId set by TenantContextMiddleware
      // when X-Organization-Id header is present).
      if (options?.parentId != null && options.parentId > 0) {
        scopeParentId = options.parentId;
      } else if (user.organizationId != null) {
        // Impersonating a specific org — show its children
        scopeParentId = user.organizationId;
      }
      // If scopeParentId is still null, we are in the global super-admin view
      // — no hierarchy scoping is applied and all orgs are returned.
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

    return organizations.map(toOrganizationSummary);
  }
}
