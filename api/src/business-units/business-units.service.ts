import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessUnitStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '../common/types/auth';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto';
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto';

export type BusinessUnitScope = {
  organizationId: number;
  allUnits: boolean;
  unitIds: number[];
  assignedUnitId: number | null;
};

type ScopedRequestContext = {
  businessUnitId?: number | null;
  allBusinessUnits?: boolean;
};

const businessUnitInclude = {
  parent: { select: { id: true, name: true, code: true } },
  children: { select: { id: true, name: true, code: true, status: true } },
  _count: { select: { users: true, employees: true, children: true } },
} satisfies Prisma.BusinessUnitInclude;

@Injectable()
export class BusinessUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  private isPlatformAdmin(user: AuthUser) {
    return (
      user.role === Role.SUPER_ADMIN ||
      user.isPlatformAdmin === true ||
      user.isSuperAdmin === true ||
      user.roles.includes(Role.SUPER_ADMIN)
    );
  }

  private async resolveOrganizationId(
    requestedOrganizationId: number,
    user: AuthUser,
  ) {
    if (
      !Number.isInteger(requestedOrganizationId) ||
      requestedOrganizationId < 1
    ) {
      throw new ForbiddenException('A valid organization is required');
    }

    if (
      !this.isPlatformAdmin(user) &&
      user.organizationId !== requestedOrganizationId
    ) {
      throw new ForbiddenException('Organization access denied');
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id: requestedOrganizationId, deletedAt: null },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization.id;
  }

  private async getUnit(id: number, organizationId: number) {
    const unit = await this.prisma.businessUnit.findFirst({
      where: { id, organizationId },
      include: businessUnitInclude,
    });
    if (!unit) {
      throw new NotFoundException('Business Unit not found');
    }
    return unit;
  }

  private async validateParent(
    parentId: number | null | undefined,
    organizationId: number,
    currentId?: number,
  ) {
    if (parentId == null) return;
    if (currentId != null && parentId === currentId) {
      throw new ConflictException('A Business Unit cannot be its own parent');
    }

    const parent = await this.prisma.businessUnit.findFirst({
      where: { id: parentId, organizationId },
      select: { id: true, parentId: true },
    });
    if (!parent) {
      throw new NotFoundException('Parent Business Unit not found');
    }

    const seen = new Set<number>(currentId == null ? [] : [currentId]);
    let ancestor: { id: number; parentId: number | null } | null = parent;
    while (ancestor) {
      if (seen.has(ancestor.id)) {
        throw new ConflictException(
          'Business Unit hierarchy cannot contain a cycle',
        );
      }
      seen.add(ancestor.id);
      ancestor =
        ancestor.parentId == null
          ? null
          : await this.prisma.businessUnit.findFirst({
              where: { id: ancestor.parentId, organizationId },
              select: { id: true, parentId: true },
            });
    }
  }

  async list(organizationId: number, user: AuthUser) {
    const scopedOrganizationId = await this.resolveOrganizationId(
      organizationId,
      user,
    );
    return this.prisma.businessUnit.findMany({
      where: { organizationId: scopedOrganizationId },
      include: businessUnitInclude,
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
  }

  async create(
    organizationId: number,
    dto: CreateBusinessUnitDto,
    user: AuthUser,
  ) {
    const scopedOrganizationId = await this.resolveOrganizationId(
      organizationId,
      user,
    );
    await this.validateParent(dto.parentId, scopedOrganizationId);

    try {
      return await this.prisma.businessUnit.create({
        data: {
          organizationId: scopedOrganizationId,
          parentId: dto.parentId ?? null,
          name: dto.name.trim(),
          code: dto.code.trim().toUpperCase(),
          description: dto.description?.trim() || null,
          type: dto.type?.trim() || null,
          status: (dto.status ?? 'ACTIVE') as BusinessUnitStatus,
        },
        include: businessUnitInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A Business Unit with this code already exists in the organization',
        );
      }
      throw error;
    }
  }

  async get(id: number, organizationId: number, user: AuthUser) {
    const scopedOrganizationId = await this.resolveOrganizationId(
      organizationId,
      user,
    );
    return this.getUnit(id, scopedOrganizationId);
  }

  async update(
    id: number,
    organizationId: number,
    dto: UpdateBusinessUnitDto,
    user: AuthUser,
  ) {
    const scopedOrganizationId = await this.resolveOrganizationId(
      organizationId,
      user,
    );
    const existing = await this.getUnit(id, scopedOrganizationId);
    await this.validateParent(dto.parentId, scopedOrganizationId, existing.id);

    try {
      return await this.prisma.businessUnit.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          code: dto.code?.trim().toUpperCase(),
          description:
            dto.description === undefined
              ? undefined
              : dto.description.trim() || null,
          type: dto.type === undefined ? undefined : dto.type.trim() || null,
          status: dto.status as BusinessUnitStatus | undefined,
          parentId: dto.parentId === undefined ? undefined : dto.parentId,
        },
        include: businessUnitInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A Business Unit with this code already exists in the organization',
        );
      }
      throw error;
    }
  }

  async remove(id: number, organizationId: number, user: AuthUser) {
    const scopedOrganizationId = await this.resolveOrganizationId(
      organizationId,
      user,
    );
    const existing = await this.getUnit(id, scopedOrganizationId);
    const childCount = await this.prisma.businessUnit.count({
      where: { organizationId: scopedOrganizationId, parentId: existing.id },
    });
    if (childCount > 0) {
      throw new ConflictException(
        'Move or remove child Business Units before deleting this unit',
      );
    }

    await this.prisma.businessUnit.delete({
      where: { id },
    });
    return { success: true, message: 'Business Unit deleted successfully' };
  }

  async getAccessibleBusinessUnitsForUser(
    user: AuthUser,
    scopedOrganizationId: number,
  ): Promise<{
    units: Array<{
      id: number;
      name: string;
      code: string;
      parentId: number | null;
      status: string;
    }>;
    canSelectAll: boolean;
    assignedUnitId: number | null;
  }> {
    const orgId = await this.resolveOrganizationId(scopedOrganizationId, user);

    const canScopeMultiple =
      this.isPlatformAdmin(user) ||
      user.role === Role.HR ||
      user.role === Role.COMPLIANCE_MANAGER ||
      (Array.isArray(user.roles) &&
        (user.roles.includes(Role.HR) ||
          user.roles.includes(Role.COMPLIANCE_MANAGER)));

    const assignedUnitId: number | null =
      (typeof (user as any).employeeBusinessUnitId === 'number'
        ? (user as any).employeeBusinessUnitId
        : null) ??
      (typeof (user as any).primaryBusinessUnitId === 'number'
        ? (user as any).primaryBusinessUnitId
        : null) ??
      null;

    const allUnits = await this.prisma.businessUnit.findMany({
      where: { organizationId: orgId, status: 'ACTIVE' as any },
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
        status: true,
      },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });

    if (canScopeMultiple) {
      return {
        units: allUnits,
        canSelectAll: true,
        assignedUnitId,
      };
    }

    if (assignedUnitId != null) {
      const assigned = allUnits.filter((u) => u.id === assignedUnitId);
      return {
        units: assigned,
        canSelectAll: false,
        assignedUnitId,
      };
    }

    return {
      units: [],
      canSelectAll: false,
      assignedUnitId: null,
    };
  }

  async resolveUserScopedBusinessUnit(
    user: AuthUser,
    targetBusinessUnitId: number | null,
    scopedOrganizationId: number,
  ): Promise<{ businessUnitId: number | null; allBusinessUnits: boolean }> {
    const orgId = await this.resolveOrganizationId(scopedOrganizationId, user);

    const canScopeMultiple =
      this.isPlatformAdmin(user) ||
      user.role === Role.HR ||
      user.role === Role.COMPLIANCE_MANAGER ||
      (Array.isArray(user.roles) &&
        (user.roles.includes(Role.HR) ||
          user.roles.includes(Role.COMPLIANCE_MANAGER)));

    const assignedUnitId: number | null =
      (typeof (user as any).employeeBusinessUnitId === 'number'
        ? (user as any).employeeBusinessUnitId
        : null) ??
      (typeof (user as any).primaryBusinessUnitId === 'number'
        ? (user as any).primaryBusinessUnitId
        : null) ??
      null;

    if (canScopeMultiple) {
      if (targetBusinessUnitId == null) {
        return { businessUnitId: null, allBusinessUnits: true };
      }
      const bu = await this.prisma.businessUnit.findFirst({
        where: {
          id: targetBusinessUnitId,
          organizationId: orgId,
          status: 'ACTIVE' as any,
        },
        select: { id: true },
      });
      if (!bu) {
        throw new ForbiddenException(
          'Target Business Unit does not exist or is not accessible in this organization',
        );
      }
      return { businessUnitId: bu.id, allBusinessUnits: false };
    }

    if (assignedUnitId == null) {
      return { businessUnitId: null, allBusinessUnits: false };
    }

    if (
      targetBusinessUnitId != null &&
      targetBusinessUnitId !== assignedUnitId
    ) {
      throw new ForbiddenException(
        'You are not authorized to access any Business Unit other than your assigned unit',
      );
    }

    const bu = await this.prisma.businessUnit.findFirst({
      where: {
        id: assignedUnitId,
        organizationId: orgId,
        status: 'ACTIVE' as any,
      },
      select: { id: true },
    });
    if (!bu) {
      return { businessUnitId: null, allBusinessUnits: false };
    }

    return { businessUnitId: bu.id, allBusinessUnits: false };
  }

  private isWideScopedRole(user: AuthUser): boolean {
    const wide = new Set<string>([
      Role.SUPER_ADMIN,
      Role.ADMIN,
      Role.HR,
      Role.COMPLIANCE_MANAGER,
    ]);
    if (user.isPlatformAdmin === true || user.isSuperAdmin === true)
      return true;
    if (user.role && wide.has(user.role as string)) return true;
    if (Array.isArray(user.roles) && user.roles.some((r) => wide.has(r)))
      return true;
    return false;
  }

  private resolveAssignedUnitId(user: AuthUser): number | null {
    const directBU =
      typeof (user as any).employeeBusinessUnitId === 'number'
        ? (user as any).employeeBusinessUnitId
        : null;
    if (directBU != null) return directBU;
    const primaryBU =
      typeof (user as any).primaryBusinessUnitId === 'number'
        ? (user as any).primaryBusinessUnitId
        : null;
    if (primaryBU != null) return primaryBU;
    return null;
  }

  private async collectDescendantIds(
    organizationId: number,
    rootIds: number[],
  ): Promise<number[]> {
    if (rootIds.length === 0) return [];
    const included = new Set<number>(rootIds);
    const queue = [...rootIds];
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const children = await this.prisma.businessUnit.findMany({
        where: {
          organizationId,
          parentId,
          status: 'ACTIVE' as BusinessUnitStatus,
        },
        select: { id: true },
      });
      for (const child of children) {
        if (!included.has(child.id)) {
          included.add(child.id);
          queue.push(child.id);
        }
      }
    }
    return Array.from(included);
  }

  private async resolveOrganization(
    user: AuthUser,
    explicitOrganizationId?: number,
  ): Promise<number> {
    const requested =
      typeof explicitOrganizationId === 'number'
        ? explicitOrganizationId
        : user.organizationId;
    if (requested == null || !Number.isInteger(requested) || requested < 1) {
      throw new ForbiddenException('A valid organization is required');
    }
    if (!this.isWideScopedRole(user) && user.organizationId !== requested) {
      throw new ForbiddenException('Organization access denied');
    }
    const org = await this.prisma.organization.findFirst({
      where: { id: requested, deletedAt: null },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org.id;
  }

  async resolveScope(
    user: AuthUser & ScopedRequestContext,
    explicitOrganizationId?: number,
  ): Promise<BusinessUnitScope> {
    const organizationId = await this.resolveOrganization(
      user,
      explicitOrganizationId,
    );
    const wideScoped = this.isWideScopedRole(user);
    const assignedUnitId = this.resolveAssignedUnitId(user);

    if (wideScoped) {
      const contextSingleBU =
        user.allBusinessUnits === false &&
        typeof user.businessUnitId === 'number'
          ? user.businessUnitId
          : null;
      if (contextSingleBU != null) {
        const valid = await this.prisma.businessUnit.findFirst({
          where: {
            id: contextSingleBU,
            organizationId,
            status: 'ACTIVE' as BusinessUnitStatus,
          },
          select: { id: true },
        });
        if (!valid) {
          throw new ForbiddenException(
            'Selected Business Unit is not available in this organization',
          );
        }
        const ids = await this.collectDescendantIds(organizationId, [
          contextSingleBU,
        ]);
        return {
          organizationId,
          allUnits: false,
          unitIds: ids,
          assignedUnitId,
        };
      }
      return { organizationId, allUnits: true, unitIds: [], assignedUnitId };
    }

    if (assignedUnitId == null) {
      return {
        organizationId,
        allUnits: false,
        unitIds: [],
        assignedUnitId: null,
      };
    }

    const validAssigned = await this.prisma.businessUnit.findFirst({
      where: {
        id: assignedUnitId,
        organizationId,
        status: 'ACTIVE' as BusinessUnitStatus,
      },
      select: { id: true },
    });
    if (!validAssigned) {
      return {
        organizationId,
        allUnits: false,
        unitIds: [],
        assignedUnitId: null,
      };
    }

    const authorized = await this.collectDescendantIds(organizationId, [
      assignedUnitId,
    ]);
    if (
      user.allBusinessUnits === false &&
      typeof user.businessUnitId === 'number'
    ) {
      if (!authorized.includes(user.businessUnitId)) {
        throw new ForbiddenException(
          'You are not authorized to access the selected Business Unit',
        );
      }
      const narrowed = await this.collectDescendantIds(organizationId, [
        user.businessUnitId,
      ]);
      return {
        organizationId,
        allUnits: false,
        unitIds: narrowed,
        assignedUnitId,
      };
    }
    return {
      organizationId,
      allUnits: false,
      unitIds: authorized,
      assignedUnitId,
    };
  }

  buildDirectBUWhere(scope: BusinessUnitScope): {
    organizationId: number;
    businessUnitId?: number | { in: number[] };
  } {
    const base: {
      organizationId: number;
      businessUnitId?: number | { in: number[] };
    } = { organizationId: scope.organizationId };
    if (scope.allUnits) return base;
    if (scope.unitIds.length === 0) {
      base.businessUnitId = -1 as any;
      return base;
    }
    base.businessUnitId = { in: scope.unitIds };
    return base;
  }

  buildEmployeeBUWhere(scope: BusinessUnitScope): Prisma.EmployeeWhereInput {
    const base: Prisma.EmployeeWhereInput = {
      organizationId: scope.organizationId,
      deletedAt: null,
    };
    if (scope.allUnits) return base;
    if (scope.unitIds.length === 0) {
      return { ...base, id: -1 };
    }
    return { ...base, businessUnitId: { in: scope.unitIds } };
  }

  buildEmployeeJoinedWhere(
    scope: BusinessUnitScope,
    _employeeRelationAlias?: string,
  ): Prisma.EmployeeWhereInput {
    return this.buildEmployeeBUWhere(scope);
  }

  async getEmployeeScopeFilterIds(
    scope: BusinessUnitScope,
  ): Promise<number[] | null> {
    if (scope.allUnits) return null;
    if (scope.unitIds.length === 0) return [-1];
    const employees = await this.prisma.employee.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        businessUnitId: { in: scope.unitIds },
      },
      select: { id: true },
    });
    return employees.map((e) => e.id);
  }

  async assertRecordAccessible(
    scope: BusinessUnitScope,
    recordBU: number | null | undefined,
    resourceName = 'record',
  ): Promise<void> {
    if (scope.allUnits) return;
    if (recordBU == null) {
      if (scope.unitIds.length === 0) {
        throw new ForbiddenException(
          `You are not authorized to access this ${resourceName}`,
        );
      }
      return;
    }
    if (!scope.unitIds.includes(recordBU)) {
      throw new ForbiddenException(
        `You are not authorized to access this ${resourceName}`,
      );
    }
  }
}
