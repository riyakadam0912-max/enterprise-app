import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Cache } from 'cache-manager';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/types/auth';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { WorkflowEngineService } from '../workflows/workflow-engine.service';
import {
  createHrApprovalState,
  createManagerApprovalState,
  createRejectionState,
  createSubmittedApprovalState,
} from '../common/workflows/approval-workflow';
import { DASHBOARD_CACHE_KEY } from '../common/utils/cache-keys';

const expenseInclude: Prisma.ExpenseInclude = {
  employee: true,
  submittedByUser: { select: { id: true, name: true, email: true } },
};

const expenseDetailInclude: Prisma.ExpenseInclude = {
  employee: true,
  submittedByUser: {
    select: { id: true, name: true, email: true, managerId: true },
  },
};

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  private async invalidateDashboardCache() {
    await this.cacheManager.del(DASHBOARD_CACHE_KEY);
  }

  private validateOrganization(user: AuthUser): number {
    if (!user.organizationId) {
      throw new ForbiddenException('User has no associated organization');
    }
    return user.organizationId;
  }

  private async resolveCurrentEmployeeId(user: AuthUser) {
    if (user.employeeId) {
      return user.employeeId;
    }

    const linked = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { employeeId: true },
    });

    if (!linked?.employeeId) {
      throw new ForbiddenException('User is not linked to an employee profile');
    }

    return linked.employeeId;
  }

  private getScopedWhere(user: AuthUser): Prisma.ExpenseWhereInput {
    const organizationId = this.validateOrganization(user);
    if (user.role === Role.ADMIN || user.role === Role.HR) {
      return { organizationId };
    }

    if (user.role === Role.MANAGER) {
      return {
        organizationId,
        submittedByUser: {
          managerId: user.userId,
        },
      };
    }

    return {
      organizationId,
      submittedByUserId: user.userId,
    };
  }

  async create(dto: CreateExpenseDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const employeeId =
      dto.employeeId ?? (await this.resolveCurrentEmployeeId(user));
    if (user.role === Role.EMPLOYEE) {
      const ownEmployeeId = await this.resolveCurrentEmployeeId(user);
      if (employeeId !== ownEmployeeId) {
        throw new ForbiddenException(
          'Employees can only create expenses for themselves',
        );
      }
    }

    const expense = await this.prisma.expense.create({
      data: {
        organization: { connect: { id: organizationId } },
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency,
        receiptImage: dto.receiptImage,
        approvedBy: dto.approvedBy,
        status: dto.status ?? 'PENDING_MANAGER',
        employee: { connect: { id: employeeId } },
        submittedByUser: { connect: { id: user.userId } },
        ...createSubmittedApprovalState(user.userId),
      },
      include: expenseInclude,
    });

    await this.workflowEngine.submitWorkflow({
      definitionKey: 'expense-approval',
      entityType: 'Expense',
      entityId: expense.id,
      initiatedBy: user.userId,
      organizationId,
      context: {
        employeeId,
        requestorUserId: user.userId,
        category: dto.category,
        amount: dto.amount,
        currency: dto.currency,
      },
      metadata: {
        category: dto.category ?? null,
        amount: dto.amount ?? null,
      },
    });

    await this.invalidateDashboardCache();
    return expense;
  }

  async findAll(user: AuthUser) {
    const where = this.getScopedWhere(user);
    return this.prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: { expenseDate: 'desc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const where = this.getScopedWhere(user);
    const expense = await this.prisma.expense.findFirst({
      where: { id, ...where },
      include: expenseDetailInclude,
    });
    if (!expense) throw new NotFoundException(`Expense #${id} not found`);
    return expense;
  }

  async update(id: number, dto: UpdateExpenseDto, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const expense = await this.findOne(id, user);
    if (
      user.role === Role.EMPLOYEE &&
      (expense.status === 'APPROVED' || expense.status === 'REJECTED')
    ) {
      throw new ForbiddenException(
        'Finalized expenses cannot be edited by employee',
      );
    }

    const updated = await this.prisma.expense.update({
      where: { id, organizationId },
      data: {
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.receiptImage !== undefined && {
          receiptImage: dto.receiptImage,
        }),
        ...(dto.approvedBy !== undefined && { approvedBy: dto.approvedBy }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.employeeId !== undefined && { employeeId: dto.employeeId }),
        ...(dto.expenseDate !== undefined && {
          expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : null,
        }),
      },
    });

    await this.invalidateDashboardCache();
    return updated;
  }

  async managerApprove(id: number, user: AuthUser) {
    const expense = await this.findOne(id, user);
    if (expense.status !== 'PENDING_MANAGER') {
      throw new ForbiddenException('Expense is not pending manager approval');
    }

    const organizationId = this.validateOrganization(user);
    const workflowState = await this.workflowEngine.approveWorkflow({
      definitionKey: 'expense-approval',
      entityType: 'Expense',
      entityId: id,
      userId: user.userId,
      businessStatus: 'PENDING_HR',
      trailAction: 'MANAGER_APPROVED',
      approvedByLabel: `MANAGER:${user.userId}`,
      trail: expense.approvalTrail,
      organizationId,
    });

    const approvalState = createManagerApprovalState(
      expense.approvalTrail,
      user.userId,
    );

    const updated = await this.prisma.expense.update({
      where: { id, organizationId },
      data: {
        ...approvalState,
        approvalTrail: workflowState.legacyState
          .approvalTrail as Prisma.InputJsonValue,
        managerApprovalByUserId: user.userId,
        approvedBy: `MANAGER:${user.userId}`,
      },
    });

    await this.invalidateDashboardCache();
    return updated;
  }

  async hrApprove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const expense = await this.prisma.expense.findFirst({
      where: { id, organizationId },
    });
    if (!expense) {
      throw new NotFoundException(`Expense #${id} not found`);
    }

    if (expense.status !== 'PENDING_HR') {
      throw new ForbiddenException('Expense is not pending HR approval');
    }

    const workflowState = await this.workflowEngine.approveWorkflow({
      definitionKey: 'expense-approval',
      entityType: 'Expense',
      entityId: id,
      userId: user.userId,
      businessStatus: 'APPROVED',
      trailAction: 'HR_APPROVED',
      approvedByLabel: `HR:${user.userId}`,
      trail: expense.approvalTrail,
      organizationId,
    });

    const approvalState = createHrApprovalState(
      expense.approvalTrail,
      user.userId,
    );

    const updated = await this.prisma.expense.update({
      where: { id, organizationId },
      data: {
        ...approvalState,
        approvalTrail: workflowState.legacyState
          .approvalTrail as Prisma.InputJsonValue,
        hrApprovalByUserId: user.userId,
        approvedBy: `HR:${user.userId}`,
      },
    });

    await this.invalidateDashboardCache();
    return updated;
  }

  async reject(id: number, user: AuthUser, reason?: string) {
    const organizationId = this.validateOrganization(user);
    const expense = await this.findOne(id, user);
    if (expense.status === 'APPROVED') {
      throw new ForbiddenException('Approved expense cannot be rejected');
    }

    const workflowState = await this.workflowEngine.rejectWorkflow({
      definitionKey: 'expense-approval',
      entityType: 'Expense',
      entityId: id,
      userId: user.userId,
      businessStatus: 'REJECTED',
      trailAction: 'REJECTED',
      approvedByLabel: `${user.role}:${user.userId} (Rejected)`,
      reason,
      trail: expense.approvalTrail,
      organizationId,
    });

    const approvalState = createRejectionState(
      expense.approvalTrail,
      String(user.role),
      user.userId,
      reason,
    );

    const updated = await this.prisma.expense.update({
      where: { id, organizationId },
      data: {
        ...approvalState,
        approvalTrail: workflowState.legacyState
          .approvalTrail as Prisma.InputJsonValue,
      },
    });

    await this.invalidateDashboardCache();
    return updated;
  }

  async remove(id: number, user: AuthUser) {
    const organizationId = this.validateOrganization(user);
    const expense = await this.prisma.expense.findFirst({
      where: { id, organizationId },
    });
    if (!expense) throw new NotFoundException(`Expense #${id} not found`);
    const deleted = await this.prisma.expense.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });
    await this.invalidateDashboardCache();
    return deleted;
  }

  async importRecords(
    records: Array<Record<string, unknown>>,
    user: AuthUser,
  ): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    const organizationId = this.validateOrganization(user);
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      try {
        const data: Prisma.ExpenseCreateInput = {
          organization: { connect: { id: organizationId } },
          expenseDate:
            typeof r.expenseDate === 'string' || r.expenseDate instanceof Date
              ? new Date(String(r.expenseDate))
              : undefined,
          category: typeof r.category === 'string' ? r.category : undefined,
          description:
            typeof r.description === 'string' ? r.description : undefined,
          amount:
            typeof r.amount === 'number'
              ? r.amount
              : typeof r.amount === 'string'
                ? Number(r.amount)
                : undefined,
          currency: typeof r.currency === 'string' ? r.currency : undefined,
          receiptImage:
            typeof r.receiptImage === 'string' ? r.receiptImage : undefined,
          approvedBy:
            typeof r.approvedBy === 'string' ? r.approvedBy : undefined,
          status: typeof r.status === 'string' ? r.status : 'PENDING',
        };

        await this.prisma.expense.create({
          data,
        });
        imported++;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Row ${i + 1}: ${message}`);
      }
    }
    await this.invalidateDashboardCache();
    return { imported, errors };
  }

  async getByCategory(user: AuthUser) {
    const where = this.getScopedWhere(user);
    const expenses = await this.prisma.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
    });
    const grouped: Record<string, typeof expenses> = {};
    for (const exp of expenses) {
      const key = exp.category ?? 'Uncategorized';
      if (grouped[key]) grouped[key].push(exp);
      else grouped[key] = [exp];
    }
    return grouped;
  }
}
