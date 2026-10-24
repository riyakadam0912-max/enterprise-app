import { Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { getAuditContext } from './audit-context';
import { getAuditTransaction } from './audit-transaction';
import {
  auditId,
  auditModel,
  findAuditRecord,
  isAuditRecord,
  resolveAuditOwnership,
} from './audit-ownership';
import type { AuditOwnership, AuditRecord } from './audit-ownership';
import { persistAuditEvent, scalarAuditRecord } from './audit-persistence';

const ACTIONS = new Set([
  'create',
  'update',
  'delete',
  'upsert',
  'createMany',
  'updateMany',
  'deleteMany',
]);
const EXCLUDED = new Set([
  'AuditLog',
  'SystemAuditEvent',
  'ActivityTimeline',
  'ActivityTimelineComment',
]);
const MODULES: Record<string, string> = {
  User: 'Users',
  Employee: 'HR',
  Attendance: 'Attendance',
  LeaveRequest: 'Leave',
  SalaryStructure: 'Payroll',
  PayrollCycle: 'Payroll',
  PayrollEntry: 'Payroll',
  Payslip: 'Payroll',
  Task: 'Tasks',
  Project: 'Projects',
  Lead: 'CRM',
  Deal: 'CRM',
  Contact: 'CRM',
  CampaignLead: 'CRM',
  Invoice: 'Accounting',
  LedgerEntry: 'Accounting',
  Payment: 'Accounting',
  Product: 'Inventory',
  File: 'Assets',
  FileActivity: 'Assets',
  FileAttachment: 'Assets',
  Quote: 'CRM',
  RolePermission: 'Roles & Permissions',
  Permission: 'Roles & Permissions',
  AppRole: 'Roles & Permissions',
};

export function automaticAuditMiddleware(
  root: PrismaClient,
): Prisma.Middleware {
  const logger = new Logger('AutomaticAudit');
  return async (params, next) => {
    const modelName = params.model;
    const action = params.action;
    if (!modelName || EXCLUDED.has(modelName) || !ACTIONS.has(action))
      return next(params);
    const model = auditModel(modelName);
    if (!model) return next(params);
    const context = { ...getAuditContext() };
    const transaction = getAuditTransaction(root);
    const client = transaction ?? root;
    const batchTransaction = params.runInTransaction && !transaction;
    const bulk = action.endsWith('Many');
    const args: AuditRecord = isAuditRecord(params.args) ? params.args : {};
    const where = isAuditRecord(args.where) ? args.where : {};
    let before: AuditRecord | null = null;
    let lookupFailed = false;
    if (!bulk && !batchTransaction && action !== 'create') {
      try {
        before = await findAuditRecord(client, modelName, where);
      } catch (error) {
        if (transaction) throw error;
        lookupFailed = true;
      }
    }
    // Mutation errors propagate unchanged and never generate a success audit.
    const result: unknown = await next(params);
    try {
      const base = {
        module: MODULES[modelName] ?? modelName,
        entityType: modelName,
        action: action.toUpperCase(),
      };
      if (bulk || batchTransaction) {
        await persistAuditEvent(
          client,
          {
            ...base,
            newValue: {
              count: isAuditRecord(result) ? result.count : null,
              where: args.where,
            },
            status: batchTransaction ? 'UNVERIFIED' : 'SUCCESS',
            description:
              'Operation summary; individual affected rows are not inferred',
          },
          context,
          {
            organizationId: null,
            reason: batchTransaction
              ? 'BATCH_TRANSACTION_UNVERIFIED'
              : 'BULK_WRITE_SUMMARY',
          },
        );
        return result;
      }
      let after: AuditRecord | null = isAuditRecord(result) ? result : null;
      const returnedOrganizationId = auditId(after?.organizationId);
      if (action !== 'delete') {
        const identity = after?.id != null ? { id: after.id } : where;
        if (Object.keys(identity).length)
          after = (await findAuditRecord(client, modelName, identity)) ?? after;
        // A successful create proves its supplied tenant FK even with a restricted select.
        if (
          !before &&
          action === 'create' &&
          after &&
          !('organizationId' in after)
        ) {
          const data = isAuditRecord(args.data) ? args.data : {};
          const relation =
            isAuditRecord(data.organization) &&
            isAuditRecord(data.organization.connect)
              ? data.organization.connect
              : {};
          const organizationId =
            auditId(data.organizationId) ?? auditId(relation.id);
          if (organizationId) after = { ...after, organizationId };
        }
      }
      const target = action === 'delete' ? before : after;
      let ownership: AuditOwnership = lookupFailed
        ? { organizationId: null, reason: 'OWNERSHIP_LOOKUP_FAILED' }
        : await resolveAuditOwnership(client, modelName, target);
      if (
        returnedOrganizationId &&
        ownership.organizationId &&
        returnedOrganizationId !== ownership.organizationId
      ) {
        ownership = { organizationId: null, reason: 'OWNERSHIP_CHANGED' };
      }
      if (before && after && action !== 'delete') {
        const oldOwner = await resolveAuditOwnership(client, modelName, before);
        if (
          oldOwner.organizationId &&
          ownership.organizationId &&
          oldOwner.organizationId !== ownership.organizationId
        )
          ownership = { organizationId: null, reason: 'OWNERSHIP_CHANGED' };
      }
      const entityId = auditId(target?.id) ?? auditId(before?.id);
      let eventAction =
        action === 'upsert'
          ? before
            ? 'UPDATE'
            : 'CREATE'
          : action.toUpperCase();
      if (
        before &&
        after &&
        before.deletedAt == null &&
        after.deletedAt != null
      )
        eventAction = 'DELETE';
      if (
        before &&
        after &&
        before.deletedAt != null &&
        after.deletedAt === null
      )
        eventAction = 'RESTORE';
      const oldValue = before ? scalarAuditRecord(model, before) : undefined;
      const newValue =
        action === 'delete'
          ? undefined
          : after
            ? scalarAuditRecord(model, after)
            : undefined;
      const event = {
        ...base,
        action: eventAction,
        entityId,
        oldValue,
        newValue,
      };
      if (eventAction === 'UPDATE' && before && after) {
        for (const [field, value] of Object.entries(newValue ?? {})) {
          if (field === 'createdAt' || field === 'updatedAt') continue;
          if (
            JSON.stringify(before[field], (_key, entry: unknown) =>
              typeof entry === 'bigint' ? entry.toString() : entry,
            ) ===
            JSON.stringify(value, (_key, entry: unknown) =>
              typeof entry === 'bigint' ? entry.toString() : entry,
            )
          )
            continue;
          await persistAuditEvent(
            client,
            {
              ...event,
              fieldName: field,
              oldValue: before[field],
              newValue: value,
            },
            context,
            ownership,
          );
        }
      } else await persistAuditEvent(client, event, context, ownership);
      const data = isAuditRecord(args.data)
        ? args.data
        : isAuditRecord(args.create)
          ? args.create
          : {};
      const nested = model.fields
        .filter((field) => field.kind === 'object' && field.name in data)
        .map((field) => field.name);
      if (nested.length)
        await persistAuditEvent(
          client,
          {
            ...base,
            entityId,
            action: 'NESTED_WRITE_SUMMARY',
            newValue: { relations: nested },
          },
          context,
          {
            organizationId: ownership.organizationId,
            reason: 'NESTED_WRITE_SUMMARY',
          },
        );
    } catch (error) {
      // Interactive transactions roll back both mutation and audit on failure.
      if (transaction) throw error;
      // Already committed writes must not look like retryable mutation failures.
      logger.error(
        JSON.stringify({
          event: 'AUDIT_PERSISTENCE_FAILED',
          model: modelName,
          action,
          correlationId: context.correlationId ?? null,
        }),
      );
    }
    return result;
  };
}
