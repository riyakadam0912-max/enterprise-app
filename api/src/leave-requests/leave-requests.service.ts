import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import type { Cache } from 'cache-manager';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';
import { WorkflowEngineService } from '../workflows/workflow-engine.service';
import {
  createHrApprovalState,
  createManagerApprovalState,
  createRejectionState,
  createSubmittedApprovalState,
} from '../common/workflows/approval-workflow';
import { DASHBOARD_CACHE_KEY } from '../common/utils/cache-keys';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessUnitsService } from '../business-units/business-units.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { EmployeeLeaveRequestedEvent } from './events/employee-leave-requested.event';

const FINAL_LEAVE_STATUSES = ['APPROVED', 'REJECTED', 'CANCELLED'] as const;
type FinalLeaveStatus = (typeof FINAL_LEAVE_STATUSES)[number];

function isFinalLeaveStatus(status: string): status is FinalLeaveStatus {
  return FINAL_LEAVE_STATUSES.some((value) => value === status);
}

@Injectable()
export class LeaveRequestsService {
  private readonly logger = new Logger(LeaveRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly businessUnitsService: BusinessUnitsService,
  ) {}

  private async invalidateDashboardCache() {
    await this.cacheManager.del(DASHBOARD_CACHE_KEY);
  }

  private getOrganizationId(user: AuthUser): number {
    if (user.organizationId === null) {
      throw new ForbiddenException('User has no associated organization');
    }

    return user.organizationId;
  }

