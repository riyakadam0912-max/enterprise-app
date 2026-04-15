import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Role } from '../common/enums/role.enum';
import { MetricsService } from '../common/services/metrics.service';
import { DASHBOARD_CACHE_KEY } from '../common/utils/cache-keys';
import { PrismaService } from '../prisma/prisma.service';

type AuthUser = { userId: number; role: Role; employeeId?: number | null };

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private async invalidateDashboardCache() {
    await this.cacheManager.del(DASHBOARD_CACHE_KEY);
  }

  async getStats(user?: AuthUser) {
    const cached = await this.cacheManager.get<Record<string, unknown>>(DASHBOARD_CACHE_KEY);
    if (cached) {
      return cached;
    }

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
    ] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { status: 'CONVERTED' } }),
      this.prisma.task.count(),
      this.prisma.invoice.count(),
      this.prisma.attendance.count(),
      this.prisma.attendance.count({ where: { status: 'ABSENT' } }),
      this.prisma.invoice.aggregate({ _sum: { totalAmount: true } }),
      this.prisma.task.groupBy({ by: ['status'], _count: { status: true } }),
      this.prisma.lead.groupBy({ by: ['status'], _count: { status: true } }),
      this.prisma.deal.groupBy({ by: ['stage'], _count: { stage: true } }),
      this.prisma.deal.count(),
      this.prisma.deal.count({ where: { stage: 'WON' } }),
      this.prisma.deal.count({ where: { stage: 'LOST' } }),
      this.prisma.deal.aggregate({
        _sum: { value: true },
        where: { stage: { notIn: ['WON', 'LOST'] } },
      }),
      this.prisma.deal.findMany({
        where: { stage: 'WON' },
        select: { value: true, actualCloseDate: true, closeDate: true },
      }),
      this.prisma.leaveRequest.count({ where: { status: 'PENDING_MANAGER' } }),
      this.prisma.leaveRequest.count({ where: { status: 'PENDING_HR' } }),
      this.prisma.expense.count({ where: { status: { in: ['PENDING', 'PENDING_MANAGER', 'PENDING_HR'] } } }),
      this.prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          updatedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      this.prisma.leaveRequest.count({
        where: {
          status: 'REJECTED',
          updatedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      this.prisma.attendance.groupBy({ by: ['status'], _count: { status: true }, where: { date: new Date(new Date().setHours(0, 0, 0, 0)) } }),
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

    const leadConversionRate = totalLeads === 0
      ? 0
      : Number(((convertedLeads / totalLeads) * 100).toFixed(2));

    const conversionRate = this.metricsService.calculateConversionRate(wonDeals, totalLeads);
    const absenteeismRate = this.metricsService.calculateAbsenteeism(absentAttendanceRows, totalAttendanceRows);
    const revenuePerLead = this.metricsService.calculateRevenuePerLead(invoiceAgg._sum.totalAmount ?? 0, totalLeads);

    const attendanceToday: Record<string, number> = {};
    for (const item of attendanceTodaySummary) {
      attendanceToday[item.status] = item._count.status;
    }

    const payload = {
      totalEmployees,
      totalLeads,
      leadConversionRate,
      conversionRate,
      absenteeismRate,
      revenuePerLead,
      totalTasks,
      totalInvoices,
      totalRevenue:   invoiceAgg._sum.totalAmount ?? 0,
      totalAttendanceRows,
      tasksByStatus:  taskStatusMap,
      leadsByStatus:  leadStatusMap,
      totalDeals,
      wonDeals,
      lostDeals,
      pipelineValue:  pipelineAgg._sum.value ?? 0,
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
      scope: {
        role: user?.role ?? null,
      },
    };

    await this.cacheManager.set(DASHBOARD_CACHE_KEY, payload, 300);
    return payload;
  }
}
