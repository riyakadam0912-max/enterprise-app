import { Prisma } from '@prisma/client';

const SOFT_DELETE_MODELS = new Set([
  'User',
  'Employee',
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

function mergeWhere(existingWhere: Record<string, unknown> | undefined, deletedAtCondition: unknown) {
  return {
    ...(existingWhere ?? {}),
    deletedAt: deletedAtCondition,
  };
}

export function softDeleteMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    if (!params.model || !SOFT_DELETE_MODELS.has(params.model)) {
      return next(params);
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
      return next(params);
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
      return next(params);
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
      const args = (params.args ?? {}) as Record<string, unknown>;
      const where = args.where as Record<string, unknown> | undefined;

      if (where && Object.prototype.hasOwnProperty.call(where, 'deletedAt')) {
        return next(params);
      }

      params.args = {
        ...args,
        where: mergeWhere(where, null),
      };

      if (params.action === 'findUnique' || params.action === 'findUniqueOrThrow') {
        params.action = params.action === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
      }

      return next(params);
    }

    return next(params);
  };
}
