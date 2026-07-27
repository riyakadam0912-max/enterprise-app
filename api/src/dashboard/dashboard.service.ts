import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { MetricsService } from '../common/services/metrics.service';
import { DASHBOARD_CACHE_KEY } from '../common/utils/cache-keys';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth';

type WorkflowAction =
  | 'SUBMITTED'
  | 'MANAGER_APPROVED'
  | 'HR_APPROVED'
  | 'REJECTED';
type WorkflowType = 'LEAVE' | 'EXPENSE';

type WorkflowTrailEntry = {
  action: WorkflowAction;
  at: string;
  byUserId: number;
  reason: string | null;
};

type WorkflowActivity = {
  id: string;
  type: WorkflowType;
  action: WorkflowAction;
  title: string;
  at: string;
  status: string;
  href: string;
};

type RecentLeaveActivity = {
  id: number;
  leaveType: string | null;
  status: string;
  updatedAt: Date;
  createdAt?: Date | null;
  reason: string | null;
  approvalTrail?: unknown;
  employee: { name: string | null } | null;
};

const WORKFLOW_AGEING_HOURS = 48;
const WORKFLOW_OVERDUE_HOURS = 72;
const PENDING_LEAVE_STATUSES = ['PENDING_MANAGER', 'PENDING_HR'] as const;
const PENDING_EXPENSE_STATUSES = [
  'PENDING',
  'PENDING_MANAGER',
  'PENDING_HR',
] as const;

function getLatestTrailEntry(trail: unknown): WorkflowTrailEntry | null {
  if (!Array.isArray(trail) || trail.length === 0) {
    return null;
  }

  const latest = trail[trail.length - 1] as
    | Partial<WorkflowTrailEntry>
    | undefined;
  if (
    !latest ||
    typeof latest.action !== 'string' ||
    typeof latest.at !== 'string' ||
    typeof latest.byUserId !== 'number'
  ) {
    return null;
  }

  return {
    action: [
      'SUBMITTED',
      'MANAGER_APPROVED',
      'HR_APPROVED',
      'REJECTED',
    ].includes(latest.action)
      ? latest.action
      : 'SUBMITTED',
    at: latest.at,
    byUserId: latest.byUserId,
    reason: latest.reason ?? null,
  };
}

function formatWorkflowAge(date: Date | string | null | undefined) {
  if (!date) return 0;
  const value =
    date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (Number.isNaN(value)) return 0;
  return value;
}

function toDateString(
  date: Date | string | null | undefined,
  fallback: Date,
): string {
  if (!date) return fallback.toISOString();
  if (date instanceof Date) return date.toISOString();
  try {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  } catch {
    // ignore, use fallback
  }
  return fallback.toISOString();
}

