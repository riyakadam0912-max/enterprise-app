import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getAuditContext,
  setAuditContext,
} from '../../audit-logs/audit-context';
import type { JwtPayload } from '../../common/types/auth';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

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

      if (resolvedOrganizationId != null) {
        const current = getAuditContext();
        setAuditContext({ ...current, organizationId: resolvedOrganizationId });
      }

      return next();
    } catch (err) {
      this.logger.error('TenantContextMiddleware error', err as any);
      return next();
    }
  }
}

export default TenantContextMiddleware;
