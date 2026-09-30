import { Injectable } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getRelatedOrganizationIds(organizationId: number): Promise<number[]> {
    const organizations = await this.prisma.organization.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, parentId: true },
    });
    const byId = new Map(organizations.map((organization) => [organization.id, organization]));
    if (!byId.has(organizationId)) return [];

    let rootId = organizationId;
    const ancestors = new Set<number>([organizationId]);
    while (byId.get(rootId)?.parentId != null) {
      const parentId = byId.get(rootId)!.parentId!;
      if (ancestors.has(parentId) || !byId.has(parentId)) break;
      ancestors.add(parentId);
      rootId = parentId;
    }

    const relatedIds = new Set<number>([rootId]);
    let frontier = [rootId];
    while (frontier.length > 0) {
      const parents = new Set(frontier);
      frontier = organizations
        .filter(
          (organization) =>
            organization.parentId != null &&
            parents.has(organization.parentId) &&
            !relatedIds.has(organization.id),
        )
        .map((organization) => organization.id);
      frontier.forEach((id) => relatedIds.add(id));
    }
    return [...relatedIds];
  }

  async getOrganizationIds(user: AuthUser): Promise<number[] | null> {
    const isPlatformAdmin =
      user.role === Role.SUPER_ADMIN ||
      user.isPlatformAdmin === true ||
      user.isSuperAdmin === true ||
      user.roles?.includes(Role.SUPER_ADMIN) === true;

    if (isPlatformAdmin && user.organizationId == null) {
      return null;
    }

    const rootOrganizationId =
      user.homeOrganizationId ?? user.organizationId;
    if (rootOrganizationId == null) {
      return [];
    }

    const canInheritDescendants =
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      (Array.isArray(user.roles) &&
        (user.roles.includes(Role.ADMIN) || user.roles.includes(Role.HR))) ||
      isPlatformAdmin;
    if (!canInheritDescendants) {
      return [user.organizationId ?? rootOrganizationId];
    }

    const accessibleOrganizations = new Set([rootOrganizationId]);
    let frontier = [rootOrganizationId];

    while (frontier.length > 0) {
      const children = await this.prisma.organization.findMany({
        where: {
          parentId: { in: frontier },
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });
      frontier = children
        .map((organization) => organization.id)
        .filter((id) => !accessibleOrganizations.has(id));
      frontier.forEach((id) => accessibleOrganizations.add(id));
    }

    return [...accessibleOrganizations];
  }
}