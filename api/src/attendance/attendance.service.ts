import {
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AttendanceCheckoutSource, AttendanceStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { Role } from '../common/enums/role.enum';
import { DASHBOARD_CACHE_KEY } from '../common/utils/cache-keys';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessUnitsService } from '../business-units/business-units.service';
import { OrganizationScopeService } from '../organizations/organization-scope.service';
import { AssignShiftDto } from './dto/assign-shift.dto';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import {
  attendanceDateFromKey,
  calculateLateMinutesInTimezone,
  dateKeyInTimezone,
  localMidnightAtDateInTimezone,
  localMidnightAfterDateInTimezone,
  shiftEndInTimezone,
} from './attendance-time.utils';
import { calculateNetWorkingHours } from './attendance-work-time.utils';
import {
  getFlexibleTaskTimeCutoverDate,
  sumIntervalSeconds,
} from './task-work-time.utils';
import {
  isScheduledWorkday as isShiftScheduledWorkday,
  resolveShiftForDate,
} from './workday-schedule.utils';
import type { WorkdayShift } from './workday-schedule.utils';
import { buildApprovedWorkFromHomeCredits } from './work-from-home.utils';
import { TasksService } from '../tasks/tasks.service';
import type { AuthUser } from '../common/types/auth';

type AttendanceUser = {
  userId: number;
  role: Role;
  employeeId?: number | null;
  organizationId: number;
  homeOrganizationId?: number | null;
  roles?: string[];
  isPlatformAdmin?: boolean;
  isSuperAdmin?: boolean;
  businessUnitId?: number | null;
  allBusinessUnits?: boolean;
};

type ShiftLite = {
  id: number;
  name: string;
  type: 'FIXED' | 'FLEXIBLE' | 'ROTATIONAL';
  startTime: string | null;
  endTime: string | null;
  requiredHours: number;
  minPresentHours: number;
  gracePeriodMinutes: number;
  weeklyHolidayDay: number;
  workingDays?: number[];
};

type DailyAttendanceRow = {
  id: number | null;
  employeeId: number;
  employee: {
    id: number;
    name: string;
    department: string | null;
    designation: string | null;
    organization?: { id: number; name: string };
  };
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  checkoutSource: AttendanceCheckoutSource | null;
  checkoutActorName: string | null;
  workingHours: number | null;
  taskHours?: number;
  creditedWorkSeconds?: number;
  breaks: { startedAt: string; endedAt: string | null }[];
  breakHours: number;
  onBreak: boolean;
  shortfallHours: number;
  expectedHours?: number;
  lateMinutes: number;
  overtimeHours: number;
  status: AttendanceStatus;
  workFromHomeCredit?: number;
  isShootDay: boolean;
  holidayName?: string | null;
  shiftDetails: {
    id: number | null;
    name: string;
    type: string;
    startTime: string | null;
    endTime: string | null;
    requiredHours: number | null;
    minPresentHours: number | null;
    gracePeriodMinutes: number | null;
    weeklyHolidayDay: number;
    workingDays?: number[];
  } | null;
};

type LeaveRequestLite = {
  startDate: Date;
  endDate: Date;
  duration?: string | null;
  employeeId?: number | null;
  requestType?: string;
};

type ManualTaskTimesheet = {
  employeeId: number;
  date: Date;
  hours: number;
};

