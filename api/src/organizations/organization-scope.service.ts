import { Injectable } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getDescendantOrganizationIds(
    organizationId: number,
    includeRoot = true,
  ): Promise<number[]> {
    const organizations = await this.prisma.organization.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, parentId: true },
    });
    const byParent = new Map<number, number[]>();
    for (const organization of organizations) {
      if (organization.parentId == null) continue;
      const children = byParent.get(organization.parentId) ?? [];
      children.push(organization.id);
      byParent.set(organization.parentId, children);
    }
    if (
      !organizations.some((organization) => organization.id === organizationId)
    ) {
      return [];
    }

    const descendants = new Set<number>(includeRoot ? [organizationId] : []);
    const visited = new Set<number>([organizationId]);
    const frontier = [organizationId];
    while (frontier.length > 0) {
      const children = (byParent.get(frontier.shift()!) ?? []).filter(
        (childId) => !visited.has(childId),
      );
      children.forEach((childId) => {
        visited.add(childId);
        descendants.add(childId);
        frontier.push(childId);
      });
    }
    return [...descendants];
  }

  async getOrganizationFamilyRootId(
    organizationId: number,
  ): Promise<number | null> {
    const organizations = await this.prisma.organization.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, parentId: true },
    });
    const byId = new Map(
      organizations.map((organization) => [organization.id, organization]),
    );
    if (!byId.has(organizationId)) return null;

    let rootId = organizationId;
    const visited = new Set<number>([rootId]);
    while (byId.get(rootId)?.parentId != null) {
      const parentId = byId.get(rootId)!.parentId!;
      if (visited.has(parentId) || !byId.has(parentId)) break;
      visited.add(parentId);
      rootId = parentId;
    }
    return rootId;
  }

  async getOrganizationFamilyRootMap(organizationIds: number[]) {
    if (organizationIds.length === 0) return new Map<number, number | null>();
    const organizations = await this.prisma.organization.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, parentId: true },
    });
    const byId = new Map(
      organizations.map((organization) => [organization.id, organization]),
    );
    const roots = new Map<number, number | null>();

    for (const organizationId of new Set(organizationIds)) {
      if (!byId.has(organizationId)) {
        roots.set(organizationId, null);
        continue;
      }
      let rootId = organizationId;
      const visited = new Set<number>([rootId]);
      while (byId.get(rootId)?.parentId != null) {
        const parentId = byId.get(rootId)!.parentId!;
        if (visited.has(parentId) || !byId.has(parentId)) break;
        visited.add(parentId);
        rootId = parentId;
      }
      roots.set(organizationId, rootId);
    }
    return roots;
  }

  async getRelatedOrganizationIds(organizationId: number): Promise<number[]> {
    const organizations = await this.prisma.organization.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, parentId: true },
    });
    const byId = new Map(
      organizations.map((organization) => [organization.id, organization]),
    );
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

    const rootOrganizationId = user.homeOrganizationId ?? user.organizationId;
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

    return this.getDescendantOrganizationIds(rootOrganizationId);
  }
}
