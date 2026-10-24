import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

const auditReads = new AsyncLocalStorage<boolean>();
export function withDeletedRecords<T>(callback: () => T): T {
  return auditReads.run(true, callback);
}

const SOFT_DELETE_MODELS = new Set([
  'User',
  'Employee',
  'Attendance',
  'Lead',
  'Deal',
  'Task',
  'LeaveRequest',
  'TicketType',
  'Ticket',
  'FormSubmission',
  'MarketingCampaign',
  'Expense',
  'Project',
  'ProjectLink',
  'Contact',
  'Event',
  'DynamicForm',
  'Quote',
  'QuoteItem',
  'ProductCategory',
  'Product',
  'CampaignLead',
  'Activity',
  'LedgerEntry',
  'Invoice',
  'Timesheet',
  'Payment',
  'FileAttachment',
  'SalaryStructure',
  'PayrollCycle',
  'PayrollEntry',
  'Payslip',
  'PayrollEarnings',
  'PayrollDeduction',
  'TaxDeclaration',
  'Form16',
  'JobOpening',
  'Candidate',
  'Interview',
  'GoalCycle',
  'Goal',
  'PerformanceReview',
]);

function mergeWhere(
  existingWhere: Record<string, unknown> | undefined,
  deletedAtCondition: unknown,
) {
  return {
    ...(existingWhere ?? {}),
    deletedAt: deletedAtCondition,
  };
}

export function softDeleteMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    if (!params.model || !SOFT_DELETE_MODELS.has(params.model)) {
      return await next(params);
    }

    if (params.action === 'delete') {
      params.action = 'update';
      params.args = {
        ...params.args,
        data: {
          ...(params.args?.data ?? {}),
          deletedAt: new Date(),
        },
      };
      return await next(params);
    }

    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      params.args = {
        ...params.args,
        data: {
          ...(params.args?.data ?? {}),
          deletedAt: new Date(),
        },
      };
      return await next(params);
    }

    if (
      params.action === 'findMany' ||
      params.action === 'findFirst' ||
      params.action === 'findUnique' ||
      params.action === 'findUniqueOrThrow' ||
      params.action === 'findFirstOrThrow' ||
      params.action === 'count' ||
      params.action === 'aggregate' ||
      params.action === 'groupBy'
    ) {
      if (auditReads.getStore()) return next(params);
      const args = (params.args ?? {}) as Record<string, unknown>;
      const where = args.where as Record<string, unknown> | undefined;

      if (where && Object.prototype.hasOwnProperty.call(where, 'deletedAt')) {
        return await next(params);
      }

      params.args = {
        ...args,
        where: mergeWhere(where, null),
      };

      return await next(params);
    }

    return await next(params);
  };
}
