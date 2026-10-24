import { Prisma, PrismaClient } from '@prisma/client';
import { withDeletedRecords } from '../../prisma/middleware/softDelete';

export type AuditDatabase = PrismaClient | Prisma.TransactionClient;
export type AuditRecord = Record<string, unknown>;
export type AuditOwnership = {
  organizationId: number | null;
  reason: string | null;
};
const models = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [model.name, model]),
);
const GLOBAL_MODELS = new Set([
  'AppRole',
  'Permission',
  'RolePermission',
  'TicketType',
  'NotificationTemplate',
  'WorkflowDefinition',
  'WorkflowStage',
  'WorkflowRule',
  'SystemSetting',
]);
const OWNERS: Record<string, [string, string]> = {
  AuthSession: ['User', 'userId'],
  UserReportingManager: ['User', 'employeeId'],
  UserRole: ['User', 'userId'],
  EmployeeShiftAssignment: ['Employee', 'employeeId'],
  AttendanceBreak: ['Attendance', 'attendanceId'],
  AttendanceSessionBreak: ['AttendanceSession', 'attendanceSessionId'],
  TaskCrewAssignment: ['Task', 'taskId'],
  TaskTimerInterval: ['TaskTimerSession', 'timerSessionId'],
  ClientProjectAccess: ['ClientProfile', 'clientProfileId'],
  QuotePublicLink: ['Quote', 'quoteId'],
  QuoteStatusHistory: ['Quote', 'quoteId'],
};

export function isAuditRecord(value: unknown): value is AuditRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function auditId(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}
type AuditModel = {
  name: string;
  fields: readonly { name: string; kind: string }[];
};
export function auditModel(name: string): AuditModel | undefined {
  return models.get(name);
}

export async function findAuditRecord(
  client: AuditDatabase,
  model: string,
  where: AuditRecord,
) {
  if (!models.has(model) || Object.keys(where).length === 0) return null;
  const delegate = Reflect.get(
    client,
    model[0].toLowerCase() + model.slice(1),
  ) as {
    findUnique(args: { where: AuditRecord }): Promise<unknown>;
  };
  const result = await withDeletedRecords(() => delegate.findUnique({ where }));
  return isAuditRecord(result) ? result : null;
}

export async function resolveAuditOwnership(
  client: AuditDatabase,
  model: string,
  record: AuditRecord | null,
  depth = 0,
): Promise<AuditOwnership> {
  if (!models.has(model))
    return { organizationId: null, reason: 'UNKNOWN_ENTITY' };
  if (GLOBAL_MODELS.has(model))
    return { organizationId: null, reason: 'PLATFORM_EVENT' };
  if (!record || depth > 3)
    return { organizationId: null, reason: 'OWNERSHIP_UNRESOLVED' };
  if (model === 'Organization')
    return { organizationId: auditId(record.id), reason: null };
  if (
    models.get(model)?.fields.some((field) => field.name === 'organizationId')
  ) {
    const organizationId = auditId(record.organizationId);
    return {
      organizationId,
      reason: organizationId
        ? null
        : model === 'User' && record.organizationId === null
          ? 'PLATFORM_EVENT'
          : 'OWNERSHIP_UNRESOLVED',
    };
  }
  const owner = OWNERS[model];
  const ownerId = owner && auditId(record[owner[1]]);
  if (!owner || !ownerId)
    return { organizationId: null, reason: 'OWNERSHIP_UNRESOLVED' };
  return resolveAuditOwnership(
    client,
    owner[0],
    await findAuditRecord(client, owner[0], { id: ownerId }),
    depth + 1,
  );
}
