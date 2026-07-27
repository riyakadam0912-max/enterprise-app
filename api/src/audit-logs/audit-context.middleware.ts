import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithAuditContext } from './audit-context';

type AuditRequest = Request & {
  user?: {
    userId?: number;
    id?: number;
    email?: string;
    role?: string;
    name?: string;
    organizationId?: number | null;
  };
  route?: {
    path?: string | null;
  };
  headers: Request['headers'] & {
    'x-request-id'?: string | string[] | undefined;
    'user-agent'?: string | string[] | undefined;
    'x-forwarded-for'?: string | string[] | undefined;
  };
};

@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  use(req: AuditRequest, res: Response, next: NextFunction) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]?.trim()
        : (req.ip ?? null);

    const route = req.route as { path?: unknown } | undefined;
    const routePath = typeof route?.path === 'string' ? route.path : null;

    const context = {
      userId: req.user?.userId ?? req.user?.id ?? null,
      userName: req.user?.name ?? req.user?.email ?? null,
      userRole: req.user?.role ?? null,
      organizationId:
        (req as any)?.organizationId ?? req.user?.organizationId ?? null,
      ipAddress,
      deviceInfo: req.headers['user-agent'] ?? null,
      requestMethod: req.method ?? null,
      endpoint: req.originalUrl ?? req.url ?? null,
      route: routePath,
      correlationId:
        typeof req.headers['x-request-id'] === 'string'
          ? req.headers['x-request-id']
          : null,
    };

    runWithAuditContext(context, () => {
      next();
    });
  }
}
