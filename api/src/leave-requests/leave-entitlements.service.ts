import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationScopeService } from '../organizations/organization-scope.service';

export type LeaveBalanceCategory = 'PAID_LEAVE' | 'COMP_OFF';
type LedgerReader = Pick<Prisma.TransactionClient, 'leaveBalanceEntry'>;
type LedgerWriter = Pick<
  Prisma.TransactionClient,
  '$queryRaw' | 'leaveBalanceEntry' | 'employee'
>;
type LeaveLedgerRow = {
  amount: number;
  createdAt: Date;
  expiresAt: Date | null;
};

const DAY_MS = 86_400_000;
const AUTOMATION_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class LeaveEntitlementsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeaveEntitlementsService.name);
  private automationTimer: ReturnType<typeof setInterval> | null = null;
  private automationRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationScopeService: OrganizationScopeService,
  ) {}

  onModuleInit() {
    void this.runMonthlyEntitlements().catch((error: unknown) => {
      this.logger.error(
        'Initial leave entitlement processing failed',
        error instanceof Error ? error.stack : String(error),
      );
    });
    this.automationTimer = setInterval(() => {
      void this.runMonthlyEntitlements().catch((error: unknown) => {
        this.logger.error(
          'Scheduled leave entitlement processing failed',
          error instanceof Error ? error.stack : String(error),
        );
      });
    }, AUTOMATION_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.automationTimer) {
      clearInterval(this.automationTimer);
      this.automationTimer = null;
    }
  }

  private monthStart(date: Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    );
  }

  private monthKey(date: Date) {
    return date.toISOString().slice(0, 7);
  }

  private addMonths(date: Date, amount: number) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1),
    );
  }

  private nextMonthStart(now: Date) {
    return this.addMonths(this.monthStart(now), 1);
  }

  private calculateAvailableBalance(
    rows: LeaveLedgerRow[],
    asOf = new Date(),
  ) {
    const credits: Array<{
      remaining: number;
      expiresAt: Date | null;
    }> = [];
    let debt = 0;

    for (const row of rows) {
      const effectiveDate = row.createdAt;
      for (const credit of credits) {
        if (credit.expiresAt && credit.expiresAt <= effectiveDate) {
          credit.remaining = 0;
        }
      }

      if (row.amount > 0) {
        credits.push({ remaining: row.amount, expiresAt: row.expiresAt });
        continue;
      }

      let amountToConsume = Math.abs(row.amount);
      for (const credit of credits) {
        if (amountToConsume <= 0) break;
        if (
          credit.remaining <= 0 ||
          (credit.expiresAt && credit.expiresAt <= effectiveDate)
        ) {
          continue;
        }
        const consumed = Math.min(credit.remaining, amountToConsume);
        credit.remaining -= consumed;
        amountToConsume -= consumed;
      }
      debt += amountToConsume;
    }

    const available = credits.reduce((sum, credit) => {
      if (credit.expiresAt && credit.expiresAt <= asOf) return sum;
      return sum + credit.remaining;
    }, 0);

    return Math.max(0, available - debt);
  }

  async getBalance(
    employeeId: number,
    organizationId: number,
    asOf = new Date(),
  ) {
    const entries = await this.prisma.leaveBalanceEntry.findMany({
      where: { employeeId, organizationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        category: true,
        entryType: true,
        amount: true,
        createdAt: true,
        expiresAt: true,
        periodStart: true,
      },
    });
    const paidEntries = entries.filter(
      (entry) => entry.category === 'PAID_LEAVE',
    );
    const compOffEntries = entries.filter(
      (entry) => entry.category === 'COMP_OFF',
    );
    const yearStart = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
    const yearPaidEntries = paidEntries.filter(
      (entry) =>
        entry.entryType === 'OPENING_BALANCE' ||
        (entry.periodStart && entry.periodStart >= yearStart),
    );
    const daysTaken = yearPaidEntries.reduce(
      (sum, entry) =>
        entry.entryType === 'LEAVE_USAGE' ? sum + Math.abs(entry.amount) : sum,
      0,
    );
    const totalAllocation = yearPaidEntries.reduce(
      (sum, entry) => (entry.amount > 0 ? sum + entry.amount : sum),
      0,
    );

    return {
      totalAllocation,
      daysTaken,
      balance: this.calculateAvailableBalance(paidEntries, asOf),
      compOffAvailable: this.calculateAvailableBalance(
        compOffEntries,
        asOf,
      ),
      year: asOf.getUTCFullYear(),
    };
  }

  async getAvailableBalance(
    employeeId: number,
    organizationId: number,
    category: LeaveBalanceCategory,
    reader: LedgerReader = this.prisma,
    asOf = new Date(),
  ) {
    const entries = await reader.leaveBalanceEntry.findMany({
      where: { employeeId, organizationId, category },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { amount: true, createdAt: true, expiresAt: true },
    });
    return this.calculateAvailableBalance(entries, asOf);
  }

  async recordUsage(
    writer: LedgerWriter,
    input: {
      employeeId: number;
      organizationId: number;
      category: LeaveBalanceCategory;
      amount: number;
      sourceKey: string;
      sourceId: number;
      description: string;
      periodStart: Date;
      periodEnd: Date;
    },
  ) {
    const lockCategory = input.category === 'PAID_LEAVE' ? 1 : 2;
    await writer.$queryRaw<Array<{ locked: number }>>`
      WITH lock_result AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(
          ${input.employeeId}::integer,
          ${lockCategory}::integer
        )
      )
      SELECT 1 AS locked
      FROM lock_result
    `;

    const existing = await writer.leaveBalanceEntry.findUnique({
      where: { sourceKey: input.sourceKey },
      select: { id: true },
    });
    if (existing) return;

    const available = await this.getAvailableBalance(
      input.employeeId,
      input.organizationId,
      input.category,
      writer,
    );
    if (available < input.amount) {
      throw new BadRequestException(
        input.category === 'PAID_LEAVE'
          ? `Insufficient paid leave balance. Available: ${available} day(s).`
          : `Insufficient comp-off balance. Available: ${available} day(s).`,
      );
    }

    await writer.leaveBalanceEntry.create({
      data: {
        employeeId: input.employeeId,
        organizationId: input.organizationId,
        category: input.category,
        entryType:
          input.category === 'PAID_LEAVE' ? 'LEAVE_USAGE' : 'COMPOFF_USAGE',
        amount: -input.amount,
        sourceKey: input.sourceKey,
        sourceId: input.sourceId,
        description: input.description,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
    });
    if (input.category === 'PAID_LEAVE') {
      await writer.employee.update({
        where: { id: input.employeeId, organizationId: input.organizationId },
        data: { leaveBalance: available - input.amount },
      });
    }
  }

  async getScheduledLeaveDates(
    employeeId: number,
    organizationId: number,
    startDate: Date,
    endDate: Date,
    transaction: Prisma.TransactionClient = this.prisma,
  ): Promise<Date[]> {
    const employee = await transaction.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      select: {
        shift: { select: { workingDays: true } },
        shiftAssignments: {
          where: {
            effectiveFrom: { lte: endDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: startDate } }],
          },
          orderBy: { effectiveFrom: 'asc' },
          select: {
            effectiveFrom: true,
            effectiveTo: true,
            shift: { select: { workingDays: true } },
          },
        },
      },
    });
    if (!employee) return [];

    const familyRoots =
      await this.organizationScopeService.getOrganizationFamilyRootMap([
        organizationId,
      ]);
    const familyRootId = familyRoots.get(organizationId);
    const holidayWhere: Prisma.HolidayWhereInput[] = [
      { organizationId, familyRootOrganizationId: null },
    ];
    if (familyRootId != null) {
      holidayWhere.push({ familyRootOrganizationId: familyRootId });
    }
    const holidays = await transaction.holiday.findMany({
      where: {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        OR: holidayWhere,
      },
      select: { startDate: true, endDate: true },
    });

    const scheduledDates: Date[] = [];
    const cursor = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate(),
      ),
    );
    const end = Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    );
    while (cursor.getTime() <= end) {
      const dayStart = cursor.getTime();
      const assignment = employee.shiftAssignments
        .filter(
          (item) =>
            item.effectiveFrom.getTime() <= dayStart &&
            (item.effectiveTo === null ||
              item.effectiveTo.getTime() > dayStart),
        )
        .at(-1);
      const workingDays =
        assignment?.shift.workingDays ??
        employee.shift?.workingDays ??
        [1, 2, 3, 4, 5];
      const isHoliday = holidays.some((holiday) => {
        const holidayStart = Date.UTC(
          holiday.startDate.getUTCFullYear(),
          holiday.startDate.getUTCMonth(),
          holiday.startDate.getUTCDate(),
        );
        const holidayEnd = Date.UTC(
          holiday.endDate.getUTCFullYear(),
          holiday.endDate.getUTCMonth(),
          holiday.endDate.getUTCDate(),
        );
        return dayStart >= holidayStart && dayStart <= holidayEnd;
      });
      if (workingDays.includes(cursor.getUTCDay()) && !isHoliday) {
        scheduledDates.push(new Date(cursor));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return scheduledDates;
  }

  async countScheduledLeaveDays(
    employeeId: number,
    organizationId: number,
    startDate: Date,
    endDate: Date,
    duration: string | null | undefined,
    transaction: Prisma.TransactionClient = this.prisma,
  ) {
    const scheduledDates = await this.getScheduledLeaveDates(
      employeeId,
      organizationId,
      startDate,
      endDate,
      transaction,
    );
    return duration === 'HALF_DAY'
      ? scheduledDates.length * 0.5
      : scheduledDates.length;
  }

  private async ensurePolicies(now: Date) {
    const organizations = await this.prisma.organization.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    const firstAccrualMonth = this.nextMonthStart(now);
    await this.prisma.leavePolicy.createMany({
      data: organizations.map(({ id }) => ({
        organizationId: id,
        firstAccrualMonth,
        compOffEffectiveFrom: new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
          ),
        ),
      })),
      skipDuplicates: true,
    });
  }

  private isEmployeeEligible(status: string | null) {
    const normalized = status?.trim().toUpperCase();
    return (
      !normalized ||
      !['INACTIVE', 'TERMINATED', 'RESIGNED', 'OFFBOARDED'].includes(
        normalized,
      )
    );
  }

  private async scanHolidayCompOffClaims(now: Date) {
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const todayStart = today.getTime();
    const policies = await this.prisma.leavePolicy.findMany({
      where: { compOffEffectiveFrom: { lt: today } },
    });
    for (const policy of policies) {
      const scanStart = new Date(
        Math.max(
          policy.compOffEffectiveFrom.getTime(),
          todayStart - 90 * DAY_MS,
        ),
      );
      const attendanceRows = await this.prisma.attendance.findMany({
        where: {
          organizationId: policy.organizationId,
          date: { gte: scanStart, lt: today },
          status: { not: 'LEAVE' },
          deletedAt: null,
          OR: [
            { checkIn: { not: null } },
            { workingHours: { gt: 0 } },
            { taskHours: { gt: 0 } },
          ],
        },
        select: {
          employeeId: true,
          organizationId: true,
          date: true,
          workingHours: true,
          taskHours: true,
          shift: { select: { workingDays: true } },
          employee: {
            select: {
              status: true,
              deletedAt: true,
              shift: { select: { workingDays: true } },
            },
          },
        },
      });
      if (attendanceRows.length === 0) continue;

      const organizationIds = [
        ...new Set(attendanceRows.map((row) => row.organizationId)),
      ];
      const roots =
        await this.organizationScopeService.getOrganizationFamilyRootMap(
          organizationIds,
        );
      const rootIds = [...new Set([...roots.values()].filter((id) => id != null))];
      const holidays = await this.prisma.holiday.findMany({
        where: {
          startDate: { lte: today },
          endDate: { gte: scanStart },
          OR: [
            { organizationId: { in: organizationIds }, familyRootOrganizationId: null },
            ...(rootIds.length > 0
              ? [{ familyRootOrganizationId: { in: rootIds } }]
              : []),
          ],
        },
        select: {
          organizationId: true,
          familyRootOrganizationId: true,
          startDate: true,
          endDate: true,
        },
      });

      const claims: Array<{
        employeeId: number;
        organizationId: number;
        workDate: Date;
        hours: number;
      }> = [];
      for (const row of attendanceRows) {
        if (row.employee.deletedAt || !this.isEmployeeEligible(row.employee.status)) {
          continue;
        }
        const hours = (row.workingHours ?? 0) + row.taskHours;
        if (hours < policy.compOffMinimumHours) continue;
        const day = new Date(row.date);
        const dayKey = day.toISOString().slice(0, 10);
        const rootId = roots.get(row.organizationId);
        const isCorporateHoliday = holidays.some((holiday) => {
          const applies =
            holiday.familyRootOrganizationId != null
              ? holiday.familyRootOrganizationId === rootId
              : holiday.organizationId === row.organizationId;
          return (
            applies &&
            dayKey >= holiday.startDate.toISOString().slice(0, 10) &&
            dayKey <= holiday.endDate.toISOString().slice(0, 10)
          );
        });
        const workingDays =
          row.shift?.workingDays ??
          row.employee.shift?.workingDays ??
          [1, 2, 3, 4, 5];
        const isWeeklyOff = !workingDays.includes(day.getUTCDay());
        if (isCorporateHoliday || isWeeklyOff) {
          claims.push({
            employeeId: row.employeeId,
            organizationId: row.organizationId,
            workDate: new Date(
              Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
            ),
            hours,
          });
        }
      }
      if (claims.length > 0) {
        await this.prisma.leaveCompOffClaim.createMany({
          data: claims,
          skipDuplicates: true,
        });
      }
    }
  }

  async runMonthlyEntitlements(now = new Date()) {
    if (this.automationRunning) return;
    this.automationRunning = true;
    try {
      await this.ensurePolicies(now);
      const policies = await this.prisma.leavePolicy.findMany();
      const completedMonth = this.addMonths(this.monthStart(now), -1);

      for (const policy of policies) {
        for (
          let periodStart = this.monthStart(policy.firstAccrualMonth);
          periodStart <= completedMonth;
          periodStart = this.addMonths(periodStart, 1)
        ) {
          const periodEnd = new Date(
            Date.UTC(
              periodStart.getUTCFullYear(),
              periodStart.getUTCMonth() + 1,
              0,
            ),
          );
          const employees = await this.prisma.employee.findMany({
            where: {
              organizationId: policy.organizationId,
              deletedAt: null,
              OR: [
                { hireDate: null },
                {
                  hireDate: {
                    lt: new Date(periodStart.getTime() + DAY_MS),
                  },
                },
              ],
            },
            select: { id: true, status: true },
          });
          const eligibleEmployees = employees.filter((employee) =>
            this.isEmployeeEligible(employee.status),
          );
          if (eligibleEmployees.length === 0) continue;

          const employeeIds = eligibleEmployees.map((employee) => employee.id);
          const hoursByEmployee = await this.prisma.timesheet.groupBy({
            by: ['employeeId'],
            where: {
              organizationId: policy.organizationId,
              employeeId: { in: employeeIds },
              date: { gte: periodStart, lt: this.addMonths(periodStart, 1) },
              status: { not: 'REJECTED' },
              deletedAt: null,
            },
            _sum: { hours: true },
          });
          const taskHoursByEmployee = new Map(
            hoursByEmployee.map((row) => [
              row.employeeId,
              row._sum.hours ?? 0,
            ]),
          );
          const entries = eligibleEmployees.flatMap((employee) => {
            const periodKey = this.monthKey(periodStart);
            const paidLeave = {
              employeeId: employee.id,
              organizationId: policy.organizationId,
              category: 'PAID_LEAVE',
              entryType: 'MONTHLY_ACCRUAL',
              amount: policy.monthlyPaidLeave,
              sourceKey: `monthly-accrual:${employee.id}:${periodKey}`,
              description: `Monthly paid leave accrual for ${periodKey}`,
              periodStart,
              periodEnd,
            };
            const taskHours =
              taskHoursByEmployee.get(employee.id) ?? 0;
            if (taskHours < policy.taskHoursBonusThreshold) {
              return [paidLeave];
            }
            return [
              paidLeave,
              {
                ...paidLeave,
                entryType: 'TASK_HOURS_BONUS',
                amount: 1,
                sourceKey: `task-hours-bonus:${employee.id}:${periodKey}`,
                description: `Task-hours bonus for ${periodKey} (${taskHours} hours)`,
              },
            ];
          });
          await this.prisma.$transaction(async (tx) => {
            for (const entry of entries) {
              const created = await tx.leaveBalanceEntry.createMany({
                data: [entry],
                skipDuplicates: true,
              });
              if (
                created.count > 0 &&
                entry.category === 'PAID_LEAVE'
              ) {
                await tx.employee.update({
                  where: {
                    id: entry.employeeId,
                    organizationId: entry.organizationId,
                  },
                  data: { leaveBalance: { increment: entry.amount } },
                });
              }
            }
          });
        }
      }
      await this.scanHolidayCompOffClaims(now);
    } finally {
      this.automationRunning = false;
    }
  }
}
