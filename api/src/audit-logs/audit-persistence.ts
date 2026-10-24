import { Prisma } from '@prisma/client';
import type { AuditRequestContext } from './audit-context';
import type {
  AuditDatabase,
  AuditOwnership,
  AuditRecord,
} from './audit-ownership';
import {
  auditId,
  findAuditRecord,
  resolveAuditOwnership,
} from './audit-ownership';

const SENSITIVE_KEYS = /password|token|otp|secret|api.?key|session/i;
export function redactAuditValue(value: unknown): Prisma.JsonValue {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(redactAuditValue);
  if (typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEYS.test(key) ? '***' : redactAuditValue(entry),
      ]),
    );
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return value;
  return '[unsupported value]';
}
export type AuditEvent = {
  module: string;
  entityType: string;
  entityId?: number | null;
  action: string;
  userId?: number | null;
  userName?: string | null;
  userRole?: string | null;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  description?: string | null;
  ipAddress?: string | null;
  deviceInfo?: string | null;
  requestMethod?: string | null;
  endpoint?: string | null;
  status?: string;
  organizationId?: number | null;
};

// Ownership comes from the affected entity, never from the actor's home tenant.
export async function persistAuditEvent(
  client: AuditDatabase,
  event: AuditEvent,
  context: AuditRequestContext,
  knownOwnership?: AuditOwnership,
) {
  let ownership = knownOwnership;
  if (!ownership) {
    const id = auditId(event.entityId);
    const record = id
      ? await findAuditRecord(client, event.entityType, { id })
      : null;
    ownership = await resolveAuditOwnership(client, event.entityType, record);
  }
  const targetOrganizationId = ownership.organizationId;
  const requestOrganizationId = auditId(context.organizationId);
  const suppliedOrganizationId = auditId(event.organizationId);
  const mismatch = [requestOrganizationId, suppliedOrganizationId].find(
    (id) =>
      id !== null &&
      targetOrganizationId !== null &&
      id !== targetOrganizationId,
  );
  const requestedOrganizationId =
    mismatch ?? requestOrganizationId ?? suppliedOrganizationId;
  let reason = ownership.reason;
  if (mismatch && !context.isPlatformAdmin) reason = 'CONTEXT_MISMATCH';
  if (targetOrganizationId && !reason) {
    const organization = await client.organization.findUnique({
      where: { id: targetOrganizationId },
      select: { id: true },
    });
    if (!organization) reason = 'ORGANIZATION_MISSING';
  }
  const json = (value: unknown) =>
    event.fieldName && SENSITIVE_KEYS.test(event.fieldName)
      ? '***'
      : value == null
        ? Prisma.JsonNull
        : (redactAuditValue(value) as Prisma.InputJsonValue);
  const data = {
    userId: event.userId ?? context.userId ?? undefined,
    userName: event.userName ?? context.userName ?? undefined,
    userRole: event.userRole ?? context.userRole ?? undefined,
    module: event.module,
    entityType: event.entityType,
    entityId: event.entityId ?? undefined,
    action: event.action,
    fieldName: event.fieldName ?? undefined,
    oldValue: event.oldValue === undefined ? undefined : json(event.oldValue),
    newValue: event.newValue === undefined ? undefined : json(event.newValue),
    description: event.description ?? undefined,
    ipAddress: event.ipAddress ?? context.ipAddress ?? undefined,
    deviceInfo: event.deviceInfo ?? context.deviceInfo ?? undefined,
    requestMethod: event.requestMethod ?? context.requestMethod ?? undefined,
    endpoint: event.endpoint ?? context.endpoint ?? undefined,
    status: event.status ?? 'SUCCESS',
  };
  if (!reason && targetOrganizationId)
    return client.auditLog.create({
      data: { ...data, organizationId: targetOrganizationId },
    });
  return client.systemAuditEvent.create({
    data: {
      ...data,
      reason: reason ?? 'OWNERSHIP_UNRESOLVED',
      targetOrganizationId: targetOrganizationId ?? undefined,
      requestedOrganizationId: requestedOrganizationId ?? undefined,
      correlationId: context.correlationId ?? undefined,
      jobName: context.jobName ?? undefined,
    },
  });
}

export function scalarAuditRecord(
  model: { fields: readonly { name: string; kind: string }[] },
  record: AuditRecord,
) {
  return Object.fromEntries(
    model.fields
      .filter(
        (field) =>
          field.kind !== 'object' &&
          Object.prototype.hasOwnProperty.call(record, field.name),
      )
      .map((field) => [field.name, record[field.name]]),
  );
}
