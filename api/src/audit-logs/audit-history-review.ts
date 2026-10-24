import { auditId, auditModel, isAuditRecord } from './audit-ownership';
import type { AuditOwnership } from './audit-ownership';
export type HistoricalAudit = {
  entityType: string;
  entityId: number | null;
  organizationId: number;
  oldValue: unknown;
  newValue: unknown;
};
export function reviewHistoricalAudit(
  row: HistoricalAudit,
  current: AuditOwnership,
) {
  const model = auditModel(row.entityType);
  if (!model || current.reason === 'PLATFORM_EVENT')
    return {
      reason: 'PLATFORM_OR_UNKNOWN_ENTITY',
      confirmedOrganizationId: null,
    };
  const snapshots = [row.oldValue, row.newValue].filter(isAuditRecord);
  const evidence = snapshots
    .filter((snapshot) => auditId(snapshot.id) === row.entityId)
    .map((snapshot) =>
      row.entityType === 'Organization'
        ? auditId(snapshot.id)
        : model.fields.some((field) => field.name === 'organizationId')
          ? auditId(snapshot.organizationId)
          : null,
    )
    .filter((id): id is number => id !== null);
  const owners = [...new Set(evidence)];
  if (owners.length !== 1)
    return {
      reason:
        owners.length > 1 ? 'CONFLICTING_SNAPSHOTS' : 'NO_RECORD_SNAPSHOT',
      confirmedOrganizationId: null,
    };
  const target = owners[0];
  if (current.organizationId && current.organizationId !== target)
    return {
      reason: 'CURRENT_OWNER_DIFFERS_FROM_SNAPSHOT',
      confirmedOrganizationId: null,
    };
  if (target === row.organizationId)
    return { reason: 'SNAPSHOT_MATCHES', confirmedOrganizationId: null };
  return {
    reason: 'CONFIRMED_SNAPSHOT_MISMATCH',
    confirmedOrganizationId: target,
  };
}