@Injectable()
export class AttendanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttendanceService.name);
  private automationTimer: ReturnType<typeof setInterval> | null = null;
  private readonly lastAutomationDateByOrganization = new Map<number, string>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly businessUnitsService: BusinessUnitsService,
    private readonly organizationScopeService: OrganizationScopeService,
    private readonly tasksService: TasksService,
  ) {}

  private async resolveOrganizationId(user: AttendanceUser): Promise<number> {
    if (
      typeof user.organizationId === 'number' &&
      Number.isInteger(user.organizationId) &&
      user.organizationId > 0
    ) {
      return user.organizationId;
    }
    if (!user.userId) {
      throw new ForbiddenException('Organization ID is required');
    }
    const userRow = await this.prisma.user.findUnique({
      where: { id: user.userId },
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

  private async invalidateDashboardCache() {
    await this.cacheManager.del(DASHBOARD_CACHE_KEY);
  }

  onModuleInit() {
    this.flexibleTaskTimeCutoverDate();
    if (process.env.VERCEL === '1') return;

    this.runDailyAutomation().catch((error: unknown) => {
      this.logger.error('Initial attendance automation failed', error);
    });
    this.automationTimer = setInterval(
      () => {
        this.runDailyAutomation().catch((error: unknown) => {
          this.logger.error('Scheduled attendance automation failed', error);
        });
      },
      60 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.automationTimer) {
      clearInterval(this.automationTimer);
      this.automationTimer = null;
    }
  }

  private startOfDay(date: Date) {
    const day = new Date(date);
    day.setUTCHours(0, 0, 0, 0);
    return day;
  }

  private endOfDay(date: Date) {
    const day = this.startOfDay(date);
    day.setUTCDate(day.getUTCDate() + 1);
    day.setUTCMilliseconds(day.getUTCMilliseconds() - 1);
    return day;
  }

  private calculateWorkingHours(
    checkIn: Date,
    checkOut: Date,
    breaks: { startedAt: Date; endedAt: Date | null }[] = [],
  ) {
    return calculateNetWorkingHours(checkIn, checkOut, breaks);
  }

  private isAttendanceEligible(day: Date, hireDate?: Date | null) {
    if (!hireDate) return true;
    return (
      this.startOfDay(day).getTime() >= this.startOfDay(hireDate).getTime()
    );
  }

  private assertAttendanceEligible(day: Date, hireDate?: Date | null) {
    if (!this.isAttendanceEligible(day, hireDate)) {
      throw new BadRequestException(
        'Attendance cannot be recorded before the employee hire date',
      );
    }
  }

  private getShiftWindow(day: Date, shift: ShiftLite | null, timezone = 'UTC') {
    if (!shift) {
      return { shiftStart: null as Date | null, shiftEnd: null as Date | null };
    }
    if (!shift.startTime) {
      return { shiftStart: null, shiftEnd: null };
    }
    const shiftEndTime =
      shift.endTime ??
      (() => {
        const [hour, minute] = shift.startTime!.split(':').map(Number);
        const totalMinutes =
          hour * 60 + minute + Math.round(shift.requiredHours * 60);
        return `${String(Math.floor((totalMinutes % 1440) / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
      })();
    return {
      shiftStart: null,
      shiftEnd: shiftEndInTimezone(
        this.dateKey(day),
        { startTime: shift.startTime, endTime: shiftEndTime },
        timezone,
      ),
    };
  }

  private calculateLateMinutes(
    checkIn: Date,
    dateKey: string,
    shift: ShiftLite | null,
    timezone: string,
  ) {
    return calculateLateMinutesInTimezone(checkIn, dateKey, shift, timezone);
  }

  private calculateOvertimeHours(
    workingHours: number,
    shift: ShiftLite | null,
  ) {
    const requiredHours = shift?.requiredHours ?? 8;
    return Number(Math.max(0, workingHours - requiredHours).toFixed(2));
  }

  private calculateShortfallHours(
    workingHours: number | null,
    shift: ShiftLite | null,
    requiredHoursOverride?: number,
  ) {
    if (workingHours == null) return 0;
    const requiredHours = requiredHoursOverride ?? shift?.requiredHours ?? 8;
    return Number(Math.max(0, requiredHours - workingHours).toFixed(2));
  }

  private isWeeklyHoliday(day: Date, shift: ShiftLite | null | undefined) {
    return Boolean(shift && !this.isScheduledWorkday(day, shift));
  }

  private shiftAssignmentForDay<TShift extends { type: string }>(
    assignments:
      | Array<{
          effectiveFrom: Date;
          effectiveTo: Date | null;
          shift: TShift;
        }>
      | undefined,
    day: Date,
  ): TShift | undefined {
    const date = this.startOfDay(day).getTime();
    return assignments
      ?.filter(
        (assignment) =>
          assignment.effectiveFrom.getTime() <= date &&
          (assignment.effectiveTo === null ||
            assignment.effectiveTo.getTime() > date),
      )
      .sort(
        (left, right) =>
          right.effectiveFrom.getTime() - left.effectiveFrom.getTime(),
      )[0]?.shift;
  }

  private employeeShiftForDay<TShift extends { type: string }>(
    assignments:
      | Array<{
          effectiveFrom: Date;
          effectiveTo: Date | null;
          shift: TShift;
        }>
      | undefined,
    currentShift: TShift | null,
    day: Date,
  ): TShift | null {
    return resolveShiftForDate(
      assignments as Array<{
        effectiveFrom: Date;
        effectiveTo: Date | null;
        shift: TShift & {
          requiredHours?: number;
          weeklyHolidayDay?: number;
          workingDays?: number[];
        };
      }> | undefined,
      currentShift as
        | (TShift & {
            requiredHours?: number;
            weeklyHolidayDay?: number;
            workingDays?: number[];
          })
        | null,
      null,
      day,
    );
  }

  private isScheduledWorkday(day: Date, shift: WorkdayShift) {
    return isShiftScheduledWorkday(day, shift);
  }

  private buildSummary(rows: DailyAttendanceRow[]) {
    const summary = rows.reduce(
      (acc, row) => {
        if (row.status === AttendanceStatus.PRESENT) acc.present += 1;
        if (row.status === AttendanceStatus.ABSENT) acc.absent += 1;
        if (row.status === AttendanceStatus.LEAVE) acc.leave += 1;
        if (row.status === AttendanceStatus.HOLIDAY) acc.holiday += 1;
        if (row.status === AttendanceStatus.HALF_DAY) acc.halfDay += 1;
        if (row.lateMinutes > 0) acc.lateCount += 1;
        acc.overtimeHours += row.overtimeHours ?? 0;
        acc.shortfallHours += row.shortfallHours ?? 0;
        acc.totalWorkedHours += (row.workingHours ?? 0) + (row.taskHours ?? 0);
        acc.totalTaskHours += row.taskHours ?? 0;
        const requiredHours = row.shiftDetails?.requiredHours ?? 8;
        if (
          row.status === AttendanceStatus.PRESENT ||
          row.status === AttendanceStatus.HALF_DAY
        ) {
          acc.totalExpectedHours +=
            row.expectedHours ??
            (row.status === AttendanceStatus.HALF_DAY
              ? requiredHours / 2
              : requiredHours);
        }
        return acc;
      },
      {
        present: 0,
        absent: 0,
        leave: 0,
        holiday: 0,
        halfDay: 0,
        lateCount: 0,
        overtimeHours: 0,
        shortfallHours: 0,
        totalWorkedHours: 0,
        totalTaskHours: 0,
        totalExpectedHours: 0,
      },
    );

    return {
      ...summary,
      presentDays: summary.present,
      absentDays: summary.absent,
      leaveDays: summary.leave,
      holidayDays: summary.holiday,
      halfDays: summary.halfDay,
      totalWorkingDays: rows.filter((row) =>
        this.isScheduledAttendanceStatus(row.status),
      ).length,
      overtimeHours: Number(summary.overtimeHours.toFixed(2)),
      shortfallHours: Number(summary.shortfallHours.toFixed(2)),
      totalWorkedHours: Number(summary.totalWorkedHours.toFixed(2)),
      totalTaskHours: Number(summary.totalTaskHours.toFixed(2)),
      totalExpectedHours: Number(summary.totalExpectedHours.toFixed(2)),
    };
  }

  private isScheduledAttendanceStatus(status: AttendanceStatus) {
    const scheduledStatuses: AttendanceStatus[] = [
      AttendanceStatus.PRESENT,
      AttendanceStatus.ABSENT,
      AttendanceStatus.HALF_DAY,
    ];
    return scheduledStatuses.includes(status);
  }

  private calculateStatus(params: {
    day: Date;
    checkIn: Date | null;
    checkOut: Date | null;
    workingHours: number | null;
    onLeave: boolean;
    shift?: ShiftLite | null;
    lateMinutes?: number;
    timezone?: string;
  }) {
    const {
      day,
      checkIn,
      checkOut,
      workingHours,
      onLeave,
      shift,
      lateMinutes: _lateMinutes = 0,
      timezone = 'UTC',
    } = params;
    if (onLeave) return AttendanceStatus.LEAVE;

    // Check if today is the weekly holiday
    if (shift?.type !== 'FLEXIBLE' && this.isWeeklyHoliday(day, shift)) {
      return AttendanceStatus.WEEKLY_OFF;
    }

    const minPresentHours = shift?.minPresentHours ?? 5;
    const halfDayThreshold = Math.max(1, minPresentHours / 2);

    if (checkIn && checkOut) {
      const worked = workingHours ?? 0;
      if (worked >= minPresentHours) return AttendanceStatus.PRESENT;
      if (worked >= halfDayThreshold) return AttendanceStatus.HALF_DAY;
      return AttendanceStatus.ABSENT;
    }
    if (checkIn) {
      return AttendanceStatus.PRESENT;
    }

    if (!shift) {
      return AttendanceStatus.NOT_SCHEDULED;
    }
    if (shift.type === 'FLEXIBLE') return AttendanceStatus.NOT_SCHEDULED;

    const todayKey = dateKeyInTimezone(new Date(), timezone);
    const targetKey = this.dateKey(day);
    if (targetKey > todayKey) {
      return AttendanceStatus.UPCOMING;
    }
    if (targetKey === todayKey) {
      const { shiftEnd } = this.getShiftWindow(day, shift, timezone);
      if (!shiftEnd || new Date() < shiftEnd) {
        return AttendanceStatus.NOT_STARTED;
      }
    }

    return AttendanceStatus.ABSENT;
  }

  private async resolveCurrentEmployeeId(user: AttendanceUser) {
    if (user.employeeId != null) {
      const linkedEmployee = await this.prisma.employee.findFirst({
        where: {
          id: user.employeeId,
          organizationId: user.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (linkedEmployee) {
        return linkedEmployee.id;
      }
    }

    const linked = await this.prisma.user.findUnique({
      where: { id: user.userId, organizationId: user.organizationId },
      select: { employeeId: true },
    });

    if (!linked?.employeeId) {
      throw new ForbiddenException('Employee account is not linked to a user');
    }

    const currentEmployee = await this.prisma.employee.findFirst({
      where: {
        id: linked.employeeId,
        organizationId: user.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!currentEmployee) {
      throw new ForbiddenException(
        'Employee account is not linked to an active employee profile',
      );
    }

    return currentEmployee.id;
  }

  private shouldUseCrossOrganizationScope(user: AttendanceUser) {
    return user.role === Role.SUPER_ADMIN;
  }

  private buildOrganizationScope(user: AttendanceUser) {
    if (this.shouldUseCrossOrganizationScope(user)) {
      return {};
    }

    return { organizationId: user.organizationId };
  }

  private async getAttendanceOrganizationIds(
    user: AttendanceUser,
  ): Promise<number[] | null> {
    if (user.role === Role.SUPER_ADMIN) {
      if (user.organizationId == null) return null;
      return this.organizationScopeService.getDescendantOrganizationIds(
        user.organizationId,
      );
    }
    if (user.role === Role.ADMIN) {
      const homeOrganizationId = user.homeOrganizationId ?? user.organizationId;
      const homeFamilyRootId =
        await this.organizationScopeService.getOrganizationFamilyRootId(
          homeOrganizationId,
        );
      const selectedFamilyRootId =
        await this.organizationScopeService.getOrganizationFamilyRootId(
          user.organizationId,
        );
      if (
        homeFamilyRootId == null ||
        selectedFamilyRootId !== homeFamilyRootId
      ) {
        throw new ForbiddenException(
          'Selected organization is outside your attendance family',
        );
      }
      return this.organizationScopeService.getDescendantOrganizationIds(
        user.organizationId,
      );
    }
    if (user.role !== Role.HR) {
      return [user.organizationId];
    }

    const homeOrganizationId = user.homeOrganizationId ?? user.organizationId;
    const authorizationUser = {
      ...user,
      organizationId: homeOrganizationId,
    };
    const authorizedOrganizationIds =
      await this.organizationScopeService.getOrganizationIds(
        authorizationUser as any,
      );
    if (authorizedOrganizationIds === null) {
      if (user.organizationId == null) return null;
      return this.organizationScopeService.getDescendantOrganizationIds(
        user.organizationId,
      );
    }

    if (!authorizedOrganizationIds.includes(user.organizationId)) {
      throw new ForbiddenException(
        'Selected organization is outside your attendance scope',
      );
    }

    const selectedDescendants =
      await this.organizationScopeService.getDescendantOrganizationIds(
        user.organizationId,
      );
    return selectedDescendants.filter((id) =>
      authorizedOrganizationIds.includes(id),
    );
  }

  private async resolveScopedEmployeeId(
    user: AttendanceUser,
    requestedEmployeeId?: number | null,
  ) {
    const employeeId = await this.resolveCurrentEmployeeId(user);

    if (requestedEmployeeId && requestedEmployeeId !== employeeId) {
      throw new ForbiddenException('You can only access your own attendance');
    }

    return employeeId;
  }

  private async getManagerEmployeeIds(userId: number, user: AttendanceUser) {
    const rows = await this.prisma.employee.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
        user: { managerId: userId },
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private async getScopedEmployeeFilter(
    user?: AttendanceUser,
    requestedEmployeeId?: number,
  ): Promise<number[] | null> {
    let roleBasedIds: number[] | null;

    if (
      !user ||
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      user.role === Role.SUPER_ADMIN
    ) {
      roleBasedIds = requestedEmployeeId ? [requestedEmployeeId] : null;
    } else if (user.role === Role.MANAGER) {
      const ownEmployeeId = await this.resolveCurrentEmployeeId(user);
      const managedIds = await this.getManagerEmployeeIds(user.userId, user);
      const scopedIds = Array.from(new Set([ownEmployeeId, ...managedIds]));

      if (requestedEmployeeId) {
        if (requestedEmployeeId === ownEmployeeId) {
          roleBasedIds = [ownEmployeeId];
        } else if (managedIds.includes(requestedEmployeeId)) {
          roleBasedIds = [requestedEmployeeId];
        } else {
          throw new ForbiddenException(
            'You can only access attendance for your team',
          );
        }
      } else {
        roleBasedIds = scopedIds;
      }
    } else {
      const ownEmployeeId = await this.resolveCurrentEmployeeId(user);
      if (requestedEmployeeId && requestedEmployeeId !== ownEmployeeId) {
        throw new ForbiddenException('You can only access your own attendance');
      }
      roleBasedIds = [ownEmployeeId];
    }

    if (!user) {
      return roleBasedIds;
    }

    if (
      user.role === Role.ADMIN ||
      user.role === Role.HR ||
      user.role === Role.SUPER_ADMIN
    ) {
      const organizationIds = await this.getAttendanceOrganizationIds(user);
      if (organizationIds === null) {
        const employees = await this.prisma.employee.findMany({
          where: {
            deletedAt: null,
            ...(requestedEmployeeId ? { id: requestedEmployeeId } : {}),
          },
          select: { id: true },
        });
        return employees.map((employee) => employee.id);
      }
      const buScope = await this.businessUnitsService.resolveScope(user as any);
      const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
      const descendantIds = organizationIds.filter(
        (id) => id !== buScope.organizationId,
      );
      if (!descendantIds || descendantIds.length === 0) {
        const buEmployeeIds =
          await this.businessUnitsService.getEmployeeScopeFilterIds(buScope);
        if (buEmployeeIds === null) return roleBasedIds;
        return roleBasedIds === null
          ? buEmployeeIds
          : roleBasedIds.filter((id) => buEmployeeIds.includes(id));
      }
      const employees = await this.prisma.employee.findMany({
        where: {
          OR: [
            buWhere,
            { organizationId: { in: descendantIds }, deletedAt: null },
          ],
          ...(requestedEmployeeId ? { id: requestedEmployeeId } : {}),
        },
        select: { id: true },
      });
      const scopedIds = (employees ?? []).map((employee) => employee.id);
      return roleBasedIds === null
        ? scopedIds
        : roleBasedIds.filter((id) => scopedIds.includes(id));
    }

    const buScope = await this.businessUnitsService.resolveScope(user as any);
    if (user.role === Role.EMPLOYEE) {
      return roleBasedIds;
    }
    const buEmployeeIds =
      await this.businessUnitsService.getEmployeeScopeFilterIds(buScope);

    if (
      buEmployeeIds &&
      buEmployeeIds.length === 1 &&
      buEmployeeIds[0] === -1
    ) {
      return [-1];
    }

    if (buEmployeeIds === null) {
      return roleBasedIds;
    }

    if (roleBasedIds === null) {
      return buEmployeeIds;
    }

    const intersection = roleBasedIds.filter((id) =>
      buEmployeeIds.includes(id),
    );
    return intersection.length === 0 ? [-1] : intersection;
  }

  private async ensureEmployee(employeeId: number, user: AttendanceUser) {
    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
    const employeeScope =
      user.role === Role.EMPLOYEE
        ? {
            organizationId: user.organizationId,
            deletedAt: null,
            id: employeeId,
          }
        : {
            id: employeeId,
            deletedAt: null,
            ...this.buildOrganizationScope(user),
            ...buWhere,
          };
    const employee = await this.prisma.employee.findFirst({
      where: employeeScope,
      include: {
        shift: true,
        shiftAssignments: { include: { shift: true } },
      },
    });
    if (!employee)
      throw new NotFoundException(`Employee #${employeeId} not found`);
    return employee;
  }

  private async findApprovedLeaveForDay(
    employeeId: number,
    day: Date,
    duration: 'FULL_DAY' | 'HALF_DAY' = 'FULL_DAY',
  ) {
    return await this.prisma.leaveRequest.findFirst({
      where: {
        deletedAt: null,
        employeeId,
        requestType: 'LEAVE',
        status: 'APPROVED',
        duration,
        startDate: { lte: this.endOfDay(day) },
        endDate: { gte: this.startOfDay(day) },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private toDailyRow(
    employee: {
      id: number;
      name: string;
      department: string | null;
      designation: string | null;
      organization?: { id: number; name: string; timezone?: string | null };
      shift: ShiftLite | null;
      shiftAssignments?: Array<{
        effectiveFrom: Date;
        effectiveTo: Date | null;
        shift: ShiftLite;
      }>;
    },
    day: Date,
    attendance:
      | ({
          id: number;
          checkIn: Date | null;
          checkOut: Date | null;
          workingHours: number | null;
          taskHours?: number;
          breaks?: { startedAt: Date; endedAt: Date | null }[];
          lateMinutes: number;
          overtimeHours: number;
          shortfallHours: number;
          status: AttendanceStatus;
          isShootDay?: boolean;
          shift?: ShiftLite | null;
          isAutoClosed?: boolean;
          checkoutSource?: AttendanceCheckoutSource | null;
          checkoutActor?: { name: string } | null;
        } & { shortfallHours?: number })
      | null,
    onLeave: boolean,
    holidayName?: string | null,
    creditedWorkSeconds?: number,
    workFromHomeCredit?: number,
  ): DailyAttendanceRow {
    const shift =
      attendance?.shift ??
      this.employeeShiftForDay(
        employee.shiftAssignments,
        employee.shift,
        day,
      ) ??
      null;
    const computedStatus = onLeave
      ? AttendanceStatus.LEAVE
      : holidayName && !attendance?.checkIn
        ? AttendanceStatus.HOLIDAY
        : shift?.type === 'FLEXIBLE' && !attendance?.checkIn
          ? AttendanceStatus.NOT_SCHEDULED
          : (attendance?.status ??
            this.calculateStatus({
              day,
              checkIn: null,
              checkOut: null,
              workingHours: null,
              onLeave,
              shift,
              timezone: employee.organization?.timezone ?? 'UTC',
            }));
    const shortfallHours =
      (attendance as { shortfallHours?: number })?.shortfallHours ??
      this.calculateShortfallHours(attendance?.workingHours ?? null, shift);

    const status =
      workFromHomeCredit === undefined
        ? computedStatus
        : workFromHomeCredit === 1
          ? AttendanceStatus.PRESENT
          : AttendanceStatus.HALF_DAY;
    return {
      id: attendance?.id ?? null,
      employeeId: employee.id,
      employee: {
        id: employee.id,
        name: employee.name,
        department: employee.department ?? null,
        designation: employee.designation ?? null,
        organization: employee.organization,
      },
      date: day.toISOString(),
      checkIn: attendance?.checkIn?.toISOString() ?? null,
      checkOut: attendance?.checkOut?.toISOString() ?? null,
      checkoutSource:
        attendance?.checkoutSource ??
        (attendance?.isAutoClosed ? AttendanceCheckoutSource.AUTO : null),
      checkoutActorName: attendance?.checkoutActor?.name ?? null,
      workingHours:
        creditedWorkSeconds !== undefined
          ? Number((creditedWorkSeconds / 3600).toFixed(2))
          : (attendance?.workingHours ??
            (attendance?.checkIn
              ? calculateNetWorkingHours(
                  attendance.checkIn,
                  new Date(),
                  attendance.breaks ?? [],
                )
              : null)),
      taskHours: attendance?.taskHours ?? 0,
      ...(creditedWorkSeconds !== undefined ? { creditedWorkSeconds } : {}),
      breaks: (attendance?.breaks ?? []).map((interval) => ({
        startedAt: interval.startedAt.toISOString(),
        endedAt: interval.endedAt?.toISOString() ?? null,
      })),
      breakHours: Number(
        (attendance?.breaks ?? [])
          .reduce((total, interval) => {
            const end = Math.min(
              interval.endedAt?.getTime() ?? Date.now(),
              attendance?.checkOut?.getTime() ?? Date.now(),
            );
            return (
              total + Math.max(0, end - interval.startedAt.getTime()) / 36e5
            );
          }, 0)
          .toFixed(2),
      ),
      onBreak: (attendance?.breaks ?? []).some((interval) => !interval.endedAt),
      shortfallHours,
      lateMinutes: attendance?.lateMinutes ?? 0,
      overtimeHours: attendance?.overtimeHours ?? 0,
      status,
      ...(workFromHomeCredit !== undefined ? { workFromHomeCredit } : {}),
      isShootDay: attendance?.isShootDay ?? false,
      holidayName:
        computedStatus === AttendanceStatus.HOLIDAY ? holidayName : null,
      shiftDetails: shift
        ? {
            id: shift.id,
            name: shift.name,
            type: shift.type,
            startTime: shift.startTime,
            endTime: shift.endTime,
            requiredHours: shift.requiredHours,
            minPresentHours: shift.minPresentHours,
            gracePeriodMinutes: shift.gracePeriodMinutes,
            weeklyHolidayDay: shift.weeklyHolidayDay,
            workingDays:
              shift.workingDays ??
              [0, 1, 2, 3, 4, 5, 6].filter(
                (weekday) => weekday !== shift.weeklyHolidayDay,
              ),
          }
        : null,
    };
  }

  async createShift(dto: CreateShiftDto, user: AttendanceUser) {
    const organizationId = await this.resolveOrganizationId(user);
    const requiredHours = dto.requiredHours ?? 8;
    const minPresentHours = dto.minPresentHours ?? Math.min(5, requiredHours);
    const result = await this.prisma.shift.create({
      data: {
        name: dto.name,
        type: dto.type,
        startTime: dto.startTime,
        endTime: dto.endTime,
        requiredHours,
        minPresentHours: Math.min(minPresentHours, requiredHours),
        gracePeriodMinutes: dto.gracePeriodMinutes ?? 15,
        weeklyHolidayDay: dto.weeklyHolidayDay ?? 0,
        workingDays:
          dto.workingDays ??
          (dto.weeklyHolidayDay !== undefined
            ? [0, 1, 2, 3, 4, 5, 6].filter(
                (weekday) => weekday !== dto.weeklyHolidayDay,
              )
            : [1, 2, 3, 4, 5]),
        organizationId,
      },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  private parseHolidayDate(value: string) {
    const dateKey = value.slice(0, 10);
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== dateKey
    ) {
      throw new BadRequestException('A valid holiday date is required');
    }
    return date;
  }

  private dateKey(day: Date) {
    return day.toISOString().slice(0, 10);
  }

  private flexibleTaskTimeCutoverDate() {
    return getFlexibleTaskTimeCutoverDate();
  }

  private holidayCoversDay(
    holiday: { startDate: Date; endDate: Date },
    day: Date,
  ) {
    const dayKey = this.dateKey(day);
    return (
      dayKey >= holiday.startDate.toISOString().slice(0, 10) &&
      dayKey <= holiday.endDate.toISOString().slice(0, 10)
    );
  }

  private async getOrganizationFamilyRootMap(organizationIds: number[]) {
    return this.organizationScopeService.getOrganizationFamilyRootMap(
      organizationIds,
    );
  }

  private async findApplicableHolidays(
    organizationIds: number[],
    startDate: Date,
    endDate: Date,
  ) {
    if (organizationIds.length === 0) {
      return {
        holidays: [],
        familyRootByOrganization: new Map<number, number | null>(),
      };
    }
    const familyRootByOrganization =
      await this.getOrganizationFamilyRootMap(organizationIds);
    const familyRootIds = [
      ...new Set(
        [...familyRootByOrganization.values()].filter(
          (id): id is number => id != null,
        ),
      ),
    ];
    const holidays = await this.prisma.holiday.findMany({
      where: {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        OR: [
          { organizationId: { in: organizationIds } },
          ...(familyRootIds.length > 0
            ? [{ familyRootOrganizationId: { in: familyRootIds } }]
            : []),
        ],
      },
    });
    return { holidays, familyRootByOrganization };
  }

  private holidayAppliesToOrganization(
    holiday: {
      organizationId: number;
      familyRootOrganizationId: number | null;
    },
    organizationId: number,
    familyRootByOrganization: Map<number, number | null>,
  ) {
    if (holiday.familyRootOrganizationId != null) {
      return (
        holiday.familyRootOrganizationId ===
        familyRootByOrganization.get(organizationId)
      );
    }
    return holiday.organizationId === organizationId;
  }

  private async validateHolidayRange(
    organizationId: number,
    startDate: Date,
    endDate: Date,
    excludeId?: number,
    organizationIds: number[] = [organizationId],
    familyRootOrganizationId?: number | null,
  ) {
    if (startDate > endDate) {
      throw new BadRequestException(
        'Holiday end date must be on or after the start date',
      );
    }
    const overlap = await this.prisma.holiday.findFirst({
      where: {
        ...(excludeId != null ? { id: { not: excludeId } } : {}),
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        OR: [
          { organizationId: { in: organizationIds } },
          ...(familyRootOrganizationId != null
            ? [{ familyRootOrganizationId }]
            : []),
        ],
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException(
        'This holiday range overlaps another corporate holiday',
      );
    }
  }

  async listHolidays(user: AttendanceUser) {
    const organizationId = await this.resolveOrganizationId(user);
    const familyRootOrganizationId =
      await this.organizationScopeService.getOrganizationFamilyRootId(
        organizationId,
      );
    const holidays = await this.prisma.holiday.findMany({
      where: {
        OR: [
          { organizationId },
          ...(familyRootOrganizationId != null
            ? [{ familyRootOrganizationId }]
            : []),
        ],
      },
      orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
    });
    return holidays.map((holiday) => ({
      ...holiday,
      canManage:
        holiday.familyRootOrganizationId == null
          ? holiday.organizationId === organizationId
          : holiday.familyRootOrganizationId === organizationId,
    }));
  }

  async createHoliday(dto: CreateHolidayDto, user: AttendanceUser) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Holiday name is required');
    const organizationId = await this.resolveOrganizationId(user);
    const familyWide = dto.familyWide === true;
    const familyRootOrganizationId =
      await this.organizationScopeService.getOrganizationFamilyRootId(
        organizationId,
      );
    let holidayOrganizationIds = [organizationId];
    if (familyWide) {
      if (familyRootOrganizationId !== organizationId) {
        throw new ForbiddenException(
          'Select the parent organization to create a family-wide holiday',
        );
      }
      holidayOrganizationIds =
        await this.organizationScopeService.getDescendantOrganizationIds(
          organizationId,
        );
      const authorizedIds = await this.getAttendanceOrganizationIds(user);
      if (
        authorizedIds !== null &&
        holidayOrganizationIds.some((id) => !authorizedIds.includes(id))
      ) {
        throw new ForbiddenException(
          'You are not authorized to apply holidays to the entire organization family',
        );
      }
    }
    const startDate = this.parseHolidayDate(dto.startDate);
    const endDate = this.parseHolidayDate(dto.endDate);
    await this.validateHolidayRange(
      organizationId,
      startDate,
      endDate,
      undefined,
      holidayOrganizationIds,
      familyRootOrganizationId,
    );
    const holiday = await this.prisma.holiday.create({
      data: {
        organizationId,
        familyRootOrganizationId: familyWide ? organizationId : null,
        startDate,
        endDate,
        name,
      },
    });
    await this.invalidateDashboardCache();
    return holiday;
  }

  async updateHoliday(id: number, dto: UpdateHolidayDto, user: AttendanceUser) {
    const name = dto.name?.trim();
    if (dto.name !== undefined && !name) {
      throw new BadRequestException('Holiday name is required');
    }
    const organizationId = await this.resolveOrganizationId(user);
    const familyRootOrganizationId =
      await this.organizationScopeService.getOrganizationFamilyRootId(
        organizationId,
      );
    const existing = await this.prisma.holiday.findFirst({
      where: {
        id,
        OR: [
          { organizationId },
          ...(familyRootOrganizationId != null
            ? [{ familyRootOrganizationId }]
            : []),
        ],
      },
    });
    if (!existing) throw new NotFoundException('Holiday not found');
    const currentlyFamilyWide = existing.familyRootOrganizationId != null;
    if (currentlyFamilyWide && familyRootOrganizationId !== organizationId) {
      throw new ForbiddenException(
        'Only the parent organization can edit a family-wide holiday',
      );
    }
    const familyWide = dto.familyWide ?? currentlyFamilyWide;
    if (familyWide && familyRootOrganizationId !== organizationId) {
      throw new ForbiddenException(
        'Select the parent organization to apply a family-wide holiday',
      );
    }
    const affectedOrganizationIds = familyWide
      ? await this.organizationScopeService.getDescendantOrganizationIds(
          organizationId,
        )
      : [organizationId];
    const authorizedIds = familyWide
      ? await this.getAttendanceOrganizationIds(user)
      : null;
    if (
      authorizedIds !== null &&
      affectedOrganizationIds.some((id) => !authorizedIds.includes(id))
    ) {
      throw new ForbiddenException(
        'You are not authorized to apply holidays to the entire organization family',
      );
    }

    const startDate = dto.startDate
      ? this.parseHolidayDate(dto.startDate)
      : existing.startDate;
    const endDate = dto.endDate
      ? this.parseHolidayDate(dto.endDate)
      : existing.endDate;
    await this.validateHolidayRange(
      organizationId,
      startDate,
      endDate,
      id,
      affectedOrganizationIds,
      familyRootOrganizationId,
    );

    const holiday = await this.prisma.holiday.update({
      where: { id },
      data: {
        organizationId,
        familyRootOrganizationId: familyWide ? organizationId : null,
        startDate,
        endDate,
        ...(name !== undefined ? { name } : {}),
      },
    });
    await this.invalidateDashboardCache();
    return holiday;
  }

  async deleteHoliday(id: number, user: AttendanceUser) {
    const organizationId = await this.resolveOrganizationId(user);
    const familyRootOrganizationId =
      await this.organizationScopeService.getOrganizationFamilyRootId(
        organizationId,
      );
    const existing = await this.prisma.holiday.findFirst({
      where: {
        id,
        OR: [
          { organizationId },
          ...(familyRootOrganizationId != null
            ? [{ familyRootOrganizationId }]
            : []),
        ],
      },
      select: { id: true, familyRootOrganizationId: true },
    });
    if (!existing) throw new NotFoundException('Holiday not found');
    if (
      existing.familyRootOrganizationId != null &&
      familyRootOrganizationId !== organizationId
    ) {
      throw new ForbiddenException(
        'Only the parent organization can delete a family-wide holiday',
      );
    }
    const holiday = await this.prisma.holiday.delete({ where: { id } });
    await this.invalidateDashboardCache();
    return holiday;
  }

  async listShifts(user: AttendanceUser) {
    const organizationId = await this.resolveOrganizationId(user);
    const familyOrganizationIds =
      await this.organizationScopeService.getRelatedOrganizationIds(
        organizationId,
      );
    const shifts = await this.prisma.shift.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        organizationId: { in: familyOrganizationIds },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: { organization: { select: { name: true } } },
    });
    return shifts.map((shift) => ({
      ...shift,
      organizationName: shift.organization.name,
      canManage: shift.organizationId === organizationId,
    }));
  }

  async assignShift(dto: AssignShiftDto, user: AttendanceUser) {
    const organizationId = await this.resolveOrganizationId(user);
    const familyOrganizationIds =
      await this.organizationScopeService.getRelatedOrganizationIds(
        organizationId,
      );
    const shift = await this.prisma.shift.findFirst({
      where: {
        id: dto.shiftId,
        organizationId: { in: familyOrganizationIds },
        isActive: true,
        deletedAt: null,
      },
      include: { organization: { select: { name: true } } },
    });
    if (!shift || !shift.isActive) {
      throw new NotFoundException('Shift not found');
    }

    const scopedEmployeeIds = await this.getScopedEmployeeFilter(
      user,
      dto.employeeId,
    );
    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employeeId,
        ...(scopedEmployeeIds === null
          ? {}
          : { id: { in: scopedEmployeeIds } }),
        deletedAt: null,
        ...buWhere,
      },
      select: { id: true, organizationId: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    const [shiftFamilyRootId, employeeFamilyRootId] = await Promise.all([
      this.organizationScopeService.getOrganizationFamilyRootId(
        shift.organizationId,
      ),
      this.organizationScopeService.getOrganizationFamilyRootId(
        employee.organizationId,
      ),
    ]);
    if (
      shiftFamilyRootId == null ||
      shiftFamilyRootId !== employeeFamilyRootId
    ) {
      throw new BadRequestException(
        'The shift and employee must belong to the same organization family',
      );
    }

    const employeeOrganization = await this.prisma.organization.findUnique({
      where: { id: employee.organizationId },
      select: { timezone: true },
    });
    const assignedAt = attendanceDateFromKey(
      dateKeyInTimezone(new Date(), employeeOrganization?.timezone ?? 'UTC'),
    );
    const result = await this.prisma.$transaction(async (tx) => {
      const activeAssignment = await tx.employeeShiftAssignment.findFirst({
        where: { employeeId: dto.employeeId, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (activeAssignment?.shiftId !== dto.shiftId) {
        if (
          activeAssignment &&
          activeAssignment.effectiveFrom.getTime() >= assignedAt.getTime()
        ) {
          await tx.employeeShiftAssignment.update({
            where: { id: activeAssignment.id },
            data: { shiftId: dto.shiftId },
          });
        } else if (activeAssignment) {
          await tx.employeeShiftAssignment.update({
            where: { id: activeAssignment.id },
            data: { effectiveTo: assignedAt },
          });
          await tx.employeeShiftAssignment.create({
            data: {
              employeeId: dto.employeeId,
              shiftId: dto.shiftId,
              effectiveFrom: assignedAt,
            },
          });
        } else {
          await tx.employeeShiftAssignment.create({
            data: {
              employeeId: dto.employeeId,
              shiftId: dto.shiftId,
              effectiveFrom: assignedAt,
            },
          });
        }
      }
      return tx.employee.update({
        where: { id: dto.employeeId, organizationId: employee.organizationId },
        data: { shiftId: dto.shiftId },
        include: { shift: true },
      });
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async updateShift(id: number, dto: UpdateShiftDto, user: AttendanceUser) {
    const organizationId = await this.resolveOrganizationId(user);
    const shift = await this.prisma.shift.findFirst({
      where: { id, organizationId },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    // Prepare update data, filtering out undefined values
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.startTime !== undefined) updateData.startTime = dto.startTime;
    if (dto.endTime !== undefined) updateData.endTime = dto.endTime;
    if (dto.requiredHours !== undefined)
      updateData.requiredHours = dto.requiredHours;
    if (dto.minPresentHours !== undefined) {
      updateData.minPresentHours = Math.min(
        dto.minPresentHours,
        updateData.requiredHours ?? shift.requiredHours,
      );
    }
    if (dto.gracePeriodMinutes !== undefined)
      updateData.gracePeriodMinutes = dto.gracePeriodMinutes;
    if (dto.weeklyHolidayDay !== undefined)
      updateData.weeklyHolidayDay = dto.weeklyHolidayDay;
    if (dto.workingDays !== undefined) {
      updateData.workingDays = dto.workingDays;
    } else if (dto.weeklyHolidayDay !== undefined) {
      updateData.workingDays = [0, 1, 2, 3, 4, 5, 6].filter(
        (weekday) => weekday !== dto.weeklyHolidayDay,
      );
    }

    const result = await this.prisma.shift.update({
      where: { id },
      data: updateData,
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async deleteShift(id: number, user: AttendanceUser) {
    const organizationId = await this.resolveOrganizationId(user);
    const shift = await this.prisma.shift.findFirst({
      where: { id, organizationId },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    // Check if any employees are assigned to this shift
    const assignedEmployees = await this.prisma.employee.count({
      where: { shiftId: id, deletedAt: null },
    });

    if (assignedEmployees > 0) {
      throw new BadRequestException(
        `Cannot delete shift. ${assignedEmployees} employee(s) are assigned to this shift.`,
      );
    }

    // Soft delete or hard delete - checking if the model supports soft deletes
    const result = await this.prisma.shift.update({
      where: { id },
      data: { isActive: false },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async checkIn(dto: CheckInDto, user: AttendanceUser) {
    const employeeId = await this.resolveScopedEmployeeId(user, dto.employeeId);
    const employee = await this.ensureEmployee(employeeId, user);

    if (!employee.shift) {
      throw new BadRequestException(
        'Assign an active flexible or fixed shift before checking in',
      );
    }

    const organizationId = employee.organizationId ?? user.organizationId;
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const timezone = organization?.timezone ?? 'UTC';
    const requestedInstant = dto.timestamp
      ? new Date(dto.timestamp)
      : new Date();
    if (Number.isNaN(requestedInstant.getTime())) {
      throw new BadRequestException('A valid attendance timestamp is required');
    }
    const requestedDateKey =
      dto.date?.slice(0, 10) ?? dateKeyInTimezone(requestedInstant, timezone);
    const day = attendanceDateFromKey(requestedDateKey);
    this.assertAttendanceEligible(day, employee.hireDate);

    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: day } },
      include: { shift: true },
    });

    if (existing?.checkIn) {
      throw new ConflictException('Employee has already checked in today');
    }

    const checkInTime = this.resolveAttendanceActionTime(
      dto.date,
      dto.timestamp,
      user,
      timezone,
    );
    const dateKey = dateKeyInTimezone(checkInTime, timezone);

    const leave = await this.findApprovedLeaveForDay(employeeId, day);
    if (leave) {
      throw new ConflictException(
        'Employee is on approved leave for this date',
      );
    }

    if (this.isWeeklyHoliday(day, employee.shift)) {
      const balances = await this.getWorkHourBalancesForEmployee(
        employeeId,
        employee,
        checkInTime,
        timezone,
      );
      if (
        balances.week.remainingHours <= 0 &&
        balances.month.remainingHours <= 0
      ) {
        throw new ConflictException(
          'This date is not a scheduled workday; catch-up is available only when scheduled hours are outstanding',
        );
      }
    }

    const lateMinutes = this.calculateLateMinutes(
      checkInTime,
      dateKey,
      employee.shift,
      timezone,
    );

    // Calculate status based on late check-in
    const status = AttendanceStatus.PRESENT;

    if (existing) {
      const result = await this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          shiftId: employee.shift.id,
          checkIn: checkInTime,
          lateMinutes,
          requiredHours: employee.shift.requiredHours,
          status,
          isPaidLeave: null,
        },
        include: { employee: true, shift: true },
      });

      await this.invalidateDashboardCache();
      return result;
    }

    const result = await this.prisma.attendance.create({
      data: {
        employeeId,
        shiftId: employee.shift.id,
        organizationId,
        date: day,
        checkIn: checkInTime,
        lateMinutes,
        overtimeHours: 0,
        requiredHours: employee.shift.requiredHours,
        status,
      },
      include: { employee: true, shift: true },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async checkOut(dto: CheckOutDto, user: AttendanceUser) {
    const employeeId = await this.resolveScopedEmployeeId(user, dto.employeeId);
    const employee = await this.ensureEmployee(employeeId, user);

    const organization = await this.prisma.organization.findUnique({
      where: { id: employee.organizationId ?? user.organizationId },
      select: { timezone: true },
    });
    const timezone = organization?.timezone ?? 'UTC';
    const checkOutTime = this.resolveAttendanceActionTime(
      dto.date,
      dto.timestamp,
      user,
      timezone,
    );
    let record: {
      id: number;
      checkIn: Date | null;
      checkOut: Date | null;
      date: Date;
      employeeId: number;
      shift: ShiftLite | null;
      breaks: { id: number; startedAt: Date; endedAt: Date | null }[];
    } | null = null;

    if (dto.date) {
      const day = attendanceDateFromKey(dto.date.slice(0, 10));
      record = await this.prisma.attendance.findUnique({
        where: { employeeId_date: { employeeId, date: day } },
        include: {
          shift: true,
          breaks: true,
          checkoutActor: { select: { name: true } },
        },
      });
    } else {
      // Supports night shifts: close the latest open attendance row.
      record = await this.prisma.attendance.findFirst({
        where: {
          employeeId,
          checkIn: { not: null },
          checkOut: null,
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: { shift: true, breaks: true },
      });
      if (!record) {
        const latestAttendance = await this.prisma.attendance.findFirst({
          where: { employeeId, checkIn: { not: null } },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          include: { shift: true, breaks: true },
        });
        if (
          latestAttendance?.checkOut &&
          dateKeyInTimezone(latestAttendance.checkOut, timezone) ===
            dateKeyInTimezone(checkOutTime, timezone)
        ) {
          throw new ConflictException('Employee has already checked out');
        }
      }
    }

    if (!record || !record.checkIn) {
      throw new NotFoundException('No check-in record found');
    }

    if (record.checkOut) {
      throw new ConflictException('Employee has already checked out');
    }

    if (checkOutTime.getTime() < new Date(record.checkIn).getTime()) {
      throw new BadRequestException(
        'Check-out time cannot be earlier than check-in time',
      );
    }

    const shift = record.shift ?? employee.shift ?? null;
    const breakIntervals = record.breaks ?? [];
    const openBreak = breakIntervals.find((item) => item.endedAt === null);
    if (openBreak) {
      openBreak.endedAt = checkOutTime;
    }
    const workingHours = calculateNetWorkingHours(
      new Date(record.checkIn),
      checkOutTime,
      breakIntervals,
    );
    const overtimeHours = this.calculateOvertimeHours(workingHours, shift);
    const halfDayLeave = await this.findApprovedLeaveForDay(
      employeeId,
      new Date(record.date),
      'HALF_DAY',
    );
    const shortfallHours = this.calculateShortfallHours(
      workingHours,
      shift,
      halfDayLeave ? 5 : undefined,
    );
    const lateMinutes = (record as any).lateMinutes ?? 0;

    const status = this.calculateStatus({
      day: this.startOfDay(new Date(record.date)),
      checkIn: new Date(record.checkIn),
      checkOut: checkOutTime,
      workingHours,
      onLeave: false,
      shift,
      lateMinutes,
      timezone,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      if (openBreak) {
        await tx.attendanceBreak.update({
          where: { id: openBreak.id },
          data: { endedAt: checkOutTime },
        });
      }
      if (shift?.type !== 'FLEXIBLE') {
        await this.tasksService.stopActiveTimerForEmployee(
          employeeId,
          employee.organizationId ?? user.organizationId,
          checkOutTime,
          tx,
        );
      }
      return tx.attendance.update({
        where: { id: record.id },
        data: {
          checkOut: checkOutTime,
          checkoutSource: AttendanceCheckoutSource.USER,
          checkoutActorId: user.userId,
          workingHours,
          overtimeHours,
          shortfallHours,
          status,
        },
        include: { employee: true, shift: true },
      });
    });

    await this.invalidateDashboardCache();
    return result;
  }

  private resolveAttendanceActionTime(
    date: string | undefined,
    timestamp: string | undefined,
    user: AttendanceUser,
    timezone: string,
  ) {
    const now = new Date();
    const privileged = [Role.ADMIN, Role.HR, Role.SUPER_ADMIN].some(
      (role) => role === user.role,
    );
    if (!privileged && (date || timestamp)) {
      throw new BadRequestException(
        'Employee attendance actions use server time; admins can correct historical attendance separately',
      );
    }

    const actionTime = timestamp ? new Date(timestamp) : now;
    if (Number.isNaN(actionTime.getTime())) {
      throw new BadRequestException('A valid attendance timestamp is required');
    }
    if (actionTime.getTime() > now.getTime()) {
      throw new BadRequestException(
        'Attendance timestamps cannot be in the future',
      );
    }
    if (timestamp && now.getTime() - actionTime.getTime() > 2 * 60_000) {
      throw new BadRequestException(
        'Historical attendance must be corrected through the admin attendance editor',
      );
    }
    if (date && dateKeyInTimezone(actionTime, timezone) !== date.slice(0, 10)) {
      throw new BadRequestException(
        'Attendance date must match the timestamp in the employee organization timezone',
      );
    }
    return actionTime;
  }

  async startBreak(user: AttendanceUser) {
    const employeeId = await this.resolveScopedEmployeeId(user);
    const employee = await this.ensureEmployee(employeeId, user);
    const flexibleShift =
      employee.shift?.type === 'FLEXIBLE' ? employee.shift : null;
    let attendanceDay: Date | undefined;
    if (flexibleShift) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: employee.organizationId ?? user.organizationId },
        select: { timezone: true },
      });
      const timezone = organization?.timezone ?? 'UTC';
      const dateKey = dateKeyInTimezone(new Date(), timezone);
      attendanceDay = attendanceDateFromKey(dateKey);
    }
    const startedAt = new Date();
    const created = await this.prisma.$transaction(async (tx) => {
      await this.tasksService.lockTimerAndAttendanceStateForUser(user, tx);
      let record: Prisma.AttendanceGetPayload<{
        include: { breaks: true };
      }> | null;
      if (flexibleShift) {
        const existingBreak = await tx.attendance.findFirst({
          where: {
            employeeId,
            organizationId: employee.organizationId ?? user.organizationId,
            breaks: { some: { endedAt: null } },
          },
          select: { id: true },
        });
        if (existingBreak) {
          throw new ConflictException('A break is already in progress');
        }
        record = await tx.attendance.findUnique({
          where: {
            employeeId_date: {
              employeeId,
              date: attendanceDay!,
            },
          },
          include: { breaks: true },
        });
        if (!record) {
          record = await tx.attendance.create({
            data: {
              employeeId,
              organizationId: employee.organizationId,
              shiftId: flexibleShift.id,
              date: attendanceDay!,
              requiredHours: flexibleShift.requiredHours,
              status: AttendanceStatus.NOT_STARTED,
            },
            include: { breaks: true },
          });
        }
      } else {
        record = await tx.attendance.findFirst({
          where: {
            employeeId,
            checkIn: { not: null },
            checkOut: null,
          },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          include: { breaks: true },
        });
        if (!record) {
          throw new BadRequestException('Check in before starting a break');
        }
      }
      if (
        record.checkIn &&
        new Date(record.checkIn).getTime() > startedAt.getTime()
      ) {
        throw new BadRequestException('A break cannot start before check-in');
      }
      if (record.breaks.some((interval) => interval.endedAt === null)) {
        throw new ConflictException('A break is already in progress');
      }
      await this.tasksService.stopRunningTimersForUser(user, startedAt, tx);
      return tx.attendanceBreak.create({
        data: { attendanceId: record.id, startedAt },
      });
    });
    await this.invalidateDashboardCache();
    return { break: created, onBreak: true };
  }

  async stopBreak(user: AttendanceUser) {
    const employeeId = await this.resolveScopedEmployeeId(user);
    const employee = await this.ensureEmployee(employeeId, user);
    if (employee.shift?.type === 'FLEXIBLE') {
      const activeRecords = await this.prisma.attendance.findMany({
        where: {
          employeeId,
          organizationId: employee.organizationId ?? user.organizationId,
          breaks: { some: { endedAt: null } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: { breaks: { where: { endedAt: null } } },
      });
      const openBreaks = activeRecords.flatMap((record) => record.breaks);
      if (openBreaks.length === 0) {
        throw new BadRequestException('No break is in progress');
      }

      const endedAt = new Date();
      const updatedBreaks = await this.prisma.$transaction((tx) =>
        Promise.all(
          openBreaks.map((interval) =>
            tx.attendanceBreak.update({
              where: { id: interval.id },
              data: { endedAt },
            }),
          ),
        ),
      );
      await this.invalidateDashboardCache();
      return {
        break: updatedBreaks[0],
        onBreak: false,
        closedBreakCount: updatedBreaks.length,
      };
    }

    const record = await this.prisma.attendance.findFirst({
      where: {
        employeeId,
        organizationId: employee.organizationId ?? user.organizationId,
        checkIn: { not: null },
        checkOut: null,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { breaks: true },
    });
    if (!record)
      throw new BadRequestException('No active check-in record found');
    const openBreak = record.breaks.find(
      (interval) => interval.endedAt === null,
    );
    if (!openBreak)
      throw new BadRequestException('There is no break in progress');
    const endedAt = new Date();
    const updated = await this.prisma.attendanceBreak.update({
      where: { id: openBreak.id },
      data: { endedAt },
    });
    await this.invalidateDashboardCache();
    return { break: updated, onBreak: false };
  }

  private async buildDailySnapshot(
    day: Date,
    employeeIds: number[] | null,
    user: AttendanceUser,
  ) {
    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
    const organizationIds = await this.getAttendanceOrganizationIds(user);
    const otherOrganizationIds = organizationIds?.filter(
      (id) => id !== buScope.organizationId,
    );
    const employeeWhere =
      organizationIds === null
        ? { deletedAt: null }
        : otherOrganizationIds && otherOrganizationIds.length > 0
          ? {
              OR: [
                buWhere,
                {
                  organizationId: { in: otherOrganizationIds },
                  deletedAt: null,
                },
              ],
            }
          : {
              ...this.buildOrganizationScope(user),
              ...buWhere,
            };
    const employees = await this.prisma.employee.findMany({
      where: {
        ...employeeWhere,
        ...(employeeIds ? { id: { in: employeeIds } } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        shift: true,
        shiftAssignments: { include: { shift: true } },
        organization: { select: { id: true, name: true, timezone: true } },
      },
    });
    const eligibleEmployees = employees.filter((employee) =>
      this.isAttendanceEligible(day, employee.hireDate),
    );

    if (eligibleEmployees.length === 0) {
      const emptySummary = {
        present: 0,
        absent: 0,
        leave: 0,
        holiday: 0,
        halfDay: 0,
        presentDays: 0,
        absentDays: 0,
        leaveDays: 0,
        halfDays: 0,
        lateCount: 0,
        overtimeHours: 0,
        totalWorkingDays: 0,
      };
      return { rows: [] as DailyAttendanceRow[], summary: emptySummary };
    }

    const ids = eligibleEmployees.map((employee) => employee.id);

    const [attendanceRows, leaveRows, wfhRequestRows] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { employeeId: { in: ids }, date: this.startOfDay(day) },
        include: {
          shift: true,
          breaks: true,
          checkoutActor: { select: { name: true } },
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: ids },
          requestType: 'LEAVE',
          status: 'APPROVED',
          duration: 'FULL_DAY',
          startDate: { lte: this.endOfDay(day) },
          endDate: { gte: this.startOfDay(day) },
        },
        select: { employeeId: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: ids },
          requestType: 'WORK_FROM_HOME',
          status: 'APPROVED',
          deletedAt: null,
          startDate: { lte: this.endOfDay(day) },
          endDate: {
            gte: new Date(
              Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1),
            ),
          },
        },
        select: {
          employeeId: true,
          requestType: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      }),
    ]);

    const holidayOrganizationIds = [
      ...new Set(eligibleEmployees.map((employee) => employee.organizationId)),
    ];
    const monthStartHolidayDate = this.parseHolidayDate(
      this.dateKey(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1))),
    );
    const monthEndHolidayDate = this.parseHolidayDate(
      this.dateKey(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0))),
    );
    const { holidays, familyRootByOrganization } =
      await this.findApplicableHolidays(
        holidayOrganizationIds,
        monthStartHolidayDate,
        monthEndHolidayDate,
      );

    const attendanceMap = new Map(
      attendanceRows.map((row) => [row.employeeId, row]),
    );
    const leaveSet = new Set(leaveRows.map((row) => row.employeeId));
    const dailyWfhCredits = buildApprovedWorkFromHomeCredits(
      wfhRequestRows.map((request) => ({
        employeeId: request.employeeId,
        requestType: request.requestType,
        status: request.status,
        startDate: request.startDate,
        endDate: request.endDate,
      })),
      (employeeId, date) => {
        const employee = eligibleEmployees.find(
          (row) => row.id === employeeId,
        );
        if (!employee || !this.isAttendanceEligible(date, employee.hireDate)) {
          return false;
        }
        const attendance = attendanceMap.get(employeeId);
        const shift = resolveShiftForDate(
          employee.shiftAssignments,
          employee.shift,
          attendance?.shift ?? null,
          date,
        );
        return Boolean(
          shift &&
            this.isScheduledWorkday(date, shift) &&
            !holidays.some(
              (holiday) =>
                this.holidayAppliesToOrganization(
                  holiday,
                  employee.organizationId,
                  familyRootByOrganization,
                ) && this.holidayCoversDay(holiday, date),
            ),
        );
      },
    );

    const dailyCredits = new Map<number, number>();
    const today = new Date();
    await Promise.all(
      eligibleEmployees.map(async (employee) => {
        const attendance = attendanceMap.get(employee.id) ?? null;
        const shift =
          attendance?.shift ??
          this.employeeShiftForDay(
            employee.shiftAssignments,
            employee.shift,
            day,
          );
        if (shift?.type !== 'FLEXIBLE') return;
        const timezone = employee.organization?.timezone ?? 'UTC';
        const dayKey = this.dateKey(day);
        const rangeStart = this.localDateStart(dayKey, timezone);
        const rangeEnd = localMidnightAfterDateInTimezone(dayKey, timezone);
        if (!rangeEnd || rangeStart >= today) {
          dailyCredits.set(employee.id, 0);
          return;
        }
        const measuredEnd = new Date(
          Math.min(today.getTime(), rangeEnd.getTime()),
        );
        const intervals = await this.getFlexibleTaskIntervals(
          employee.id,
          employee.organizationId,
          rangeStart,
          measuredEnd,
        );
        dailyCredits.set(
          employee.id,
          this.sumFlexibleCreditedWorkSeconds(
            attendance ? [attendance] : [],
            intervals,
            rangeStart,
            measuredEnd,
            timezone,
            today,
          ).seconds,
        );
      }),
    );

    const rows = eligibleEmployees.map((employee) =>
      this.toDailyRow(
        employee,
        this.startOfDay(day),
        attendanceMap.get(employee.id) ?? null,
        leaveSet.has(employee.id),
        holidays.find(
          (holiday) =>
            this.holidayAppliesToOrganization(
              holiday,
              employee.organizationId,
              familyRootByOrganization,
            ) && this.holidayCoversDay(holiday, day),
        )?.name,
        dailyCredits.get(employee.id),
        dailyWfhCredits.get(`${employee.id}:${this.dateKey(day)}`),
      ),
    );

    return { rows, summary: this.buildSummary(rows) };
  }

  async findAll(query: QueryAttendanceDto, user: AttendanceUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const organizationId = await this.resolveOrganizationId(user);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const dayKey =
      query.date?.slice(0, 10) ??
      dateKeyInTimezone(new Date(), organization?.timezone ?? 'UTC');
    const day = attendanceDateFromKey(dayKey);
    const scopedIds = await this.getScopedEmployeeFilter(
      user,
      query.employeeId,
    );

    const { rows } = await this.buildDailySnapshot(day, scopedIds, user);
    const statusFilteredRows = query.status
      ? rows.filter((row) => row.status === query.status)
      : rows;

    const filteredRows = query.department
      ? statusFilteredRows.filter((row) =>
          (row.employee.department ?? 'Unassigned')
            .toLowerCase()
            .includes(query.department!.toLowerCase()),
        )
      : statusFilteredRows;

    const start = (page - 1) * limit;
    const data = filteredRows.slice(start, start + limit);

    return {
      data,
      total: filteredRows.length,
      page,
      limit,
      date: day.toISOString(),
      summary: this.buildSummary(filteredRows),
    };
  }

  async findMine(query: QueryAttendanceDto, user: AttendanceUser) {
    const employeeId = await this.resolveCurrentEmployeeId(user);
    return this.findAll({ ...query, employeeId }, user);
  }

  async getMyAttendanceHistory(
    query: QueryAttendanceDto,
    user: AttendanceUser,
  ) {
    const employeeId = await this.resolveCurrentEmployeeId(user);
    const organizationId = await this.resolveOrganizationId(user);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const timezone = organization?.timezone ?? 'UTC';
    const todayKey = dateKeyInTimezone(new Date(), timezone);
    const today = attendanceDateFromKey(todayKey);
    const rangeStart = query.all
      ? null
      : query.fromDate
        ? attendanceDateFromKey(query.fromDate.slice(0, 10))
        : attendanceDateFromKey(todayKey);
    if (!query.all && !query.fromDate && rangeStart) {
      rangeStart.setUTCDate(rangeStart.getUTCDate() - 29);
    }
    const where: Prisma.AttendanceWhereInput = {
      employeeId,
      organizationId,
      deletedAt: null,
      ...(!query.all && rangeStart
        ? { date: { gte: rangeStart, lte: today } }
        : {}),
      ...(query.status && query.status !== 'LATE'
        ? { status: query.status }
        : {}),
      ...(query.status === 'LATE' ? { lateMinutes: { gt: 0 } } : {}),
    };
    const page = query.page ?? 1;
    const limit = Math.max(1, Math.min(query.limit ?? 10, 100));
    const [rows, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              department: true,
              designation: true,
            },
          },
          shift: true,
          breaks: true,
        },
      }),
      this.prisma.attendance.count({ where }),
    ]);

    const data = rows.map((row) => {
      const shift = row.shift;
      const breaks = row.breaks.map((interval) => ({
        startedAt: interval.startedAt.toISOString(),
        endedAt: interval.endedAt?.toISOString() ?? null,
      }));
      return {
        id: row.id,
        employeeId,
        employee: row.employee,
        date: row.date.toISOString(),
        checkIn: row.checkIn?.toISOString() ?? null,
        checkOut: row.checkOut?.toISOString() ?? null,
        checkoutSource: row.checkoutSource,
        checkoutActorName: null,
        workingHours: row.workingHours,
        taskHours: row.taskHours ?? 0,
        breaks,
        breakHours: row.breaks.reduce((totalBreakHours, interval) => {
          const end =
            interval.endedAt?.getTime() ?? interval.startedAt.getTime();
          return (
            totalBreakHours +
            Math.max(0, end - interval.startedAt.getTime()) / 3_600_000
          );
        }, 0),
        onBreak: row.breaks.some((interval) => interval.endedAt == null),
        shortfallHours: row.shortfallHours,
        expectedHours: row.requiredHours ?? undefined,
        lateMinutes: row.lateMinutes,
        overtimeHours: row.overtimeHours,
        status: row.status,
        isShootDay: row.isShootDay,
        shiftDetails: shift
          ? {
              id: shift.id,
              name: shift.name,
              type: shift.type,
              startTime: shift.startTime,
              endTime: shift.endTime,
              requiredHours: shift.requiredHours,
              minPresentHours: shift.minPresentHours,
              gracePeriodMinutes: shift.gracePeriodMinutes,
              weeklyHolidayDay: shift.weeklyHolidayDay,
              workingDays: shift.workingDays,
            }
          : null,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      date: today.toISOString(),
      summary: this.buildSummary(data),
    };
  }

  async getToday(user: AttendanceUser, date?: string) {
    user.organizationId = await this.resolveOrganizationId(user);
    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { timezone: true },
    });
    const timezone = organization?.timezone ?? 'UTC';
    const dateKey =
      date?.slice(0, 10) ?? dateKeyInTimezone(new Date(), timezone);
    const day = attendanceDateFromKey(dateKey);
    const scopedIds = await this.getScopedEmployeeFilter(user);
    const { rows, summary } = await this.buildDailySnapshot(
      day,
      scopedIds,
      user,
    );
    if (!date) {
      const flexibleEmployeeIds = rows
        .filter((row) => row.shiftDetails?.type === 'FLEXIBLE')
        .map((row) => row.employeeId);
      if (flexibleEmployeeIds.length > 0) {
        const openBreakRows = await this.prisma.attendance.findMany({
          where: {
            employeeId: { in: flexibleEmployeeIds },
            breaks: { some: { endedAt: null } },
          },
          select: { employeeId: true },
        });
        const employeesOnBreak = new Set(
          openBreakRows.map((row) => row.employeeId),
        );
        for (const row of rows) {
          if (employeesOnBreak.has(row.employeeId)) row.onBreak = true;
        }
      }
    }

    return {
      date: day.toISOString(),
      rows,
      summary,
    };
  }

  async getMySnapshot(user: AttendanceUser) {
    const employeeId = await this.resolveCurrentEmployeeId(user);
    const today = await this.getToday(
      {
        ...user,
        employeeId,
      },
      undefined,
    );

    const row =
      today.rows.find((item) => item.employeeId === employeeId) ?? null;
    if (!row) {
      return {
        date: today.date,
        checkIn: null,
        checkOut: null,
        workingHours: null,
        taskHours: 0,
        breaks: [],
        onBreak: false,
        lateMinutes: 0,
        overtimeHours: 0,
        status: AttendanceStatus.NOT_SCHEDULED,
        isShootDay: false,
        shiftDetails: null,
      };
    }

    return {
      date: today.date,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      workingHours: row.workingHours,
      taskHours: row.taskHours ?? 0,
      breaks: row.breaks,
      onBreak: row.onBreak,
      lateMinutes: row.lateMinutes,
      overtimeHours: row.overtimeHours,
      status: row.status,
      isShootDay: row.isShootDay,
      shiftDetails: row.shiftDetails,
    };
  }

  async getMyTaskWorkSummary(user: AttendanceUser) {
    const employeeId = await this.resolveCurrentEmployeeId(user);
    const employee = await this.ensureEmployee(employeeId, user);
    const organizationId = employee.organizationId;
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const timezone = organization?.timezone ?? 'UTC';
    const now = new Date();
    const dateKey = dateKeyInTimezone(now, timezone);
    const rangeStart = localMidnightAtDateInTimezone(dateKey, timezone);
    const rangeEnd = localMidnightAfterDateInTimezone(dateKey, timezone);
    if (!rangeStart || !rangeEnd) {
      throw new BadRequestException(
        'Unable to calculate today in organization timezone',
      );
    }
    const measuredEnd = new Date(Math.min(now.getTime(), rangeEnd.getTime()));

    const timesheetDate = attendanceDateFromKey(dateKey);
    const nextTimesheetDate = new Date(timesheetDate);
    nextTimesheetDate.setUTCDate(nextTimesheetDate.getUTCDate() + 1);
    const [intervals, activeTimer, attendance, taskTimesheets] =
      await Promise.all([
        this.prisma.taskTimerInterval.findMany({
          where: {
            timerSession: { userId: user.userId, organizationId },
            startedAt: { lt: measuredEnd },
            endedAt: { gt: rangeStart },
          },
          select: { startedAt: true, endedAt: true },
        }),
        this.prisma.taskTimerSession.findFirst({
          where: { userId: user.userId, organizationId, status: 'RUNNING' },
          select: {
            startedAt: true,
            task: { select: { taskName: true } },
          },
        }),
        this.prisma.attendance.findUnique({
          where: {
            employeeId_date: {
              employeeId,
              date: attendanceDateFromKey(dateKey),
            },
          },
          include: { breaks: true, shift: true },
        }),
        this.prisma.timesheet.findMany({
          where: {
            employeeId,
            organizationId,
            date: { gte: timesheetDate, lt: nextTimesheetDate },
            status: { not: 'REJECTED' },
            source: { not: 'TASK_TIMER' },
            deletedAt: null,
          },
          select: { hours: true },
        }),
      ]);

    const taskIntervals = [...intervals];
    if (activeTimer?.startedAt && measuredEnd > activeTimer.startedAt) {
      taskIntervals.push({
        startedAt: activeTimer.startedAt,
        endedAt: measuredEnd,
      });
    }
    const taskTrackedSeconds = sumIntervalSeconds(
      taskIntervals,
      rangeStart,
      measuredEnd,
    );
    const taskTimesheetSeconds = taskTimesheets.reduce(
      (total, timesheet) =>
        total + Math.max(0, Math.round(timesheet.hours * 3600)),
      0,
    );
    const taskWorkSeconds = taskTrackedSeconds + taskTimesheetSeconds;

    let attendanceWorkedSeconds = 0;
    let creditedWorkSeconds = 0;
    let legacyAttendanceSeconds = 0;
    if (employee.shift?.type === 'FLEXIBLE') {
      const creditedWork = this.sumFlexibleCreditedWorkSeconds(
        attendance ? [attendance] : [],
        taskIntervals,
        rangeStart,
        measuredEnd,
        timezone,
        now,
      );
      creditedWorkSeconds = creditedWork.seconds;
      legacyAttendanceSeconds = creditedWork.legacySeconds;
      attendanceWorkedSeconds = creditedWork.seconds;
    } else if (attendance?.checkIn) {
      const workStart = Math.max(
        rangeStart.getTime(),
        attendance.checkIn.getTime(),
      );
      const workEnd = Math.min(
        measuredEnd.getTime(),
        attendance.checkOut?.getTime() ?? measuredEnd.getTime(),
      );
      const breakMilliseconds = attendance.breaks.reduce((total, interval) => {
        const breakStart = Math.max(workStart, interval.startedAt.getTime());
        const breakEnd = Math.min(
          workEnd,
          interval.endedAt?.getTime() ?? measuredEnd.getTime(),
        );
        return total + Math.max(0, breakEnd - breakStart);
      }, 0);
      attendanceWorkedSeconds = Math.floor(
        Math.max(0, workEnd - workStart - breakMilliseconds) / 1000,
      );
    }

    const scheduledHours =
      attendance?.requiredHours ??
      attendance?.shift?.requiredHours ??
      employee.shift?.requiredHours ??
      0;
    return {
      date: dateKey,
      taskTrackedSeconds,
      taskTimesheetSeconds,
      taskWorkSeconds,
      attendanceWorkedSeconds,
      scheduledSeconds: Math.max(0, Math.round(scheduledHours * 3600)),
      activeTimer: activeTimer?.startedAt
        ? {
            taskName: activeTimer.task.taskName,
            startedAt: activeTimer.startedAt.toISOString(),
          }
        : null,
      ...(employee.shift?.type === 'FLEXIBLE'
        ? {
            shiftType: 'FLEXIBLE',
            workdayHours: 8,
            creditedWorkSeconds,
            legacyAttendanceSeconds,
            workingDayEquivalent: Number(
              (creditedWorkSeconds / 3600 / 8).toFixed(2),
            ),
          }
        : {}),
    };
  }

  async getEmployeeAttendance(
    employeeId: number,
    user: AttendanceUser,
    month?: string,
  ) {
    const scopedIds = await this.getScopedEmployeeFilter(user, employeeId);
    if (!scopedIds || !scopedIds.includes(employeeId)) {
      throw new ForbiddenException(
        'You can only access authorized attendance records',
      );
    }

    const employeeWhere =
      user.role === Role.EMPLOYEE
        ? {
            id: employeeId,
            organizationId: user.organizationId,
            deletedAt: null,
          }
        : { id: employeeId, deletedAt: null };
    const employee = await this.prisma.employee.findFirst({
      where: employeeWhere,
      include: {
        shift: true,
        shiftAssignments: { include: { shift: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee #${employeeId} not found`);
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: employee.organizationId },
      select: { timezone: true },
    });
    const timezone = organization?.timezone ?? 'UTC';
    const currentDateKey = dateKeyInTimezone(new Date(), timezone);
    const monthKey = month ?? currentDateKey.slice(0, 7);
    const monthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey);
    if (!monthMatch) {
      throw new BadRequestException('Month must use YYYY-MM format');
    }
    const monthYear = Number(monthMatch[1]);
    const monthNumber = Number(monthMatch[2]);
    const monthStart = new Date(Date.UTC(monthYear, monthNumber - 1, 1));
    const nextMonthStart = new Date(Date.UTC(monthYear, monthNumber, 1));
    const monthEnd = new Date(nextMonthStart.getTime() - 1);

    const attendanceRows = await this.prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: monthStart, lte: monthEnd },
      },
      include: { shift: true, breaks: true },
      orderBy: { date: 'asc' },
    });
    const leaveRequestRows: LeaveRequestLite[] =
      await this.prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          deletedAt: null,
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
        select: {
          requestType: true,
          startDate: true,
          endDate: true,
          duration: true,
        },
      });
    const leaveRows = leaveRequestRows.filter(
      (request) => request.requestType !== 'WORK_FROM_HOME',
    );

    const monthStartHolidayDate = this.parseHolidayDate(
      this.dateKey(monthStart),
    );
    const monthEndHolidayDate = this.parseHolidayDate(this.dateKey(monthEnd));
    const { holidays, familyRootByOrganization } =
      await this.findApplicableHolidays(
        [employee.organizationId],
        monthStartHolidayDate,
        monthEndHolidayDate,
      );

    const attendanceMap = new Map(
      attendanceRows.map((row) => [
        this.startOfDay(new Date(row.date)).getTime(),
        row,
      ]),
    );
    const workFromHomeCredits = buildApprovedWorkFromHomeCredits(
      leaveRequestRows.map((request) => ({
        employeeId: employee.id,
        requestType: request.requestType ?? 'LEAVE',
        status: 'APPROVED',
        startDate: request.startDate,
        endDate: request.endDate,
      })),
      (_employeeId, date) => {
        if (!this.isAttendanceEligible(date, employee.hireDate)) return false;
        const attendance = attendanceMap.get(
          this.startOfDay(date).getTime(),
        );
        const shift = resolveShiftForDate(
          employee.shiftAssignments,
          employee.shift,
          attendance?.shift ?? null,
          date,
        );
        const dateKey = this.dateKey(date);
        return Boolean(
          shift &&
            this.isScheduledWorkday(date, shift) &&
            !holidays.some(
              (holiday) =>
                this.holidayAppliesToOrganization(
                  holiday,
                  employee.organizationId,
                  familyRootByOrganization,
                ) && this.holidayCoversDay(holiday, date),
            ) &&
            !leaveRows.some(
              (leave) =>
                this.dateKey(leave.startDate) <= dateKey &&
                this.dateKey(leave.endDate) >= dateKey,
            ),
        );
      },
    );

    const daysInMonth = new Date(
      Date.UTC(monthYear, monthNumber, 0),
    ).getUTCDate();
    const days: Array<{
      date: string;
      day: number;
      status: AttendanceStatus;
      holidayName: string | null;
      checkIn: string | null;
      checkOut: string | null;
      workingHours: number | null;
      taskHours: number;
      creditedWorkSeconds?: number;
      breaks: { startedAt: string; endedAt: string | null }[];
      shortfallHours: number;
      expectedHours?: number;
      lateMinutes: number;
      overtimeHours: number;
      isShootDay: boolean;
      workFromHomeCredit?: number;
      shiftDetails: (ShiftLite & { minPresentHours: number }) | null;
    }> = [];

    const rangeStart = this.localDateStart(
      monthStart.toISOString().slice(0, 10),
      timezone,
    );
    const rangeEnd = this.localDateStart(
      nextMonthStart.toISOString().slice(0, 10),
      timezone,
    );
    const now = new Date();
    const measuredEnd = new Date(Math.min(now.getTime(), rangeEnd.getTime()));
    const hasFlexibleShiftInMonth =
      ((employee.shiftAssignments ?? []).length === 0 &&
        employee.shift?.type === 'FLEXIBLE') ||
      (employee.shiftAssignments ?? []).some(
        (assignment) =>
          assignment.shift.type === 'FLEXIBLE' &&
          assignment.effectiveFrom < rangeEnd &&
          (assignment.effectiveTo === null ||
            assignment.effectiveTo > rangeStart),
      );
    const taskIntervals =
      hasFlexibleShiftInMonth && measuredEnd > rangeStart
        ? await this.getFlexibleTaskIntervals(
            employeeId,
            employee.organizationId,
            rangeStart,
            measuredEnd,
          )
        : [];

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
      const day = new Date(Date.UTC(monthYear, monthNumber - 1, dayNumber));
      if (!this.isAttendanceEligible(day, employee.hireDate)) {
        continue;
      }
      const attendance =
        attendanceMap.get(this.startOfDay(day).getTime()) ?? null;
      const isHalfDayLeave = leaveRows.some(
        (row) =>
          row.duration === 'HALF_DAY' &&
          row.startDate <= this.endOfDay(day) &&
          row.endDate >= this.startOfDay(day),
      );
      const onLeave = leaveRows.some(
        (row) =>
          row.duration !== 'HALF_DAY' &&
          row.startDate <= this.endOfDay(day) &&
          row.endDate >= this.startOfDay(day),
      );
      const shift =
        attendance?.shift ??
        this.employeeShiftForDay(
          employee.shiftAssignments,
          employee.shift,
          day,
        ) ??
        null;
      const flexibleDay = shift?.type === 'FLEXIBLE';
      const holidayName = holidays.find(
        (holiday) =>
          this.holidayAppliesToOrganization(
            holiday,
            employee.organizationId,
            familyRootByOrganization,
          ) && this.holidayCoversDay(holiday, day),
      )?.name;
      const status = onLeave
        ? AttendanceStatus.LEAVE
        : holidayName && !attendance?.checkIn
          ? AttendanceStatus.HOLIDAY
          : shift?.type === 'FLEXIBLE' && !attendance?.checkIn
            ? AttendanceStatus.NOT_SCHEDULED
            : (attendance?.status ??
              this.calculateStatus({
                day,
                checkIn: null,
                checkOut: null,
                workingHours: null,
                onLeave,
                shift,
                timezone,
              }));
      const workFromHomeCredit = workFromHomeCredits.get(
        `${employee.id}:${this.dateKey(day)}`,
      );
      const effectiveStatus =
        workFromHomeCredit === undefined
          ? status
          : workFromHomeCredit === 1
            ? AttendanceStatus.PRESENT
            : AttendanceStatus.HALF_DAY;
      const requiredHours = shift?.requiredHours ?? 8;
      const minPresentHours = shift?.minPresentHours ?? 5;
      const gracePeriodMinutes = shift?.gracePeriodMinutes ?? 15;
      const shortfallHours =
        (attendance as { shortfallHours?: number })?.shortfallHours ??
        this.calculateShortfallHours(attendance?.workingHours ?? null, shift);
      const effectiveShift = shift
        ? {
            id: shift.id,
            name: shift.name,
            type: shift.type,
            startTime: shift.startTime,
            endTime: shift.endTime,
            requiredHours,
            minPresentHours,
            gracePeriodMinutes,
            weeklyHolidayDay: shift.weeklyHolidayDay,
            workingDays:
              shift.workingDays ??
              [0, 1, 2, 3, 4, 5, 6].filter(
                (weekday) => weekday !== shift.weeklyHolidayDay,
              ),
          }
        : null;

      const dayKey = day.toISOString().slice(0, 10);
      const dayStart = this.localDateStart(dayKey, timezone);
      const dayEnd = localMidnightAfterDateInTimezone(dayKey, timezone);
      const creditedWorkSeconds =
        flexibleDay && dayEnd && dayStart < measuredEnd
          ? this.sumFlexibleCreditedWorkSeconds(
              attendance ? [attendance] : [],
              taskIntervals,
              dayStart,
              new Date(Math.min(dayEnd.getTime(), measuredEnd.getTime())),
              timezone,
              now,
            ).seconds
          : undefined;
      days.push({
        date: this.startOfDay(day).toISOString(),
        day: dayNumber,
        status: effectiveStatus,
        isShootDay: attendance?.isShootDay ?? false,
        holidayName:
          effectiveStatus === AttendanceStatus.HOLIDAY
            ? (holidayName ?? null)
            : null,
        checkIn: attendance?.checkIn?.toISOString() ?? null,
        checkOut: attendance?.checkOut?.toISOString() ?? null,
        workingHours:
          creditedWorkSeconds !== undefined
            ? Number((creditedWorkSeconds / 3600).toFixed(2))
            : (attendance?.workingHours ?? null),
        taskHours: attendance?.taskHours ?? 0,
        ...(workFromHomeCredit !== undefined
          ? { workFromHomeCredit }
          : {}),
        ...(creditedWorkSeconds !== undefined ? { creditedWorkSeconds } : {}),
        breaks: (attendance?.breaks ?? []).map((interval) => ({
          startedAt: interval.startedAt.toISOString(),
          endedAt: interval.endedAt?.toISOString() ?? null,
        })),
        shortfallHours,
        expectedHours: isHalfDayLeave ? 5 : undefined,
        lateMinutes: attendance?.lateMinutes ?? 0,
        overtimeHours: attendance?.overtimeHours ?? 0,
        shiftDetails: effectiveShift,
      });
    }

    const summary = this.buildSummary(
      days.map((d) => ({
        id: null,
        employeeId,
        employee: {
          id: employee.id,
          name: employee.name,
          department: employee.department,
          designation: employee.designation,
        },
        date: d.date,
        checkIn: d.checkIn,
        checkOut: d.checkOut,
        checkoutSource: null,
        checkoutActorName: null,
        workingHours: d.workingHours,
        taskHours: d.taskHours,
        breaks: d.breaks,
        breakHours: d.breaks.reduce((total, interval) => {
          const start = new Date(interval.startedAt).getTime();
          const end = interval.endedAt
            ? new Date(interval.endedAt).getTime()
            : start;
          return total + Math.max(0, end - start) / 36e5;
        }, 0),
        onBreak: false,
        shortfallHours: d.shortfallHours,
        expectedHours: d.expectedHours,
        lateMinutes: d.lateMinutes,
        overtimeHours: d.overtimeHours,
        isShootDay: d.isShootDay,
        status: d.status,
        shiftDetails: d.shiftDetails,
      })),
    );

    return {
      employee,
      month: monthKey,
      summary,
      days,
    };
  }

  private async getWorkHourBalancesForEmployee(
    employeeId: number,
    employee: {
      id: number;
      organizationId: number;
      hireDate: Date | null;
      shift: ShiftLite | null;
      shiftAssignments?: Array<{
        effectiveFrom: Date;
        effectiveTo: Date | null;
        shift: ShiftLite;
      }>;
    },
    now: Date,
    timezone: string,
  ) {
    const todayKey = dateKeyInTimezone(now, timezone);
    const today = attendanceDateFromKey(todayKey);
    const monthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
    );
    const weekStart = new Date(today);
    const daysFromMonday = (weekStart.getUTCDay() + 6) % 7;
    weekStart.setUTCDate(weekStart.getUTCDate() - daysFromMonday);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const queryStart = weekStart < monthStart ? weekStart : monthStart;

    const attendanceRows = await this.prisma.attendance.findMany({
      where: { employeeId, date: { gte: queryStart, lte: today } },
      include: { shift: true, breaks: true },
    });
    const taskTimeCutoverKey = this.flexibleTaskTimeCutoverDate();
    const queryStartKey = queryStart.toISOString().slice(0, 10);
    const hireDateKey = employee.hireDate?.toISOString().slice(0, 10);
    const taskRangeStartKey = [
      queryStartKey,
      taskTimeCutoverKey,
      ...(hireDateKey ? [hireDateKey] : []),
    ].reduce((latest, key) => (key > latest ? key : latest));
    const taskTimesheetRangeStartKey = [
      queryStartKey,
      ...(hireDateKey ? [hireDateKey] : []),
    ].reduce((latest, key) => (key > latest ? key : latest));
    const taskIntervals =
      taskRangeStartKey <= todayKey
        ? await this.getFlexibleTaskIntervals(
            employeeId,
            employee.organizationId,
            this.localDateStart(taskRangeStartKey, timezone),
            now,
          )
        : [];
    const taskTimesheetRangeStart = attendanceDateFromKey(
      taskTimesheetRangeStartKey,
    );
    const taskTimesheetRangeEnd = attendanceDateFromKey(todayKey);
    taskTimesheetRangeEnd.setUTCDate(taskTimesheetRangeEnd.getUTCDate() + 1);
    const taskTimesheets =
      taskTimesheetRangeStartKey <= todayKey
        ? await this.prisma.timesheet.findMany({
            where: {
              employeeId,
              organizationId: employee.organizationId,
              date: { gte: taskTimesheetRangeStart, lt: taskTimesheetRangeEnd },
              source: { not: 'TASK_TIMER' },
              deletedAt: null,
            },
            select: { date: true, hours: true },
          })
        : [];
    const leaves: LeaveRequestLite[] = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        requestType: 'LEAVE',
        status: 'APPROVED',
        startDate: { lte: this.endOfDay(monthEnd) },
        endDate: { gte: queryStart },
        deletedAt: null,
      },
      select: { startDate: true, endDate: true, duration: true },
    });
    const { holidays, familyRootByOrganization } =
      await this.findApplicableHolidays(
        [employee.organizationId],
        queryStart,
        monthEnd,
      );

    const attendanceByDate = new Map(
      attendanceRows.map((row) => [this.dateKey(row.date), row]),
    );
    const isCovered = (
      range: { startDate: Date; endDate: Date },
      dayKey: string,
    ) =>
      dayKey >= range.startDate.toISOString().slice(0, 10) &&
      dayKey <= range.endDate.toISOString().slice(0, 10);

    const aggregatePeriod = (periodStart: Date, scheduledThrough: Date) => {
      let requiredHours = 0;
      let breakHours = 0;
      let scheduledDays = 0;
      let completedHours = 0;
      let flexibleCompletedHours = 0;
      let flexibleTaskHours = 0;
      let workingDayEquivalents = 0;
      let activeDays = 0;
      let hasFlexibleShift = false;
      const periodStartKey = periodStart.toISOString().slice(0, 10);
      const eligibleStartKey = [
        periodStartKey,
        ...(hireDateKey ? [hireDateKey] : []),
      ].reduce((latest, key) => (key > latest ? key : latest));
      const measuredStart = this.localDateStart(eligibleStartKey, timezone);
      const periodEndKey = scheduledThrough.toISOString().slice(0, 10);
      const periodEnd =
        localMidnightAfterDateInTimezone(periodEndKey, timezone) ?? now;
      const measuredEnd = new Date(
        Math.min(now.getTime(), periodEnd.getTime()),
      );
      const taskWork =
        measuredStart < measuredEnd
          ? this.sumTaskWork(
              taskIntervals,
              taskTimesheets,
              measuredStart,
              measuredEnd,
              timezone,
            )
          : { seconds: 0, activeDays: 0 };
      const taskWorkHours = taskWork.seconds / 3600;
      for (
        const day = new Date(periodStart);
        day <= scheduledThrough;
        day.setUTCDate(day.getUTCDate() + 1)
      ) {
        const dayKey = this.dateKey(day);
        const row = attendanceByDate.get(dayKey);
        const shift = resolveShiftForDate(
          employee.shiftAssignments,
          employee.shift,
          row?.shift,
          day,
        );
        const isElapsedDay = day <= today;
        if (isElapsedDay && row?.breaks) {
          breakHours += row.breaks.reduce((total, interval) => {
            const startedAt = interval.startedAt.getTime();
            const endedAt = Math.min(
              interval.endedAt?.getTime() ?? now.getTime(),
              now.getTime(),
            );
            return total + Math.max(0, endedAt - startedAt) / 36e5;
          }, 0);
        }
        const fullDayLeave = leaves.some(
          (leave) =>
            leave.duration !== 'HALF_DAY' && isCovered(leave, dayKey),
        );
        const halfDayLeave = leaves.some(
          (leave) => leave.duration === 'HALF_DAY' && isCovered(leave, dayKey),
        );

        if (
          !shift ||
          !this.isScheduledWorkday(day, shift) ||
          !this.isAttendanceEligible(day, employee.hireDate) ||
          row?.status === AttendanceStatus.LEAVE ||
          row?.status === AttendanceStatus.HOLIDAY ||
          row?.status === AttendanceStatus.WEEKLY_OFF ||
          holidays.some(
            (holiday) =>
              this.holidayAppliesToOrganization(
                holiday,
                employee.organizationId,
                familyRootByOrganization,
              ) && isCovered(holiday, dayKey),
          ) ||
          fullDayLeave
        ) {
          continue;
        }
        const availableDayFraction = halfDayLeave ? 0.5 : 1;
        const flexible = shift.type === 'FLEXIBLE';
        const dailyRequiredHours = flexible
          ? 8
          : (row?.requiredHours ?? shift.requiredHours);
        hasFlexibleShift ||= flexible;
        requiredHours += dailyRequiredHours * availableDayFraction;
        scheduledDays += availableDayFraction;

        if (!isElapsedDay) continue;
        if (flexible) {
          const dayStart = this.localDateStart(dayKey, timezone);
          const dayEnd = localMidnightAfterDateInTimezone(dayKey, timezone);
          if (!dayEnd) {
            throw new BadRequestException(
              'Unable to calculate flexible work time in organization timezone',
            );
          }
          const dayWork = this.sumFlexibleCreditedWorkSeconds(
            row ? [row] : [],
            taskIntervals,
            dayStart,
            new Date(Math.min(dayEnd.getTime(), measuredEnd.getTime())),
            timezone,
            now,
            taskTimesheets,
          );
          const dayWorkSeconds = dayWork.seconds;
          const earnedHours = dayWorkSeconds / 3600;
          completedHours += earnedHours;
          flexibleCompletedHours += earnedHours;
          flexibleTaskHours +=
            Math.max(0, dayWorkSeconds - dayWork.legacySeconds) / 3600;
          workingDayEquivalents += earnedHours / 8;
          if (dayWorkSeconds > 0) activeDays += 1;
        } else {
          const workedHours =
            row?.workingHours ??
            (row?.checkIn
              ? calculateNetWorkingHours(
                  row.checkIn,
                  row.checkOut ?? now,
                  row.breaks ?? [],
                )
              : 0);
          completedHours += workedHours;
          if (workedHours > 0) activeDays += 1;
          if (row?.status === AttendanceStatus.PRESENT) {
            workingDayEquivalents += availableDayFraction;
          } else if (row?.status === AttendanceStatus.HALF_DAY) {
            workingDayEquivalents += Math.min(0.5, availableDayFraction);
          }
        }
      }
      requiredHours = Number(requiredHours.toFixed(2));
      completedHours = Number(completedHours.toFixed(2));
      breakHours = Number(breakHours.toFixed(2));
      const exactTaskWorkHours = taskWork.seconds / 3600;
      const remainingHours = Number(
        Math.max(0, requiredHours - completedHours).toFixed(2),
      );
      return {
        startDate: periodStart.toISOString(),
        endDate: scheduledThrough.toISOString(),
        requiredHours,
        completedHours,
        taskWorkHours: Number(exactTaskWorkHours.toFixed(2)),
        taskWorkActiveDays: taskWork.activeDays,
        breakHours,
        scheduledDays,
        remainingHours,
        flexible: hasFlexibleShift,
        workdayHours: 8,
        activeDays,
        workingDayEquivalents: Number(workingDayEquivalents.toFixed(2)),
        taskWorkWorkingDayEquivalents: Number(
          ((hasFlexibleShift ? flexibleTaskHours : exactTaskWorkHours) / 8)
            .toFixed(2),
        ),
        flexibleCompletedHours: Number(flexibleCompletedHours.toFixed(2)),
        progressPercent:
          requiredHours > 0
            ? Math.min(
                100,
                Number(((completedHours / requiredHours) * 100).toFixed(1)),
              )
            : 100,
      };
    };

    const monthToDate = aggregatePeriod(monthStart, today);
    const fullMonth = aggregatePeriod(monthStart, monthEnd);
    return {
      week: aggregatePeriod(weekStart, weekEnd),
      month: {
        ...monthToDate,
        fullPeriodRequiredHours: fullMonth.requiredHours,
        fullPeriodScheduledDays: fullMonth.scheduledDays,
      },
    };
  }

  private localDateStart(dateKey: string, timezone: string) {
    const start = localMidnightAtDateInTimezone(dateKey, timezone);
    if (!start) {
      throw new BadRequestException(
        'Unable to calculate the work period in organization timezone',
      );
    }
    return start;
  }

  private async getFlexibleTaskIntervals(
    employeeId: number,
    organizationId: number,
    rangeStart: Date,
    rangeEnd: Date,
  ) {
    const timerScope = {
      organizationId,
      user: { employeeId },
    };
    const [intervals, activeTimers] = await Promise.all([
      this.prisma.taskTimerInterval.findMany({
        where: {
          timerSession: timerScope,
          startedAt: { lt: rangeEnd },
          endedAt: { gt: rangeStart },
        },
        select: { startedAt: true, endedAt: true },
      }),
      this.prisma.taskTimerSession.findMany({
        where: {
          ...timerScope,
          status: 'RUNNING',
          startedAt: { not: null, lt: rangeEnd },
        },
        select: { startedAt: true },
      }),
    ]);
    const activeIntervals = activeTimers.flatMap((timer) =>
      timer.startedAt && timer.startedAt < rangeEnd
        ? [{ startedAt: timer.startedAt, endedAt: rangeEnd }]
        : [],
    );
    return [...intervals, ...activeIntervals];
  }

  private sumTaskWork(
    intervals: Array<{ startedAt: Date; endedAt: Date }>,
    timesheets: Array<{ date: Date; hours: number }>,
    rangeStart: Date,
    rangeEnd: Date,
    timezone: string,
  ) {
    let seconds = 0;
    let activeDays = 0;
    let cursor = new Date(rangeStart);

    while (cursor < rangeEnd) {
      const dateKey = dateKeyInTimezone(cursor, timezone);
      const dayStart = localMidnightAtDateInTimezone(dateKey, timezone);
      const dayEnd = localMidnightAfterDateInTimezone(dateKey, timezone);
      if (!dayStart || !dayEnd || dayEnd <= cursor) {
        throw new BadRequestException(
          'Unable to calculate task work time in organization timezone',
        );
      }
      const measuredStart = new Date(
        Math.max(rangeStart.getTime(), dayStart.getTime()),
      );
      const measuredEnd = new Date(
        Math.min(rangeEnd.getTime(), dayEnd.getTime()),
      );
      let dateTimesheetSeconds = 0;
      for (const timesheet of timesheets) {
        if (timesheet.date.toISOString().slice(0, 10) !== dateKey) continue;
        dateTimesheetSeconds += Math.max(0, Math.round(timesheet.hours * 3600));
      }
      const daySeconds =
        sumIntervalSeconds(intervals, measuredStart, measuredEnd) +
        dateTimesheetSeconds;
      seconds += daySeconds;
      if (daySeconds > 0) activeDays += 1;
      cursor = dayEnd;
    }

    return { seconds, activeDays };
  }

  private sumFlexibleCreditedWorkSeconds(
    attendanceRows: Array<{
      date: Date;
      checkIn: Date | null;
      checkOut: Date | null;
      workingHours: number | null;
      breaks: Array<{ startedAt: Date; endedAt: Date | null }>;
    }>,
    intervals: Array<{ startedAt: Date; endedAt: Date }>,
    rangeStart: Date,
    rangeEnd: Date,
    timezone: string,
    now: Date,
    manualTimesheets: Array<{ date: Date; hours: number }> = [],
  ) {
    let seconds = 0;
    let legacySeconds = 0;
    let activeDays = 0;
    let cursor = new Date(rangeStart);
    const attendanceByDate = new Map(
      attendanceRows.map((row) => [row.date.toISOString().slice(0, 10), row]),
    );

    while (cursor < rangeEnd) {
      const dateKey = dateKeyInTimezone(cursor, timezone);
      const dayStart = localMidnightAtDateInTimezone(dateKey, timezone);
      const dayEnd = localMidnightAfterDateInTimezone(dateKey, timezone);
      if (!dayStart || !dayEnd || dayEnd <= cursor) {
        throw new BadRequestException(
          'Unable to calculate flexible work time in organization timezone',
        );
      }
      const measuredStart = new Date(
        Math.max(rangeStart.getTime(), dayStart.getTime()),
      );
      const measuredEnd = new Date(
        Math.min(rangeEnd.getTime(), dayEnd.getTime(), now.getTime()),
      );
      const dayIntervals = intervals.filter(
        (interval) =>
          interval.startedAt < measuredEnd && interval.endedAt > measuredStart,
      );
      let daySeconds = 0;

      if (dateKey >= this.flexibleTaskTimeCutoverDate()) {
        daySeconds = sumIntervalSeconds(
          dayIntervals,
          measuredStart,
          measuredEnd,
        );
      } else {
        const attendance = attendanceByDate.get(dateKey);
        if (attendance?.workingHours != null && attendance.workingHours > 0) {
          daySeconds = Math.max(0, Math.round(attendance.workingHours * 3600));
        } else if (attendance?.checkIn) {
          const workStart = Math.max(
            measuredStart.getTime(),
            attendance.checkIn.getTime(),
          );
          const workEnd = Math.min(
            measuredEnd.getTime(),
            attendance.checkOut?.getTime() ?? now.getTime(),
            now.getTime(),
          );
          const breakMilliseconds = attendance.breaks.reduce(
            (total, interval) => {
              const breakStart = Math.max(
                workStart,
                interval.startedAt.getTime(),
              );
              const breakEnd = Math.min(
                workEnd,
                interval.endedAt?.getTime() ?? now.getTime(),
              );
              return total + Math.max(0, breakEnd - breakStart);
            },
            0,
          );
          daySeconds = Math.floor(
            Math.max(0, workEnd - workStart - breakMilliseconds) / 1000,
          );
        }
        legacySeconds += daySeconds;
      }

      for (const timesheet of manualTimesheets) {
        if (timesheet.date.toISOString().slice(0, 10) === dateKey) {
          daySeconds += Math.max(0, Math.round(timesheet.hours * 3600));
        }
      }
      if (daySeconds > 0) activeDays += 1;
      seconds += daySeconds;
      cursor = dayEnd;
    }

    return { seconds, legacySeconds, activeDays };
  }

  async getMyWorkHourBalances(user: AttendanceUser) {
    const employeeId = await this.resolveCurrentEmployeeId(user);
    const employee = await this.ensureEmployee(employeeId, user);
    const organization = await this.prisma.organization.findUnique({
      where: { id: employee.organizationId },
      select: { timezone: true },
    });
    return this.getWorkHourBalancesForEmployee(
      employeeId,
      employee,
      new Date(),
      organization?.timezone ?? 'UTC',
    );
  }

  async getTeamWeeklyWorkHours(user: AttendanceUser) {
    const scopedIds = await this.getScopedEmployeeFilter(user);
    const organizationIds = await this.getAttendanceOrganizationIds(user);
    const employees = await this.prisma.employee.findMany({
      where: {
        ...(organizationIds === null
          ? {}
          : { organizationId: { in: organizationIds } }),
        deletedAt: null,
        ...(scopedIds ? { id: { in: scopedIds } } : {}),
      },
      include: {
        shift: true,
        shiftAssignments: { include: { shift: true } },
      },
      orderBy: { name: 'asc' },
    });

    const now = new Date();
    const organizations = await Promise.all(
      [...new Set(employees.map((employee) => employee.organizationId))].map(
        async (organizationId) => {
          const organization = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            select: { timezone: true },
          });
          return [organizationId, organization?.timezone ?? 'UTC'] as const;
        },
      ),
    );
    const timezoneByOrganization = new Map(organizations);
    const taskTimeRanges = new Map<number, { start: Date; end: Date }>();
    for (const employee of employees) {
      const timezone =
        timezoneByOrganization.get(employee.organizationId) ?? 'UTC';
      const today = attendanceDateFromKey(dateKeyInTimezone(now, timezone));
      const weekStart = new Date(today);
      weekStart.setUTCDate(
        weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7),
      );
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
      const start = localMidnightAtDateInTimezone(
        this.dateKey(weekStart),
        timezone,
      );
      const end = localMidnightAtDateInTimezone(
        this.dateKey(weekEnd),
        timezone,
      );
      if (!start || !end) {
        throw new BadRequestException(
          'Unable to calculate weekly task time in organization timezone',
        );
      }
      taskTimeRanges.set(employee.id, { start, end });
    }

    const minTaskRangeStart = Math.min(
      ...[...taskTimeRanges.values()].map(({ start }) => start.getTime()),
    );
    const maxTaskRangeEnd = Math.max(
      ...[...taskTimeRanges.values()].map(({ end }) => end.getTime()),
    );
    const employeeIds = employees.map((employee) => employee.id);
    const timerScope = {
      organizationId: { in: [...timezoneByOrganization.keys()] },
      user: { employeeId: { in: employeeIds } },
    };
    const [taskIntervals, activeTaskTimers] =
      employeeIds.length > 0
        ? await Promise.all([
            this.prisma.taskTimerInterval.findMany({
              where: {
                timerSession: timerScope,
                startedAt: { lt: new Date(maxTaskRangeEnd) },
                endedAt: { gt: new Date(minTaskRangeStart) },
              },
              select: {
                startedAt: true,
                endedAt: true,
                timerSession: {
                  select: {
                    user: { select: { employeeId: true } },
                  },
                },
              },
            }),
            this.prisma.taskTimerSession.findMany({
              where: {
                ...timerScope,
                status: 'RUNNING',
                startedAt: { not: null, lt: now },
              },
              select: {
                startedAt: true,
                user: { select: { employeeId: true } },
              },
            }),
          ])
        : [[], []];
    const taskIntervalsByEmployee = new Map<
      number,
      { startedAt: Date; endedAt: Date }[]
    >();
    for (const interval of taskIntervals) {
      const employeeId = interval.timerSession.user.employeeId;
      if (employeeId == null) continue;
      const employeeIntervals = taskIntervalsByEmployee.get(employeeId) ?? [];
      employeeIntervals.push(interval);
      taskIntervalsByEmployee.set(employeeId, employeeIntervals);
    }
    for (const timer of activeTaskTimers) {
      const employeeId = timer.user.employeeId;
      if (employeeId == null || !timer.startedAt) continue;
      const employeeIntervals = taskIntervalsByEmployee.get(employeeId) ?? [];
      employeeIntervals.push({ startedAt: timer.startedAt, endedAt: now });
      taskIntervalsByEmployee.set(employeeId, employeeIntervals);
    }

    const rows: Array<{
      employeeId: number;
      employeeName: string;
      department: string | null;
      taskTrackedHours: number;
      week: Awaited<
        ReturnType<AttendanceService['getWorkHourBalancesForEmployee']>
      >['week'];
    }> = [];
    for (let offset = 0; offset < employees.length; offset += 10) {
      const batch = await Promise.all(
        employees.slice(offset, offset + 10).map(async (employee) => {
          const balances = await this.getWorkHourBalancesForEmployee(
            employee.id,
            employee,
            now,
            timezoneByOrganization.get(employee.organizationId) ?? 'UTC',
          );
          const taskRange = taskTimeRanges.get(employee.id);
          const taskTrackedHours = taskRange
            ? Number(
                (
                  sumIntervalSeconds(
                    taskIntervalsByEmployee.get(employee.id) ?? [],
                    taskRange.start,
                    new Date(Math.min(now.getTime(), taskRange.end.getTime())),
                  ) / 3600
                ).toFixed(2),
              )
            : 0;
          return {
            employeeId: employee.id,
            employeeName: employee.name,
            department: employee.department ?? null,
            taskTrackedHours,
            week: balances.week,
          };
        }),
      );
      rows.push(...batch);
    }

    return { employees: rows };
  }

  async getSummary(query: AttendanceSummaryQueryDto, user: AttendanceUser) {
    user.organizationId = await this.resolveOrganizationId(user);
    const targetMonth = query.month
      ? new Date(`${query.month}-01T00:00:00.000Z`)
      : new Date();

    const monthStart = new Date(
      Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
    );
    monthEnd.setUTCHours(23, 59, 59, 999);
    const nextMonthStart = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1),
    );

    const scopedIds = await this.getScopedEmployeeFilter(
      user,
      query.employeeId,
    );

    const whereWithEmployee = {
      date: { gte: monthStart, lte: monthEnd },
      ...(scopedIds === null
        ? this.buildOrganizationScope(user)
        : { employeeId: { in: scopedIds } }),
    } as const;

    const attendanceRows = await this.prisma.attendance.findMany({
      where: { ...whereWithEmployee, deletedAt: null },
      include: {
        shift: true,
        breaks: true,
        employee: { select: { hireDate: true, organizationId: true } },
      },
    });
    const summaryEmployees = await this.prisma.employee.findMany({
      where:
        scopedIds === null
          ? { deletedAt: null, ...this.buildOrganizationScope(user) }
          : { id: { in: scopedIds }, deletedAt: null },
      select: {
        id: true,
        hireDate: true,
        organizationId: true,
        shift: true,
        shiftAssignments: { include: { shift: true } },
        organization: { select: { timezone: true } },
      },
    });
    const summaryEmployeeById = new Map(
      summaryEmployees.map((employee) => [employee.id, employee]),
    );

    const organizationIds = [
      ...new Set(summaryEmployees.map((employee) => employee.organizationId)),
    ];
    const monthStartHolidayDate = this.parseHolidayDate(
      this.dateKey(monthStart),
    );
    const monthEndHolidayDate = this.parseHolidayDate(this.dateKey(monthEnd));
    const { holidays, familyRootByOrganization } =
      await this.findApplicableHolidays(
        organizationIds,
        monthStartHolidayDate,
        monthEndHolidayDate,
      );
    const summaryEmployeeIds = summaryEmployees.map((employee) => employee.id);
    const summaryLeavesPromise =
      summaryEmployeeIds.length > 0
        ? this.prisma.leaveRequest.findMany({
            where: {
              employeeId: { in: summaryEmployeeIds },
              deletedAt: null,
              status: 'APPROVED',
              startDate: { lte: monthEnd },
              endDate: { gte: monthStart },
            },
            select: {
              employeeId: true,
              startDate: true,
              endDate: true,
              duration: true,
              requestType: true,
            },
          })
        : Promise.resolve([] as LeaveRequestLite[]);
    const summaryTimesheetsPromise =
      summaryEmployeeIds.length > 0
        ? this.prisma.timesheet.findMany({
            where: {
              employeeId: { in: summaryEmployeeIds },
              date: { gte: monthStart, lt: nextMonthStart },
              source: { not: 'TASK_TIMER' },
              deletedAt: null,
            },
            select: { employeeId: true, date: true, hours: true },
          })
        : Promise.resolve([] as ManualTaskTimesheet[]);
    const [summaryLeaves, manualTimesheets] = await Promise.all([
      summaryLeavesPromise,
      summaryTimesheetsPromise,
    ]);
    const summaryLeaveRequests = summaryLeaves as LeaveRequestLite[];
    const ordinarySummaryLeaves = summaryLeaveRequests.filter(
      (leave) => leave.requestType !== 'WORK_FROM_HOME',
    );
    const corporateHolidayKeys = new Set<string>();
    for (const employee of summaryEmployees) {
      for (const holiday of holidays) {
        if (
          !this.holidayAppliesToOrganization(
            holiday,
            employee.organizationId,
            familyRootByOrganization,
          )
        ) {
          continue;
        }
        for (
          const day = new Date(
            Math.max(holiday.startDate.getTime(), monthStart.getTime()),
          );
          day <= new Date(
            Math.min(holiday.endDate.getTime(), monthEnd.getTime()),
          );
          day.setUTCDate(day.getUTCDate() + 1)
        ) {
          corporateHolidayKeys.add(
            `${employee.organizationId}:${this.dateKey(day)}`,
          );
        }
      }
    }
    const statusForRow = (row: (typeof attendanceRows)[number]) =>
      holidays.some(
        (holiday) =>
          this.holidayAppliesToOrganization(
            holiday,
            row.employee.organizationId,
            familyRootByOrganization,
          ) && this.holidayCoversDay(holiday, row.date),
      )
        ? AttendanceStatus.HOLIDAY
        : row.status;
    const summaryWfhCredits = buildApprovedWorkFromHomeCredits(
      summaryLeaveRequests.map((request) => ({
        ...request,
        employeeId: request.employeeId ?? null,
        requestType: request.requestType ?? 'LEAVE',
        status: 'APPROVED',
      })),
      (employeeId, date) => {
        const employee = summaryEmployeeById.get(employeeId);
        if (!employee || !this.isAttendanceEligible(date, employee.hireDate)) {
          return false;
        }
        const dateKey = this.dateKey(date);
        const attendance = attendanceRows.find(
          (row) =>
            row.employeeId === employeeId && this.dateKey(row.date) === dateKey,
        );
        const shift = resolveShiftForDate(
          employee.shiftAssignments,
          employee.shift,
          attendance?.shift ?? null,
          date,
        );
        return Boolean(
          shift &&
            this.isScheduledWorkday(date, shift) &&
            !corporateHolidayKeys.has(
              `${employee.organizationId}:${dateKey}`,
            ) &&
            !ordinarySummaryLeaves.some(
              (leave) =>
                leave.employeeId === employeeId &&
                this.dateKey(leave.startDate) <= dateKey &&
                this.dateKey(leave.endDate) >= dateKey,
            ),
        );
      },
    );

    const eligibleAttendanceRows = attendanceRows.filter((row) =>
      this.isAttendanceEligible(row.date, row.employee.hireDate),
    );
    const effectiveShiftForRow = (
      row: (typeof eligibleAttendanceRows)[number],
    ) =>
      resolveShiftForDate(
        summaryEmployeeById.get(row.employeeId)?.shiftAssignments,
        summaryEmployeeById.get(row.employeeId)?.shift ?? null,
        row.shift,
        row.date,
      );
    const fixedAttendanceRows = eligibleAttendanceRows.filter(
      (row) => effectiveShiftForRow(row)?.type !== 'FLEXIBLE',
    );
    const summaryNow = new Date();
    const nextMonthKey = this.dateKey(nextMonthStart);
    const flexibleEmployeeRows = await Promise.all(
      summaryEmployees
        .filter((employee) => {
          if (
            employee.hireDate &&
            this.dateKey(employee.hireDate) > this.dateKey(monthEnd)
          ) {
            return false;
          }
          const assignments = employee.shiftAssignments ?? [];
          return assignments.length === 0
            ? employee.shift?.type === 'FLEXIBLE' ||
                attendanceRows.some(
                  (row) =>
                    row.employeeId === employee.id &&
                    row.shift?.type === 'FLEXIBLE',
                )
            : assignments.some(
                (assignment) =>
                  assignment.shift.type === 'FLEXIBLE' &&
                  assignment.effectiveFrom <= monthEnd &&
                  (assignment.effectiveTo === null ||
                    assignment.effectiveTo >= monthStart),
              ) ||
                attendanceRows.some(
                  (row) =>
                    row.employeeId === employee.id &&
                    row.shift?.type === 'FLEXIBLE',
                );
        })
        .map(async (employee) => {
          const timezone = employee.organization?.timezone ?? 'UTC';
          const rangeStart = this.localDateStart(
            this.dateKey(monthStart),
            timezone,
          );
          const rangeEnd = this.localDateStart(nextMonthKey, timezone);
          const measuredEnd = new Date(
            Math.min(summaryNow.getTime(), rangeEnd.getTime()),
          );
          if (measuredEnd <= rangeStart) {
            return { seconds: 0, attendanceCredit: 0 };
          }
          const intervals = await this.getFlexibleTaskIntervals(
            employee.id,
            employee.organizationId,
            rangeStart,
            measuredEnd,
          );
          const attendanceForEmployee = eligibleAttendanceRows.filter(
            (row) => row.employeeId === employee.id,
          );
          const employeeManualTimesheets = manualTimesheets.filter(
            (timesheet) => timesheet.employeeId === employee.id,
          );
          let seconds = 0;
          let attendanceCredit = 0;
          for (
            const day = new Date(monthStart);
            day < nextMonthStart;
            day.setUTCDate(day.getUTCDate() + 1)
          ) {
            if (
              day > new Date(
                Date.UTC(
                  summaryNow.getUTCFullYear(),
                  summaryNow.getUTCMonth(),
                  summaryNow.getUTCDate(),
                ),
              ) ||
              !this.isAttendanceEligible(day, employee.hireDate)
            ) {
              continue;
            }
            const dayKey = this.dateKey(day);
            const attendance = attendanceForEmployee.find(
              (row) => this.dateKey(row.date) === dayKey,
            );
            const shift = resolveShiftForDate(
                employee.shiftAssignments,
                employee.shift,
                attendance?.shift,
                day,
              );
            if (shift?.type !== 'FLEXIBLE') continue;
            if (!this.isScheduledWorkday(day, shift)) continue;
            const orgDayKey = `${employee.organizationId}:${dayKey}`;
            if (corporateHolidayKeys.has(orgDayKey)) continue;
            const leaveForDay = ordinarySummaryLeaves.find(
              (leave) =>
                leave.employeeId === employee.id &&
                leave.startDate.toISOString().slice(0, 10) <= dayKey &&
                leave.endDate.toISOString().slice(0, 10) >= dayKey,
            );
            if (leaveForDay?.duration !== 'HALF_DAY' && leaveForDay) continue;
            const dayStart = this.localDateStart(dayKey, timezone);
            const dayEnd = localMidnightAfterDateInTimezone(dayKey, timezone);
            if (!dayEnd || dayStart >= measuredEnd) continue;
            const daySeconds = this.sumFlexibleCreditedWorkSeconds(
              attendance ? [attendance] : [],
              intervals,
              dayStart,
              new Date(Math.min(dayEnd.getTime(), measuredEnd.getTime())),
              timezone,
              summaryNow,
              employeeManualTimesheets,
            ).seconds;
            seconds += daySeconds;
            const wfhCredit = summaryWfhCredits.get(
              `${employee.id}:${dayKey}`,
            );
            if (wfhCredit !== undefined) {
              if (
                day <= new Date(
                  Date.UTC(
                    summaryNow.getUTCFullYear(),
                    summaryNow.getUTCMonth(),
                    summaryNow.getUTCDate(),
                  ),
                )
              ) {
                attendanceCredit += wfhCredit;
              }
            } else {
              const leaveFraction = leaveForDay ? 0.5 : 0;
              attendanceCredit += Math.min(
                daySeconds / 3600 / 8,
                1 - leaveFraction,
              );
            }
          }
          return { seconds, attendanceCredit };
        }),
    );
    const flexibleWorkedHours =
      flexibleEmployeeRows.reduce((total, row) => total + row.seconds, 0) /
      3600;
    const flexibleDayEquivalents = flexibleWorkedHours / 8;
    const fixedAttendanceCredit = fixedAttendanceRows.reduce((total, row) => {
      const wfhCredit = summaryWfhCredits.get(
        `${row.employeeId}:${this.dateKey(row.date)}`,
      );
      if (wfhCredit !== undefined) {
        return total;
      }
      const status = statusForRow(row);
      if (
        status === AttendanceStatus.LEAVE ||
        status === AttendanceStatus.HOLIDAY ||
        status === AttendanceStatus.WEEKLY_OFF
      ) {
        return total;
      }
      const employee = summaryEmployeeById.get(row.employeeId);
      const shift = resolveShiftForDate(
        employee?.shiftAssignments,
        employee?.shift ?? null,
        row.shift,
        row.date,
      );
      if (!shift || !this.isScheduledWorkday(row.date, shift)) return total;
      const dayKey = this.dateKey(row.date);
      const leaveForDay = ordinarySummaryLeaves.find(
        (leave) =>
          leave.employeeId === row.employeeId &&
          leave.startDate.toISOString().slice(0, 10) <= dayKey &&
          leave.endDate.toISOString().slice(0, 10) >= dayKey,
      );
      if (leaveForDay && leaveForDay.duration !== 'HALF_DAY') return total;
      const maxCredit = leaveForDay ? 0.5 : 1;
      if (status === AttendanceStatus.PRESENT) return total + maxCredit;
      if (status === AttendanceStatus.HALF_DAY) {
        return total + Math.min(0.5, maxCredit);
      }
      return total;
    }, 0);
    const fixedWfhCredit = [...summaryWfhCredits].reduce(
      (total, [key, credit]) => {
        const [employeeIdString, dateKey] = key.split(':');
        const employeeId = Number(employeeIdString);
        const employee = summaryEmployeeById.get(employeeId);
        const date = this.parseHolidayDate(dateKey);
        const shift = employee
          ? resolveShiftForDate(
              employee.shiftAssignments,
              employee.shift,
              attendanceRows.find(
                (row) =>
                  row.employeeId === employeeId &&
                  this.dateKey(row.date) === dateKey,
              )?.shift ?? null,
              date,
            )
          : null;
        const currentDate = new Date(
          Date.UTC(
            summaryNow.getUTCFullYear(),
            summaryNow.getUTCMonth(),
            summaryNow.getUTCDate(),
          ),
        );
        return shift?.type !== 'FLEXIBLE' && date <= currentDate
          ? total + credit
          : total;
      },
      0,
    );
    const flexibleAttendanceCredit = flexibleEmployeeRows.reduce(
      (total, row) => total + row.attendanceCredit,
      0,
    );
    const presentDays = Number(
      (fixedAttendanceCredit + fixedWfhCredit + flexibleAttendanceCredit).toFixed(2),
    );
    const scheduledFixedRows = fixedAttendanceRows.filter((row) => {
      const employee = summaryEmployeeById.get(row.employeeId);
      const shift = resolveShiftForDate(
        employee?.shiftAssignments,
        employee?.shift ?? null,
        row.shift,
        row.date,
      );
      return shift != null && this.isScheduledWorkday(row.date, shift);
    });
    const ordinaryFixedRows = scheduledFixedRows.filter((row) => {
      if (
        summaryWfhCredits.has(`${row.employeeId}:${this.dateKey(row.date)}`)
      ) {
        return false;
      }
      const status = statusForRow(row);
      return (
        status !== AttendanceStatus.LEAVE &&
        status !== AttendanceStatus.HOLIDAY &&
        status !== AttendanceStatus.WEEKLY_OFF
      );
    });
    const absentDays = ordinaryFixedRows.filter(
      (row) => statusForRow(row) === AttendanceStatus.ABSENT,
    ).length;
    const leaveDays = scheduledFixedRows.filter(
      (row) => statusForRow(row) === AttendanceStatus.LEAVE,
    ).length;
    const holidayDays = scheduledFixedRows.filter(
      (row) => statusForRow(row) === AttendanceStatus.HOLIDAY,
    ).length;
    const halfDays = ordinaryFixedRows.filter(
      (row) => statusForRow(row) === AttendanceStatus.HALF_DAY,
    ).length + [...summaryWfhCredits].filter(([key, credit]) => {
      const [employeeIdString, dateKey] = key.split(':');
      const employeeId = Number(employeeIdString);
      const date = this.parseHolidayDate(dateKey);
      const currentDate = new Date(
        Date.UTC(
          summaryNow.getUTCFullYear(),
          summaryNow.getUTCMonth(),
          summaryNow.getUTCDate(),
        ),
      );
      return (
        credit === 0.5 &&
        date <= currentDate
      );
    }).length;
    const lateCount = ordinaryFixedRows.filter(
      (row) => (row.lateMinutes ?? 0) > 0,
    ).length;
    const overtimeHours = Number(
      ordinaryFixedRows
        .reduce((sum: number, row) => sum + (row.overtimeHours ?? 0), 0)
        .toFixed(2),
    );
    const shortfallHours = Number(
      ordinaryFixedRows
        .reduce((sum: number, row) => {
          const sf = (row as { shortfallHours?: number }).shortfallHours;
          if (typeof sf === 'number') return sum + sf;
          const required = row.requiredHours ?? row.shift?.requiredHours ?? 8;
          return sum + Math.max(0, required - (row.workingHours ?? 0));
        }, 0)
        .toFixed(2),
    );
    const summaryCutoff = this.endOfDay(
      new Date(Math.min(monthEnd.getTime(), summaryNow.getTime())),
    );
    const periodAttendanceRows = ordinaryFixedRows.filter(
      (row) => row.date <= summaryCutoff,
    );
    const totalTaskHours = Number(
      eligibleAttendanceRows
        .filter((row) => row.date <= summaryCutoff)
        .reduce((sum, row) => sum + (row.taskHours ?? 0), 0)
        .toFixed(2),
    );
    const totalWorkedHours = Number(
      (
        periodAttendanceRows.reduce((sum: number, row) => {
          if (row.workingHours != null) return sum + row.workingHours;
          if (!row.checkIn) return sum;
          return (
            sum +
            calculateNetWorkingHours(
              row.checkIn,
              row.checkOut ?? summaryNow,
              row.breaks,
            )
          );
        }, 0) +
        flexibleWorkedHours +
        totalTaskHours
      ).toFixed(2),
    );
    let totalWorkingDays = 0;
    let totalExpectedHours = 0;
    const cutoffDate = new Date(
      Math.min(
        monthEnd.getTime(),
        Date.UTC(
          summaryNow.getUTCFullYear(),
          summaryNow.getUTCMonth(),
          summaryNow.getUTCDate(),
        ),
      ),
    );
    for (const employee of summaryEmployees) {
      for (
        const day = new Date(monthStart);
        day <= cutoffDate;
        day.setUTCDate(day.getUTCDate() + 1)
      ) {
        if (!this.isAttendanceEligible(day, employee.hireDate)) continue;
        const dayKey = this.dateKey(day);
        const attendance = eligibleAttendanceRows.find(
          (row) =>
            row.employeeId === employee.id &&
            this.dateKey(row.date) === dayKey,
        );
        const shift = resolveShiftForDate(
          employee.shiftAssignments,
          employee.shift,
          attendance?.shift,
          day,
        );
        if (!shift || !this.isScheduledWorkday(day, shift)) continue;
        if (
          corporateHolidayKeys.has(`${employee.organizationId}:${dayKey}`)
        ) {
          continue;
        }
        const leaveForDay = summaryLeaves.find(
          (leave) =>
            leave.employeeId === employee.id &&
            leave.startDate.toISOString().slice(0, 10) <= dayKey &&
            leave.endDate.toISOString().slice(0, 10) >= dayKey,
        );
        if (leaveForDay && leaveForDay.duration !== 'HALF_DAY') continue;
        const eligibleFraction = leaveForDay ? 0.5 : 1;
        totalWorkingDays += eligibleFraction;
        totalExpectedHours +=
          (shift.type === 'FLEXIBLE'
            ? 8
            : (attendance?.requiredHours ?? shift.requiredHours)) *
          eligibleFraction;
      }
    }

    return {
      presentDays,
      absentDays,
      leaveDays,
      holidayDays,
      halfDays,
      lateCount,
      overtimeHours,
      shortfallHours,
      totalWorkedHours,
      totalTaskHours,
      totalExpectedHours: Number(totalExpectedHours.toFixed(2)),
      totalWorkingDays,
    };
  }

  async getMonthlyReport(query: QueryAttendanceDto, user: AttendanceUser) {
    const targetYear = query.year ?? new Date().getUTCFullYear();
    const targetMonth = query.month
      ? Number(query.month)
      : new Date().getUTCMonth() + 1;
    const monthStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const monthEnd = new Date(
      Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999),
    );

    const scopedEmployeeIds = await this.getScopedEmployeeFilter(
      user,
      query.employeeId,
    );

    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
    const organizationIds = await this.getAttendanceOrganizationIds(user);
    const descendantIds = organizationIds?.filter(
      (id) => id !== buScope.organizationId,
    );
    const employeeWhere =
      organizationIds === null
        ? { deletedAt: null }
        : descendantIds && descendantIds.length > 0
          ? {
              OR: [
                buWhere,
                {
                  organizationId: { in: descendantIds },
                  deletedAt: null,
                },
              ],
            }
          : {
              deletedAt: null,
              ...this.buildOrganizationScope(user),
              ...buWhere,
            };
    const employees = await this.prisma.employee.findMany({
      where: {
        ...employeeWhere,
        ...(scopedEmployeeIds ? { id: { in: scopedEmployeeIds } } : {}),
        ...(query.employeeId ? { id: query.employeeId } : {}),
        ...(query.department
          ? { department: { contains: query.department, mode: 'insensitive' } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        hireDate: true,
        department: true,
        designation: true,
        position: true,
        shift: {
          select: {
            id: true,
            type: true,
            requiredHours: true,
            weeklyHolidayDay: true,
            workingDays: true,
          },
        },
        shiftAssignments: {
          select: {
            effectiveFrom: true,
            effectiveTo: true,
            shift: {
              select: {
                id: true,
                type: true,
                requiredHours: true,
                weeklyHolidayDay: true,
                workingDays: true,
              },
            },
          },
        },
        organization: { select: { id: true, name: true, timezone: true } },
        user: { select: { role: true } },
      },
      orderBy: { name: 'asc' },
    });

    if (employees.length === 0) {
      return {
        month: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
        year: targetYear,
        rows: [],
        total: 0,
      };
    }

    const employeeIds = employees.map((employee) => employee.id);
    const attendanceRows = await this.prisma.attendance.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: monthStart, lte: monthEnd },
        deletedAt: null,
      },
      include: { shift: true, breaks: true },
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    });
    const leaveRequestRows = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        deletedAt: null,
        status: 'APPROVED',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
    });
    const leaveRows = leaveRequestRows.filter(
      (leave) => leave.requestType !== 'WORK_FROM_HOME',
    );
    const manualTimesheets = await this.prisma.timesheet.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: monthStart, lt: new Date(Date.UTC(targetYear, targetMonth, 1)) },
        source: { not: 'TASK_TIMER' },
        deletedAt: null,
      },
      select: { employeeId: true, date: true, hours: true },
    });
    const holidayOrganizationIds = [
      ...new Set(employees.map((employee) => employee.organization.id)),
    ];
    const reportMonthStart = this.parseHolidayDate(this.dateKey(monthStart));
    const reportMonthEnd = this.parseHolidayDate(this.dateKey(monthEnd));
    const { holidays: reportHolidays, familyRootByOrganization } =
      await this.findApplicableHolidays(
        holidayOrganizationIds,
        reportMonthStart,
        reportMonthEnd,
      );
    const corporateHolidayDays: Array<{
      organizationId: number;
      date: Date;
      dateKey: string;
    }> = [];
    for (const organizationId of holidayOrganizationIds) {
      for (const holiday of reportHolidays) {
        if (
          !this.holidayAppliesToOrganization(
            holiday,
            organizationId,
            familyRootByOrganization,
          )
        )
          continue;
        const start = new Date(
          Math.max(holiday.startDate.getTime(), reportMonthStart.getTime()),
        );
        const end = new Date(
          Math.min(holiday.endDate.getTime(), reportMonthEnd.getTime()),
        );
        for (
          const date = new Date(start);
          date <= end;
          date.setUTCDate(date.getUTCDate() + 1)
        ) {
          corporateHolidayDays.push({
            organizationId,
            date: new Date(date),
            dateKey: date.toISOString().slice(0, 10),
          });
        }
      }
    }
    const corporateHolidayKeys = new Set(
      corporateHolidayDays.map(
        (holiday) => `${holiday.organizationId}:${holiday.dateKey}`,
      ),
    );
    const fullLeaveDateKeys = new Set(
      leaveRows.flatMap((leave) => {
        if (leave.duration === 'HALF_DAY') return [];
        const dates: string[] = [];
        const start = this.startOfDay(
          new Date(Math.max(leave.startDate.getTime(), monthStart.getTime())),
        );
        const end = this.startOfDay(
          new Date(Math.min(leave.endDate.getTime(), monthEnd.getTime())),
        );
        for (
          const date = new Date(start);
          date <= end;
          date.setUTCDate(date.getUTCDate() + 1)
        ) {
          dates.push(`${leave.employeeId}:${date.toISOString().slice(0, 10)}`);
        }
        return dates;
      }),
    );
    const grouped = new Map<
      number,
      {
        employeeId: number;
        employeeName: string;
        organization: { id: number; name: string };
        hireDate: string | null;
        department: string | null;
        role: string;
        presentCount: number;
        absentCount: number;
        lateCount: number;
        halfDayCount: number;
        leaveCount: number;
        holidayCount: number;
        weeklyOffCount: number;
        workingDays: number;
        attendancePercent: number;
        totalWorkedHours: number;
        totalExpectedHours: number;
        shortfallHours: number;
        overtimeHours: number;
        isFlexible: boolean;
        workingDayEquivalents: number;
      }
    >();

    for (const employee of employees) {
      grouped.set(employee.id, {
        employeeId: employee.id,
        employeeName: employee.name,
        organization: employee.organization,
        hireDate: employee.hireDate?.toISOString() ?? null,
        department: employee.department ?? null,
        role:
          employee.user?.role ??
          employee.designation ??
          employee.position ??
          'EMPLOYEE',
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        halfDayCount: 0,
        leaveCount: 0,
        holidayCount: corporateHolidayDays.filter(
          (holiday) =>
            holiday.organizationId === employee.organization.id &&
            this.isAttendanceEligible(holiday.date, employee.hireDate),
        ).length,
        weeklyOffCount: 0,
        workingDays: 0,
        attendancePercent: 0,
        totalWorkedHours: 0,
        totalExpectedHours: 0,
        shortfallHours: 0,
        overtimeHours: 0,
        isFlexible:
          ((employee.shiftAssignments ?? []).length === 0 &&
            employee.shift?.type === 'FLEXIBLE') ||
          (employee.shiftAssignments ?? []).some(
            (assignment) =>
              assignment.shift.type === 'FLEXIBLE' &&
              assignment.effectiveFrom <= monthEnd &&
              (assignment.effectiveTo === null ||
                assignment.effectiveTo >= monthStart),
          ) ||
          attendanceRows.some(
            (row) =>
              row.employeeId === employee.id && row.shift?.type === 'FLEXIBLE',
          ),
        workingDayEquivalents: 0,
      });
    }

    const attendanceByEmployeeDate = new Map(
      attendanceRows.map((row) => [
        `${row.employeeId}:${this.dateKey(row.date)}`,
        row,
      ]),
    );
    const reportNow = new Date();
    const cutoffDate = new Date(
      Math.min(
        monthEnd.getTime(),
        Date.UTC(
          reportNow.getUTCFullYear(),
          reportNow.getUTCMonth(),
          reportNow.getUTCDate(),
        ),
      ),
    );
    const reportWfhCredits = buildApprovedWorkFromHomeCredits(
      leaveRequestRows.map((request) => ({
        employeeId: request.employeeId ?? null,
        requestType: request.requestType ?? 'LEAVE',
        status: request.status,
        startDate: request.startDate,
        endDate: request.endDate,
      })),
      (employeeId, date) => {
        const employee = employees.find((item) => item.id === employeeId);
        if (!employee || !this.isAttendanceEligible(date, employee.hireDate)) {
          return false;
        }
        const dateKey = this.dateKey(date);
        const attendance = attendanceByEmployeeDate.get(
          `${employeeId}:${dateKey}`,
        );
        const shift = resolveShiftForDate(
          employee.shiftAssignments,
          employee.shift,
          attendance?.shift,
          date,
        );
        return Boolean(
          shift &&
            this.isScheduledWorkday(date, shift) &&
            !corporateHolidayKeys.has(
              `${employee.organization.id}:${dateKey}`,
            ) &&
            !leaveRows.some(
              (leave) =>
                leave.employeeId === employeeId &&
                this.dateKey(leave.startDate) <= dateKey &&
                this.dateKey(leave.endDate) >= dateKey,
            ),
        );
      },
    );

    for (const row of attendanceRows) {
      const entry = grouped.get(row.employeeId);
      if (!entry) continue;
      const employee = employees.find((item) => item.id === row.employeeId);
      if (
        !employee ||
        !this.isAttendanceEligible(row.date, employee.hireDate)
      ) {
        continue;
      }
      const rowShift = resolveShiftForDate(
        employee.shiftAssignments,
        employee.shift,
        row.shift,
        row.date,
      );
      if (rowShift?.type === 'FLEXIBLE') {
        continue;
      }

      const rowDateKey = this.dateKey(row.date);
      const corporateHolidayKey = `${employee.organization.id}:${rowDateKey}`;
      const leaveForDay = leaveRows.find(
        (leave) =>
          leave.employeeId === employee.id &&
          leave.startDate.toISOString().slice(0, 10) <= rowDateKey &&
          leave.endDate.toISOString().slice(0, 10) >= rowDateKey,
      );
      const wfhCredit = reportWfhCredits.get(
        `${row.employeeId}:${rowDateKey}`,
      );
      const effectiveStatus =
        wfhCredit !== undefined
          ? wfhCredit === 1
            ? AttendanceStatus.PRESENT
            : AttendanceStatus.HALF_DAY
          : leaveForDay && leaveForDay.duration !== 'HALF_DAY'
            ? AttendanceStatus.LEAVE
            : corporateHolidayKeys.has(corporateHolidayKey)
              ? AttendanceStatus.HOLIDAY
              : row.status;
      const matchesStatus =
        query.status === 'LATE'
          ? (row.lateMinutes ?? 0) > 0
          : query.status
            ? effectiveStatus === query.status
            : true;

      if (!matchesStatus) continue;

      if (
        !rowShift ||
        !this.isScheduledWorkday(row.date, rowShift) ||
        effectiveStatus === AttendanceStatus.WEEKLY_OFF
      ) {
        entry.weeklyOffCount += 1;
        continue;
      }

      if (
        effectiveStatus === AttendanceStatus.HOLIDAY ||
        effectiveStatus === AttendanceStatus.LEAVE
      ) {
        continue;
      }

      const availableDayFraction = leaveForDay ? 0.5 : 1;
      const requiredHours = row.requiredHours ?? rowShift?.requiredHours ?? 8;
      entry.overtimeHours += row.overtimeHours ?? 0;
      entry.totalWorkedHours +=
        (row.taskHours ?? 0) + (row.workingHours ?? 0);
      const rowShortfall = (row as { shortfallHours?: number }).shortfallHours;
      if (typeof rowShortfall === 'number') {
        entry.shortfallHours += rowShortfall;
      } else {
        entry.shortfallHours += Math.max(
          0,
          requiredHours - (row.workingHours ?? 0),
        );
      }

      if (effectiveStatus === AttendanceStatus.PRESENT) {
        entry.presentCount += availableDayFraction;
      }
      if (effectiveStatus === AttendanceStatus.ABSENT) entry.absentCount += 1;
      if (effectiveStatus === AttendanceStatus.HALF_DAY) {
        entry.halfDayCount += 1;
        entry.presentCount += Math.min(0.5, availableDayFraction);
      }
      if ((row.lateMinutes ?? 0) > 0) entry.lateCount += 1;
    }

    for (const [key, credit] of reportWfhCredits) {
      const [employeeIdString, dateKey] = key.split(':');
      const employeeId = Number(employeeIdString);
      const entry = grouped.get(employeeId);
      const date = this.parseHolidayDate(dateKey);
      const employee = employees.find((item) => item.id === employeeId);
      if (
        !entry ||
        !employee ||
        date > cutoffDate ||
        attendanceByEmployeeDate.has(key)
      ) {
        continue;
      }
      const shift = resolveShiftForDate(
        employee.shiftAssignments,
        employee.shift,
        null,
        date,
      );
      if (shift?.type === 'FLEXIBLE') continue;
      const wfhStatus =
        credit === 1 ? AttendanceStatus.PRESENT : AttendanceStatus.HALF_DAY;
      if (
        query.status &&
        (query.status === 'LATE' || query.status !== wfhStatus)
      ) {
        continue;
      }
      entry.presentCount += credit;
      if (credit === 0.5) entry.halfDayCount += 1;
    }

    for (const leave of leaveRows) {
      if (leave.employeeId == null) continue;
      const employee = grouped.get(leave.employeeId);
      if (!employee) continue;
      const employeeRecord = employees.find(
        (item) => item.id === leave.employeeId,
      );
      const start = this.startOfDay(
        new Date(
          Math.max(
            leave.startDate.getTime(),
            monthStart.getTime(),
            employeeRecord?.hireDate?.getTime() ?? monthStart.getTime(),
          ),
        ),
      );
      const end = this.startOfDay(
        new Date(Math.min(leave.endDate.getTime(), cutoffDate.getTime())),
      );
      for (
        const date = new Date(start);
        date <= end;
        date.setUTCDate(date.getUTCDate() + 1)
      ) {
        const dateKey = this.dateKey(date);
        const attendance = attendanceByEmployeeDate.get(
          `${leave.employeeId}:${dateKey}`,
        );
        const shift = employeeRecord
          ? resolveShiftForDate(
              employeeRecord.shiftAssignments,
              employeeRecord.shift,
              attendance?.shift,
              date,
            )
          : null;
        if (
          !shift ||
          !this.isScheduledWorkday(date, shift) ||
          corporateHolidayKeys.has(
            `${employeeRecord?.organization.id}:${dateKey}`,
          )
        ) {
          continue;
        }
        employee.leaveCount += leave.duration === 'HALF_DAY' ? 0.5 : 1;
      }
    }

    for (const employeeRecord of employees) {
      const entry = grouped.get(employeeRecord.id);
      if (!entry) continue;
      for (
        const date = new Date(monthStart);
        date <= cutoffDate;
        date.setUTCDate(date.getUTCDate() + 1)
      ) {
        if (!this.isAttendanceEligible(date, employeeRecord.hireDate)) continue;
        const dateKey = this.dateKey(date);
        const attendance = attendanceByEmployeeDate.get(
          `${employeeRecord.id}:${dateKey}`,
        );
        const shift = resolveShiftForDate(
          employeeRecord.shiftAssignments,
          employeeRecord.shift,
          attendance?.shift,
          date,
        );
        if (!shift || !this.isScheduledWorkday(date, shift)) continue;
        if (
          corporateHolidayKeys.has(
            `${employeeRecord.organization.id}:${dateKey}`,
          )
        ) {
          continue;
        }
        const leaveForDay = leaveRows.find(
          (leave) =>
            leave.employeeId === employeeRecord.id &&
            leave.startDate.toISOString().slice(0, 10) <= dateKey &&
            leave.endDate.toISOString().slice(0, 10) >= dateKey,
        );
        if (leaveForDay && leaveForDay.duration !== 'HALF_DAY') continue;
        const eligibleFraction = leaveForDay ? 0.5 : 1;
        entry.workingDays += eligibleFraction;
        entry.totalExpectedHours +=
          (shift.type === 'FLEXIBLE'
            ? 8
            : (attendance?.requiredHours ?? shift.requiredHours)) *
          eligibleFraction;
      }
    }

    const flexibleEmployees = employees.filter((employee) => {
      const assignmentHasFlexible = (employee.shiftAssignments ?? []).some(
        (assignment) =>
          assignment.shift.type === 'FLEXIBLE' &&
          assignment.effectiveFrom <= monthEnd &&
          (assignment.effectiveTo === null ||
            assignment.effectiveTo >= monthStart),
      );
      return (
        ((employee.shiftAssignments ?? []).length === 0 &&
          employee.shift?.type === 'FLEXIBLE') ||
        assignmentHasFlexible ||
        attendanceRows.some(
          (row) =>
            row.employeeId === employee.id && row.shift?.type === 'FLEXIBLE',
        )
      );
    });
    const reportMonthStartKey = this.dateKey(monthStart);
    const nextMonth = new Date(Date.UTC(targetYear, targetMonth, 1));
    const nextMonthKey = this.dateKey(nextMonth);
    const now = reportNow;
    await Promise.all(
      flexibleEmployees.map(async (employee) => {
        if (
          query.status &&
          query.status !== AttendanceStatus.PRESENT &&
          query.status !== AttendanceStatus.HALF_DAY
        ) {
          return;
        }
        if (
          employee.hireDate &&
          this.dateKey(employee.hireDate) > this.dateKey(monthEnd)
        ) {
          return;
        }
        const timezone = employee.organization.timezone ?? 'UTC';
        const hireDateKey =
          employee.hireDate?.toISOString().slice(0, 10) ?? reportMonthStartKey;
        const employeeMonthStartKey =
          hireDateKey > reportMonthStartKey ? hireDateKey : reportMonthStartKey;
        const rangeStart = localMidnightAtDateInTimezone(
          employeeMonthStartKey,
          timezone,
        );
        const rangeEnd = localMidnightAtDateInTimezone(nextMonthKey, timezone);
        if (!rangeStart || !rangeEnd) {
          throw new BadRequestException(
            'Unable to calculate flexible monthly work time in organization timezone',
          );
        }
        const measuredEnd = new Date(
          Math.min(now.getTime(), rangeEnd.getTime()),
        );
        if (measuredEnd <= rangeStart) return;
        const intervals = await this.getFlexibleTaskIntervals(
          employee.id,
          employee.organization.id,
          rangeStart,
          measuredEnd,
        );
        const attendanceForEmployee = attendanceRows.filter(
          (row) => row.employeeId === employee.id,
        );
        const employeeTimesheets = manualTimesheets.filter(
          (timesheet) => timesheet.employeeId === employee.id,
        );
        for (
          const day = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
          day <= cutoffDate;
          day.setUTCDate(day.getUTCDate() + 1)
        ) {
          if (!this.isAttendanceEligible(day, employee.hireDate)) continue;
          const dayKey = this.dateKey(day);
          const attendance = attendanceForEmployee.find(
            (row) => this.dateKey(row.date) === dayKey,
          );
          const effectiveShift = resolveShiftForDate(
            employee.shiftAssignments,
            employee.shift,
            attendance?.shift,
            day,
          );
          if (effectiveShift?.type !== 'FLEXIBLE') continue;
          if (!this.isScheduledWorkday(day, effectiveShift)) continue;
          if (
            corporateHolidayKeys.has(
              `${employee.organization.id}:${dayKey}`,
            )
          ) {
            continue;
          }
          const leaveForDay = leaveRows.find(
            (leave) =>
              leave.employeeId === employee.id &&
              leave.startDate.toISOString().slice(0, 10) <= dayKey &&
              leave.endDate.toISOString().slice(0, 10) >= dayKey,
          );
          if (leaveForDay && leaveForDay.duration !== 'HALF_DAY') continue;
          const eligibleFraction = leaveForDay ? 0.5 : 1;
          const dayStart = this.localDateStart(dayKey, timezone);
          const dayEnd = localMidnightAfterDateInTimezone(dayKey, timezone);
          if (!dayEnd || dayStart >= measuredEnd) continue;
          const daySeconds = this.sumFlexibleCreditedWorkSeconds(
            attendance ? [attendance] : [],
            intervals,
            dayStart,
            new Date(Math.min(dayEnd.getTime(), measuredEnd.getTime())),
            timezone,
            now,
            employeeTimesheets,
          ).seconds;
          const dayHours = daySeconds / 3600;
          const entry = grouped.get(employee.id);
          if (!entry) continue;
          entry.workingDayEquivalents += dayHours / 8;
          const wfhCredit = reportWfhCredits.get(
            `${employee.id}:${dayKey}`,
          );
          if (wfhCredit !== undefined) {
            if (
              !query.status ||
              query.status ===
                (wfhCredit === 1
                  ? AttendanceStatus.PRESENT
                  : AttendanceStatus.HALF_DAY)
            ) {
              entry.presentCount += wfhCredit;
              if (wfhCredit === 0.5) entry.halfDayCount += 1;
            }
          } else if (
            !query.status ||
            query.status === AttendanceStatus.PRESENT
          ) {
            entry.presentCount += Math.min(dayHours / 8, eligibleFraction);
          }
          const legacyTaskHours =
            dayKey < this.flexibleTaskTimeCutoverDate()
              ? (attendance?.taskHours ?? 0)
              : 0;
          entry.totalWorkedHours += dayHours + legacyTaskHours;
        }
        const entry = grouped.get(employee.id);
        if (!entry) return;
        entry.workingDayEquivalents = Number(
          entry.workingDayEquivalents.toFixed(2),
        );
      }),
    );

    const rows = Array.from(grouped.values()).map((entry) => ({
      ...entry,
      presentCount: Number(entry.presentCount.toFixed(2)),
      overtimeHours: Number(entry.overtimeHours.toFixed(2)),
      shortfallHours: Number(entry.shortfallHours.toFixed(2)),
      totalWorkedHours: Number(entry.totalWorkedHours.toFixed(2)),
      totalExpectedHours: Number(entry.totalExpectedHours.toFixed(2)),
      attendancePercent:
        entry.workingDays > 0
          ? Number(
              (
                (Math.min(entry.presentCount, entry.workingDays) /
                  entry.workingDays) *
                100
              ).toFixed(2),
            )
          : 0,
    }));

    return {
      month: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
      year: targetYear,
      rows,
      total: rows.length,
    };
  }

  async update(id: number, dto: UpdateAttendanceDto, user: AttendanceUser) {
    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
    const record = await this.prisma.attendance.findFirst({
      where: {
        id,
        ...this.buildOrganizationScope(user),
        employee: buWhere,
      },
      include: {
        employee: { include: { shift: true } },
        shift: true,
        breaks: true,
      },
    });

    if (!record) {
      throw new NotFoundException(`Attendance #${id} not found`);
    }

    const nextDate = dto.date
      ? attendanceDateFromKey(dto.date.slice(0, 10))
      : new Date(record.date);
    const attendanceDateShiftMs =
      nextDate.getTime() - new Date(record.date).getTime();
    this.assertAttendanceEligible(nextDate, record.employee.hireDate);

    if (nextDate.getTime() !== new Date(record.date).getTime()) {
      const duplicate = await this.prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: record.employeeId,
            date: nextDate,
          },
        },
      });

      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          'Attendance already exists for this employee on the selected date',
        );
      }
    }

    const checkIn =
      dto.checkIn !== undefined
        ? dto.checkIn
          ? new Date(dto.checkIn)
          : null
        : record.checkIn;
    const checkOut =
      dto.checkOut !== undefined
        ? dto.checkOut
          ? new Date(dto.checkOut)
          : null
        : record.checkOut;
    const checkoutChanged =
      dto.checkOut !== undefined &&
      checkOut?.getTime() !== record.checkOut?.getTime();

    if (checkOut && !checkIn) {
      throw new BadRequestException('Check-in is required before check-out');
    }

    if (checkIn && checkOut && checkOut.getTime() < checkIn.getTime()) {
      throw new BadRequestException(
        'Check-out time cannot be earlier than check-in time',
      );
    }

    const breaks =
      dto.breaks !== undefined
        ? dto.breaks.map((interval) => ({
            startedAt: new Date(interval.startedAt),
            endedAt: interval.endedAt ? new Date(interval.endedAt) : null,
          }))
        : attendanceDateShiftMs !== 0
          ? record.breaks.map((interval) => ({
              startedAt: new Date(
                interval.startedAt.getTime() + attendanceDateShiftMs,
              ),
              endedAt: interval.endedAt
                ? new Date(interval.endedAt.getTime() + attendanceDateShiftMs)
                : null,
            }))
          : record.breaks;
    const orderedBreaks = [...breaks].sort(
      (left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
    );
    let previousBreakEnd = checkIn?.getTime() ?? Number.NEGATIVE_INFINITY;
    let hasOpenBreak = false;

    for (const [index, interval] of orderedBreaks.entries()) {
      const start = interval.startedAt.getTime();
      const end = interval.endedAt?.getTime() ?? null;
      if (!Number.isFinite(start) || (end !== null && !Number.isFinite(end))) {
        throw new BadRequestException('Break times must be valid dates');
      }
      if (!checkIn || start < checkIn.getTime()) {
        throw new BadRequestException('Breaks must start at or after check-in');
      }
      if (end !== null && end <= start) {
        throw new BadRequestException('Break end must be after its start');
      }
      if (start < previousBreakEnd) {
        throw new BadRequestException('Break intervals cannot overlap');
      }
      if (
        checkOut &&
        (start >= checkOut.getTime() ||
          (end !== null && end > checkOut.getTime()))
      ) {
        throw new BadRequestException(
          'Breaks must fall within check-in and check-out',
        );
      }
      if (end === null) {
        if (checkOut || hasOpenBreak || index !== orderedBreaks.length - 1) {
          throw new BadRequestException(
            'Only the latest active attendance may have an open break',
          );
        }
        hasOpenBreak = true;
        previousBreakEnd = Number.POSITIVE_INFINITY;
      } else {
        previousBreakEnd = end;
      }
    }

    const shift = (record.shift ??
      record.employee?.shift ??
      null) as ShiftLite | null;
    const organization = await this.prisma.organization.findUnique({
      where: { id: record.organizationId },
      select: { timezone: true },
    });
    const timezone = organization?.timezone ?? 'UTC';

    const workingHours =
      checkIn && checkOut
        ? this.calculateWorkingHours(checkIn, checkOut, orderedBreaks)
        : null;
    const halfDayLeave = await this.findApprovedLeaveForDay(
      record.employeeId,
      nextDate,
      'HALF_DAY',
    );
    const overtimeHours =
      workingHours != null
        ? this.calculateOvertimeHours(workingHours, shift)
        : 0;
    const shortfallHours = this.calculateShortfallHours(
      workingHours,
      shift,
      halfDayLeave ? 5 : undefined,
    );
    const lateMinutes = checkIn
      ? this.calculateLateMinutes(
          checkIn,
          dto.date?.slice(0, 10) ?? nextDate.toISOString().slice(0, 10),
          shift,
          timezone,
        )
      : 0;

    const leave = await this.findApprovedLeaveForDay(
      record.employeeId,
      nextDate,
    );
    const status =
      dto.status ??
      this.calculateStatus({
        day: nextDate,
        checkIn,
        checkOut,
        workingHours,
        onLeave: Boolean(leave),
        shift,
        lateMinutes,
        timezone,
      });

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.breaks !== undefined || attendanceDateShiftMs !== 0) {
        await tx.attendanceBreak.deleteMany({ where: { attendanceId: id } });
        if (orderedBreaks.length > 0) {
          await tx.attendanceBreak.createMany({
            data: orderedBreaks.map((interval) => ({
              attendanceId: id,
              startedAt: interval.startedAt,
              endedAt: interval.endedAt,
            })),
          });
        }
      }

      return tx.attendance.update({
        where: { id, organizationId: record.organizationId },
        data: {
          date: nextDate,
          checkIn,
          checkOut,
          ...(checkoutChanged
            ? {
                checkoutSource: checkOut
                  ? AttendanceCheckoutSource.ADMIN_EDIT
                  : null,
                checkoutActorId: checkOut ? user.userId : null,
                isAutoClosed: false,
              }
            : {}),
          workingHours,
          overtimeHours,
          shortfallHours,
          lateMinutes,
          status,
          isPaidLeave: leave ? Boolean(leave.isPaid ?? true) : null,
        },
        include: { employee: true, shift: true, breaks: true },
      });
    });
    await this.invalidateDashboardCache();
    return updated;
  }

  private async closeOverdueAttendances() {
    const openAttendances =
      (await this.prisma.attendance.findMany({
        where: { checkIn: { not: null }, checkOut: null, deletedAt: null },
        include: {
          breaks: true,
          shift: true,
          employee: {
            include: {
              shift: true,
              organization: { select: { timezone: true } },
            },
          },
        },
      })) ?? [];
    const now = new Date();

    for (const attendance of openAttendances) {
      if (!attendance.checkIn || !attendance.employee) continue;
      const shift = attendance.shift ?? attendance.employee.shift;
      const timezone = attendance.employee.organization?.timezone ?? 'UTC';
      const dateKey = new Date(attendance.date).toISOString().slice(0, 10);
      if (dateKeyInTimezone(now, timezone) <= dateKey) continue;

      const checkOut = localMidnightAfterDateInTimezone(dateKey, timezone);
      if (!checkOut || checkOut.getTime() < attendance.checkIn.getTime()) {
        continue;
      }
      if (checkOut.getTime() > now.getTime()) continue;

      const breaks = attendance.breaks ?? [];
      const openBreak = breaks.find((interval) => interval.endedAt === null);
      const breakIntervals = breaks.map((interval) => ({
        startedAt: interval.startedAt,
        endedAt: interval.endedAt ?? (openBreak ? checkOut : null),
      }));
      const workingHours = this.calculateWorkingHours(
        attendance.checkIn,
        checkOut,
        breakIntervals,
      );
      const halfDayLeave = await this.findApprovedLeaveForDay(
        attendance.employeeId,
        attendance.date,
        'HALF_DAY',
      );
      const overtimeHours = this.calculateOvertimeHours(workingHours, shift);
      const shortfallHours = this.calculateShortfallHours(
        workingHours,
        shift,
        halfDayLeave ? 5 : undefined,
      );
      const lateMinutes = attendance.lateMinutes ?? 0;

      await this.prisma.$transaction(async (tx) => {
        if (openBreak) {
          await tx.attendanceBreak.update({
            where: { id: openBreak.id },
            data: { endedAt: checkOut },
          });
        }
        if (shift?.type !== 'FLEXIBLE') {
          await this.tasksService.stopActiveTimerForEmployee(
            attendance.employeeId,
            attendance.organizationId,
            checkOut,
            tx,
          );
        }
        await tx.attendance.update({
          where: { id: attendance.id },
          data: {
            checkOut,
            checkoutSource: AttendanceCheckoutSource.AUTO,
            checkoutActorId: null,
            workingHours,
            overtimeHours,
            shortfallHours,
            isAutoClosed: true,
            status: this.calculateStatus({
              day: this.startOfDay(new Date(attendance.date)),
              checkIn: attendance.checkIn,
              checkOut,
              workingHours,
              onLeave: false,
              shift,
              lateMinutes,
              timezone,
            }),
          },
        });
      });
    }
  }

  async runAutoCheckoutAutomation() {
    await this.closeOverdueAttendances();
    await this.invalidateDashboardCache();
    return { processedAt: new Date().toISOString() };
  }

  async runDailyAutomation() {
    await this.closeOverdueAttendances();
    const now = new Date();
    const employees = await this.prisma.employee.findMany({
      include: {
        shift: true,
        shiftAssignments: { include: { shift: true } },
        organization: { select: { timezone: true } },
      },
    });
    const targetByEmployee = new Map<number, { day: Date; key: string }>();
    for (const employee of employees) {
      const timezone = employee.organization?.timezone ?? 'UTC';
      const today = attendanceDateFromKey(dateKeyInTimezone(now, timezone));
      today.setUTCDate(today.getUTCDate() - 1);
      const key = today.toISOString().slice(0, 10);
      targetByEmployee.set(employee.id, {
        day: today,
        key,
      });
    }
    const targetByOrganization = new Map<number, string>();
    for (const employee of employees) {
      const target = targetByEmployee.get(employee.id);
      if (target) targetByOrganization.set(employee.organizationId, target.key);
    }
    if (
      targetByOrganization.size > 0 &&
      [...targetByOrganization].every(
        ([organizationId, key]) =>
          this.lastAutomationDateByOrganization.get(organizationId) === key,
      )
    ) {
      return {
        processedDate: [...targetByEmployee.values()][0]?.key ?? null,
        alreadyProcessed: true,
      };
    }

    const organizationIds = [
      ...new Set(employees.map((employee) => employee.organizationId)),
    ];
    const targetKeys = [...targetByEmployee.values()].map(
      (target) => target.key,
    );
    targetKeys.sort();
    const startKey = targetKeys[0];
    const endKey = targetKeys[targetKeys.length - 1];
    if (!startKey || !endKey) {
      return { processedDate: null, alreadyProcessed: true };
    }
    const { holidays: holidayRows, familyRootByOrganization } =
      await this.findApplicableHolidays(
        organizationIds,
        this.parseHolidayDate(startKey),
        this.parseHolidayDate(endKey),
      );

    for (const employee of employees) {
      const targetInfo = targetByEmployee.get(employee.id);
      if (!targetInfo) continue;
      const target = targetInfo.day;
      if (
        this.lastAutomationDateByOrganization.get(employee.organizationId) ===
        targetInfo.key
      ) {
        continue;
      }
      if (!this.isAttendanceEligible(target, employee.hireDate)) {
        continue;
      }
      const shift = this.employeeShiftForDay(
        employee.shiftAssignments,
        employee.shift,
        target,
      );
      if (!shift) {
        continue;
      }
      const isCorporateHoliday = holidayRows.some(
        (holiday) =>
          this.holidayAppliesToOrganization(
            holiday,
            employee.organizationId,
            familyRootByOrganization,
          ) && this.holidayCoversDay(holiday, target),
      );

      const leave = await this.findApprovedLeaveForDay(employee.id, target);
      const shootAssignment = await this.prisma.taskCrewAssignment.findFirst({
        where: {
          user: { employeeId: employee.id },
          task: {
            taskType: 'SHOOT',
            shootDate: target,
            deletedAt: null,
          },
        },
        select: { id: true },
      });
      const shootCreditEligible = Boolean(
        shootAssignment &&
        !leave &&
        !isCorporateHoliday &&
        !this.isWeeklyHoliday(target, shift),
      );

      if (shift.type === 'FLEXIBLE') continue;

      const existing = await this.prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: target,
          },
        },
        create: {
          organizationId: employee.organizationId,
          employeeId: employee.id,
          shiftId: shift.id,
          date: target,
          status: leave
            ? AttendanceStatus.LEAVE
            : isCorporateHoliday
              ? AttendanceStatus.HOLIDAY
              : this.isWeeklyHoliday(target, shift)
                ? AttendanceStatus.WEEKLY_OFF
                : shootCreditEligible
                  ? AttendanceStatus.PRESENT
                  : AttendanceStatus.ABSENT,
          requiredHours: shift.requiredHours,
          isPaidLeave: leave ? Boolean(leave.isPaid ?? true) : null,
          isShootDay: shootCreditEligible,
        },
        update: {},
        include: { shift: true, breaks: true },
      });

      if (existing.status === AttendanceStatus.LEAVE || leave) {
        continue;
      }

      if (
        shootCreditEligible &&
        (existing.status === AttendanceStatus.ABSENT ||
          existing.status === AttendanceStatus.UPCOMING ||
          existing.status === AttendanceStatus.NOT_STARTED ||
          existing.status === AttendanceStatus.NOT_SCHEDULED) &&
        !existing.checkIn &&
        !existing.checkOut
      ) {
        await this.prisma.attendance.update({
          where: { id: existing.id },
          data: {
            status: AttendanceStatus.PRESENT,
            isShootDay: true,
            remarks: existing.remarks ?? 'Shoot day credit',
          },
        });
      }

      if (isCorporateHoliday && !existing.checkIn) {
        if (existing.status !== AttendanceStatus.HOLIDAY) {
          await this.prisma.attendance.update({
            where: { id: existing.id },
            data: { status: AttendanceStatus.HOLIDAY },
          });
        }
        continue;
      }

      if (
        this.isWeeklyHoliday(target, shift) &&
        existing.status !== AttendanceStatus.WEEKLY_OFF
      ) {
        await this.prisma.attendance.update({
          where: { id: existing.id },
          data: { status: AttendanceStatus.WEEKLY_OFF },
        });
        continue;
      }
    }

    for (const [organizationId, key] of targetByOrganization) {
      this.lastAutomationDateByOrganization.set(organizationId, key);
    }
    await this.invalidateDashboardCache();
    return {
      processedDate: endKey,
      alreadyProcessed: false,
    };
  }
}
