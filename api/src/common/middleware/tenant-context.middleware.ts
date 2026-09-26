import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getAuditContext,
  setAuditContext,
} from '../../audit-logs/audit-context';
import type { JwtPayload } from '../../common/types/auth';
import { Role } from '../enums/role.enum';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private userCanScopeMultipleBusinessUnits(
    role: string | undefined,
    roles: string[] | undefined,
    isPlatformAdmin: boolean,
  ): boolean {
    if (isPlatformAdmin) return true;
    const wideRoles = new Set<string>([
      Role.SUPER_ADMIN,
      Role.ADMIN,
      Role.HR,
      Role.COMPLIANCE_MANAGER,
    ]);
    if (role && wideRoles.has(role)) return true;
    if (Array.isArray(roles) && roles.some((r) => wideRoles.has(r)))
      return true;
    return false;
  }

  async resolveBusinessUnitContext(
    request: any,
    payload: JwtPayload,
    resolvedOrganizationId: number | null,
    isPlatformAdmin: boolean,
    headerBU: string | undefined,
  ): Promise<{ businessUnitId: number | null; allBusinessUnits: boolean }> {
    const roleStr = typeof payload.role === 'string' ? payload.role : undefined;
    const rolesArr = Array.isArray(payload.roles) ? payload.roles : [];
    const canScopeMultiple = this.userCanScopeMultipleBusinessUnits(
      roleStr,
      rolesArr,
      isPlatformAdmin,
    );

    const assignedBUId: number | null =
      (typeof payload.employeeBusinessUnitId === 'number'
        ? payload.employeeBusinessUnitId
        : null) ??
      (typeof payload.primaryBusinessUnitId === 'number'
        ? payload.primaryBusinessUnitId
        : null);

    if (resolvedOrganizationId == null) {
      return { businessUnitId: assignedBUId, allBusinessUnits: false };
    }

    if (canScopeMultiple) {
      if (
        headerBU === undefined ||
        headerBU === null ||
        headerBU === '' ||
        headerBU.toUpperCase() === 'ALL'
      ) {
        return { businessUnitId: null, allBusinessUnits: true };
      }

      const buId = Number(headerBU);
      if (!Number.isNaN(buId) && buId > 0) {
        const bu = await this.prisma.businessUnit.findFirst({
          where: { id: buId, organizationId: resolvedOrganizationId },
          select: { id: true, status: true },
        });
        if (bu && (bu.status as string) === 'ACTIVE') {
          return { businessUnitId: bu.id, allBusinessUnits: false };
        }
        if (!bu) {
          this.logger.warn(
            `Admin user ${payload.sub ?? payload.userId} requested Business Unit ${buId} not in org ${resolvedOrganizationId}`,
          );
        } else {
          this.logger.warn(
            `Admin user ${payload.sub ?? payload.userId} requested inactive Business Unit ${buId} (status=${bu.status})`,
          );
        }
        return { businessUnitId: null, allBusinessUnits: true };
      }
      this.logger.warn(
        `Invalid X-Business-Unit-Id header for admin user: ${headerBU}`,
      );
      return { businessUnitId: null, allBusinessUnits: true };
    }

    const userId = payload.userId ?? payload.sub;
    const assignments =
      userId == null
        ? []
        : await this.prisma.businessUnitAdmin.findMany({
            where: { userId, organizationId: resolvedOrganizationId },
            select: { businessUnitId: true },
          });
    const activeAssignmentIds = assignments.length
      ? await this.prisma.businessUnit.findMany({
          where: {
            organizationId: resolvedOrganizationId,
            status: 'ACTIVE',
            id: { in: assignments.map((assignment) => assignment.businessUnitId) },
          },
          select: { id: true },
        })
      : [];

    if (activeAssignmentIds.length > 0) {
      if (
        headerBU === undefined ||
        headerBU === null ||
        headerBU === '' ||
        headerBU.toUpperCase() === 'ALL'
      ) {
        return { businessUnitId: null, allBusinessUnits: true };
      }

      const requestedBUId = Number(headerBU);
      if (Number.isInteger(requestedBUId) && requestedBUId > 0) {
        const requestedUnit = await this.prisma.businessUnit.findFirst({
          where: {
            id: requestedBUId,
            organizationId: resolvedOrganizationId,
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        if (requestedUnit) {
          return { businessUnitId: requestedUnit.id, allBusinessUnits: false };
        }
      }

      this.logger.warn(
        `BU administrator ${userId} requested an unavailable Business Unit ${headerBU} in organization ${resolvedOrganizationId}`,
      );
      return { businessUnitId: null, allBusinessUnits: true };
    }

    const roots = Array.from(
      new Set([
        ...(assignedBUId == null ? [] : [assignedBUId]),
      ]),
    );
    const units = roots.length
      ? await this.prisma.businessUnit.findMany({
          where: { organizationId: resolvedOrganizationId, status: 'ACTIVE' },
          select: { id: true, parentId: true },
        })
      : [];
    const authorizedIds = new Set<number>();
    for (const rootId of roots) {
      if (units.some((unit) => unit.id === rootId)) authorizedIds.add(rootId);
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const unit of units) {
        if (
          unit.parentId != null &&
          authorizedIds.has(unit.parentId) &&
          !authorizedIds.has(unit.id)
        ) {
          authorizedIds.add(unit.id);
          changed = true;
        }
      }
    }

    if (headerBU?.toUpperCase() === 'ALL' || !headerBU) {
      if (assignments.length > 0) {
        return { businessUnitId: null, allBusinessUnits: false };
      }
      if (assignedBUId != null && authorizedIds.has(assignedBUId)) {
        return { businessUnitId: assignedBUId, allBusinessUnits: false };
      }
      return { businessUnitId: null, allBusinessUnits: false };
    }

    const requestedBUId = Number(headerBU);
    if (Number.isInteger(requestedBUId) && authorizedIds.has(requestedBUId)) {
      return { businessUnitId: requestedBUId, allBusinessUnits: false };
    }
    this.logger.warn(
      `User ${userId ?? 'unknown'} requested an unassigned Business Unit ${headerBU}; using their authorized scope`,
    );
    if (assignments.length > 0) {
      return { businessUnitId: null, allBusinessUnits: false };
    }
    return {
      businessUnitId:
        assignedBUId != null && authorizedIds.has(assignedBUId)
          ? assignedBUId
          : null,
      allBusinessUnits: false,
    };
  }

  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      const cookieToken = (req.cookies as Record<string, string | undefined>)
        ?.enterprise_access_token;
      const authHeader =
        typeof req.headers.authorization === 'string'
          ? req.headers.authorization
          : undefined;
      const bearer = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined;
      const token = cookieToken ?? bearer;
      if (!token) return next();

      let payload: JwtPayload | null = null;
      try {
        payload = this.jwtService.verify<JwtPayload>(token);
      } catch {
        return next();
      }

      if (!payload) {
        return next();
      }

      const isPlatformAdmin =
        payload.isPlatformAdmin === true ||
        payload.isSuperAdmin === true ||
        payload.role === 'SUPER_ADMIN' ||
        (Array.isArray(payload.roles) && payload.roles.includes('SUPER_ADMIN'));

      const headerOrg =
        (req.headers['x-organization-id'] as string) ||
        (req.headers['X-Organization-Id'] as string) ||
        undefined;

      const headerBU =
        (req.headers['x-business-unit-id'] as string) ||
        (req.headers['X-Business-Unit-Id'] as string) ||
        undefined;

      let resolvedOrganizationId: number | null = null;
      const request = req as any;

      if (!isPlatformAdmin && headerOrg) {
        this.logger.warn(
          `Ignoring X-Organization-Id header for non-platform user ${payload.sub ?? payload.userId}: ${headerOrg}`,
        );
      }

      if (isPlatformAdmin) {
        if (headerOrg) {
          const orgId = Number(headerOrg);
          if (!Number.isNaN(orgId) && orgId > 0) {
            const org = await this.prisma.organization.findUnique({
              where: { id: orgId },
              select: { id: true, status: true },
            });

            if (org && org.status === 'ACTIVE') {
              resolvedOrganizationId = org.id;
              this.logger.debug(
                `SUPER_ADMIN assumed organization ${org.id} via X-Organization-Id`,
              );
            } else if (!org) {
              this.logger.warn(
                `SUPER_ADMIN requested organization ${orgId} which does not exist`,
              );
            } else {
              this.logger.warn(
                `SUPER_ADMIN requested organization ${orgId} which is not ACTIVE (status=${org.status})`,
              );
            }
          } else {
            this.logger.warn(
              `Invalid X-Organization-Id header value: ${headerOrg}`,
            );
          }
        }

        if (
          resolvedOrganizationId == null &&
          typeof payload.organizationId === 'number'
        ) {
          const org = await this.prisma.organization.findUnique({
            where: { id: payload.organizationId },
            select: { id: true, status: true },
          });

          if (org && org.status === 'ACTIVE') {
            resolvedOrganizationId = org.id;
          } else if (!org) {
            this.logger.warn(
              `Platform admin organization ${payload.organizationId} not found for user ${payload.sub ?? payload.userId}`,
            );
          } else {
            this.logger.warn(
              `Platform admin organization ${payload.organizationId} is not ACTIVE (status=${org.status}) for user ${payload.sub ?? payload.userId}`,
            );
          }
        }
      } else if (typeof payload.organizationId === 'number') {
        const org = await this.prisma.organization.findUnique({
          where: { id: payload.organizationId },
          select: { id: true, status: true },
        });

        if (org && org.status === 'ACTIVE') {
          resolvedOrganizationId = org.id;
        } else if (!org) {
          this.logger.warn(
            `Tenant organization ${payload.organizationId} not found for user ${payload.sub ?? payload.userId}`,
          );
        } else {
          this.logger.warn(
            `Tenant organization ${payload.organizationId} is not ACTIVE (status=${org.status}) for user ${payload.sub ?? payload.userId}`,
          );
        }
      }

      request.organizationId = resolvedOrganizationId;
      request.__tenantResolvedByMiddleware = true;
      request.__isPlatformAdmin = isPlatformAdmin;

      if (resolvedOrganizationId == null && !isPlatformAdmin) {
        const activeOrgs = await this.prisma.organization.findMany({
          where: { status: 'ACTIVE', deletedAt: null },
          select: { id: true },
          orderBy: { id: 'asc' },
        });
        if (activeOrgs.length === 1) {
          resolvedOrganizationId = activeOrgs[0].id;
          request.organizationId = resolvedOrganizationId;
          this.logger.debug(
            `Auto-assigned organization ${resolvedOrganizationId} (only ACTIVE org) for tenant user ${payload.sub ?? payload.userId}`,
          );
        } else if (activeOrgs.length > 1) {
          this.logger.warn(
            `Tenant user ${payload.sub ?? payload.userId} has no resolved organizationId; found ${activeOrgs.length} ACTIVE orgs. Set organizationId on tenant users.`,
          );
        }
      }

      const buContext = await this.resolveBusinessUnitContext(
        request,
        payload,
        resolvedOrganizationId,
        isPlatformAdmin,
        headerBU,
      );
      request.businessUnitId = buContext.businessUnitId;
      request.allBusinessUnits = buContext.allBusinessUnits;

      if (resolvedOrganizationId != null || buContext.businessUnitId != null) {
        const current = getAuditContext();
        setAuditContext({
          ...current,
          organizationId: resolvedOrganizationId ?? undefined,
        });
      }

      return next();
    } catch (err) {
      this.logger.error('TenantContextMiddleware error', err as any);
      return next();
    }
  }
}

export default TenantContextMiddleware;