function isMissingApprovalTrailColumnError(error: unknown) {
  return error instanceof Error && error.message.includes('approvalTrail');
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private async resolveOrganizationId(user: AuthUser): Promise<number> {
    if (
      typeof user.organizationId === 'number' &&
      Number.isInteger(user.organizationId) &&
      user.organizationId > 0
    ) {
      return user.organizationId;
    }
    const userId = user.userId ?? user.id;
    if (!userId) {
      throw new BadRequestException('User has no associated organization');
    }
    const userRow = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!userRow) {
      throw new BadRequestException('User has no associated organization');
    }
    const organizationId = userRow.organizationId;
    if (
      typeof organizationId !== 'number' ||
      !Number.isInteger(organizationId) ||
      organizationId <= 0
    ) {
      throw new BadRequestException('User has no associated organization');
    }
    return organizationId;
  }

  private async invalidateDashboardCache() {
    await this.cacheManager.del(DASHBOARD_CACHE_KEY);
  }

  private async loadRecentLeaveActivities(user: AuthUser) {
    const organizationId = await this.resolveOrganizationId(user);
    const baseSelect = {
      id: true,
      leaveType: true,
      status: true,
      updatedAt: true,
      reason: true,
      employee: { select: { name: true } },
    } as const;

    try {
      return (await this.prisma.leaveRequest.findMany({
        where: {
          status: {
            in: ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED'],
          },
          organizationId,
        },
        orderBy: { updatedAt: 'desc' },
        take: 4,
        select: {
          ...baseSelect,
          approvalTrail: true,
        },
      })) as RecentLeaveActivity[];
    } catch (error) {
      if (!isMissingApprovalTrailColumnError(error)) {
        throw error;
      }

      return (await this.prisma.leaveRequest.findMany({
        where: {
          status: {
            in: ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED'],
          },
          organizationId,
        },
        orderBy: { updatedAt: 'desc' },
        take: 4,
        select: baseSelect,
      })) as RecentLeaveActivity[];
    }
  }

  async getStats(user: AuthUser) {
    const organizationId = await this.resolveOrganizationId(user);
    const now = new Date();
    const ageingCutoff = new Date(
      now.getTime() - WORKFLOW_AGEING_HOURS * 60 * 60 * 1000,
    );
    const overdueCutoff = new Date(
      now.getTime() - WORKFLOW_OVERDUE_HOURS * 60 * 60 * 1000,
    );
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

    const [
      totalEmployees,
      totalLeads,
      convertedLeads,
      totalTasks,
      totalInvoices,
      totalAttendanceRows,
      absentAttendanceRows,
      invoiceAgg,
      tasksByStatus,
      leadsByStatus,
      dealsByStageRows,
      totalDeals,
      wonDeals,
      lostDeals,
      pipelineAgg,
      wonDealsForRevenue,
      pendingManagerLeaves,
      pendingHrLeaves,
      pendingExpenses,
      approvedThisMonthLeaves,
      rejectedThisMonthLeaves,
      attendanceTodaySummary,
      ageingLeaveApprovals,
      ageingExpenseApprovals,
      overdueLeaveApprovals,
      overdueExpenseApprovals,
      recentLeaveActivities,
      recentExpenseActivities,
    ] = await Promise.all([
      this.prisma.employee.count({
        where: { organizationId },
      }),
      this.prisma.lead.count({
        where: { organizationId },
      }),
      this.prisma.lead.count({
        where: { status: 'CONVERTED', organizationId },
      }),
      this.prisma.task.count({
        where: { organizationId },
      }),
      this.prisma.invoice.count({
        where: { organizationId },
      }),
      this.prisma.attendance.count({
        where: { organizationId },
      }),
      this.prisma.attendance.count({
        where: { status: 'ABSENT', organizationId },
      }),
      this.prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: { organizationId },
      }),
      this.prisma.task.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { organizationId },
      }),
      this.prisma.lead.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { organizationId },
      }),
      this.prisma.deal.groupBy({
        by: ['stage'],
        _count: { stage: true },
        where: { organizationId },
      }),
      this.prisma.deal.count({
        where: { organizationId },
      }),
      this.prisma.deal.count({
        where: { stage: 'WON', organizationId },
      }),
      this.prisma.deal.count({
        where: { stage: 'LOST', organizationId },
      }),
      this.prisma.deal.aggregate({
        _sum: { value: true },
        where: {
          stage: { notIn: ['WON', 'LOST'] },
          organizationId,
        },
      }),
      this.prisma.deal.findMany({
        where: { stage: 'WON', organizationId },
        select: { value: true, actualCloseDate: true, closeDate: true },
      }),
      this.prisma.leaveRequest.count({
        where: {
          status: 'PENDING_MANAGER',
          organizationId,
        },
      }),
      this.prisma.leaveRequest.count({
        where: { status: 'PENDING_HR', organizationId },
      }),
      this.prisma.expense.count({
        where: {
          status: { in: ['PENDING', 'PENDING_MANAGER', 'PENDING_HR'] },
          organizationId,
        },
      }),
      this.prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          updatedAt: { gte: monthStart },
          organizationId,
        },
      }),
      this.prisma.leaveRequest.count({
        where: {
          status: 'REJECTED',
          updatedAt: { gte: monthStart },
          organizationId,
        },
      }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { date: today, organizationId },
      }),
      this.prisma.leaveRequest.count({
        where: {
          status: { in: [...PENDING_LEAVE_STATUSES] },
          updatedAt: { lt: ageingCutoff },
          organizationId,
        },
      }),
      this.prisma.expense.count({
        where: {
          status: { in: [...PENDING_EXPENSE_STATUSES] },
          updatedAt: { lt: ageingCutoff },
          organizationId,
        },
      }),
      this.prisma.leaveRequest.count({
        where: {
          status: { in: [...PENDING_LEAVE_STATUSES] },
          updatedAt: { lt: overdueCutoff },
          organizationId,
        },
      }),
      this.prisma.expense.count({
        where: {
          status: { in: [...PENDING_EXPENSE_STATUSES] },
          updatedAt: { lt: overdueCutoff },
          organizationId,
        },
      }),
      this.loadRecentLeaveActivities(user),
      this.prisma.expense.findMany({
        where: {
          status: {
            in: [
              'PENDING',
              'PENDING_MANAGER',
              'PENDING_HR',
              'APPROVED',
              'REJECTED',
            ],
          },
          organizationId,
        },
        orderBy: { updatedAt: 'desc' },
        take: 4,
        select: {
          id: true,
          category: true,
          description: true,
          status: true,
          updatedAt: true,
          approvalTrail: true,
          employee: { select: { name: true } },
        },
      }),
    ]);

    const taskStatusMap: Record<string, number> = {};
    for (const item of tasksByStatus) {
      taskStatusMap[item.status] = item._count.status;
    }

    const leadStatusMap: Record<string, number> = {};
    for (const item of leadsByStatus) {
      leadStatusMap[item.status] = item._count.status;
    }

    const dealsByStage: Record<string, number> = {};
    for (const item of dealsByStageRows) {
      dealsByStage[item.stage] = item._count.stage;
    }

    const monthBuckets = new Map<string, number>();
    for (const deal of wonDealsForRevenue) {
      const date = deal.actualCloseDate ?? deal.closeDate;
      if (!date) continue;
      const month = date.toISOString().slice(0, 7);
      monthBuckets.set(month, (monthBuckets.get(month) ?? 0) + deal.value);
    }

    const revenueByMonth = [...monthBuckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, revenue]) => ({ month, revenue }));

    const leadConversionRate =
      totalLeads === 0
        ? 0
        : Number(((convertedLeads / totalLeads) * 100).toFixed(2));

    const conversionRate = this.metricsService.calculateConversionRate(
      wonDeals,
      totalLeads,
    );
    const absenteeismRate = this.metricsService.calculateAbsenteeism(
      absentAttendanceRows,
      totalAttendanceRows,
    );
    const revenuePerLead = this.metricsService.calculateRevenuePerLead(
      invoiceAgg._sum.totalAmount ?? 0,
      totalLeads,
    );

    const attendanceToday: Record<string, number> = {};
    for (const item of attendanceTodaySummary) {
      attendanceToday[item.status] = item._count.status;
    }

    const workflowRecentActivity: WorkflowActivity[] = [
      ...recentLeaveActivities.map(
        (item: {
          id: number;
          approvalTrail?: unknown;
          updatedAt?: Date | string | null;
          createdAt?: Date | string | null;
          status?: string;
          employee?: { name?: string | null } | null;
          leaveType?: string | null;
        }): WorkflowActivity => {
          const latestTrail = getLatestTrailEntry(item.approvalTrail);
          const activityAt = toDateString(
            latestTrail?.at ?? item.updatedAt ?? item.createdAt,
            now,
          );

          return {
            id: `leave-${item.id}`,
            type: 'LEAVE',
            action: latestTrail?.action ?? 'SUBMITTED',
            title: `${item.employee?.name ?? 'Leave request'} • ${(item.leaveType ?? 'leave').toString().replaceAll('_', ' ').toLowerCase()}`,
            at: activityAt,
            status: item.status ?? '',
            href: '/dashboard/requests',
          };
        },
      ),
      ...recentExpenseActivities.map(
        (item: {
          id: number;
          approvalTrail?: unknown;
          updatedAt?: Date | string | null;
          createdAt?: Date | string | null;
          status?: string;
          employee?: { name?: string | null } | null;
          category?: string | null;
        }): WorkflowActivity => {
          const latestTrail = getLatestTrailEntry(item.approvalTrail);
          const activityAt = toDateString(
            latestTrail?.at ?? item.updatedAt ?? item.createdAt,
            now,
          );

          return {
            id: `expense-${item.id}`,
            type: 'EXPENSE',
            action: latestTrail?.action ?? 'SUBMITTED',
            title: `${item.employee?.name ?? 'Expense'} • ${(item.category ?? 'Uncategorized').toString().replaceAll('_', ' ').toLowerCase()}`,
            at: activityAt,
            status: item.status ?? '',
            href: '/dashboard/expenses',
          };
        },
      ),
    ]
      .sort((a, b) => formatWorkflowAge(b.at) - formatWorkflowAge(a.at))
      .slice(0, 6);

    const workflow = {
      pendingLeaves: pendingManagerLeaves + pendingHrLeaves,
      pendingExpenses,
      agingApprovals: ageingLeaveApprovals + ageingExpenseApprovals,
      overdueApprovals: overdueLeaveApprovals + overdueExpenseApprovals,
      recentActivity: workflowRecentActivity,
    };

    const payload = {
      totalEmployees,
      totalLeads,
      leadConversionRate,
      conversionRate,
      absenteeismRate,
      revenuePerLead,
      totalTasks,
      totalInvoices,
      totalRevenue: invoiceAgg._sum.totalAmount ?? 0,
      totalAttendanceRows,
      tasksByStatus: taskStatusMap,
      leadsByStatus: leadStatusMap,
      totalDeals,
      wonDeals,
      lostDeals,
      pipelineValue: pipelineAgg._sum.value ?? 0,
      dealsByStage,
      revenueByMonth,
      hr: {
        pendingManagerLeaves,
        pendingHrLeaves,
        pendingExpenses,
        approvedThisMonthLeaves,
        rejectedThisMonthLeaves,
        attendanceToday,
      },
      workflow,
      scope: {
        role: user?.role ?? null,
      },
    };

    await this.cacheManager.set(DASHBOARD_CACHE_KEY, payload, 300);
    return payload;
  }
}
