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
};

type ShiftLite = {
  id: number;
  name: string;
  type: 'FIXED' | 'FLEXIBLE' | 'ROTATIONAL';
  startTime: string | null;
  endTime: string | null;
  requiredHours: number;
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
  ) {}

  private async invalidateDashboardCache() {
    await this.cacheManager.del(DASHBOARD_CACHE_KEY);
  }

  onModuleInit() {
    // Run once on boot and then hourly; each date is processed only once.
    this.runDailyAutomation().catch(() => {
      return;
    });
    this.automationTimer = setInterval(() => {
      this.runDailyAutomation().catch(() => {
        return;
      });
    }, 60 * 60 * 1000);
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
    const [hourRaw, minuteRaw] = time.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw ?? 0);
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

  private calculateLateMinutes(checkIn: Date, day: Date, shift: ShiftLite | null) {
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

  private buildSummary(rows: DailyAttendanceRow[]) {
    const summary = rows.reduce(
      (acc, row) => {
        if (row.status === AttendanceStatus.PRESENT) acc.present += 1;
        if (row.status === AttendanceStatus.ABSENT) acc.absent += 1;
        if (row.status === AttendanceStatus.LEAVE) acc.leave += 1;
        if (row.status === AttendanceStatus.HALF_DAY) acc.halfDay += 1;
        if (row.lateMinutes > 0) acc.lateCount += 1;
        acc.overtimeHours += row.overtimeHours ?? 0;
        return acc;
      },
      {
        present: 0,
        absent: 0,
        leave: 0,
        halfDay: 0,
        lateCount: 0,
        overtimeHours: 0,
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
    };
  }

  private calculateStatus(params: {
    day: Date;
    checkIn: Date | null;
    checkOut: Date | null;
    workingHours: number | null;
    onLeave: boolean;
  }) {
    const { day, checkIn, checkOut, workingHours, onLeave } = params;
    if (onLeave) return AttendanceStatus.LEAVE;
    if (checkIn && checkOut) {
      return (workingHours ?? 0) >= 4
        ? AttendanceStatus.PRESENT
        : AttendanceStatus.HALF_DAY;
    }
    if (checkIn) {
      return this.startOfDay(day).getTime() === this.startOfDay(new Date()).getTime()
        ? AttendanceStatus.PRESENT
        : AttendanceStatus.HALF_DAY;
    }
    return AttendanceStatus.ABSENT;
  }

  private async resolveCurrentEmployeeId(user: AttendanceUser) {
    if (user.employeeId) {
      return user.employeeId;
    }

    const linked = (await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { employeeId: true },
    } as any)) as { employeeId?: number | null } | null;

    if (!linked?.employeeId) {
      throw new ForbiddenException('Employee account is not linked to a user');
    }

    return linked.employeeId;
  }

  private async resolveScopedEmployeeId(
    user: AttendanceUser,
    requestedEmployeeId?: number | null,
  ) {
    if (user.role === Role.ADMIN || user.role === Role.HR) {
      if (!requestedEmployeeId) {
        throw new BadRequestException('employeeId is required');
      }
      return requestedEmployeeId;
    }

    const employeeId = await this.resolveCurrentEmployeeId(user);
    if (requestedEmployeeId && requestedEmployeeId !== employeeId) {
      throw new ForbiddenException('You can only access your own attendance');
    }

    return employeeId;
  }

  private async getManagerEmployeeIds(userId: number) {
    const rows = await this.prisma.employee.findMany({
      where: { user: { managerId: userId } },
      select: { id: true },
    } as any);
    return rows.map((row) => row.id);
  }

  private async getScopedEmployeeFilter(
    user?: AttendanceUser,
    requestedEmployeeId?: number,
  ): Promise<number[] | null> {
    if (!user || user.role === Role.ADMIN || user.role === Role.HR) {
      return requestedEmployeeId ? [requestedEmployeeId] : null;
    }

    if (user.role === Role.MANAGER) {
      const managedIds = await this.getManagerEmployeeIds(user.userId);
      if (requestedEmployeeId) {
        if (!managedIds.includes(requestedEmployeeId)) {
          throw new ForbiddenException('You can only access attendance for your team');
        }
        return [requestedEmployeeId];
      }
      return managedIds;
    }

    const ownEmployeeId = await this.resolveCurrentEmployeeId(user);
    if (requestedEmployeeId && requestedEmployeeId !== ownEmployeeId) {
      throw new ForbiddenException('You can only access your own attendance');
    }
    return [ownEmployeeId];
  }

  private async ensureEmployee(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { shift: true },
    } as any);

    if (!employee) throw new NotFoundException(`Employee #${employeeId} not found`);
    return employee as any;
  }

  private async findApprovedLeaveForDay(employeeId: number, day: Date) {
    return (await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: 'APPROVED',
        startDate: { lte: this.endOfDay(day) },
        endDate: { gte: this.startOfDay(day) },
      },
      orderBy: { createdAt: 'desc' },
    } as any)) as any;
  }

  private toDailyRow(employee: any, day: Date, attendance: any | null, onLeave: boolean): DailyAttendanceRow {
    const shift = attendance?.shift ?? employee.shift ?? null;

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
      lateMinutes: attendance?.lateMinutes ?? 0,
      overtimeHours: attendance?.overtimeHours ?? 0,
      status:
        attendance?.status ??
        this.calculateStatus({
          day,
          checkIn: null,
          checkOut: null,
          workingHours: null,
          onLeave,
        }),
      shiftDetails: shift
        ? {
            id: shift.id,
            name: shift.name,
            type: shift.type,
            startTime: shift.startTime,
            endTime: shift.endTime,
            requiredHours: shift.requiredHours,
            gracePeriodMinutes: shift.gracePeriodMinutes,
          }
        : null,
    };
  }

  async createShift(dto: CreateShiftDto) {
    const prisma = this.prisma as any;
    const result = await prisma.shift.create({
      data: {
        name: dto.name,
        type: dto.type,
        startTime: dto.startTime,
        endTime: dto.endTime,
        requiredHours: dto.requiredHours ?? 8,
        gracePeriodMinutes: dto.gracePeriodMinutes ?? 15,
        rotationPattern: dto.rotationPattern,
      },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async listShifts() {
    const prisma = this.prisma as any;
    return prisma.shift.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async assignShift(dto: AssignShiftDto) {
    const prisma = this.prisma as any;
    const shift = await prisma.shift.findUnique({ where: { id: dto.shiftId } });
    if (!shift || !shift.isActive) {
      throw new NotFoundException('Shift not found');
    }

    const employee = await prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const result = await prisma.employee.update({
      where: { id: dto.employeeId },
      data: { shiftId: dto.shiftId },
      include: { shift: true },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  async checkIn(dto: CheckInDto, user: AttendanceUser) {
    const prisma = this.prisma as any;
    const employeeId = await this.resolveScopedEmployeeId(user, dto.employeeId);
    const employee = await this.ensureEmployee(employeeId);

    if (!employee.shift) {
      throw new BadRequestException('Employee has no active shift assigned');
    }

    const checkInTime = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const day = this.parseTargetDay(dto.date, checkInTime);

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: day } },
      include: { shift: true },
    });

    if (existing?.checkIn) {
      throw new ConflictException('Employee has already checked in today');
    }

    const leave = await this.findApprovedLeaveForDay(employeeId, day);
    if (leave) {
      throw new ConflictException('Employee is on approved leave for this date');
    }

    const lateMinutes = this.calculateLateMinutes(checkInTime, day, employee.shift);

    if (existing) {
      const result = await prisma.attendance.update({
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

    const result = await prisma.attendance.create({
      data: {
        employeeId,
        shiftId: employee.shift.id,
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
    const prisma = this.prisma as any;
    const employeeId = await this.resolveScopedEmployeeId(user, dto.employeeId);
    const employee = await this.ensureEmployee(employeeId);

    const checkOutTime = dto.timestamp ? new Date(dto.timestamp) : new Date();
    let record: any | null = null;

    if (dto.date) {
      const day = this.parseTargetDay(dto.date, checkOutTime);
      record = await prisma.attendance.findUnique({
        where: { employeeId_date: { employeeId, date: day } },
        include: { shift: true },
      });
    } else {
      // Supports night shifts: close the latest open attendance row.
      record = await prisma.attendance.findFirst({
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
      throw new BadRequestException('Check-out time cannot be earlier than check-in time');
    }

    const shift = (record.shift ?? employee.shift ?? null) as ShiftLite | null;
    const workingHours = this.calculateWorkingHours(new Date(record.checkIn), checkOutTime);
    const overtimeHours = this.calculateOvertimeHours(workingHours, shift);

    const status = this.calculateStatus({
      day: this.startOfDay(new Date(record.date)),
      checkIn: new Date(record.checkIn),
      checkOut: checkOutTime,
      workingHours,
      onLeave: false,
    });

    const result = await prisma.attendance.update({
      where: { id: record.id },
      data: {
        checkOut: checkOutTime,
        workingHours,
        overtimeHours,
        status,
      },
      include: { employee: true, shift: true },
    });

    await this.invalidateDashboardCache();
    return result;
  }

  private async buildDailySnapshot(day: Date, employeeIds: number[] | null) {
    const prisma = this.prisma as any;
    const employees = await prisma.employee.findMany({
      where: employeeIds ? { id: { in: employeeIds } } : undefined,
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

    const ids = employees.map((employee: any) => employee.id);

    const [attendanceRows, leaveRows] = await Promise.all([
      prisma.attendance.findMany({
        where: { employeeId: { in: ids }, date: this.startOfDay(day) },
        include: { shift: true },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: ids },
          status: 'APPROVED',
          startDate: { lte: this.endOfDay(day) },
          endDate: { gte: this.startOfDay(day) },
        },
        select: { employeeId: true },
      }),
    ]);

    const attendanceMap = new Map(attendanceRows.map((row: any) => [row.employeeId, row]));
    const leaveSet = new Set(leaveRows.map((row: any) => row.employeeId));

    const rows = employees.map((employee: any) =>
      this.toDailyRow(
        employee,
        this.startOfDay(day),
        attendanceMap.get(employee.id) ?? null,
        leaveSet.has(employee.id),
      ),
    );

    return { rows, summary: this.buildSummary(rows) };
  }

  async findAll(query: QueryAttendanceDto, user?: AttendanceUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const day = this.parseTargetDay(query.date);
    const scopedIds = await this.getScopedEmployeeFilter(user, query.employeeId);

    const { rows, summary } = await this.buildDailySnapshot(day, scopedIds);
    const statusFilteredRows = query.status
      ? rows.filter((row) => row.status === query.status)
      : rows;

    const filteredRows = query.department
      ? statusFilteredRows.filter(
          (row) =>
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

  async getToday(date?: string, user?: AttendanceUser) {
    const day = this.parseTargetDay(date);
    const scopedIds = await this.getScopedEmployeeFilter(user);
    const { rows, summary } = await this.buildDailySnapshot(day, scopedIds);

    return {
      date: day.toISOString(),
      rows,
      summary,
    };
  }

  async getMySnapshot(user: AttendanceUser) {
    const employeeId = await this.resolveCurrentEmployeeId(user);
    const today = await this.getToday(undefined, {
      ...user,
      employeeId,
    });

    const row = today.rows[0] ?? null;
    if (!row) {
      throw new NotFoundException('Attendance row not found for current user');
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

  async getEmployeeAttendance(employeeId: number, month?: string, user?: AttendanceUser) {
    if (user) {
      const scopedIds = await this.getScopedEmployeeFilter(user, employeeId);
      if (!scopedIds || !scopedIds.includes(employeeId)) {
        throw new ForbiddenException('You can only access authorized attendance records');
      }
    }

    const prisma = this.prisma as any;
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { shift: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee #${employeeId} not found`);
    }

    const base = month ? new Date(`${month}-01T00:00:00`) : new Date();
    const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
    const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);

    const [attendanceRows, leaveRows] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          employeeId,
          date: { gte: monthStart, lte: monthEnd },
        },
        include: { shift: true },
        orderBy: { date: 'asc' },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
      }),
    ]);

    const attendanceMap = new Map(
      attendanceRows.map((row: any) => [this.startOfDay(new Date(row.date)).getTime(), row]),
    );

    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const days: Array<any> = [];

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
      const day = new Date(base.getFullYear(), base.getMonth(), dayNumber);
      const attendance =
        (attendanceMap.get(this.startOfDay(day).getTime()) ?? null) as any;
      const onLeave = leaveRows.some(
        (row: any) => row.startDate <= this.endOfDay(day) && row.endDate >= this.startOfDay(day),
      );
      const status = attendance?.status ?? this.calculateStatus({
        day,
        checkIn: null,
        checkOut: null,
        workingHours: null,
        onLeave,
      });

      days.push({
        date: this.startOfDay(day).toISOString(),
        day: dayNumber,
        status,
        checkIn: attendance?.checkIn?.toISOString() ?? null,
        checkOut: attendance?.checkOut?.toISOString() ?? null,
        workingHours: attendance?.workingHours ?? null,
        lateMinutes: attendance?.lateMinutes ?? 0,
        overtimeHours: attendance?.overtimeHours ?? 0,
        shiftDetails: attendance?.shift
          ? {
              id: attendance.shift.id,
              name: attendance.shift.name,
              type: attendance.shift.type,
              startTime: attendance.shift.startTime,
              endTime: attendance.shift.endTime,
              requiredHours: attendance.shift.requiredHours,
              gracePeriodMinutes: attendance.shift.gracePeriodMinutes,
            }
          : employee.shift
            ? {
                id: employee.shift.id,
                name: employee.shift.name,
                type: employee.shift.type,
                startTime: employee.shift.startTime,
                endTime: employee.shift.endTime,
                requiredHours: employee.shift.requiredHours,
                gracePeriodMinutes: employee.shift.gracePeriodMinutes,
              }
            : null,
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
    const targetMonth = query.month
      ? new Date(`${query.month}-01T00:00:00`)
      : new Date();

    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999);

    const scopedIds = await this.getScopedEmployeeFilter(user, query.employeeId);
    const prisma = this.prisma as any;

    const where: any = {
      date: { gte: monthStart, lte: monthEnd },
    };

    if (scopedIds) {
      where.employeeId = { in: scopedIds };
    }

    const attendanceRows = await prisma.attendance.findMany({
      where,
      select: {
        employeeId: true,
        status: true,
        lateMinutes: true,
        overtimeHours: true,
      },
    });

    const presentDays = attendanceRows.filter((row: any) => row.status === 'PRESENT').length;
    const absentDays = attendanceRows.filter((row: any) => row.status === 'ABSENT').length;
    const leaveDays = attendanceRows.filter((row: any) => row.status === 'LEAVE').length;
    const halfDays = attendanceRows.filter((row: any) => row.status === 'HALF_DAY').length;
    const lateCount = attendanceRows.filter((row: any) => (row.lateMinutes ?? 0) > 0).length;
    const overtimeHours = Number(
      attendanceRows
        .reduce((sum: number, row: any) => sum + (row.overtimeHours ?? 0), 0)
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
      totalWorkingDays,
    };
  }

  async update(id: number, dto: UpdateAttendanceDto) {
    const prisma = this.prisma as any;
    const record = await prisma.attendance.findUnique({
      where: { id },
      include: { employee: { include: { shift: true } }, shift: true },
    });

    if (!record) {
      throw new NotFoundException(`Attendance #${id} not found`);
    }

    const nextDate = dto.date ? this.parseTargetDay(dto.date) : new Date(record.date);

    if (nextDate.getTime() !== new Date(record.date).getTime()) {
      const duplicate = await prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: record.employeeId,
            date: nextDate,
          },
        },
      });

      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Attendance already exists for this employee on the selected date');
      }
    }

    const checkIn = dto.checkIn !== undefined ? (dto.checkIn ? new Date(dto.checkIn) : null) : record.checkIn;
    const checkOut = dto.checkOut !== undefined ? (dto.checkOut ? new Date(dto.checkOut) : null) : record.checkOut;

    if (checkOut && !checkIn) {
      throw new BadRequestException('Check-in is required before check-out');
    }

    if (checkIn && checkOut && checkOut.getTime() < checkIn.getTime()) {
      throw new BadRequestException('Check-out time cannot be earlier than check-in time');
    }

    const shift = (record.shift ?? record.employee?.shift ?? null) as ShiftLite | null;

    const workingHours = checkIn && checkOut ? this.calculateWorkingHours(checkIn, checkOut) : null;
    const overtimeHours = workingHours != null ? this.calculateOvertimeHours(workingHours, shift) : 0;
    const lateMinutes = checkIn ? this.calculateLateMinutes(checkIn, nextDate, shift) : 0;

    const leave = await this.findApprovedLeaveForDay(record.employeeId, nextDate);
    const status =
      dto.status ??
      this.calculateStatus({
        day: nextDate,
        checkIn,
        checkOut,
        workingHours,
        onLeave: Boolean(leave),
      });

    return prisma.attendance.update({
      where: { id },
      data: {
        date: nextDate,
        checkIn,
        checkOut,
        workingHours,
        overtimeHours,
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

    const prisma = this.prisma as any;
    const employees = await prisma.employee.findMany({
      include: { shift: true },
    });

    for (const employee of employees) {
      if (!employee.shift) {
        continue;
      }

      const leave = await this.findApprovedLeaveForDay(employee.id, target);

      const existing = await prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: target,
          },
        },
        include: { shift: true },
      });

      if (!existing) {
        await prisma.attendance.create({
          data: {
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
        const overtimeHours = this.calculateOvertimeHours(workingHours, employee.shift);

        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            checkOut: autoCheckOut,
            workingHours,
            overtimeHours,
            isAutoClosed: true,
            status: this.calculateStatus({
              day: target,
              checkIn: new Date(existing.checkIn),
              checkOut: autoCheckOut,
              workingHours,
              onLeave: false,
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
