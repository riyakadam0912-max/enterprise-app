import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth';

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
  };
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrganizationsForUser(
    user: AuthUser,
  ): Promise<OrganizationSummary[]> {
    const isPlatformAdmin =
      user?.isPlatformAdmin === true ||
      user?.role === 'SUPER_ADMIN' ||
      (Array.isArray(user?.roles) && user.roles.includes('SUPER_ADMIN'));

    if (isPlatformAdmin) {
      const organizations = await this.prisma.organization.findMany({
        where: { deletedAt: null },
        orderBy: [{ status: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          code: true,
          slug: true,
          status: true,
          createdAt: true,
          subscriptionPlan: true,
          users: {
            where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
            select: { id: true, name: true, email: true },
            take: 1,
          },
        },
      });

      return organizations.map(toOrganizationSummary);
    }

    if (typeof user.organizationId === 'number' && user.organizationId > 0) {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.organizationId, deletedAt: null },
        select: {
          id: true,
          name: true,
          code: true,
          slug: true,
          status: true,
          createdAt: true,
          subscriptionPlan: true,
          users: {
            where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
            select: { id: true, name: true, email: true },
            take: 1,
          },
        },
      });
      return org ? [toOrganizationSummary(org)] : [];
    }

    const userId = user.userId ?? user.id;
    if (userId) {
      const userRow = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          organization: {
            select: {
              id: true,
              name: true,
              code: true,
              slug: true,
              status: true,
              createdAt: true,
              subscriptionPlan: true,
              users: {
                where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
                select: { id: true, name: true, email: true },
                take: 1,
              },
            },
          },
        },
      });
      if (userRow?.organization) {
        return [toOrganizationSummary(userRow.organization)];
      }
    }

    return [];
  }
}