  private async resolveCurrentEmployeeId(user: AuthUser) {
    const organizationId = this.getOrganizationId(user);
    if (user.employeeId) {
      const linkedEmployee = await this.prisma.employee.findFirst({
        where: {
          id: user.employeeId,
          organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (linkedEmployee) return linkedEmployee.id;
    }

    const employee = user.email
      ? await this.prisma.employee.findFirst({
          where: {
            email: user.email,
            organizationId,
            deletedAt: null,
          },
          orderBy: { id: 'asc' },
          select: { id: true },
        })
      : null;

    if (!employee) {
      throw new ForbiddenException('User is not linked to an employee profile');
    }

    return employee.id;
  }

  private async findScoped(id: number, user: AuthUser) {
    const organizationId = this.getOrganizationId(user);
    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);

    const where: Prisma.LeaveRequestWhereInput = {
      id,
      organizationId,
      employee:
        user.role === Role.EMPLOYEE
          ? { organizationId, deletedAt: null }
          : buWhere,
    };

    if (user.role === Role.EMPLOYEE) {
      where.employeeId = await this.resolveCurrentEmployeeId(user);
    } else if (user.role === Role.MANAGER) {
      where.employee = {
        ...(where.employee as Prisma.EmployeeWhereInput),
        user: { managerId: user.userId },
      };
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
    });
  }

  private computeLeaveDays(startDate: Date, endDate: Date) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(
      1,
      Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1,
    );
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
    const organizationId = this.getOrganizationId(user);
    const currentEmployeeId =
      user.role === Role.EMPLOYEE
        ? await this.resolveCurrentEmployeeId(user)
        : (user.employeeId ?? null);
    const employeeId = dto.employeeId ?? currentEmployeeId;

    if (user.role === Role.EMPLOYEE) {
      const ownEmployeeId =
        currentEmployeeId ?? (await this.resolveCurrentEmployeeId(user));
      if (dto.employeeId !== undefined && dto.employeeId !== ownEmployeeId) {
        throw new ForbiddenException(
          'Employees can only create leave requests for themselves',
        );
      }
    }

    if (employeeId === null || employeeId === undefined) {
      throw new ForbiddenException(
        'Employee identifier is required to create a leave request',
      );
    }

    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...(user.role === Role.EMPLOYEE
          ? { organizationId, deletedAt: null }
          : buWhere),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, managerId: true },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee #${employeeId} not found`);
    }

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        organizationId,
        employeeId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        leaveType: dto.leaveType,
        reason: dto.reason,
        status: 'PENDING_MANAGER',
        appliedOn: new Date(),
        ...createSubmittedApprovalState(user.userId),
      },
      include: { employee: true },
    });

    try {
      await this.workflowEngine.submitWorkflow({
        definitionKey: 'leave-request-approval',
        entityType: 'LeaveRequest',
        entityId: leaveRequest.id,
        initiatedBy: user.userId,
        organizationId,
        context: {
          employeeId,
          requestorUserId: user.userId,
          leaveType: dto.leaveType,
          startDate: leaveRequest.startDate.toISOString(),
          endDate: leaveRequest.endDate.toISOString(),
        },
        metadata: {
          leaveType: dto.leaveType,
          reason: dto.reason ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Leave request ${leaveRequest.id} was created, but workflow initialization failed`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    await this.invalidateDashboardCache();

    // Emit event for leave request notification workflow
    const empUser = employee.user;
    if (empUser) {
      const managerUser =
        empUser.managerId === null
          ? null
          : await this.prisma.user.findUnique({
              where: { id: empUser.managerId },
              select: { name: true, email: true },
            });

      const event = new EmployeeLeaveRequestedEvent(
        leaveRequest.id,
        employeeId,
        empUser.name,
        empUser.email,
        empUser.managerId,
        managerUser?.name ?? null,
        managerUser?.email ?? null,
        dto.leaveType,
        leaveRequest.startDate,
        leaveRequest.endDate,
        dto.reason,
        organizationId,
      );

      this.eventEmitter.emit('employee.leave_requested', event);
    }

    return leaveRequest;
  }

  async findAll(user: AuthUser) {
    const organizationId = this.getOrganizationId(user);
    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);

    const where: Prisma.LeaveRequestWhereInput = {
      organizationId,
      employee:
        user.role === Role.EMPLOYEE
          ? { organizationId, deletedAt: null }
          : buWhere,
    };

    if (user.role === Role.EMPLOYEE) {
      where.employeeId = await this.resolveCurrentEmployeeId(user);
    } else if (user.role === Role.MANAGER) {
      where.employee = {
        ...(where.employee as Prisma.EmployeeWhereInput),
        user: { managerId: user.userId },
      };
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
    });
  }

  async findOne(id: number, user: AuthUser) {
    const req = await this.findScoped(id, user);
    if (!req) throw new NotFoundException(`LeaveRequest #${id} not found`);
    return req;
  }

  async update(id: number, dto: UpdateLeaveRequestDto, user: AuthUser) {
    const organizationId = this.getOrganizationId(user);
    const existing = await this.findScoped(id, user);
    if (!existing) {
      throw new NotFoundException(`LeaveRequest #${id} not found`);
    }

    if (user.role === Role.EMPLOYEE && isFinalLeaveStatus(existing.status)) {
      throw new ForbiddenException('Finalized leave requests cannot be edited');
    }

    const data: Prisma.LeaveRequestUpdateInput = {};
    if (dto.employeeId !== undefined)
      data.employee = dto.employeeId
        ? { connect: { id: dto.employeeId } }
        : { disconnect: true };

    // Validate new employeeId is within user's BU scope if provided
    if (dto.employeeId !== undefined && dto.employeeId !== null) {
      const buScope = await this.businessUnitsService.resolveScope(user as any);
      const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
      const targetEmployee = await this.prisma.employee.findFirst({
        where: { id: dto.employeeId, ...buWhere },
        select: { id: true },
      });
      if (!targetEmployee) {
        throw new ForbiddenException(
          'Target employee is not within your authorized Business Unit scope',
        );
      }
    }

    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.leaveType !== undefined) data.leaveType = dto.leaveType;
    if (dto.reason !== undefined) data.reason = dto.reason;
    const updated = await this.prisma.leaveRequest.update({
      where: { id, organizationId },
      data,
    });

    await this.invalidateDashboardCache();
    return updated;
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.getOrganizationId(user);
    await this.findOne(id, user);
    const deleted = await this.prisma.leaveRequest.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
    await this.invalidateDashboardCache();
    return deleted;
  }

  async managerApprove(id: number, user: AuthUser) {
    const organizationId = this.getOrganizationId(user);
    const request = await this.findScoped(id, user);
    if (!request) {
      throw new NotFoundException(`LeaveRequest #${id} not found`);
    }

    if (request.status !== 'PENDING_MANAGER') {
      throw new ForbiddenException(
        'Leave request is not pending manager approval',
      );
    }

    const result = await this.workflowEngine.approveWorkflow({
      definitionKey: 'leave-request-approval',
      entityType: 'LeaveRequest',
      entityId: id,
      userId: user.userId,
      businessStatus: 'PENDING_HR',
      trailAction: 'MANAGER_APPROVED',
      approvedByLabel: `MANAGER:${user.userId}`,
      trail: request.approvalTrail,
      organizationId,
    });

    const updated = await this.prisma.leaveRequest.update({
      where: { id, organizationId },
      data: {
        ...createManagerApprovalState(request.approvalTrail, user.userId),
        approvalTrail: result.legacyState.approvalTrail,
      },
    });

    await this.invalidateDashboardCache();
    return updated;
  }

  async hrApprove(id: number, user: AuthUser) {
    const organizationId = this.getOrganizationId(user);
    const request = await this.findScoped(id, user);
    if (!request) {
      throw new NotFoundException(`LeaveRequest #${id} not found`);
    }

    const canFinalizeFromManagerStage =
      (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) &&
      request.status === 'PENDING_MANAGER';
    if (request.status !== 'PENDING_HR' && !canFinalizeFromManagerStage) {
      throw new ForbiddenException('Leave request is not pending HR approval');
    }

    // Prevent HR from approving their own leave request
    if (user.role === Role.HR && user.employeeId === request.employeeId) {
      throw new ForbiddenException(
        'HR cannot approve their own leave request. This requires Admin or Super Admin approval.',
      );
    }

    const leaveDays = this.computeLeaveDays(request.startDate, request.endDate);

    const result = await this.workflowEngine.approveWorkflow({
      definitionKey: 'leave-request-approval',
      entityType: 'LeaveRequest',
      entityId: id,
      userId: user.userId,
      businessStatus: 'APPROVED',
      trailAction: 'HR_APPROVED',
      approvedByLabel: `${user.role}:${user.userId}`,
      trail: request.approvalTrail,
      organizationId,
    });

    const approved = await this.prisma.$transaction(async (tx) => {
      const employee = request.employeeId
        ? await tx.employee.findFirst({
            where: {
              id: request.employeeId,
              organizationId,
            },
            include: { shift: true },
          })
        : null;

      if (employee) {
        const currentBalance = employee.leaveBalance ?? 0;
        await tx.employee.update({
          where: { id: employee.id, organizationId },
          data: { leaveBalance: Math.max(0, currentBalance - leaveDays) },
        });
      }

      const approved = await tx.leaveRequest.update({
        where: { id, organizationId },
        data: {
          ...createHrApprovalState(request.approvalTrail, user.userId),
          approvalTrail: result.legacyState.approvalTrail,
          isPaid: request.leaveType?.toUpperCase().includes('UNPAID')
            ? false
            : true,
        },
      });

      if (request.employeeId) {
        for (const leaveDay of this.enumerateDays(
          approved.startDate,
          approved.endDate,
        )) {
          await tx.attendance.upsert({
            where: {
              employeeId_date: {
                employeeId: request.employeeId,
                date: leaveDay,
              },
            },
            update: {
              organizationId,
              shiftId: employee?.shiftId ?? undefined,
              status: 'LEAVE',
              isPaidLeave: approved.isPaid ?? true,
              checkIn: null,
              checkOut: null,
              workingHours: null,
              lateMinutes: 0,
              overtimeHours: 0,
              remarks: 'On Leave',
            },
            create: {
              organizationId,
              employeeId: request.employeeId,
              shiftId: employee?.shiftId ?? undefined,
              date: leaveDay,
              status: 'LEAVE',
              isPaidLeave: approved.isPaid ?? true,
              requiredHours: employee?.shift?.requiredHours ?? 8,
              remarks: 'On Leave',
            },
          });
        }
      }

      return approved;
    });

    await this.invalidateDashboardCache();

    return approved;
  }

  async reject(id: number, user: AuthUser, reason?: string) {
    const organizationId = this.getOrganizationId(user);
    const request = await this.findScoped(id, user);
    if (!request) {
      throw new NotFoundException(`LeaveRequest #${id} not found`);
    }

    const result = await this.workflowEngine.rejectWorkflow({
      definitionKey: 'leave-request-approval',
      entityType: 'LeaveRequest',
      entityId: id,
      userId: user.userId,
      businessStatus: 'REJECTED',
      trailAction: 'REJECTED',
      approvedByLabel: `${user.role}:${user.userId} (Rejected)`,
      reason,
      trail: request.approvalTrail,
      organizationId,
    });

    const updated = await this.prisma.leaveRequest.update({
      where: { id, organizationId },
      data: {
        ...createRejectionState(
          request.approvalTrail,
          String(user.role),
          user.userId,
          reason,
        ),
        approvalTrail: result.legacyState.approvalTrail,
      },
    });

    await this.invalidateDashboardCache();
    return updated;
  }

  async importRecords(
    records: Record<string, any>[],
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    const organizationId = this.getOrganizationId(user);
    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.startDate) {
        errors.push(`Row ${i + 1}: 'startDate' is required`);
        continue;
      }
      if (!r.endDate) {
        errors.push(`Row ${i + 1}: 'endDate' is required`);
        continue;
      }
      if (!r.leaveType) {
        errors.push(`Row ${i + 1}: 'leaveType' is required`);
        continue;
      }
      if (r.employeeId) {
        const validEmployee = await this.prisma.employee.findFirst({
          where: {
            id: Number(r.employeeId),
            ...buWhere,
          },
          select: { id: true },
        });
        if (!validEmployee) {
          errors.push(
            `Row ${i + 1}: Employee #${r.employeeId} not found or not authorized`,
          );
          continue;
        }
      }
      try {
        await this.prisma.leaveRequest.create({
          data: {
            organizationId,
            employeeId: r.employeeId ? Number(r.employeeId) : null,
            startDate: new Date(String(r.startDate)),
            endDate: new Date(String(r.endDate)),
            leaveType: String(r.leaveType),
            reason: r.reason ? String(r.reason) : undefined,
            status: r.status ? String(r.status) : 'PENDING',
            appliedOn: r.appliedOn ? new Date(String(r.appliedOn)) : undefined,
            approvedBy: r.approvedBy ? String(r.approvedBy) : null,
          },
        });
        imported++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Row ${i + 1}: ${msg ?? 'Unknown error'}`);
      }
    }
    await this.invalidateDashboardCache();
    return { imported, errors };
  }
}
