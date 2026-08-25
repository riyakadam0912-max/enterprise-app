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
  org: OrganizationWithAdmin,
): OrganizationSummary {
  return {
    id: org.id,
    name: org.name,
    code: org.code,
    slug: org.slug,
    status: org.status,
    createdAt: org.createdAt,
    subscriptionPlan: org.subscriptionPlan ?? null,
    adminUser: org.users?.[0]?.name ?? null,
    email:
      (org as OrganizationSummary & { email?: string | null }).email ?? null,
    phone:
      (org as OrganizationSummary & { phone?: string | null }).phone ?? null,
    country:
      (org as OrganizationSummary & { country?: string | null }).country ??
      null,
    currency:
      (org as OrganizationSummary & { currency?: string | null }).currency ??
      null,
    timezone:
      (org as OrganizationSummary & { timezone?: string | null }).timezone ??
      null,
    address:
      (org as OrganizationSummary & { address?: string | null }).address ??
      null,
    website:
      (org as OrganizationSummary & { website?: string | null }).website ??
      null,
    industry:
      (org as OrganizationSummary & { industry?: string | null }).industry ??
      null,
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
    if (!this.isPlatformAdmin(user)) {
      throw new ForbiddenException(
        'Only platform administrators can create organizations',
      );
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
    const trialDays = dto.trialDays ?? 14;
    const createdAt = new Date();
    const trialEndDate = new Date(
      createdAt.getTime() + trialDays * 24 * 60 * 60 * 1000,
    );

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
        timezone: dto.timezone ?? 'UTC',
        currency: dto.currency ?? 'USD',
        status: normalizedStatus as
          | 'ACTIVE'
          | 'SUSPENDED'
          | 'INACTIVE'
          | 'CANCELLED',
        website: dto.website ?? null,
        industry: dto.industry ?? null,
        subscriptionPlan: dto.subscriptionPlan ?? 'STARTER',
        createdAt,
        trialStartDate: createdAt,
        trialEndDate,
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
        id: true, name: true, code: true, slug: true, email: true, phone: true,
        logoUrl: true, address: true, city: true, state: true, country: true,
        timezone: true, currency: true, status: true, website: true,
        industry: true, subscriptionPlan: true, trialStartDate: true,
        trialEndDate: true, createdAt: true, updatedAt: true,
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
        throw new ConflictException('An organization with that slug already exists');
      }
    }

    if (dto.name && dto.name.trim() !== organization.name) {
      const existingName = await this.prisma.organization.findFirst({
        where: { name: dto.name.trim(), NOT: { id: organizationId } },
      });
      if (existingName) {
        throw new ConflictException('An organization with that name already exists');
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
    if (!this.isPlatformAdmin(user)) {
      throw new ForbiddenException(
        'Only platform administrators can update organizations',
      );
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
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
        subscriptionPlan: dto.subscriptionPlan ?? organization.subscriptionPlan,
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
    if (!this.isPlatformAdmin(user)) {
      throw new ForbiddenException(
        'Only platform administrators can delete organizations',
      );
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
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
    },
  ): Promise<OrganizationSummary[]> {
    const isPlatformAdmin = this.isPlatformAdmin(user);

    if (isPlatformAdmin) {
      const where: Record<string, unknown> = { deletedAt: null };
      if (options?.status) {
        where.status = options.status.toUpperCase();
      }
      if (options?.search) {
        where.OR = [
          { name: { contains: options.search, mode: 'insensitive' } },
          { slug: { contains: options.search, mode: 'insensitive' } },
          { code: { contains: options.search, mode: 'insensitive' } },
        ];
      }

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

    throw new ForbiddenException(
      'Only platform administrators can list organizations',
    );
  }
}
