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
import { AssignShiftDto } from './dto/assign-shift.dto';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

type AttendanceUser = {
  userId: number;
  role: Role;
  employeeId?: number | null;
  organizationId: number;
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
};

type DailyAttendanceRow = {
  id: number | null;
  employeeId: number;
  employee: {
    id: number;
    name: string;
    department: string | null;
    designation: string | null;
  };
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number | null;
  shortfallHours: number;
  lateMinutes: number;
  overtimeHours: number;
  status: AttendanceStatus;
  shiftDetails: {
    id: number | null;
    name: string;
    type: string;
    startTime: string | null;
    endTime: string | null;
    requiredHours: number | null;
    minPresentHours: number | null;
    gracePeriodMinutes: number | null;
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

  private parseTargetDay(date?: string, fallback?: Date) {
    return this.startOfDay(date ? new Date(date) : (fallback ?? new Date()));
  }

  private calculateWorkingHours(checkIn: Date, checkOut: Date) {
    return Number(
      Math.max(0, (checkOut.getTime() - checkIn.getTime()) / 36e5).toFixed(2),
    );
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
    day: Date,
    shift: ShiftLite | null,
  ) {
    if (!shift || !shift.startTime || shift.type === 'FLEXIBLE') return 0;

    const { shiftStart } = this.getShiftWindow(day, shift);
    if (!shiftStart) return 0;

    const graceMs = (shift.gracePeriodMinutes || 0) * 60 * 1000;
    const effectiveStart = shiftStart.getTime() + graceMs;
    if (checkIn.getTime() <= effectiveStart) return 0;

    return Math.floor((checkIn.getTime() - effectiveStart) / 60000);
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

  private buildSummary(rows: DailyAttendanceRow[]) {
    const summary = rows.reduce(
      (acc, row) => {
        if (row.status === AttendanceStatus.PRESENT) acc.present += 1;
        if (row.status === AttendanceStatus.ABSENT) acc.absent += 1;
        if (row.status === AttendanceStatus.LEAVE) acc.leave += 1;
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
      halfDays: summary.halfDay,
      totalWorkingDays: rows.length,
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
  }) {
    const { day, checkIn, checkOut, workingHours, onLeave, shift } = params;
    if (onLeave) return AttendanceStatus.LEAVE;
    const minPresentHours = shift?.minPresentHours ?? 5;
    const halfDayThreshold = Math.max(1, minPresentHours / 2);
    if (checkIn && checkOut) {
      const worked = workingHours ?? 0;
      if (worked >= minPresentHours) return AttendanceStatus.PRESENT;
      if (worked >= halfDayThreshold) return AttendanceStatus.HALF_DAY;
      return AttendanceStatus.ABSENT;
    }
    if (checkIn) {
      return this.startOfDay(day).getTime() ===
        this.startOfDay(new Date()).getTime()
        ? AttendanceStatus.PRESENT
        : AttendanceStatus.HALF_DAY;
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
      shift: ShiftLite | null;
    },
    day: Date,
    attendance:
      | ({
          id: number;
          checkIn: Date | null;
          checkOut: Date | null;
          workingHours: number | null;
          lateMinutes: number;
          overtimeHours: number;
          shortfallHours: number;
          status: AttendanceStatus;
          shift?: ShiftLite | null;
        } & { shortfallHours?: number })
      | null,
    onLeave: boolean,
  ): DailyAttendanceRow {
    const shift = attendance?.shift ?? employee.shift ?? null;
    const computedStatus =
      attendance?.status ??
      this.calculateStatus({
        day,
        checkIn: null,
        checkOut: null,
        workingHours: null,
        onLeave,
        shift,
      });
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
      },
      date: day.toISOString(),
      checkIn: attendance?.checkIn?.toISOString() ?? null,
      checkOut: attendance?.checkOut?.toISOString() ?? null,
      workingHours: attendance?.workingHours ?? null,
      shortfallHours,
      lateMinutes: attendance?.lateMinutes ?? 0,
      overtimeHours: attendance?.overtimeHours ?? 0,
      status: computedStatus,
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
        rotationPattern: dto.rotationPattern,
        organizationId: user.organizationId,
      },
    });

    await this.invalidateDashboardCache();
    return result;
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

  async checkIn(dto: CheckInDto, user: AttendanceUser) {
    const employeeId = await this.resolveScopedEmployeeId(user, dto.employeeId);
    const employee = await this.ensureEmployee(employeeId, user);

    if (!employee.shift) {
      throw new BadRequestException(
        'Assign an active flexible or fixed shift before checking in',
      );
    }

    const checkInTime = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const day = this.parseTargetDay(dto.date, checkInTime);

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

    const lateMinutes = this.calculateLateMinutes(
      checkInTime,
      day,
      employee.shift,
    );

    if (existing) {
      const result = await this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          shiftId: employee.shift.id,
          checkIn: checkInTime,
          lateMinutes,
          requiredHours: employee.shift.requiredHours,
          status: AttendanceStatus.PRESENT,
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
        status: AttendanceStatus.PRESENT,
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
    } | null = null;

    if (dto.date) {
      const day = this.parseTargetDay(dto.date, checkOutTime);
      record = await this.prisma.attendance.findUnique({
        where: { employeeId_date: { employeeId, date: day } },
        include: { shift: true },
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
        include: { shift: true },
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
    const workingHours = this.calculateWorkingHours(
      new Date(record.checkIn),
      checkOutTime,
    );
    const overtimeHours = this.calculateOvertimeHours(workingHours, shift);
    const shortfallHours = this.calculateShortfallHours(workingHours, shift);

    const status = this.calculateStatus({
      day: this.startOfDay(new Date(record.date)),
      checkIn: new Date(record.checkIn),
      checkOut: checkOutTime,
      workingHours,
      onLeave: false,
      shift,
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

  private async buildDailySnapshot(
    day: Date,
    employeeIds: number[] | null,
    user: AttendanceUser,
  ) {
    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
    const employees = await this.prisma.employee.findMany({
      where: {
        ...this.buildOrganizationScope(user),
        ...buWhere,
        ...(employeeIds ? { id: { in: employeeIds } } : {}),
      },
      orderBy: { name: 'asc' },
      include: { shift: true },
    });

    if (employees.length === 0) {
      const emptySummary = {
        present: 0,
        absent: 0,
        leave: 0,
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

    const ids = employees.map((employee) => employee.id);

    const [attendanceRows, leaveRows] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { employeeId: { in: ids }, date: this.startOfDay(day) },
        include: { shift: true },
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

    const attendanceMap = new Map(
      attendanceRows.map((row) => [row.employeeId, row]),
    );
    const leaveSet = new Set(leaveRows.map((row) => row.employeeId));

    const rows = employees.map((employee) =>
      this.toDailyRow(
        employee,
        this.startOfDay(day),
        attendanceMap.get(employee.id) ?? null,
        leaveSet.has(employee.id),
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

    const { rows, summary } = await this.buildDailySnapshot(
      day,
      scopedIds,
      user,
    );
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
      summary,
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
        lateMinutes: 0,
        overtimeHours: 0,
        status: AttendanceStatus.ABSENT,
        shiftDetails: null,
      };
    }

    return {
      date: today.date,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
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

    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
    const employeeWhere =
      user.role === Role.EMPLOYEE
        ? {
            id: employeeId,
            organizationId: user.organizationId,
            deletedAt: null,
          }
        : {
            id: employeeId,
            ...this.buildOrganizationScope(user),
            ...buWhere,
          };
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
        include: { shift: true },
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
      checkIn: string | null;
      checkOut: string | null;
      workingHours: number | null;
      shortfallHours: number;
      lateMinutes: number;
      overtimeHours: number;
      shiftDetails: (ShiftLite & { minPresentHours: number }) | null;
    }> = [];

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
      const day = new Date(base.getFullYear(), base.getMonth(), dayNumber);
      const attendance =
        attendanceMap.get(this.startOfDay(day).getTime()) ?? null;
      const onLeave = leaveRows.some(
        (row) =>
          row.startDate <= this.endOfDay(day) &&
          row.endDate >= this.startOfDay(day),
      );
      const shift = attendance?.shift ?? employee.shift ?? null;
      const status =
        attendance?.status ??
        this.calculateStatus({
          day,
          checkIn: null,
          checkOut: null,
          workingHours: null,
          onLeave,
          shift,
        });
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
          }
        : null;

      days.push({
        date: this.startOfDay(day).toISOString(),
        day: dayNumber,
        status,
        checkIn: attendance?.checkIn?.toISOString() ?? null,
        checkOut: attendance?.checkOut?.toISOString() ?? null,
        workingHours: attendance?.workingHours ?? null,
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

    const where = {
      date: { gte: monthStart, lte: monthEnd },
      ...this.buildOrganizationScope(user),
    } as const;

    const whereWithEmployee = scopedIds
      ? {
          ...where,
          employeeId: { in: scopedIds },
        }
      : where;

    const attendanceRows = await this.prisma.attendance.findMany({
      where: whereWithEmployee,
      include: { shift: true },
    });

    const presentDays = attendanceRows.filter(
      (row) => row.status === 'PRESENT',
    ).length;
    const absentDays = attendanceRows.filter(
      (row) => row.status === 'ABSENT',
    ).length;
    const leaveDays = attendanceRows.filter(
      (row) => row.status === 'LEAVE',
    ).length;
    const halfDays = attendanceRows.filter(
      (row) => row.status === 'HALF_DAY',
    ).length;
    const lateCount = attendanceRows.filter(
      (row) => (row.lateMinutes ?? 0) > 0,
    ).length;
    const overtimeHours = Number(
      attendanceRows
        .reduce((sum: number, row) => sum + (row.overtimeHours ?? 0), 0)
        .toFixed(2),
    );
    const shortfallHours = Number(
      attendanceRows
        .reduce((sum: number, row) => {
          const sf = (row as { shortfallHours?: number }).shortfallHours;
          if (typeof sf === 'number') return sum + sf;
          const required = row.requiredHours ?? row.shift?.requiredHours ?? 8;
          return sum + Math.max(0, required - (row.workingHours ?? 0));
        }, 0)
        .toFixed(2),
    );
    const totalWorkedHours = Number(
      attendanceRows
        .reduce((sum: number, row) => sum + (row.workingHours ?? 0), 0)
        .toFixed(2),
    );
    const totalExpectedHours = Number(
      attendanceRows
        .reduce((sum: number, row) => {
          const required = row.requiredHours ?? row.shift?.requiredHours ?? 8;
          if (row.status === 'PRESENT' || row.status === 'HALF_DAY') {
            return sum + (row.status === 'HALF_DAY' ? required / 2 : required);
          }
          return sum;
        }, 0)
        .toFixed(2),
    );

    const totalWorkingDays = attendanceRows.length;

    return {
      presentDays,
      absentDays,
      leaveDays,
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
    const employees = await this.prisma.employee.findMany({
      where: {
        deletedAt: null,
        ...this.buildOrganizationScope(user),
        ...buWhere,
        ...(scopedEmployeeIds ? { id: { in: scopedEmployeeIds } } : {}),
        ...(query.employeeId ? { id: query.employeeId } : {}),
        ...(query.department
          ? { department: { contains: query.department, mode: 'insensitive' } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        department: true,
        designation: true,
        position: true,
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
        ...this.buildOrganizationScope(user),
      },
      include: { shift: true },
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    });

    const grouped = new Map<
      number,
      {
        employeeId: number;
        employeeName: string;
        department: string | null;
        role: string;
        presentCount: number;
        absentCount: number;
        lateCount: number;
        halfDayCount: number;
        leaveCount: number;
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

      const matchesStatus =
        query.status === 'LATE'
          ? (row.lateMinutes ?? 0) > 0
          : query.status
            ? row.status === query.status
            : true;

      if (!matchesStatus) continue;

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
        row.status === AttendanceStatus.PRESENT ||
        row.status === AttendanceStatus.HALF_DAY
      ) {
        entry.totalExpectedHours +=
          row.status === AttendanceStatus.HALF_DAY
            ? requiredHours / 2
            : requiredHours;
      }

      if (row.status === AttendanceStatus.PRESENT) entry.presentCount += 1;
      if (row.status === AttendanceStatus.ABSENT) entry.absentCount += 1;
      if (row.status === AttendanceStatus.HALF_DAY) entry.halfDayCount += 1;
      if (row.status === AttendanceStatus.LEAVE) entry.leaveCount += 1;
      if ((row.lateMinutes ?? 0) > 0) entry.lateCount += 1;
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
      ? this.parseTargetDay(dto.date)
      : new Date(record.date);

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
      ? this.calculateLateMinutes(checkIn, nextDate, shift)
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

    for (const employee of employees) {
      if (!employee.shift) {
        continue;
      }

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
            status: leave ? AttendanceStatus.LEAVE : AttendanceStatus.ABSENT,
            requiredHours: employee.shift.requiredHours,
            isPaidLeave: leave ? Boolean(leave.isPaid ?? true) : null,
          },
        });
        continue;
      }

      if (existing.status === AttendanceStatus.LEAVE || leave) {
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
