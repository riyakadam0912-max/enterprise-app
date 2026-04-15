import {
  Inject,
  BadRequestException,
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

export interface ReportsUserContext {
  userId: number;
  role: 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';
  employeeId?: number | null;
}

export interface ReportsQueryFilters {
  month?: string;
  from?: string;
  to?: string;
  department?: string;
  employeeId?: string;
  role?: string;
  page?: string;
  limit?: string;
}

interface ScopeInfo {
  role: ReportsUserContext['role'];
  employeeIds?: number[];
  requestedEmployeeId?: number;
}

interface DateRange {
  start: Date;
  end: Date;
  monthLabel: string;
}

@Injectable()
export class ReportsAnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly monthlyPrecompute = new Map<string, unknown>();
  private precomputeInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  onModuleInit() {
    this.precomputeCurrentMonth().catch(() => undefined);

    // Simple cron-like precompute every 6 hours for current and previous month summaries.
    this.precomputeInterval = setInterval(() => {
      this.precomputeCurrentMonth().catch(() => undefined);
    }, 6 * 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.precomputeInterval) {
      clearInterval(this.precomputeInterval);
    }
  }

  async getAttendanceReport(user: ReportsUserContext, filters: ReportsQueryFilters) {
    return this.withCache('attendance', user, filters, async () => {
      const scope = await this.resolveScope(user, filters);
      const dateRange = this.resolveDateRange(filters);
      const where = this.attendanceWhere(dateRange, scope, filters.department, filters.role);

      const [totalDays, presentDays, absentDays, lateCount, overtime] = await Promise.all([
        this.prisma.attendance.count({ where }),
        this.prisma.attendance.count({
          where: {
            ...where,
            status: { in: ['PRESENT', 'HALF_DAY'] },
          },
        }),
        this.prisma.attendance.count({
          where: {
            ...where,
            status: 'ABSENT',
          },
        }),
        this.prisma.attendance.count({
          where: {
            ...where,
            lateMinutes: { gt: 0 },
          },
        }),
        this.prisma.attendance.aggregate({
          where,
          _sum: { overtimeHours: true },
        }),
      ]);

      return {
        totalDays,
        presentDays,
        absentDays,
        lateCount,
        overtimeHours: overtime._sum.overtimeHours ?? 0,
      };
    });
  }

  async getDailyAttendanceBreakdown(user: ReportsUserContext, filters: ReportsQueryFilters) {
    return this.withCache('attendance-daily', user, filters, async () => {
      const scope = await this.resolveScope(user, filters);
      const dateRange = this.resolveDateRange(filters);
      const where = this.attendanceWhere(dateRange, scope, filters.department, filters.role);
      const { page, limit, skip } = this.resolvePagination(filters);

      const [total, rows] = await Promise.all([
        this.prisma.attendance.count({ where }),
        this.prisma.attendance.findMany({
          where,
          orderBy: { date: 'desc' },
          skip,
          take: limit,
          select: {
            date: true,
            status: true,
            checkIn: true,
            checkOut: true,
            lateMinutes: true,
            overtimeHours: true,
            employee: {
              select: {
                id: true,
                name: true,
                department: true,
              },
            },
          },
        }),
      ]);

      const records = rows.map((row) => ({
        date: row.date,
        status: row.status,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        lateMinutes: row.lateMinutes,
        overtimeHours: row.overtimeHours,
        employeeId: row.employee?.id ?? null,
        employeeName: row.employee?.name ?? 'N/A',
        department: row.employee?.department ?? 'Unassigned',
      }));

      return {
        records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    });
  }

  async getDepartmentAttendance(user: ReportsUserContext, filters: ReportsQueryFilters) {
    return this.withCache('attendance-departments', user, filters, async () => {
      const scope = await this.resolveScope(user, filters);
      const dateRange = this.resolveDateRange(filters);
      const where = this.attendanceWhere(dateRange, scope, filters.department, filters.role);

      const rows = await this.prisma.attendance.findMany({
        where,
        select: {
          status: true,
          employee: {
            select: {
              department: true,
            },
          },
        },
      });

      const map = new Map<string, { total: number; present: number; absent: number; lateCount: number }>();

      for (const row of rows) {
        const department = row.employee?.department ?? 'Unassigned';
        const prev = map.get(department) ?? { total: 0, present: 0, absent: 0, lateCount: 0 };
        prev.total += 1;
        if (row.status === 'PRESENT' || row.status === 'HALF_DAY') {
          prev.present += 1;
        }
        if (row.status === 'ABSENT') {
          prev.absent += 1;
        }
        map.set(department, prev);
      }

      return Array.from(map.entries())
        .map(([department, value]) => ({
          department,
          totalDays: value.total,
          presentDays: value.present,
          absentDays: value.absent,
          attendanceRate: value.total > 0 ? Number(((value.present / value.total) * 100).toFixed(2)) : 0,
        }))
        .sort((a, b) => b.totalDays - a.totalDays);
    });
  }

  async getPayrollSummary(user: ReportsUserContext, filters: ReportsQueryFilters) {
    return this.withCache('payroll', user, filters, async () => {
      const scope = await this.resolveScope(user, filters);
      const dateRange = this.resolveDateRange(filters);
      const where = this.payrollWhere(dateRange, scope, filters.department, filters.role);

      const [entryAgg, bonusAgg] = await Promise.all([
        this.prisma.payrollEntry.aggregate({
          where,
          _sum: {
            grossPay: true,
            totalDeductions: true,
            netPay: true,
          },
        }),
        this.prisma.payslip.aggregate({
          where: {
            employeeId: where.employeeId,
            employee: where.employee,
            year: {
              gte: dateRange.start.getFullYear(),
              lte: dateRange.end.getFullYear(),
            },
            month: {
              gte: dateRange.start.getMonth() + 1,
              lte: dateRange.end.getMonth() + 1,
            },
          },
          _sum: {
            bonus: true,
          },
        }),
      ]);

      const totalPayout = entryAgg._sum.grossPay ?? 0;
      const totalDeductions = entryAgg._sum.totalDeductions ?? 0;
      const totalBonuses = bonusAgg._sum.bonus ?? 0;
      const netCost = totalPayout - totalDeductions + totalBonuses;

      return {
        totalPayout,
        totalDeductions,
        totalBonuses,
        netCost,
      };
    });
  }

  async getPayrollDistribution(user: ReportsUserContext, filters: ReportsQueryFilters) {
    return this.withCache('payroll-departments', user, filters, async () => {
      const scope = await this.resolveScope(user, filters);
      const dateRange = this.resolveDateRange(filters);
      const where = this.payrollWhere(dateRange, scope, filters.department, filters.role);

      const rows = await this.prisma.payrollEntry.findMany({
        where,
        select: {
          netPay: true,
          employee: {
            select: {
              department: true,
            },
          },
        },
      });

      const totals = new Map<string, number>();
      for (const row of rows) {
        const department = row.employee.department ?? 'Unassigned';
        totals.set(department, (totals.get(department) ?? 0) + row.netPay);
      }

      return Array.from(totals.entries())
        .map(([department, total]) => ({ department, total }))
        .sort((a, b) => b.total - a.total);
    });
  }

  async getPayrollCostTrends(user: ReportsUserContext, filters: ReportsQueryFilters) {
    return this.withCache('payroll-trends', user, filters, async () => {
      const scope = await this.resolveScope(user, filters);
      const range = this.resolveDateRange(filters);
      const months = this.lastNMonths(range.end, 6);

      const results = await Promise.all(
        months.map(async (monthPoint) => {
          const from = new Date(monthPoint.year, monthPoint.month - 1, 1);
          const to = new Date(monthPoint.year, monthPoint.month, 0, 23, 59, 59, 999);
          const where = this.payrollWhere({ start: from, end: to, monthLabel: monthPoint.label }, scope, filters.department, filters.role);
          const agg = await this.prisma.payrollEntry.aggregate({
            where,
            _sum: {
              netPay: true,
              totalDeductions: true,
            },
          });

          return {
            month: monthPoint.label,
            netPay: agg._sum.netPay ?? 0,
            deductions: agg._sum.totalDeductions ?? 0,
          };
        }),
      );

      return results;
    });
  }

  async getTurnoverSummary(user: ReportsUserContext, filters: ReportsQueryFilters) {
    return this.withCache('turnover', user, filters, async () => {
      const scope = await this.resolveScope(user, filters);
      const dateRange = this.resolveDateRange(filters);
      const employeeWhere = this.employeeWhere(scope, filters.department, filters.role);

      const [
        totalEmployees,
        openingEmployees,
        closingEmployees,
        newHires,
        resignations,
      ] = await Promise.all([
        this.prisma.employee.count({ where: employeeWhere }),
        this.prisma.employee.count({
          where: {
            ...employeeWhere,
            createdAt: { lt: dateRange.start },
          },
        }),
        this.prisma.employee.count({
          where: {
            ...employeeWhere,
            createdAt: { lte: dateRange.end },
          },
        }),
        this.prisma.employee.count({
          where: {
            ...employeeWhere,
            hireDate: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          },
        }),
        this.prisma.employee.count({
          where: {
            ...employeeWhere,
            status: {
              in: ['RESIGNED', 'TERMINATED', 'INACTIVE'],
            },
            updatedAt: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          },
        }),
      ]);

      const averageEmployees = (openingEmployees + closingEmployees) / 2 || totalEmployees || 1;
      const attritionRate = Number(((resignations / averageEmployees) * 100).toFixed(2));

      return {
        totalEmployees,
        newHires,
        resignations,
        attritionRate,
      };
    });
  }

  async getPerformanceInsights(user: ReportsUserContext, filters: ReportsQueryFilters) {
    return this.withCache('performance', user, filters, async () => {
      const scope = await this.resolveScope(user, filters);
      const dateRange = this.resolveDateRange(filters);
      const employeeWhere = this.employeeWhere(scope, filters.department, filters.role);

      const ratingWhere = {
        rating: { not: null },
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
        employeeId: employeeWhere.id,
        employee: employeeWhere,
      };

      const [avgAgg, groupedRatings, goalRows] = await Promise.all([
        this.prisma.performanceReview.aggregate({
          where: ratingWhere,
          _avg: { rating: true },
        }),
        this.prisma.performanceReview.groupBy({
          by: ['employeeId'],
          where: ratingWhere,
          _avg: { rating: true },
          _count: { employeeId: true },
        }),
        this.prisma.goal.findMany({
          where: {
            employeeId: employeeWhere.id,
            employee: employeeWhere,
            createdAt: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          },
          select: {
            status: true,
          },
        }),
      ]);

      const ratingIds = groupedRatings.map((item) => item.employeeId);
      const employees = ratingIds.length
        ? await this.prisma.employee.findMany({
            where: { id: { in: ratingIds } },
            select: { id: true, name: true, department: true },
          })
        : [];

      const employeeMap = new Map(employees.map((item) => [item.id, item]));
      const performerRows = groupedRatings
        .map((item) => ({
          employeeId: item.employeeId,
          rating: Number((item._avg.rating ?? 0).toFixed(2)),
          reviewCount: item._count.employeeId,
          name: employeeMap.get(item.employeeId)?.name ?? 'Employee',
          department: employeeMap.get(item.employeeId)?.department ?? 'Unassigned',
        }))
        .sort((a, b) => b.rating - a.rating);

      const topPerformers = performerRows.slice(0, 5);
      const lowPerformers = [...performerRows].reverse().slice(0, 5);

      const completedGoals = goalRows.filter((goal) => goal.status === 'COMPLETED').length;
      const goalCompletionRate = goalRows.length > 0
        ? Number(((completedGoals / goalRows.length) * 100).toFixed(2))
        : 0;

      return {
        avgRating: Number((avgAgg._avg.rating ?? 0).toFixed(2)),
        topPerformers,
        lowPerformers,
        goalCompletionRate,
      };
    });
  }

  async getDashboardSummary(user: ReportsUserContext, filters: ReportsQueryFilters) {
    const dateRange = this.resolveDateRange(filters);
    const cacheKey = `dashboard-summary:${user.userId}:${dateRange.start.toISOString()}:${dateRange.end.toISOString()}`;
    const cached = await this.cacheManager.get<{ cachedAt: number; payload: unknown }>(cacheKey);

    // Keep dashboard payload fresh for 5 minutes.
    if (cached && Date.now() - cached.cachedAt < 5 * 60 * 1000) {
      return cached.payload as any;
    }

    // Fetch Attendance, Payroll, and Performance summaries concurrently.
    const [attendanceSummary, payrollSummary, performanceSummary, turnoverSummary] = await Promise.all([
      this.getAttendanceReport(user, filters),
      this.getPayrollSummary(user, filters),
      this.getPerformanceInsights(user, filters),
      this.getTurnoverSummary(user, filters),
    ]);

    const scope = await this.resolveScope(user, filters);
    const employeeWhere = this.employeeWhere(scope, filters.department, filters.role);

    const [attendanceTrend, payrollTrend, employeeGrowth, attendanceRows, recentHires] = await Promise.all([
      this.buildAttendanceTrend(scope, dateRange, filters),
      this.getPayrollCostTrends(user, filters),
      this.buildEmployeeGrowthTrend(scope, dateRange, filters),
      this.getDailyAttendanceBreakdown(user, {
        ...filters,
        page: filters.page ?? '1',
        limit: filters.limit ?? '10',
      }),
      this.prisma.employee.findMany({
        where: {
          ...employeeWhere,
          hireDate: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          department: true,
          hireDate: true,
          designation: true,
        },
        orderBy: { hireDate: 'desc' },
        take: 10,
      }),
    ]);

    const performanceDistribution = this.toPerformanceDistribution(
      performanceSummary.topPerformers,
      performanceSummary.lowPerformers,
    );

    const payload = {
      attendanceSummary,
      payrollSummary,
      turnoverSummary,
      performanceSummary,
      summaryCards: {
        totalEmployees: turnoverSummary.totalEmployees,
        presentToday: attendanceSummary.presentDays,
        monthlyPayrollCost: payrollSummary.netCost,
        attritionRate: turnoverSummary.attritionRate,
      },
      charts: {
        attendanceTrend,
        payrollCost: payrollTrend,
        employeeGrowth,
        performanceDistribution,
      },
      tables: {
        topPerformers: performanceSummary.topPerformers,
        recentHires: recentHires.map((item) => ({
          id: item.id,
          name: item.name,
          department: item.department,
          designation: item.designation,
          hireDate: item.hireDate,
        })),
        attendanceBreakdown: attendanceRows.records,
      },
    };

    await this.cacheManager.set(cacheKey, { cachedAt: Date.now(), payload }, 300);
    return payload;
  }

  async getDashboard(user: ReportsUserContext, filters: ReportsQueryFilters) {
    return this.getDashboardSummary(user, filters);
  }

  private async buildAttendanceTrend(
    scope: ScopeInfo,
    dateRange: DateRange,
    filters: ReportsQueryFilters,
  ) {
    const where = this.attendanceWhere(dateRange, scope, filters.department, filters.role);
    const rows = await this.prisma.attendance.findMany({
      where,
      select: {
        date: true,
        status: true,
      },
    });

    const daily = new Map<string, { date: string; present: number; absent: number }>();

    for (const row of rows) {
      const key = this.toDateKey(row.date);
      const bucket = daily.get(key) ?? { date: key, present: 0, absent: 0 };
      if (row.status === 'PRESENT' || row.status === 'HALF_DAY') {
        bucket.present += 1;
      }
      if (row.status === 'ABSENT') {
        bucket.absent += 1;
      }
      daily.set(key, bucket);
    }

    return Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  private async buildEmployeeGrowthTrend(
    scope: ScopeInfo,
    dateRange: DateRange,
    filters: ReportsQueryFilters,
  ) {
    const months = this.lastNMonths(dateRange.end, 6);
    const employeeWhere = this.employeeWhere(scope, filters.department, filters.role);

    const data = await Promise.all(
      months.map(async (month) => {
        const monthEnd = new Date(month.year, month.month, 0, 23, 59, 59, 999);
        const count = await this.prisma.employee.count({
          where: {
            ...employeeWhere,
            createdAt: {
              lte: monthEnd,
            },
          },
        });

        return {
          month: month.label,
          count,
        };
      }),
    );

    return data;
  }

  private toPerformanceDistribution(
    topPerformers: Array<{ rating: number }>,
    lowPerformers: Array<{ rating: number }>,
  ) {
    const buckets = [
      { bucket: '1-2', count: 0 },
      { bucket: '2-3', count: 0 },
      { bucket: '3-4', count: 0 },
      { bucket: '4-5', count: 0 },
    ];

    for (const item of [...topPerformers, ...lowPerformers]) {
      const value = item.rating;
      if (value < 2) buckets[0].count += 1;
      else if (value < 3) buckets[1].count += 1;
      else if (value < 4) buckets[2].count += 1;
      else buckets[3].count += 1;
    }

    return buckets;
  }

  private async resolveScope(user: ReportsUserContext, filters: ReportsQueryFilters): Promise<ScopeInfo> {
    if (!user?.role) {
      throw new ForbiddenException('Access denied');
    }

    const requestedEmployeeId = filters.employeeId ? Number(filters.employeeId) : undefined;
    if (filters.employeeId && Number.isNaN(requestedEmployeeId)) {
      throw new BadRequestException('Invalid employeeId');
    }

    if (user.role === 'ADMIN' || user.role === 'HR') {
      if (requestedEmployeeId) {
        return {
          role: user.role,
          employeeIds: [requestedEmployeeId],
          requestedEmployeeId,
        };
      }
      return { role: user.role };
    }

    if (user.role === 'EMPLOYEE') {
      if (!user.employeeId) {
        throw new ForbiddenException('Employee mapping missing for current user');
      }
      if (requestedEmployeeId && requestedEmployeeId !== user.employeeId) {
        throw new ForbiddenException('Employees can only access their own analytics');
      }
      return {
        role: user.role,
        employeeIds: [user.employeeId],
        requestedEmployeeId: user.employeeId,
      };
    }

    // Manager: team-level access only (including self if linked to an employee profile).
    const teamUsers = await this.prisma.user.findMany({
      where: {
        managerId: user.userId,
        employeeId: { not: null },
      },
      select: {
        employeeId: true,
      },
    });

    const teamEmployeeIds = teamUsers
      .map((item) => item.employeeId)
      .filter((id): id is number => typeof id === 'number');

    if (typeof user.employeeId === 'number') {
      teamEmployeeIds.push(user.employeeId);
    }

    const distinctTeamEmployeeIds = Array.from(new Set(teamEmployeeIds));

    if (requestedEmployeeId) {
      if (!distinctTeamEmployeeIds.includes(requestedEmployeeId)) {
        throw new ForbiddenException('Managers can only access their team analytics');
      }
      return {
        role: user.role,
        employeeIds: [requestedEmployeeId],
        requestedEmployeeId,
      };
    }

    return {
      role: user.role,
      employeeIds: distinctTeamEmployeeIds,
    };
  }

  private resolveDateRange(filters: ReportsQueryFilters): DateRange {
    if (filters.month) {
      const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
      if (!monthPattern.test(filters.month)) {
        throw new BadRequestException('month must be in YYYY-MM format');
      }

      const [yearRaw, monthRaw] = filters.month.split('-');
      const year = Number(yearRaw);
      const month = Number(monthRaw);
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      return { start, end, monthLabel: filters.month };
    }

    if (filters.from || filters.to) {
      if (!filters.from || !filters.to) {
        throw new BadRequestException('Both from and to must be provided together');
      }
      const start = new Date(filters.from);
      const end = new Date(filters.to);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new BadRequestException('Invalid from/to date values');
      }
      if (start > end) {
        throw new BadRequestException('from cannot be later than to');
      }
      return {
        start,
        end: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999),
        monthLabel: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      };
    }

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return {
      start,
      end,
      monthLabel: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    };
  }

  private resolvePagination(filters: ReportsQueryFilters) {
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 20);

    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 20;

    return {
      page: safePage,
      limit: safeLimit,
      skip: (safePage - 1) * safeLimit,
    };
  }

  private attendanceWhere(
    dateRange: DateRange,
    scope: ScopeInfo,
    department?: string,
    role?: string,
  ) {
    return {
      date: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      employeeId: scope.employeeIds?.length
        ? {
            in: scope.employeeIds,
          }
        : undefined,
      employee: {
        department: department || undefined,
        user: role
          ? {
              role: role as 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE',
            }
          : undefined,
      },
    };
  }

  private payrollWhere(
    dateRange: DateRange,
    scope: ScopeInfo,
    department?: string,
    role?: string,
  ) {
    return {
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      employeeId: scope.employeeIds?.length
        ? {
            in: scope.employeeIds,
          }
        : undefined,
      employee: {
        department: department || undefined,
        user: role
          ? {
              role: role as 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE',
            }
          : undefined,
      },
    };
  }

  private employeeWhere(scope: ScopeInfo, department?: string, role?: string) {
    return {
      id: scope.employeeIds?.length
        ? {
            in: scope.employeeIds,
          }
        : undefined,
      department: department || undefined,
      user: role
        ? {
            role: role as 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE',
          }
        : undefined,
    };
  }

  private async withCache<T>(
    namespace: string,
    user: ReportsUserContext,
    filters: ReportsQueryFilters,
    producer: () => Promise<T>,
  ): Promise<T> {
    const key = `${namespace}:${user.role}:${user.userId}:${user.employeeId ?? 'NA'}:${JSON.stringify(filters)}`;
    const cached = await this.cacheManager.get<{ cachedAt: number; payload: T }>(key);

    if (cached && Date.now() - cached.cachedAt < 5 * 60 * 1000) {
      return cached.payload;
    }

    const payload = await producer();
    await this.cacheManager.set(key, { payload, cachedAt: Date.now() }, 300);

    return payload;
  }

  private lastNMonths(reference: Date, n: number) {
    const values: Array<{ year: number; month: number; label: string }> = [];
    for (let i = n - 1; i >= 0; i -= 1) {
      const point = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
      values.push({
        year: point.getFullYear(),
        month: point.getMonth() + 1,
        label: `${point.getFullYear()}-${String(point.getMonth() + 1).padStart(2, '0')}`,
      });
    }
    return values;
  }

  private toDateKey(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  private async precomputeCurrentMonth() {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const adminContext: ReportsUserContext = {
      userId: 0,
      role: 'ADMIN',
      employeeId: null,
    };

    const payload = await this.getDashboard(adminContext, { month, limit: '10', page: '1' });
    this.monthlyPrecompute.set(month, payload);

    if (this.monthlyPrecompute.size > 6) {
      const keys = Array.from(this.monthlyPrecompute.keys()).sort();
      const toDelete = keys.slice(0, keys.length - 6);
      for (const key of toDelete) {
        this.monthlyPrecompute.delete(key);
      }
    }
  }
}
