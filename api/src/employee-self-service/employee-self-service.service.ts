import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../common/types/auth';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { SubmitExpenseDto } from './dto/submit-expense.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class EmployeeSelfServiceService {
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

  /**
   * Helper method to resolve employeeId from user context
   * Handles cases where user.employeeId is null by looking up employee by email
   */
  private async resolveEmployeeId(user: AuthUser): Promise<number> {
    const organizationId = await this.resolveOrganizationId(user);

    if (user.employeeId != null) {
      const employee = await this.prisma.employee.findFirst({
        where: {
          id: user.employeeId,
          organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (employee) {
        return employee.id;
      }
    }

    if (user.email) {
      const employee = await this.prisma.employee.findFirst({
        where: {
          email: user.email,
          organizationId,
          deletedAt: null,
        },
        orderBy: { id: 'asc' },
        select: { id: true },
      });

      if (employee) {
        await this.prisma.user.update({
          where: { id: user.userId || user.id },
          data: { employeeId: employee.id },
        });

        return employee.id;
      }
    }

    throw new NotFoundException(
      'No active employee record was found for your account in this organization. Please contact HR to set up your employee profile.',
    );
  }

  /**
   * ATTENDANCE OPERATIONS
   */

  async checkIn(user: AuthUser) {
    const employeeId = await this.resolveEmployeeId(user);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if already checked in today
    const existingAttendance = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
    });

    if (existingAttendance && existingAttendance.checkIn) {
      throw new BadRequestException('Already checked in today');
    }

    const now = new Date();
    let lateMinutes = 0;
    let shift: {
      name: string | null;
      startTime: string | null;
      endTime: string | null;
      gracePeriodMinutes: number | null;
    } | null = null;

    // Calculate late minutes if shift is assigned
    if (employee.shiftId) {
      shift = await this.prisma.shift.findUnique({
        where: { id: employee.shiftId },
        select: {
          name: true,
          startTime: true,
          endTime: true,
          gracePeriodMinutes: true,
        },
      });

      if (shift && shift.startTime) {
        const [hours, minutes] = shift.startTime.split(':');
        const shiftStart = new Date(today);
        shiftStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        const gracePeriod = shift.gracePeriodMinutes || 0;
        const actualStartWithGrace = new Date(
          shiftStart.getTime() + gracePeriod * 60 * 1000,
        );

        if (now > actualStartWithGrace) {
          lateMinutes = Math.floor(
            (now.getTime() - actualStartWithGrace.getTime()) / (60 * 1000),
          );
        }
      }
    }

    // Upsert attendance record
    const organizationId = await this.resolveOrganizationId(user);
    const attendance = await this.prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
      update: {
        checkIn: now,
        lateMinutes,
        status: 'PRESENT',
        shiftId: employee.shiftId || undefined,
      },
      create: {
        organizationId,
        employeeId,
        date: today,
        checkIn: now,
        lateMinutes,
        status: 'PRESENT',
        shiftId: employee.shiftId || undefined,
      },
      include: {
        employee: true,
        shift: true,
      },
    });

    return {
      success: true,
      message: `Check-in recorded at ${now.toLocaleTimeString()}`,
      data: {
        checkIn: attendance.checkIn,
        lateMinutes: attendance.lateMinutes,
        shift:
          employee.shiftId && shift
            ? {
                name: shift.name,
                startTime: shift.startTime,
                endTime: shift.endTime,
              }
            : null,
      },
    };
  }

  async checkOut(user: AuthUser) {
    const employeeId = await this.resolveEmployeeId(user);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
      include: { shift: true },
    });

    if (!attendance) {
      throw new BadRequestException('No check-in record found for today');
    }

    if (!attendance.checkIn) {
      throw new BadRequestException('Cannot check out without checking in');
    }

    if (attendance.checkOut) {
      throw new BadRequestException('Already checked out today');
    }

    const now = new Date();
    const checkInTime = new Date(attendance.checkIn);

    // Calculate working hours
    const workingHours = parseFloat(
      ((now.getTime() - checkInTime.getTime()) / (1000 * 3600)).toFixed(2),
    );

    let overtimeHours = 0;
    const requiredHours = attendance.shift?.requiredHours || 8;

    if (workingHours > requiredHours) {
      overtimeHours = parseFloat((workingHours - requiredHours).toFixed(2));
    }

    // Update attendance
    const updatedAttendance = await this.prisma.attendance.update({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
      data: {
        checkOut: now,
        workingHours,
        overtimeHours,
      },
      include: {
        employee: true,
        shift: true,
      },
    });

    return {
      success: true,
      message: `Check-out recorded at ${now.toLocaleTimeString()}`,
      data: {
        checkIn: updatedAttendance.checkIn,
        checkOut: updatedAttendance.checkOut,
        workingHours: updatedAttendance.workingHours,
        overtimeHours: updatedAttendance.overtimeHours,
        late: updatedAttendance.lateMinutes > 0,
        lateMinutes: updatedAttendance.lateMinutes,
      },
    };
  }

  async getMyAttendanceToday(user: AuthUser) {
    const employeeId = await this.resolveEmployeeId(user);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
      include: {
        employee: { include: { shift: true } },
        shift: true,
      },
    });

    if (!attendance) {
      // Return not checked in status
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        include: { shift: true },
      });

      return {
        status: 'NOT_CHECKED_IN',
        checkIn: null,
        checkOut: null,
        workingHours: 0,
        shift: employee?.shift
          ? {
              name: employee.shift.name,
              startTime: employee.shift.startTime,
              endTime: employee.shift.endTime,
              requiredHours: employee.shift.requiredHours,
            }
          : null,
      };
    }

    return {
      status: attendance.checkOut ? 'CHECKED_OUT' : 'CHECKED_IN',
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
      workingHours: attendance.workingHours,
      lateMinutes: attendance.lateMinutes,
      overtimeHours: attendance.overtimeHours,
      shift: attendance.shift
        ? {
            name: attendance.shift.name,
            startTime: attendance.shift.startTime,
            endTime: attendance.shift.endTime,
            requiredHours: attendance.shift.requiredHours,
          }
        : null,
    };
  }

  async getMyAttendanceHistory(user: AuthUser, limit: number = 30) {
    const employeeId = await this.resolveEmployeeId(user);
    const attendances = await this.prisma.attendance.findMany({
      where: { employeeId },
      include: { shift: true },
      orderBy: { date: 'desc' },
      take: limit,
    });

    return attendances.map((att) => ({
      date: att.date,
      status: att.status,
      checkIn: att.checkIn,
      checkOut: att.checkOut,
      workingHours: att.workingHours,
      lateMinutes: att.lateMinutes,
      overtimeHours: att.overtimeHours,
      shift: att.shift
        ? {
            name: att.shift.name,
            startTime: att.shift.startTime,
            endTime: att.shift.endTime,
          }
        : null,
    }));
  }

  /**
   * LEAVE OPERATIONS
   */

  async applyLeave(user: AuthUser, dto: ApplyLeaveDto) {
    const employeeId = await this.resolveEmployeeId(user);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('End date cannot be before start date');
    }

    // Check for overlapping leaves
    const overlappingLeave = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }],
      },
    });

    if (overlappingLeave) {
      throw new BadRequestException(
        'You already have a leave request for these dates',
      );
    }

    const organizationId = await this.resolveOrganizationId(user);
    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        organizationId,
        employeeId,
        startDate,
        endDate,
        leaveType: dto.leaveType,
        reason: dto.reason,
        status: 'PENDING',
        appliedOn: new Date(),
      },
    });

    // Calculate number of days
    const daysDiff =
      (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24) + 1;

    return {
      success: true,
      message: `Leave request submitted for ${daysDiff} day(s)`,
      data: {
        id: leaveRequest.id,
        leaveType: leaveRequest.leaveType,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        status: leaveRequest.status,
        days: daysDiff,
      },
    };
  }

  async getMyLeaveBalance(user: AuthUser) {
    const employeeId = await this.resolveEmployeeId(user);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);

    // Get approved leaves for this year
    const approvedLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        startDate: { gte: yearStart },
        endDate: { lte: yearEnd },
      },
    });

    // Calculate total days taken
    let daysTaken = 0;
    approvedLeaves.forEach((leave) => {
      const days =
        (new Date(leave.endDate).getTime() -
          new Date(leave.startDate).getTime()) /
          (1000 * 3600 * 24) +
        1;
      daysTaken += days;
    });

    // Default: 20 days per year
    const totalAllocation = 20;
    const balance = totalAllocation - daysTaken;

    return {
      totalAllocation,
      daysTaken,
      balance: Math.max(0, balance),
      year: currentYear,
    };
  }

  async getMyLeaveHistory(user: AuthUser) {
    const employeeId = await this.resolveEmployeeId(user);
    const leaves = await this.prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });

    return leaves.map((leave) => {
      const days =
        (new Date(leave.endDate).getTime() -
          new Date(leave.startDate).getTime()) /
          (1000 * 3600 * 24) +
        1;

      return {
        id: leave.id,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        reason: leave.reason,
        status: leave.status,
        days,
        appliedOn: leave.appliedOn,
      };
    });
  }

  /**
   * PAYSLIP OPERATIONS
   */

  async getMyPayslips(user: AuthUser) {
    const employeeId = await this.resolveEmployeeId(user);
    const payslips = await this.prisma.payslip.findMany({
      where: { employeeId },
      include: { payrollEntry: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return payslips.map((payslip) => ({
      id: payslip.id,
      month: payslip.month,
      year: payslip.year,
      grossEarnings: payslip.grossEarnings,
      netPay: payslip.netPay,
      status: payslip.payrollEntry.status,
      generatedAt: payslip.generatedAt,
      downloadedAt: payslip.downloadedAt,
    }));
  }

  async getPayslipDetails(payslipId: number, user: AuthUser) {
    const employeeId = await this.resolveEmployeeId(user);
    const payslip = await this.prisma.payslip.findUnique({
      where: { id: payslipId },
    });

    if (!payslip) {
      throw new NotFoundException('Payslip not found');
    }

    if (payslip.employeeId !== employeeId) {
      throw new UnauthorizedException('You can only view your own payslips');
    }

    return {
      month: payslip.month,
      year: payslip.year,
      earnings: {
        basic: payslip.basicSalary,
        hra: payslip.hra,
        allowances: payslip.allowances,
        bonus: payslip.bonus,
        overtime: payslip.overtime,
        reimbursements: payslip.reimbursements,
        total: payslip.grossEarnings,
      },
      deductions: {
        pf: payslip.pfDeduction,
        esi: payslip.esiDeduction,
        professionalTax: payslip.professionalTax,
        tds: payslip.tdsDeduction,
        lossOfPay: payslip.lossOfPay,
        lateMarkPenalty: payslip.lateMarkPenalty,
        other: payslip.otherDeductions,
        total: payslip.totalDeductions,
      },
      netPay: payslip.netPay,
      attendance: {
        workingDays: payslip.workingDays,
        presentDays: payslip.presentDays,
        absenceDays: payslip.absenceDays,
        paidLeave: payslip.paidLeaveTaken,
        unpaidLeave: payslip.unpaidLeaveTaken,
        lateCount: payslip.lateCount,
        overtimeHours: payslip.overtimeHours,
      },
      generatedAt: payslip.generatedAt,
    };
  }

  async getLastPayslip(user: AuthUser) {
    const employeeId = await this.resolveEmployeeId(user);
    const lastPayslip = await this.prisma.payslip.findFirst({
      where: { employeeId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 1,
    });

    if (!lastPayslip) {
      return null;
    }

    return {
      id: lastPayslip.id,
      month: lastPayslip.month,
      year: lastPayslip.year,
      netPay: lastPayslip.netPay,
      generatedAt: lastPayslip.generatedAt,
    };
  }

  /**
   * EXPENSE OPERATIONS
   */

  async submitExpense(user: AuthUser, dto: SubmitExpenseDto) {
    const employeeId = await this.resolveEmployeeId(user);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const userId = employee.user?.id ?? null;

    const organizationId = await this.resolveOrganizationId(user);
    const expense = await this.prisma.expense.create({
      data: {
        organizationId,
        employeeId,
        submittedByUserId: userId,
        amount: dto.amount,
        category: dto.category,
        description: dto.description,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
        currency: dto.currency || 'INR',
        status: 'PENDING',
      },
    });

    return {
      success: true,
      message: 'Expense submitted successfully',
      data: {
        id: expense.id,
        amount: expense.amount,
        category: expense.category,
        status: expense.status,
        createdAt: expense.createdAt,
      },
    };
  }

  async getMyExpenses(user: AuthUser) {
    const employeeId = await this.resolveEmployeeId(user);
    const expenses = await this.prisma.expense.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });

    return expenses.map((exp) => ({
      id: exp.id,
      date: exp.expenseDate,
      category: exp.category,
      description: exp.description,
      amount: exp.amount,
      currency: exp.currency,
      status: exp.status,
      submittedAt: exp.createdAt,
      approvedAt: exp.approvedAt,
      rejectionReason: exp.rejectionReason,
    }));
  }

  async getExpenseDetails(expenseId: number, user: AuthUser) {
    const employeeId = await this.resolveEmployeeId(user);
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (expense.employeeId !== employeeId) {
      throw new UnauthorizedException('You can only view your own expenses');
    }

    return {
      id: expense.id,
      date: expense.expenseDate,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency,
      status: expense.status,
      receiptImage: expense.receiptImage,
      submittedAt: expense.createdAt,
      approvedAt: expense.approvedAt,
      rejectionReason: expense.rejectionReason,
      approvalTrail: expense.approvalTrail,
    };
  }

  /**
   * PROFILE OPERATIONS
   */

  async getMyProfile(user: AuthUser) {
    try {
      const employeeId = await this.resolveEmployeeId(user);
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          user: true,
          shift: true,
        },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      return {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        phoneNumber: employee.phoneNumber,
        position: employee.position,
        designation: employee.designation,
        department: employee.department,
        hireDate: employee.hireDate,
        manager: employee.manager,
        shift: employee.shift
          ? {
              id: employee.shift.id,
              name: employee.shift.name,
              type: employee.shift.type,
            }
          : null,
        address: employee.address,
        emergencyContact: employee.emergencyContact,
        emergencyContactPhone: employee.emergencyContactPhone,
        user: employee.user,
      };
    } catch (e) {
      console.error('Error in getMyProfile:', e);
      // If user doesn't have an employee, return user profile
      const existingUser = await this.prisma.user.findUnique({
        where: { id: user.userId || user.id },
      });

      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      return {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        phone: existingUser.phone,
        phoneNumber: existingUser.phone,
        position: null,
        designation: null,
        department: null,
        hireDate: null,
        manager: null,
        shift: null,
        address: existingUser.address,
        emergencyContact: null,
        emergencyContactPhone: null,
        user: existingUser,
      };
    }
  }

  async updateMyProfile(user: AuthUser, dto: UpdateProfileDto) {
    try {
      const employeeId = await this.resolveEmployeeId(user);
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      // Build update data for only provided fields
      const updateData: Prisma.EmployeeUpdateInput = {};
      if (dto.phoneNumber !== undefined)
        updateData.phoneNumber = dto.phoneNumber;
      if (dto.address !== undefined) updateData.address = dto.address;
      if (dto.emergencyContact !== undefined)
        updateData.emergencyContact = dto.emergencyContact;
      if (dto.emergencyContactPhone !== undefined)
        updateData.emergencyContactPhone = dto.emergencyContactPhone;

      // Update only allowed fields
      const updated = await this.prisma.employee.update({
        where: { id: employeeId },
        data: updateData,
        include: {
          user: true,
          shift: true,
        },
      });

      return {
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: updated.id,
          name: updated.name,
          phoneNumber: updated.phoneNumber,
        },
      };
    } catch (e) {
      console.error('Error in updateMyProfile:', e);
      // If user doesn't have employee, update user profile
      const userId = user.userId || user.id;
      const updateUserData: Prisma.UserUpdateInput = {};
      if (dto.phoneNumber !== undefined) updateUserData.phone = dto.phoneNumber;
      if (dto.address !== undefined) updateUserData.address = dto.address;

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateUserData,
      });

      return {
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: updatedUser.id,
          name: updatedUser.name,
          phone: updatedUser.phone,
        },
      };
    }
  }
}
