import {
  BadRequestException,
  ForbiddenException,
  Inject,
  InternalServerErrorException,
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
import { OrganizationScopeService } from '../organizations/organization-scope.service';
import { LeaveEntitlementsService } from './leave-entitlements.service';

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
    private readonly organizationScopeService: OrganizationScopeService,
    private readonly leaveEntitlementsService: LeaveEntitlementsService,
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
          user: { id: user.userId },
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
            user: { id: user.userId },
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

  private async getScopedLeaveWhere(
    user: AuthUser,
  ): Promise<Prisma.LeaveRequestWhereInput> {
    const organizationId = this.getOrganizationId(user);
    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
    const isHierarchyAdmin = user.role === Role.ADMIN || user.role === Role.HR;
    const organizationIds = isHierarchyAdmin
      ? ((await this.organizationScopeService.getOrganizationIds(user)) ?? [
          organizationId,
        ])
      : [organizationId];
    const descendantIds =
      organizationIds?.filter((id) => id !== organizationId) ?? [];

    let employeeWhere: Prisma.EmployeeWhereInput;
    let employeeId: number | undefined;
    if (user.role === Role.EMPLOYEE) {
      employeeWhere = { organizationId, deletedAt: null };
    } else if (isHierarchyAdmin && descendantIds.length > 0) {
      employeeWhere = {
        OR: [
          buWhere,
          { organizationId: { in: descendantIds }, deletedAt: null },
        ],
      };
    } else {
      employeeWhere = buWhere;
    }

    if (user.role === Role.EMPLOYEE) {
      employeeId = await this.resolveCurrentEmployeeId(user);
    } else if (user.role === Role.MANAGER) {
      employeeWhere = {
        OR: [
          {
            organizationId,
            deletedAt: null,
            user: { id: user.userId },
          },
          {
            AND: [buWhere, { user: { managerId: user.userId } }],
          },
        ],
      };
    }

    const where: Prisma.LeaveRequestWhereInput = {
      organizationId:
        organizationIds?.length === 1
          ? organizationIds[0]
          : { in: organizationIds ?? [] },
      employee: employeeWhere,
    };
    if (employeeId !== undefined) where.employeeId = employeeId;
    return where;
  }

  private async findScoped(id: number, user: AuthUser) {
    const where = await this.getScopedLeaveWhere(user);

    return this.prisma.leaveRequest.findFirst({
      where: { id, ...where },
      include: {
        employee: {
          include: {
            organization: { select: { id: true, name: true } },
            user: {
              select: { id: true, name: true, managerId: true },
            },
          },
        },
      },
    });
  }

  private validateDateRange(startDate: Date, endDate: Date) {
    if (endDate < startDate) {
      throw new BadRequestException('End date cannot be before start date');
    }
  }

  async create(dto: CreateLeaveRequestDto, user: AuthUser) {
    let organizationId = this.getOrganizationId(user);
    const currentEmployeeId =
      user.role === Role.EMPLOYEE || user.role === Role.MANAGER
        ? await this.resolveCurrentEmployeeId(user)
        : (user.employeeId ?? null);
    const employeeId = dto.employeeId ?? currentEmployeeId;
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const duration = dto.duration ?? 'FULL_DAY';
    this.validateDateRange(startDate, endDate);

    if (user.role === Role.EMPLOYEE || user.role === Role.MANAGER) {
      const ownEmployeeId =
        currentEmployeeId ?? (await this.resolveCurrentEmployeeId(user));
      if (dto.employeeId !== undefined && dto.employeeId !== ownEmployeeId) {
        const roleName = user.role === Role.MANAGER ? 'Managers' : 'Employees';
        throw new ForbiddenException(
          `${roleName} can only create leave requests for themselves`,
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
    const organizationIds =
      user.role === Role.ADMIN || user.role === Role.HR
        ? await this.organizationScopeService.getOrganizationIds(user)
        : [organizationId];
    const descendantIds =
      organizationIds?.filter((id) => id !== organizationId) ?? [];
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...(user.role === Role.EMPLOYEE || user.role === Role.MANAGER
          ? { organizationId, deletedAt: null }
          : user.role === Role.ADMIN || user.role === Role.HR
            ? descendantIds.length > 0
              ? {
                  OR: [
                    buWhere,
                    { organizationId: { in: descendantIds }, deletedAt: null },
                  ],
                }
              : buWhere
            : buWhere),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, managerId: true },
        },
        organization: { select: { id: true, name: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee #${employeeId} not found`);
    }
    organizationId = employee.organizationId;

    const requestedDays =
      await this.leaveEntitlementsService.countScheduledLeaveDays(
        employeeId,
        organizationId,
        startDate,
        endDate,
        duration,
      );
    if (requestedDays <= 0) {
      throw new BadRequestException(
        'The selected dates contain no scheduled workdays',
      );
    }

    const overlappingLeave = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        organizationId,
        deletedAt: null,
        status: {
          in: ['PENDING', 'PENDING_MANAGER', 'PENDING_HR', 'APPROVED'],
        },
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
      select: { id: true },
    });
    if (overlappingLeave) {
      throw new BadRequestException(
        'You already have a leave request for these dates',
      );
    }

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        organizationId,
        employeeId,
        startDate,
        endDate,
        duration,
        leaveType: dto.leaveType,
        reason: dto.reason,
        status: 'PENDING_MANAGER',
        appliedOn: new Date(),
        ...createSubmittedApprovalState(user.userId),
      },
      include: {
        employee: {
          include: { organization: { select: { id: true, name: true } } },
        },
      },
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
          duration,
          requiredWorkHours: duration === 'HALF_DAY' ? 5 : undefined,
          startDate: leaveRequest.startDate.toISOString(),
          endDate: leaveRequest.endDate.toISOString(),
        },
        metadata: {
          leaveType: dto.leaveType,
          duration,
          reason: dto.reason ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Leave request ${leaveRequest.id} was created, but workflow initialization failed`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.prisma.leaveRequest.delete({
        where: { id: leaveRequest.id, organizationId },
      });
      throw new InternalServerErrorException(
        'The leave request could not be submitted for approval. Please try again.',
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
        duration,
      );

      this.eventEmitter.emit('employee.leave_requested', event);
    }

    return leaveRequest;
  }

  async findAll(user: AuthUser) {
    const where = await this.getScopedLeaveWhere(user);

    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          include: {
            organization: { select: { id: true, name: true } },
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
    const existing = await this.findScoped(id, user);
    if (!existing) {
      throw new NotFoundException(`LeaveRequest #${id} not found`);
    }

    if (isFinalLeaveStatus(existing.status)) {
      throw new ForbiddenException('Finalized leave requests cannot be edited');
    }

    if (
      user.role === Role.EMPLOYEE &&
      dto.employeeId !== undefined &&
      dto.employeeId !== existing.employeeId
    ) {
      throw new ForbiddenException(
        'Employees cannot reassign a leave request to another employee',
      );
    }

    const data: Prisma.LeaveRequestUpdateInput = {};
    if (dto.employeeId !== undefined)
      data.employee = dto.employeeId
        ? { connect: { id: dto.employeeId } }
        : { disconnect: true };

    // Validate new employeeId is within user's BU scope if provided
    if (dto.employeeId !== undefined && dto.employeeId !== null) {
      const buScope = await this.businessUnitsService.resolveScope(user as any);
      const organizationIds =
        user.role === Role.ADMIN || user.role === Role.HR
          ? await this.organizationScopeService.getOrganizationIds(user)
          : [this.getOrganizationId(user)];
      const targetEmployee = await this.prisma.employee.findFirst({
        where: {
          id: dto.employeeId,
          organizationId: { in: organizationIds ?? [] },
          deletedAt: null,
        },
        select: { id: true, organizationId: true, businessUnitId: true },
      });
      if (!targetEmployee) {
        throw new ForbiddenException(
          'Target employee is not within your authorized Business Unit scope',
        );
      }
      if (targetEmployee.organizationId !== existing.organizationId) {
        throw new ForbiddenException(
          'A leave request cannot be reassigned to another organization',
        );
      }
      if (targetEmployee.organizationId === user.organizationId) {
        await this.businessUnitsService.assertRecordAccessible(
          buScope,
          targetEmployee.businessUnitId,
          'leave:target-employee',
        );
      }
    }

    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    const updatedStartDate = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const updatedEndDate = dto.endDate
      ? new Date(dto.endDate)
      : existing.endDate;
    this.validateDateRange(updatedStartDate, updatedEndDate);
    if (dto.duration !== undefined) data.duration = dto.duration;
    if (dto.leaveType !== undefined) data.leaveType = dto.leaveType;
    if (dto.reason !== undefined) data.reason = dto.reason;
    const updated = await this.prisma.leaveRequest.update({
      where: { id, organizationId: existing.organizationId },
      data,
    });

    await this.invalidateDashboardCache();
    return updated;
  }

  async remove(id: number, user: AuthUser) {
    const request = await this.findOne(id, user);
    if (isFinalLeaveStatus(request.status)) {
      throw new ForbiddenException(
        'Finalized leave requests cannot be deleted',
      );
    }
    const deleted = await this.prisma.leaveRequest.update({
      where: { id, organizationId: request.organizationId },
      data: { deletedAt: new Date() },
    });
    await this.invalidateDashboardCache();
    return deleted;
  }

  async managerApprove(id: number, user: AuthUser) {
    const request = await this.findScoped(id, user);
    if (!request) {
      throw new NotFoundException(`LeaveRequest #${id} not found`);
    }

    if (request.status !== 'PENDING_MANAGER') {
      throw new ForbiddenException(
        'Leave request is not pending manager approval',
      );
    }
    if (request.employee?.user?.id === user.userId) {
      throw new ForbiddenException(
        'Managers cannot approve their own leave requests',
      );
    }
    const organizationId = request.organizationId;

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
    const organizationId = request.organizationId;

    const scheduledLeaveDates = request.employeeId
      ? await this.leaveEntitlementsService.getScheduledLeaveDates(
          request.employeeId,
          organizationId,
          request.startDate,
          request.endDate,
        )
      : [];
    const leaveDays =
      request.duration === 'HALF_DAY'
        ? scheduledLeaveDates.length * 0.5
        : scheduledLeaveDates.length;
    const leaveUsageByYear = new Map<
      number,
      { amount: number; periodStart: Date; periodEnd: Date }
    >();
    for (const leaveDate of scheduledLeaveDates) {
      const year = leaveDate.getUTCFullYear();
      const current = leaveUsageByYear.get(year);
      const amount = request.duration === 'HALF_DAY' ? 0.5 : 1;
      if (!current) {
        leaveUsageByYear.set(year, {
          amount,
          periodStart: leaveDate,
          periodEnd: leaveDate,
        });
      } else {
        current.amount += amount;
        current.periodEnd = leaveDate;
      }
    }
    const normalizedLeaveType = request.leaveType.trim().toUpperCase();
    const leaveCategory =
      normalizedLeaveType === 'COMP_OFF' ? 'COMP_OFF' : 'PAID_LEAVE';
    const isUnpaid = normalizedLeaveType.includes('UNPAID');
    if (request.employeeId && leaveDays <= 0) {
      throw new BadRequestException(
        'The selected dates contain no scheduled workdays',
      );
    }

    if (
      request.employeeId &&
      !isUnpaid &&
      leaveDays > 0 &&
      normalizedLeaveType !== 'COMP_OFF'
    ) {
      const available = await this.leaveEntitlementsService.getAvailableBalance(
        request.employeeId,
        organizationId,
        'PAID_LEAVE',
      );
      if (available < leaveDays) {
        throw new BadRequestException(
          `Insufficient paid leave balance. Available: ${available} day(s).`,
        );
      }
    }
    if (
      request.employeeId &&
      normalizedLeaveType === 'COMP_OFF' &&
      leaveDays > 0
    ) {
      const available = await this.leaveEntitlementsService.getAvailableBalance(
        request.employeeId,
        organizationId,
        'COMP_OFF',
      );
      if (available < leaveDays) {
        throw new BadRequestException(
          `Insufficient comp-off balance. Available: ${available} day(s).`,
        );
      }
    }

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

      if (
        employee &&
        leaveDays > 0 &&
        !isUnpaid
      ) {
        for (const [year, usage] of leaveUsageByYear) {
          await this.leaveEntitlementsService.recordUsage(tx, {
            employeeId: employee.id,
            organizationId,
            category: leaveCategory,
            amount: usage.amount,
            sourceKey: `leave-usage:${id}:${year}`,
            sourceId: id,
            description: `Approved ${request.leaveType} leave request #${id}`,
            periodStart: usage.periodStart,
            periodEnd: usage.periodEnd,
          });
        }
      }

      const approved = await tx.leaveRequest.update({
        where: { id, organizationId },
        data: {
          ...createHrApprovalState(request.approvalTrail, user.userId),
          approvalTrail: result.legacyState.approvalTrail,
          isPaid: !isUnpaid,
        },
      });

      if (
        request.employeeId &&
        request.duration !== 'HALF_DAY' &&
        normalizedLeaveType !== 'COMP_OFF'
      ) {
        for (const leaveDay of scheduledLeaveDates) {
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
              isPaidLeave: !isUnpaid,
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
              isPaidLeave: !isUnpaid,
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

  private async getScopedCompOffWhere(
    user: AuthUser,
  ): Promise<Prisma.LeaveCompOffClaimWhereInput> {
    const organizationId = this.getOrganizationId(user);
    const isHierarchyAdmin = user.role === Role.ADMIN || user.role === Role.HR;
    const organizationIds = isHierarchyAdmin
      ? ((await this.organizationScopeService.getOrganizationIds(user)) ?? [
          organizationId,
        ])
      : [organizationId];
    const buScope = await this.businessUnitsService.resolveScope(user as any);
    const buWhere = this.businessUnitsService.buildEmployeeBUWhere(buScope);
    let employeeWhere: Prisma.EmployeeWhereInput;
    if (user.role === Role.EMPLOYEE) {
      employeeWhere = {
        id: await this.resolveCurrentEmployeeId(user),
        organizationId,
        deletedAt: null,
      };
    } else if (user.role === Role.MANAGER) {
      employeeWhere = {
        organizationId,
        deletedAt: null,
        AND: [
          buWhere,
          {
            OR: [
              { user: { managerId: user.userId } },
              {
                user: {
                  reportingManagers: { some: { managerId: user.userId } },
                },
              },
            ],
          },
        ],
      };
    } else if (isHierarchyAdmin && organizationIds.length > 1) {
      employeeWhere = {
        OR: [
          buWhere,
          {
            organizationId: { in: organizationIds.filter((id) => id !== organizationId) },
            deletedAt: null,
          },
        ],
      };
    } else {
      employeeWhere = buWhere;
    }
    return {
      organizationId:
        organizationIds.length === 1
          ? organizationIds[0]
          : { in: organizationIds },
      employee: employeeWhere,
    };
  }

  async findCompOffClaims(user: AuthUser) {
    const scope = await this.getScopedCompOffWhere(user);
    return this.prisma.leaveCompOffClaim.findMany({
      where: { ...scope, status: 'PENDING' },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ workDate: 'desc' }, { id: 'desc' }],
    });
  }

  private async findScopedCompOffClaim(id: number, user: AuthUser) {
    const scope = await this.getScopedCompOffWhere(user);
    return this.prisma.leaveCompOffClaim.findFirst({
      where: { id, ...scope },
      include: {
        employee: {
          include: {
            user: { select: { id: true } },
          },
        },
      },
    });
  }

  async approveCompOffClaim(id: number, user: AuthUser) {
    const claim = await this.findScopedCompOffClaim(id, user);
    if (!claim) {
      throw new NotFoundException(`Comp-off claim #${id} not found`);
    }
    if (claim.status !== 'PENDING') {
      throw new ForbiddenException('Comp-off claim is no longer pending');
    }
    if (claim.employee.user?.id === user.userId) {
      throw new ForbiddenException(
        'Employees cannot approve their own comp-off claims',
      );
    }

    const policy = await this.prisma.leavePolicy.findUnique({
      where: { organizationId: claim.organizationId },
      select: { compOffExpiryDays: true },
    });
    const earnedDays = claim.hours >= 8 ? 1 : 0.5;
    const reviewedAt = new Date();
    const expiresAt = new Date(
      reviewedAt.getTime() + (policy?.compOffExpiryDays ?? 90) * 86_400_000,
    );

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaveCompOffClaim.updateMany({
        where: { id, organizationId: claim.organizationId, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          reviewedById: user.userId,
          reviewedAt,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException(
          'Comp-off claim changed; refresh and review again',
        );
      }
      await tx.leaveBalanceEntry.create({
        data: {
          employeeId: claim.employeeId,
          organizationId: claim.organizationId,
          category: 'COMP_OFF',
          entryType: 'COMPOFF_EARNED',
          amount: earnedDays,
          sourceKey: `compoff-claim:${claim.id}`,
          sourceId: claim.id,
          description: `Comp-off earned for holiday work on ${claim.workDate.toISOString().slice(0, 10)}`,
          periodStart: claim.workDate,
          periodEnd: claim.workDate,
          expiresAt,
        },
      });
    });

    await this.invalidateDashboardCache();
    return this.findScopedCompOffClaim(id, user);
  }

  async rejectCompOffClaim(id: number, user: AuthUser) {
    const claim = await this.findScopedCompOffClaim(id, user);
    if (!claim) {
      throw new NotFoundException(`Comp-off claim #${id} not found`);
    }
    if (claim.status !== 'PENDING') {
      throw new ForbiddenException('Comp-off claim is no longer pending');
    }
    if (claim.employee.user?.id === user.userId) {
      throw new ForbiddenException(
        'Employees cannot reject their own comp-off claims',
      );
    }
    const updated = await this.prisma.leaveCompOffClaim.updateMany({
      where: { id, organizationId: claim.organizationId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        reviewedById: user.userId,
        reviewedAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      throw new BadRequestException(
        'Comp-off claim changed; refresh and review again',
      );
    }
    await this.invalidateDashboardCache();
    return this.findScopedCompOffClaim(id, user);
  }

  async reject(id: number, user: AuthUser, reason?: string) {
    const request = await this.findScoped(id, user);
    if (!request) {
      throw new NotFoundException(`LeaveRequest #${id} not found`);
    }
    const organizationId = request.organizationId;

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
