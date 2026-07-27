import { Injectable, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth';
import {
  AnalyticsSummaryDto,
  AbsenteeismSummaryDto,
  BurnRateSummaryDto,
  RevenueVelocitySummaryDto,
} from './dto/analytics-summary.dto';
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new ForbiddenException('Organization ID is required');
    }
    const userRow = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!userRow) {
      throw new ForbiddenException('Organization ID is required');
    }
    const organizationId = userRow.organizationId;
    if (
      typeof organizationId !== 'number' ||
      !Number.isInteger(organizationId) ||
      organizationId <= 0
    ) {
      throw new ForbiddenException('Organization ID is required');
    }
    return organizationId;
  }

  private getDayRange(target = new Date()) {
    const start = new Date(target);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { start, end };
  }

  private getMonthRange(target = new Date()) {
    const start = new Date(target.getFullYear(), target.getMonth(), 1);
    const end = new Date(target.getFullYear(), target.getMonth() + 1, 1);
    return { start, end };
  }

  async getAbsenteeismRate(user: AuthUser): Promise<AbsenteeismSummaryDto> {
    const resolvedOrganizationId = await this.resolveOrganizationId(user);
    const { start, end } = this.getDayRange();

    const [totalEmployees, presentEmployees] = await Promise.all([
      this.prisma.employee.count({
        where: { deletedAt: null, organizationId: resolvedOrganizationId },
      }),
      this.prisma.attendance.groupBy({
        by: ['employeeId'],
        where: {
          deletedAt: null,
          organizationId: resolvedOrganizationId,
          date: { gte: start, lt: end },
          checkIn: { not: null },
          employee: { deletedAt: null, organizationId: resolvedOrganizationId },
        },
      } satisfies Prisma.AttendanceGroupByArgs),
    ]);

    const presentCount = presentEmployees.length;
    const absenteeismRate =
      totalEmployees === 0
        ? 0
        : Number(
            (((totalEmployees - presentCount) / totalEmployees) * 100).toFixed(
              2,
            ),
          );

    return {
      totalEmployees,
      presentCount,
      absenteeismRate,
    };
  }

  async getBurnRate(user: AuthUser): Promise<BurnRateSummaryDto> {
    const resolvedOrganizationId = await this.resolveOrganizationId(user);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const { start, end } = this.getMonthRange(now);

    const [payrollAgg, expenseAgg] = await Promise.all([
      this.prisma.payrollEntry.aggregate({
        _sum: { netPay: true },
        where: {
          deletedAt: null,
          organizationId: resolvedOrganizationId,
          payrollCycle: {
            deletedAt: null,
            organizationId: resolvedOrganizationId,
            month: currentMonth,
            year: currentYear,
          },
        },
      } satisfies Prisma.PayrollEntryAggregateArgs),
      this.prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          deletedAt: null,
          organizationId: resolvedOrganizationId,
          OR: [
            { expenseDate: { gte: start, lte: end } },
            {
              expenseDate: null,
              createdAt: { gte: start, lte: end },
            },
          ],
        },
      }),
    ]);

    const payrollTotal = Number((payrollAgg._sum?.netPay ?? 0).toFixed(2));
    const expenseTotal = Number((expenseAgg._sum?.amount ?? 0).toFixed(2));

    return {
      payroll: payrollTotal,
      expenses: expenseTotal,
      total: Number((payrollTotal + expenseTotal).toFixed(2)),
    };
  }

  async getRevenueVelocity(user: AuthUser): Promise<RevenueVelocitySummaryDto> {
    const resolvedOrganizationId = await this.resolveOrganizationId(user);
    const wonDeals = await this.prisma.deal.findMany({
      where: {
        deletedAt: null,
        organizationId: resolvedOrganizationId,
        stage: 'WON',
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    if (wonDeals.length === 0) {
      return { averageDays: 0 };
    }

    const totalDiffMs = wonDeals.reduce((sum, deal) => {
      return sum + (deal.updatedAt.getTime() - deal.createdAt.getTime());
    }, 0);

    const averageDays = Number(
      (totalDiffMs / wonDeals.length / (1000 * 60 * 60 * 24)).toFixed(2),
    );

    return {
      averageDays,
    };
  }

  async getSummary(user: AuthUser): Promise<AnalyticsSummaryDto> {
    const [absenteeism, burnRate, revenueVelocity] = await Promise.all([
      this.getAbsenteeismRate(user),
      this.getBurnRate(user),
      this.getRevenueVelocity(user),
    ]);

    return {
      absenteeism,
      burnRate,
      revenueVelocity,
    };
  }
}
