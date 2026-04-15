import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { EmployeeLeaveRequestedEvent } from './events/employee-leave-requested.event';

type AuthUser = { userId: number; role: Role; employeeId?: number | null };

const FINAL_LEAVE_STATUSES = ['APPROVED', 'REJECTED', 'CANCELLED'] as const;

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async resolveCurrentEmployeeId(user: AuthUser) {
    if (user.employeeId) return user.employeeId;

    const linked = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { employeeId: true },
    } as any) as { employeeId?: number | null } | null;

    if (!linked?.employeeId) {
      throw new ForbiddenException('User is not linked to an employee profile');
    }

    return linked.employeeId;
  }

  private async findScoped(id: number, user: AuthUser) {
    const where: Record<string, any> = { id };

    if (user.role === Role.EMPLOYEE) {
      where.employeeId = await this.resolveCurrentEmployeeId(user);
    } else if (user.role === Role.MANAGER) {
      where.employee = { user: { managerId: user.userId } };
    }

    return this.prisma.leaveRequest.findFirst({
      where,
      include: {
        employee: {
          include: {
            user: {
              select: { id: true, name: true, managerId: true },
            },
          },
        },
      },
    } as any);
  }

  private computeLeaveDays(startDate: Date, endDate: Date) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1);
  }

  private enumerateDays(startDate: Date, endDate: Date) {
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    while (cursor.getTime() <= end.getTime()) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }

  async create(dto: CreateLeaveRequestDto, user: AuthUser) {
    const employeeId = dto.employeeId ?? await this.resolveCurrentEmployeeId(user);

    if (user.role === Role.EMPLOYEE) {
      const ownId = await this.resolveCurrentEmployeeId(user);
      if (employeeId !== ownId) {
        throw new ForbiddenException('Employees can only create leave requests for themselves');
      }
    }

    // Fetch employee details for event emission
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: { select: { id: true, name: true, email: true, managerId: true } },
      },
    } as any) as any;

    if (!employee) {
      throw new NotFoundException(`Employee #${employeeId} not found`);
    }

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        employeeId,
        startDate:  new Date(dto.startDate),
        endDate:    new Date(dto.endDate),
        leaveType:  dto.leaveType,
        reason:     dto.reason,
        status:     dto.status ?? 'PENDING_MANAGER',
        appliedOn:  dto.appliedOn  ? new Date(dto.appliedOn)  : new Date(),
        approvedBy: dto.approvedBy,
      },
      include: { employee: true },
    });

    // Emit event for leave request notification workflow
    if (employee.user?.managerId) {
      const managerUser = await this.prisma.user.findUnique({
        where: { id: employee.user.managerId },
        select: { name: true },
      });

      const event = new EmployeeLeaveRequestedEvent(
        leaveRequest.id,
        employeeId,
        employee.user.name,
        employee.user.email,
        employee.user.managerId,
        managerUser?.name || null,
        dto.leaveType,
        leaveRequest.startDate,
        leaveRequest.endDate,
        dto.reason,
      );

      this.eventEmitter.emit('employee.leave_requested', event);
    }

    return leaveRequest;
  }

  async findAll(user: AuthUser) {
    const where: Record<string, any> = {};

    if (user.role === Role.EMPLOYEE) {
      where.employeeId = await this.resolveCurrentEmployeeId(user);
    } else if (user.role === Role.MANAGER) {
      where.employee = { user: { managerId: user.userId } };
    }

    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          include: {
            user: { select: { id: true, name: true, managerId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    } as any);
  }

  async findOne(id: number, user: AuthUser) {
    const req = await this.findScoped(id, user);
    if (!req) throw new NotFoundException(`LeaveRequest #${id} not found`);
    return req;
  }

  async update(id: number, dto: UpdateLeaveRequestDto, user: AuthUser) {
    const existing = await this.findScoped(id, user);
    if (!existing) {
      throw new NotFoundException(`LeaveRequest #${id} not found`);
    }

    if (user.role === Role.EMPLOYEE && FINAL_LEAVE_STATUSES.includes(existing.status as any)) {
      throw new ForbiddenException('Finalized leave requests cannot be edited');
    }

    const data: Prisma.LeaveRequestUpdateInput = {};
    if (dto.employeeId  !== undefined) data.employee = dto.employeeId ? { connect: { id: dto.employeeId } } : { disconnect: true };
    if (dto.startDate  !== undefined) data.startDate  = new Date(dto.startDate);
    if (dto.endDate    !== undefined) data.endDate    = new Date(dto.endDate);
    if (dto.leaveType  !== undefined) data.leaveType  = dto.leaveType;
    if (dto.reason     !== undefined) data.reason     = dto.reason;
    if (dto.status     !== undefined) data.status     = dto.status;
    if (dto.appliedOn  !== undefined) data.appliedOn  = dto.appliedOn ? new Date(dto.appliedOn) : null;
    if (dto.approvedBy !== undefined) data.approvedBy = dto.approvedBy;
    return this.prisma.leaveRequest.update({
      where: { id },
      data,
    });
  }

  async remove(id: number, user: AuthUser) {
    await this.findOne(id, user);
    return this.prisma.leaveRequest.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async managerApprove(id: number, user: Pick<AuthUser, 'userId' | 'role'>) {
    const request = await this.findScoped(id, { ...user, employeeId: null });
    if (!request) {
      throw new NotFoundException(`LeaveRequest #${id} not found`);
    }

    if (request.status !== 'PENDING_MANAGER') {
      throw new ForbiddenException('Leave request is not pending manager approval');
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'PENDING_HR',
        approvedBy: `Manager:${user.userId}`,
      },
    });
  }

  async hrApprove(id: number, user: Pick<AuthUser, 'userId' | 'role'>) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException(`LeaveRequest #${id} not found`);
    }

    if (request.status !== 'PENDING_HR') {
      throw new ForbiddenException('Leave request is not pending HR approval');
    }

    const leaveDays = this.computeLeaveDays(request.startDate, request.endDate);

    const approved = await this.prisma.$transaction(async (tx) => {
      const txPrisma = tx as any;
      if (request.employeeId) {
        const employee = await txPrisma.employee.findUnique({ where: { id: request.employeeId } });
        if (employee) {
          const currentBalance = employee.leaveBalance ?? 0;
          await txPrisma.employee.update({
            where: { id: employee.id },
            data: { leaveBalance: Math.max(0, currentBalance - leaveDays) },
          });
        }
      }

      return txPrisma.leaveRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: `HR:${user.userId}`,
          isPaid:
            request.leaveType?.toUpperCase().includes('UNPAID') ? false : true,
        },
      });
    });

    if (request.employeeId) {
      const approvedAny = approved as any;
      const leaveDays = this.enumerateDays(approved.startDate, approved.endDate);
      const employee = (await this.prisma.employee.findUnique({
        where: { id: request.employeeId },
        include: { shift: true },
      } as any)) as any;

      for (const leaveDay of leaveDays) {
        await (this.prisma as any).attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: request.employeeId,
              date: leaveDay,
            },
          },
          update: {
            shiftId: employee?.shiftId ?? null,
            status: 'LEAVE',
            isPaidLeave: approvedAny.isPaid ?? true,
            checkIn: null,
            checkOut: null,
            workingHours: null,
            lateMinutes: 0,
            overtimeHours: 0,
            remarks: 'On Leave',
          },
          create: {
            employeeId: request.employeeId,
            shiftId: employee?.shiftId ?? null,
            date: leaveDay,
            status: 'LEAVE',
            isPaidLeave: approvedAny.isPaid ?? true,
            requiredHours: employee?.shift?.requiredHours ?? 8,
            remarks: 'On Leave',
          },
        });
      }
    }

    return approved;
  }

  async reject(id: number, user: Pick<AuthUser, 'userId' | 'role'>, reason?: string) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException(`LeaveRequest #${id} not found`);
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: reason
          ? `${user.role}:${user.userId} (Rejected: ${reason})`
          : `${user.role}:${user.userId} (Rejected)`,
      },
    });
  }

  async importRecords(records: Record<string, any>[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.startDate) { errors.push(`Row ${i + 1}: 'startDate' is required`); continue; }
      if (!r.endDate)   { errors.push(`Row ${i + 1}: 'endDate' is required`);   continue; }
      if (!r.leaveType) { errors.push(`Row ${i + 1}: 'leaveType' is required`); continue; }
      try {
        await this.prisma.leaveRequest.create({
          data: {
            employeeId: r.employeeId ? Number(r.employeeId) : undefined,
            startDate:  new Date(String(r.startDate)),
            endDate:    new Date(String(r.endDate)),
            leaveType:  String(r.leaveType),
            reason:     r.reason     ? String(r.reason)     : undefined,
            status:     r.status     ? String(r.status)     : 'PENDING',
            appliedOn:  r.appliedOn  ? new Date(String(r.appliedOn))  : undefined,
            approvedBy: r.approvedBy ? String(r.approvedBy) : undefined,
          },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message ?? 'Unknown error'}`);
      }
    }
    return { imported, errors };
  }
}
