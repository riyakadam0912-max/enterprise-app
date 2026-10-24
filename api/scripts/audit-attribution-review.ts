import { Prisma, PrismaClient } from '@prisma/client';
import {
  auditId,
  findAuditRecord,
  resolveAuditOwnership,
} from '../src/audit-logs/audit-ownership';
import { reviewHistoricalAudit } from '../src/audit-logs/audit-history-review';

async function main() {
  // Do not automatically connect to the API's potentially production .env.
  const url = process.env.AUDIT_REVIEW_DATABASE_URL;
  if (!url) throw new Error('Set AUDIT_REVIEW_DATABASE_URL explicitly');
  const apply = process.argv.includes('--apply-confirmed');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = Number(limitArg?.slice('--limit='.length) ?? 1000);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000)
    throw new Error('Limit must be between 1 and 10000');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const afterArg = process.argv.find((arg) => arg.startsWith('--after-id='));
  const afterId = Number(afterArg?.slice('--after-id='.length) ?? 0);
  if (!Number.isSafeInteger(afterId) || afterId < 0)
    throw new Error('after-id must be nonnegative');
  let scanned = 0,
    flagged = 0,
    corrected = 0,
    cursor = afterId;
  try {
    while (scanned < limit) {
      const rows = await prisma.auditLog.findMany({
        where: { id: { gt: cursor } },
        orderBy: { id: 'asc' },
        take: Math.min(100, limit - scanned),
      });
      if (!rows.length) break;
      for (const row of rows) {
        cursor = row.id;
        scanned++;
        const record = row.entityId
          ? await findAuditRecord(prisma, row.entityType, { id: row.entityId })
          : null;
        const owner = await resolveAuditOwnership(
          prisma,
          row.entityType,
          record,
        );
        const review = reviewHistoricalAudit(row, owner);
        if (
          owner.organizationId === row.organizationId &&
          !review.confirmedOrganizationId
        )
          continue;
        flagged++;
        let changed = false;
        if (apply && review.confirmedOrganizationId) {
          changed = await prisma.$transaction(
            async (tx) => {
              const latest = await tx.auditLog.findUnique({
                where: { id: row.id },
              });
              if (!latest || latest.organizationId !== row.organizationId)
                return false;
              const latestRecord = latest.entityId
                ? await findAuditRecord(tx, latest.entityType, {
                    id: latest.entityId,
                  })
                : null;
              const latestOwner = await resolveAuditOwnership(
                tx,
                latest.entityType,
                latestRecord,
              );
              const confirmed = reviewHistoricalAudit(
                latest,
                latestOwner,
              ).confirmedOrganizationId;
              if (
                !confirmed ||
                !auditId(confirmed) ||
                !(await tx.organization.findUnique({
                  where: { id: confirmed },
                  select: { id: true },
                }))
              )
                return false;
              await tx.auditLog.update({
                where: { id: latest.id },
                data: { organizationId: confirmed },
              });
              await tx.systemAuditEvent.create({
                data: {
                  module: 'Audit',
                  entityType: 'AuditLog',
                  entityId: latest.id,
                  action: 'CORRECT_ORGANIZATION',
                  reason: 'HISTORICAL_ATTRIBUTION_CORRECTION',
                  targetOrganizationId: confirmed,
                  requestedOrganizationId: latest.organizationId,
                  userRole: 'SYSTEM',
                  jobName: 'audit.history-review',
                  oldValue: { organizationId: latest.organizationId },
                  newValue: { organizationId: confirmed },
                },
              });
              return true;
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          );
          if (changed) corrected++;
        }
        // Metadata only: never dump employee, financial, or authentication snapshots.
        console.log(
          JSON.stringify({
            auditLogId: row.id,
            entityType: row.entityType,
            entityId: row.entityId,
            recordedOrganizationId: row.organizationId,
            currentOrganizationId: owner.organizationId,
            reason: review.reason,
            confirmedOrganizationId: review.confirmedOrganizationId,
            corrected: changed,
          }),
        );
      }
    }
    console.log(
      JSON.stringify({
        mode: apply ? 'apply-confirmed' : 'report-only',
        scanned,
        flagged,
        corrected,
        lastId: cursor,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch(() => {
  console.error(
    'Audit review failed. Verify the explicit database URL, schema migration, and access permissions.',
  );
  process.exitCode = 1;
});
