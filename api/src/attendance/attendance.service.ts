import {
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AttendanceStatus } from '@prisma/client';
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
} from './attendance-time.utils';
import { calculateNetWorkingHours } from './attendance-work-time.utils';

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
  workingHours: number | null;
  breaks: { startedAt: string; endedAt: string | null }[];
  breakHours: number;
  onBreak: boolean;
  shortfallHours: number;
  lateMinutes: number;
  overtimeHours: number;
  status: AttendanceStatus;
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

@Injectable()
export class AttendanceService implements OnModuleInit, OnModuleDestroy {
  private automationTimer: ReturnType<typeof setInterval> | null = null;
  private lastAutomationKey: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly businessUnitsService: BusinessUnitsService,
    private readonly organizationScopeService: OrganizationScopeService,
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
    // Run once on boot and then hourly; each date is processed only once.
    this.runDailyAutomation().catch(() => {
      return;
    });
    this.automationTimer = setInterval(
      () => {
        this.runDailyAutomation().catch(() => {
          return;
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
    day.setHours(0, 0, 0, 0);
    return day;
  }

  private endOfDay(date: Date) {
    const day = this.startOfDay(date);
    day.setDate(day.getDate() + 1);
    day.setMilliseconds(day.getMilliseconds() - 1);
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

  private parseTargetDay(date?: string, fallback?: Date) {
    return this.startOfDay(date ? new Date(date) : (fallback ?? new Date()));
  }

  private parseShiftTime(day: Date, time: string | null | undefined) {
    if (!time) return null;
    const parts = time.split(':');
    const hour = Number(parts[0]);
    const minute = Number(parts[1] ?? 0);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

    const parsed = new Date(day);
    parsed.setHours(hour, minute, 0, 0);
    return parsed;
  }

  private getShiftWindow(day: Date, shift: ShiftLite | null) {
    if (!shift) {
      return { shiftStart: null as Date | null, shiftEnd: null as Date | null };
    }

    const shiftStart = this.parseShiftTime(day, shift.startTime);
    let shiftEnd = this.parseShiftTime(day, shift.endTime);

    if (shiftStart && shiftEnd && shiftEnd.getTime() <= shiftStart.getTime()) {
      // Night shift that crosses midnight.
      shiftEnd = new Date(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    if (!shiftEnd && shiftStart) {
      shiftEnd = new Date(
        shiftStart.getTime() + shift.requiredHours * 60 * 60 * 1000,
      );
    }

    return { shiftStart, shiftEnd };
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
  ) {
    if (workingHours == null) return 0;
    const requiredHours = shift?.requiredHours ?? 8;
    return Number(Math.max(0, requiredHours - workingHours).toFixed(2));
  }

  private isWeeklyHoliday(day: Date, shift: ShiftLite | null | undefined) {
    return Boolean(shift && !this.isScheduledWorkday(day, shift));
  }

  private isScheduledWorkday(day: Date, shift: ShiftLite) {
    const workingDays =
      shift.workingDays ??
      [0, 1, 2, 3, 4, 5, 6].filter(
        (weekday) => weekday !== shift.weeklyHolidayDay,
      );
    return workingDays.includes(day.getDay());
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
        acc.totalWorkedHours += row.workingHours ?? 0;
        const requiredHours = row.shiftDetails?.requiredHours ?? 8;
        if (
          row.status === AttendanceStatus.PRESENT ||
          row.status === AttendanceStatus.HALF_DAY
        ) {
          acc.totalExpectedHours +=
            row.status === AttendanceStatus.HALF_DAY
              ? requiredHours / 2
              : requiredHours;
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
      totalWorkingDays: rows.filter(
        (row) =>
          row.status !== AttendanceStatus.WEEKLY_OFF &&
          row.status !== AttendanceStatus.HOLIDAY,
      ).length,
      overtimeHours: Number(summary.overtimeHours.toFixed(2)),
      shortfallHours: Number(summary.shortfallHours.toFixed(2)),
      totalWorkedHours: Number(summary.totalWorkedHours.toFixed(2)),
      totalExpectedHours: Number(summary.totalExpectedHours.toFixed(2)),
    };
  }

  private calculateStatus(params: {
    day: Date;
    checkIn: Date | null;
    checkOut: Date | null;
    workingHours: number | null;
    onLeave: boolean;
    shift?: ShiftLite | null;
    lateMinutes?: number;
  }) {
    const {
      day,
      checkIn,
      checkOut,
      workingHours,
      onLeave,
      shift,
      lateMinutes: _lateMinutes = 0,
    } = params;
    if (onLeave) return AttendanceStatus.LEAVE;

    // Check if today is the weekly holiday
    if (this.isWeeklyHoliday(day, shift)) return AttendanceStatus.WEEKLY_OFF;

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

    const today = this.startOfDay(new Date());
    const targetDay = this.startOfDay(day);
    if (targetDay.getTime() > today.getTime()) {
      return AttendanceStatus.UPCOMING;
    }
    if (targetDay.getTime() === today.getTime()) {
      const { shiftEnd } = this.getShiftWindow(day, shift);
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
      include: { shift: true },
    });

    if (!employee)
      throw new NotFoundException(`Employee #${employeeId} not found`);
    return employee;
  }

  private async findApprovedLeaveForDay(employeeId: number, day: Date) {
    return await this.prisma.leaveRequest.findFirst({
      where: {
        deletedAt: null,
        employeeId,
        status: 'APPROVED',
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
      organization?: { id: number; name: string };
      shift: ShiftLite | null;
    },
    day: Date,
    attendance:
      | ({
          id: number;
          checkIn: Date | null;
          checkOut: Date | null;
          workingHours: number | null;
          breaks?: { startedAt: Date; endedAt: Date | null }[];
          lateMinutes: number;
          overtimeHours: number;
          shortfallHours: number;
          status: AttendanceStatus;
          shift?: ShiftLite | null;
        } & { shortfallHours?: number })
      | null,
    onLeave: boolean,
    holidayName?: string | null,
  ): DailyAttendanceRow {
    const shift = attendance?.shift ?? employee.shift ?? null;
    const computedStatus = onLeave
      ? AttendanceStatus.LEAVE
      : holidayName && !attendance?.checkIn
        ? AttendanceStatus.HOLIDAY
        : (attendance?.status ??
          this.calculateStatus({
            day,
            checkIn: null,
            checkOut: null,
            workingHours: null,
            onLeave,
            shift,
          }));
    const shortfallHours =
      (attendance as { shortfallHours?: number })?.shortfallHours ??
      this.calculateShortfallHours(attendance?.workingHours ?? null, shift);

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
      workingHours:
        attendance?.workingHours ??
        (attendance?.checkIn
          ? calculateNetWorkingHours(
              attendance.checkIn,
              new Date(),
              attendance.breaks ?? [],
            )
          : null),
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
      status: computedStatus,
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
        rotationPattern: dto.rotationPattern,
        organizationId: user.organizationId,
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
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
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
    return this.prisma.shift.findMany({
      where: { isActive: true, organizationId: user.organizationId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async assignShift(dto: AssignShiftDto, user: AttendanceUser) {
    const shift = await this.prisma.shift.findFirst({
      where: { id: dto.shiftId, organizationId: user.organizationId },
    });
    if (!shift || !shift.isActive) {
      throw new NotFoundException('Shift not found');
    }

    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employeeId,
        organizationId: user.organizationId,
        ...buWhere,
      },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const result = await this.prisma.employee.update({
      where: { id: dto.employeeId, organizationId: user.organizationId },
      data: { shiftId: dto.shiftId },
      include: { shift: true },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async updateShift(id: number, dto: UpdateShiftDto, user: AttendanceUser) {
    // First verify the shift belongs to this organization
    const shift = await this.prisma.shift.findFirst({
      where: { id, organizationId: user.organizationId },
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
    if (dto.rotationPattern !== undefined)
      updateData.rotationPattern = dto.rotationPattern;

    const result = await this.prisma.shift.update({
      where: { id },
      data: updateData,
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async deleteShift(id: number, user: AttendanceUser) {
    // First verify the shift belongs to this organization
    const shift = await this.prisma.shift.findFirst({
      where: { id, organizationId: user.organizationId },
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

    const checkInTime = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const organizationId = employee.organizationId ?? user.organizationId;
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const timezone = organization?.timezone ?? 'UTC';
    const dateKey = dto.date
      ? dto.date.slice(0, 10)
      : dateKeyInTimezone(checkInTime, timezone);
    const day = attendanceDateFromKey(dateKey);
    this.assertAttendanceEligible(day, employee.hireDate);

    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: day } },
      include: { shift: true },
    });

    if (existing?.checkIn) {
      throw new ConflictException('Employee has already checked in today');
    }

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
        organizationId: user.organizationId,
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

    const checkOutTime = dto.timestamp ? new Date(dto.timestamp) : new Date();
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
      const day = this.parseTargetDay(dto.date, checkOutTime);
      record = await this.prisma.attendance.findUnique({
        where: { employeeId_date: { employeeId, date: day } },
        include: { shift: true, breaks: true },
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
      await this.prisma.attendanceBreak.update({
        where: { id: openBreak.id },
        data: { endedAt: checkOutTime },
      });
      openBreak.endedAt = checkOutTime;
    }
    const workingHours = calculateNetWorkingHours(
      new Date(record.checkIn),
      checkOutTime,
      breakIntervals,
    );
    const overtimeHours = this.calculateOvertimeHours(workingHours, shift);
    const shortfallHours = this.calculateShortfallHours(workingHours, shift);
    const lateMinutes = (record as any).lateMinutes ?? 0;

    const status = this.calculateStatus({
      day: this.startOfDay(new Date(record.date)),
      checkIn: new Date(record.checkIn),
      checkOut: checkOutTime,
      workingHours,
      onLeave: false,
      shift,
      lateMinutes,
    });

    const result = await this.prisma.attendance.update({
      where: { id: record.id },
      data: {
        checkOut: checkOutTime,
        workingHours,
        overtimeHours,
        shortfallHours,
        status,
      },
      include: { employee: true, shift: true },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async startBreak(user: AttendanceUser) {
    const employeeId = await this.resolveScopedEmployeeId(user);
    const record = await this.prisma.attendance.findFirst({
      where: { employeeId, checkIn: { not: null }, checkOut: null },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { breaks: true },
    });
    if (!record)
      throw new BadRequestException('Check in before starting a break');
    if (record.checkIn && new Date(record.checkIn).getTime() > Date.now()) {
      throw new BadRequestException('A break cannot start before check-in');
    }
    if (record.breaks.some((interval) => interval.endedAt === null)) {
      throw new ConflictException('A break is already in progress');
    }
    const startedAt = new Date();
    const created = await this.prisma.attendanceBreak.create({
      data: { attendanceId: record.id, startedAt },
    });
    await this.invalidateDashboardCache();
    return { break: created, onBreak: true };
  }

  async stopBreak(user: AttendanceUser) {
    const employeeId = await this.resolveScopedEmployeeId(user);
    const record = await this.prisma.attendance.findFirst({
      where: { employeeId, checkIn: { not: null }, checkOut: null },
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
        organization: { select: { id: true, name: true } },
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

    const [attendanceRows, leaveRows] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { employeeId: { in: ids }, date: this.startOfDay(day) },
        include: { shift: true, breaks: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: ids },
          status: 'APPROVED',
          startDate: { lte: this.endOfDay(day) },
          endDate: { gte: this.startOfDay(day) },
        },
        select: { employeeId: true },
      }),
    ]);

    const holidayOrganizationIds = [
      ...new Set(eligibleEmployees.map((employee) => employee.organizationId)),
    ];
    const targetHolidayDate = this.parseHolidayDate(this.dateKey(day));
    const { holidays, familyRootByOrganization } =
      await this.findApplicableHolidays(
        holidayOrganizationIds,
        targetHolidayDate,
        targetHolidayDate,
      );

    const attendanceMap = new Map(
      attendanceRows.map((row) => [row.employeeId, row]),
    );
    const leaveSet = new Set(leaveRows.map((row) => row.employeeId));

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
      ),
    );

    return { rows, summary: this.buildSummary(rows) };
  }

  async findAll(query: QueryAttendanceDto, user: AttendanceUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const day = this.parseTargetDay(query.date);
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

  async getToday(user: AttendanceUser, date?: string) {
    user.organizationId = await this.resolveOrganizationId(user);
    const day = this.parseTargetDay(date);
    const scopedIds = await this.getScopedEmployeeFilter(user);
    const { rows, summary } = await this.buildDailySnapshot(
      day,
      scopedIds,
      user,
    );

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
        breaks: [],
        onBreak: false,
        lateMinutes: 0,
        overtimeHours: 0,
        status: AttendanceStatus.NOT_SCHEDULED,
        shiftDetails: null,
      };
    }

    return {
      date: today.date,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      workingHours: row.workingHours,
      breaks: row.breaks,
      onBreak: row.onBreak,
      lateMinutes: row.lateMinutes,
      overtimeHours: row.overtimeHours,
      status: row.status,
      shiftDetails: row.shiftDetails,
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
      include: { shift: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee #${employeeId} not found`);
    }

    const base = month ? new Date(`${month}-01T00:00:00`) : new Date();
    const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
    const monthEnd = new Date(
      base.getFullYear(),
      base.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const [attendanceRows, leaveRows] = await Promise.all([
      this.prisma.attendance.findMany({
        where: {
          employeeId,
          date: { gte: monthStart, lte: monthEnd },
        },
        include: { shift: true, breaks: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
      }),
    ]);

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

    const daysInMonth = new Date(
      base.getFullYear(),
      base.getMonth() + 1,
      0,
    ).getDate();
    const days: Array<{
      date: string;
      day: number;
      status: AttendanceStatus;
      holidayName: string | null;
      checkIn: string | null;
      checkOut: string | null;
      workingHours: number | null;
      breaks: { startedAt: string; endedAt: string | null }[];
      shortfallHours: number;
      lateMinutes: number;
      overtimeHours: number;
      shiftDetails: (ShiftLite & { minPresentHours: number }) | null;
    }> = [];

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
      const day = new Date(base.getFullYear(), base.getMonth(), dayNumber);
      if (!this.isAttendanceEligible(day, employee.hireDate)) {
        continue;
      }
      const attendance =
        attendanceMap.get(this.startOfDay(day).getTime()) ?? null;
      const onLeave = leaveRows.some(
        (row) =>
          row.startDate <= this.endOfDay(day) &&
          row.endDate >= this.startOfDay(day),
      );
      const shift = attendance?.shift ?? employee.shift ?? null;
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
          : (attendance?.status ??
            this.calculateStatus({
              day,
              checkIn: null,
              checkOut: null,
              workingHours: null,
              onLeave,
              shift,
            }));
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

      days.push({
        date: this.startOfDay(day).toISOString(),
        day: dayNumber,
        status,
        holidayName:
          status === AttendanceStatus.HOLIDAY ? (holidayName ?? null) : null,
        checkIn: attendance?.checkIn?.toISOString() ?? null,
        checkOut: attendance?.checkOut?.toISOString() ?? null,
        workingHours: attendance?.workingHours ?? null,
        breaks: (attendance?.breaks ?? []).map((interval) => ({
          startedAt: interval.startedAt.toISOString(),
          endedAt: interval.endedAt?.toISOString() ?? null,
        })),
        shortfallHours,
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
        workingHours: d.workingHours,
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
        lateMinutes: d.lateMinutes,
        overtimeHours: d.overtimeHours,
        status: d.status,
        shiftDetails: d.shiftDetails,
      })),
    );

    return {
      employee,
      month: `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`,
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

    const [attendanceRows, leaves] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { employeeId, date: { gte: queryStart, lte: today } },
        include: { shift: true, breaks: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { lte: this.endOfDay(monthEnd) },
          endDate: { gte: queryStart },
          deletedAt: null,
        },
        select: { startDate: true, endDate: true },
      }),
    ]);
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
      let completedHours = 0;
      let breakHours = 0;
      let scheduledDays = 0;
      for (
        const day = new Date(periodStart);
        day <= scheduledThrough;
        day.setUTCDate(day.getUTCDate() + 1)
      ) {
        const dayKey = this.dateKey(day);
        const row = attendanceByDate.get(dayKey);
        const shift = row?.shift ?? employee.shift;
        const isElapsedDay = day <= today;
        if (isElapsedDay && row?.workingHours != null) {
          completedHours += row.workingHours;
        } else if (isElapsedDay && row?.checkIn) {
          completedHours += calculateNetWorkingHours(
            row.checkIn,
            row.checkOut ?? now,
            row.breaks,
          );
        }
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
          leaves.some((leave) => isCovered(leave, dayKey))
        ) {
          continue;
        }
        requiredHours += row?.requiredHours ?? shift.requiredHours;
        scheduledDays += 1;
      }
      requiredHours = Number(requiredHours.toFixed(2));
      completedHours = Number(completedHours.toFixed(2));
      breakHours = Number(breakHours.toFixed(2));
      const remainingHours = Number(
        Math.max(0, requiredHours - completedHours).toFixed(2),
      );
      return {
        startDate: periodStart.toISOString(),
        endDate: scheduledThrough.toISOString(),
        requiredHours,
        completedHours,
        breakHours,
        scheduledDays,
        remainingHours,
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
      include: { shift: true },
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
    const rows: Array<{
      employeeId: number;
      employeeName: string;
      department: string | null;
      week: Awaited<
        ReturnType<typeof this.getWorkHourBalancesForEmployee>
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
          return {
            employeeId: employee.id,
            employeeName: employee.name,
            department: employee.department ?? null,
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
      ? new Date(`${query.month}-01T00:00:00`)
      : new Date();

    const monthStart = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth(),
      1,
    );
    const monthEnd = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
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
      where: whereWithEmployee,
      include: {
        shift: true,
        breaks: true,
        employee: { select: { hireDate: true, organizationId: true } },
      },
    });

    const organizationIds = [
      ...new Set(attendanceRows.map((row) => row.employee.organizationId)),
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
    const statusForRow = (row: (typeof attendanceRows)[number]) =>
      row.status !== AttendanceStatus.LEAVE &&
      !row.checkIn &&
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

    const eligibleAttendanceRows = attendanceRows.filter((row) =>
      this.isAttendanceEligible(row.date, row.employee.hireDate),
    );
    const presentDays = eligibleAttendanceRows.filter(
      (row) => statusForRow(row) === AttendanceStatus.PRESENT,
    ).length;
    const absentDays = eligibleAttendanceRows.filter(
      (row) => statusForRow(row) === AttendanceStatus.ABSENT,
    ).length;
    const leaveDays = eligibleAttendanceRows.filter(
      (row) => statusForRow(row) === AttendanceStatus.LEAVE,
    ).length;
    const holidayDays = eligibleAttendanceRows.filter(
      (row) => statusForRow(row) === AttendanceStatus.HOLIDAY,
    ).length;
    const halfDays = eligibleAttendanceRows.filter(
      (row) => statusForRow(row) === AttendanceStatus.HALF_DAY,
    ).length;
    const lateCount = eligibleAttendanceRows.filter(
      (row) => (row.lateMinutes ?? 0) > 0,
    ).length;
    const overtimeHours = Number(
      eligibleAttendanceRows
        .reduce((sum: number, row) => sum + (row.overtimeHours ?? 0), 0)
        .toFixed(2),
    );
    const shortfallHours = Number(
      eligibleAttendanceRows
        .reduce((sum: number, row) => {
          const sf = (row as { shortfallHours?: number }).shortfallHours;
          if (typeof sf === 'number') return sum + sf;
          const required = row.requiredHours ?? row.shift?.requiredHours ?? 8;
          return sum + Math.max(0, required - (row.workingHours ?? 0));
        }, 0)
        .toFixed(2),
    );
    const summaryNow = new Date();
    const summaryCutoff = this.endOfDay(
      new Date(Math.min(monthEnd.getTime(), summaryNow.getTime())),
    );
    const periodAttendanceRows = eligibleAttendanceRows.filter(
      (row) => row.date <= summaryCutoff,
    );
    const totalWorkedHours = Number(
      periodAttendanceRows
        .reduce((sum: number, row) => {
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
        }, 0)
        .toFixed(2),
    );
    const totalExpectedHours = Number(
      periodAttendanceRows
        .reduce((sum: number, row) => {
          const required = row.requiredHours ?? row.shift?.requiredHours ?? 8;
          const status = statusForRow(row);
          if (!row.shift && row.requiredHours == null) return sum;
          if (
            status === AttendanceStatus.WEEKLY_OFF ||
            status === AttendanceStatus.HOLIDAY ||
            status === AttendanceStatus.LEAVE ||
            (row.shift && this.isWeeklyHoliday(row.date, row.shift))
          ) {
            return sum;
          }
          return (
            sum +
            (status === AttendanceStatus.HALF_DAY ? required / 2 : required)
          );
        }, 0)
        .toFixed(2),
    );

    const totalWorkingDays = eligibleAttendanceRows.filter(
      (row) =>
        statusForRow(row) !== AttendanceStatus.WEEKLY_OFF &&
        statusForRow(row) !== AttendanceStatus.HOLIDAY,
    ).length;

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
      totalExpectedHours,
      totalWorkingDays,
    };
  }

  async getMonthlyReport(query: QueryAttendanceDto, user: AttendanceUser) {
    const targetYear = query.year ?? new Date().getFullYear();
    const targetMonth = query.month
      ? Number(query.month)
      : new Date().getMonth() + 1;
    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

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
        organization: { select: { id: true, name: true } },
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
      },
      include: { shift: true },
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    });
    const leaveRows = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        deletedAt: null,
        status: 'APPROVED',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
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
    const leaveDateKeys = new Set(
      leaveRows.flatMap((leave) => {
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
          date.setDate(date.getDate() + 1)
        ) {
          dates.push(`${leave.employeeId}:${date.toISOString().slice(0, 10)}`);
        }
        return dates;
      }),
    );
    const attendanceDateKeys = new Set(
      attendanceRows.map(
        (row) =>
          `${row.employeeId}:${this.startOfDay(row.date).toISOString().slice(0, 10)}`,
      ),
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
      });
    }

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

      const rowDateKey = `${row.employeeId}:${this.startOfDay(row.date).toISOString().slice(0, 10)}`;
      const corporateHolidayKey = `${employee.organization.id}:${row.date.toISOString().slice(0, 10)}`;
      const effectiveStatus = leaveDateKeys.has(rowDateKey)
        ? AttendanceStatus.LEAVE
        : corporateHolidayKeys.has(corporateHolidayKey) && !row.checkIn
          ? AttendanceStatus.HOLIDAY
          : row.status;
      const matchesStatus =
        query.status === 'LATE'
          ? (row.lateMinutes ?? 0) > 0
          : query.status
            ? effectiveStatus === query.status
            : true;

      if (!matchesStatus) continue;

      if (effectiveStatus === AttendanceStatus.WEEKLY_OFF) {
        entry.weeklyOffCount += 1;
        continue;
      }

      if (effectiveStatus === AttendanceStatus.HOLIDAY) continue;

      entry.workingDays += 1;

      const requiredHours = row.requiredHours ?? row.shift?.requiredHours ?? 8;
      entry.overtimeHours += row.overtimeHours ?? 0;
      entry.totalWorkedHours += row.workingHours ?? 0;
      const rowShortfall = (row as { shortfallHours?: number }).shortfallHours;
      if (typeof rowShortfall === 'number') {
        entry.shortfallHours += rowShortfall;
      } else {
        entry.shortfallHours += Math.max(
          0,
          requiredHours - (row.workingHours ?? 0),
        );
      }

      if (
        effectiveStatus === AttendanceStatus.PRESENT ||
        effectiveStatus === AttendanceStatus.HALF_DAY
      ) {
        entry.totalExpectedHours +=
          effectiveStatus === AttendanceStatus.HALF_DAY
            ? requiredHours / 2
            : requiredHours;
      }

      if (effectiveStatus === AttendanceStatus.PRESENT) entry.presentCount += 1;
      if (effectiveStatus === AttendanceStatus.ABSENT) entry.absentCount += 1;
      if (effectiveStatus === AttendanceStatus.HALF_DAY)
        entry.halfDayCount += 1;
      if (effectiveStatus === AttendanceStatus.LEAVE) entry.leaveCount += 1;
      if ((row.lateMinutes ?? 0) > 0) entry.lateCount += 1;
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
        new Date(Math.min(leave.endDate.getTime(), monthEnd.getTime())),
      );
      for (
        const date = new Date(start);
        date <= end;
        date.setDate(date.getDate() + 1)
      ) {
        const key = `${leave.employeeId}:${date.toISOString().slice(0, 10)}`;
        if (!attendanceDateKeys.has(key)) employee.leaveCount += 1;
      }
    }

    const rows = Array.from(grouped.values()).map((entry) => ({
      ...entry,
      overtimeHours: Number(entry.overtimeHours.toFixed(2)),
      shortfallHours: Number(entry.shortfallHours.toFixed(2)),
      totalWorkedHours: Number(entry.totalWorkedHours.toFixed(2)),
      totalExpectedHours: Number(entry.totalExpectedHours.toFixed(2)),
      attendancePercent:
        entry.workingDays > 0
          ? Number(((entry.presentCount / entry.workingDays) * 100).toFixed(2))
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
      include: { employee: { include: { shift: true } }, shift: true },
    });

    if (!record) {
      throw new NotFoundException(`Attendance #${id} not found`);
    }

    const nextDate = dto.date
      ? attendanceDateFromKey(dto.date.slice(0, 10))
      : new Date(record.date);
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

    if (checkOut && !checkIn) {
      throw new BadRequestException('Check-in is required before check-out');
    }

    if (checkIn && checkOut && checkOut.getTime() < checkIn.getTime()) {
      throw new BadRequestException(
        'Check-out time cannot be earlier than check-in time',
      );
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
        ? this.calculateWorkingHours(checkIn, checkOut)
        : null;
    const overtimeHours =
      workingHours != null
        ? this.calculateOvertimeHours(workingHours, shift)
        : 0;
    const shortfallHours = this.calculateShortfallHours(workingHours, shift);
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
      });

    return this.prisma.attendance.update({
      where: { id, organizationId: user.organizationId },
      data: {
        date: nextDate,
        checkIn,
        checkOut,
        workingHours,
        overtimeHours,
        shortfallHours,
        lateMinutes,
        status,
        isPaidLeave: leave ? Boolean(leave.isPaid ?? true) : null,
      },
      include: { employee: true, shift: true },
    });
  }

  async runDailyAutomation() {
    const target = this.startOfDay(new Date());
    target.setDate(target.getDate() - 1);

    const key = target.toISOString().slice(0, 10);
    if (this.lastAutomationKey === key) {
      return { processedDate: key, alreadyProcessed: true };
    }

    const employees = await this.prisma.employee.findMany({
      include: { shift: true },
    });

    const organizationIds = [
      ...new Set(employees.map((employee) => employee.organizationId)),
    ];
    const targetHolidayDate = this.parseHolidayDate(this.dateKey(target));
    const { holidays: holidayRows, familyRootByOrganization } =
      await this.findApplicableHolidays(
        organizationIds,
        targetHolidayDate,
        targetHolidayDate,
      );

    for (const employee of employees) {
      if (!this.isAttendanceEligible(target, employee.hireDate)) {
        continue;
      }
      if (!employee.shift) {
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

      const existing = await this.prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: target,
          },
        },
        include: { shift: true },
      });

      if (!existing) {
        await this.prisma.attendance.create({
          data: {
            organizationId: employee.organizationId,
            employeeId: employee.id,
            shiftId: employee.shift.id,
            date: target,
            status: leave
              ? AttendanceStatus.LEAVE
              : isCorporateHoliday
                ? AttendanceStatus.HOLIDAY
                : this.isWeeklyHoliday(target, employee.shift)
                  ? AttendanceStatus.WEEKLY_OFF
                  : AttendanceStatus.ABSENT,
            requiredHours: employee.shift.requiredHours,
            isPaidLeave: leave ? Boolean(leave.isPaid ?? true) : null,
          },
        });
        continue;
      }

      if (existing.status === AttendanceStatus.LEAVE || leave) {
        continue;
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
        this.isWeeklyHoliday(target, employee.shift) &&
        existing.status !== AttendanceStatus.WEEKLY_OFF
      ) {
        await this.prisma.attendance.update({
          where: { id: existing.id },
          data: { status: AttendanceStatus.WEEKLY_OFF },
        });
        continue;
      }

      if (existing.checkIn && !existing.checkOut) {
        const { shiftEnd } = this.getShiftWindow(target, employee.shift);
        const autoCheckOut =
          shiftEnd && shiftEnd.getTime() > new Date(existing.checkIn).getTime()
            ? shiftEnd
            : new Date(
                new Date(existing.checkIn).getTime() +
                  employee.shift.requiredHours * 60 * 60 * 1000,
              );

        const workingHours = this.calculateWorkingHours(
          new Date(existing.checkIn),
          autoCheckOut,
        );
        const overtimeHours = this.calculateOvertimeHours(
          workingHours,
          employee.shift,
        );
        const shortfallHours = this.calculateShortfallHours(
          workingHours,
          employee.shift,
        );
        const lateMinutes = (existing as any).lateMinutes ?? 0;

        await this.prisma.attendance.update({
          where: { id: existing.id },
          data: {
            checkOut: autoCheckOut,
            workingHours,
            overtimeHours,
            shortfallHours,
            isAutoClosed: true,
            status: this.calculateStatus({
              day: target,
              checkIn: new Date(existing.checkIn),
              checkOut: autoCheckOut,
              workingHours,
              onLeave: false,
              shift: employee.shift,
              lateMinutes,
            }),
          },
        });
      }
    }

    this.lastAutomationKey = key;
    await this.invalidateDashboardCache();
    return { processedDate: key, alreadyProcessed: false };
  }
}
