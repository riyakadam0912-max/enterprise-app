import { AsyncLocalStorage } from 'async_hooks';
import type { Role } from '../common/enums/role.enum';

export type AuditActorContext = {
  userId?: number | null;
  userName?: string | null;
  userRole?: Role | string | null;
  organizationId?: number | null;
  isPlatformAdmin?: boolean;
  jobName?: string;
};

export type AuditRequestContext = AuditActorContext & {
  ipAddress?: string | null;
  deviceInfo?: string | null;
  requestMethod?: string | null;
  endpoint?: string | null;
  route?: string | null;
  status?: number | null;
  correlationId?: string | null;
};

const auditStorage = new AsyncLocalStorage<AuditRequestContext>();

export function runWithAuditContext<T>(
  context: AuditRequestContext,
  callback: () => T,
): T {
  return auditStorage.run(context, callback);
}

export function getAuditContext(): AuditRequestContext {
  return auditStorage.getStore() ?? {};
}

export function setAuditContext(context: AuditRequestContext): void {
  const current = auditStorage.getStore();
  if (!current) {
    auditStorage.enterWith(context);
    return;
  }

  Object.assign(current, context);
}

// A fresh scope prevents a worker/timer from inheriting the triggering request.
export function runWithSystemAuditContext<T>(
  organizationId: number,
  jobName: string,
  callback: () => T,
): T {
  if (!Number.isSafeInteger(organizationId) || organizationId <= 0)
    throw new Error('A background audit scope requires an organization');
  return runWithAuditContext(
    { organizationId, userName: 'System', userRole: 'SYSTEM', jobName },
    callback,
  );
}
