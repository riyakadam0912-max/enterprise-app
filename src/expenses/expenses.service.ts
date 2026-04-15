import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCurrentEmployeeId(user: { userId: number; role: Role; employeeId?: number | null }) {
    if (user.employeeId) {
      return user.employeeId;
    }

    const linked = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { employeeId: true },
    } as any) as { employeeId?: number | null } | null;

    if (!linked?.employeeId) {
      throw new ForbiddenException('User is not linked to an employee profile');
    }

    return linked.employeeId;
  }

  private async getScopedWhere(user: { userId: number; role: Role; employeeId?: number | null }) {
    if (user.role === Role.ADMIN || user.role === Role.HR) {
      return undefined;
    }

    if (user.role === Role.MANAGER) {
      return {
        submittedByUser: {
          managerId: user.userId,
        },
      };
    }

    return {
      submittedByUserId: user.userId,
    };
  }

  async create(dto: CreateExpenseDto, user: { userId: number; role: Role; employeeId?: number | null }) {
    const prisma = this.prisma as any;
    const employeeId = dto.employeeId ?? (await this.resolveCurrentEmployeeId(user));
    if (user.role === Role.EMPLOYEE) {
      const ownEmployeeId = await this.resolveCurrentEmployeeId(user);
      if (employeeId !== ownEmployeeId) {
        throw new ForbiddenException('Employees can only create expenses for themselves');
      }
    }

    return prisma.expense.create({
      data: {
        expenseDate:  dto.expenseDate  ? new Date(dto.expenseDate) : undefined,
        category:     dto.category,
        description:  dto.description,
        amount:       dto.amount,
        currency:     dto.currency,
        receiptImage: dto.receiptImage,
        approvedBy:   dto.approvedBy,
        status:       dto.status ?? 'PENDING_MANAGER',
        employeeId,
        submittedByUserId: user.userId,
        approvalTrail: [
          {
            action: 'SUBMITTED',
            at: new Date().toISOString(),
            byUserId: user.userId,
          },
        ],
      },
      include: {
        employee: true,
        submittedByUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findAll(user: { userId: number; role: Role; employeeId?: number | null }) {
    const where = await this.getScopedWhere(user);
    const prisma = this.prisma as any;
    return prisma.expense.findMany({
      where,
      include: {
        employee: true,
        submittedByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { expenseDate: 'desc' },
    } as any);
  }

  async findOne(id: number, user: { userId: number; role: Role; employeeId?: number | null }) {
    const where = await this.getScopedWhere(user);
    const prisma = this.prisma as any;
    const expense = await prisma.expense.findFirst({
      where: { id, ...(where ?? {}) },
      include: {
        employee: true,
        submittedByUser: { select: { id: true, name: true, email: true, managerId: true } },
      },
    } as any);
    if (!expense) throw new NotFoundException(`Expense #${id} not found`);
    return expense;
  }

  async update(id: number, dto: UpdateExpenseDto, user: { userId: number; role: Role; employeeId?: number | null }) {
    const prisma = this.prisma as any;
    const expense = await this.findOne(id, user);
    if (
      user.role === Role.EMPLOYEE &&
      (expense.status === 'APPROVED' || expense.status === 'REJECTED')
    ) {
      throw new ForbiddenException('Finalized expenses cannot be edited by employee');
    }

    return prisma.expense.update({
      where: { id },
      data: {
        ...(dto.category     !== undefined && { category:     dto.category }),
        ...(dto.description  !== undefined && { description:  dto.description }),
        ...(dto.amount       !== undefined && { amount:       dto.amount }),
        ...(dto.currency     !== undefined && { currency:     dto.currency }),
        ...(dto.receiptImage !== undefined && { receiptImage: dto.receiptImage }),
        ...(dto.approvedBy   !== undefined && { approvedBy:   dto.approvedBy }),
        ...(dto.status       !== undefined && { status:       dto.status }),
        ...(dto.employeeId   !== undefined && { employeeId:   dto.employeeId }),
        ...(dto.expenseDate  !== undefined && {
          expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : null,
        }),
      },
    });
  }

  async managerApprove(id: number, user: { userId: number; role: Role; employeeId?: number | null }) {
    const prisma = this.prisma as any;
    const expense = await this.findOne(id, user);
    if (expense.status !== 'PENDING_MANAGER') {
      throw new ForbiddenException('Expense is not pending manager approval');
    }

    const trail = Array.isArray(expense.approvalTrail) ? expense.approvalTrail : [];
    trail.push({ action: 'MANAGER_APPROVED', at: new Date().toISOString(), byUserId: user.userId });

    return prisma.expense.update({
      where: { id },
      data: {
        status: 'PENDING_HR',
        managerApprovalByUserId: user.userId,
        approvedBy: `MANAGER:${user.userId}`,
        approvalTrail: trail,
      },
    });
  }

  async hrApprove(id: number, user: { userId: number; role: Role; employeeId?: number | null }) {
    const prisma = this.prisma as any;
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException(`Expense #${id} not found`);
    }

    if (expense.status !== 'PENDING_HR') {
      throw new ForbiddenException('Expense is not pending HR approval');
    }

    const trail = Array.isArray(expense.approvalTrail) ? expense.approvalTrail : [];
    trail.push({ action: 'HR_APPROVED', at: new Date().toISOString(), byUserId: user.userId });

    return prisma.expense.update({
      where: { id },
      data: {
        status: 'APPROVED',
        hrApprovalByUserId: user.userId,
        approvedBy: `HR:${user.userId}`,
        approvedAt: new Date(),
        approvalTrail: trail,
      },
    });
  }

  async reject(id: number, user: { userId: number; role: Role; employeeId?: number | null }, reason?: string) {
    const prisma = this.prisma as any;
    const expense = await this.findOne(id, user);
    if (expense.status === 'APPROVED') {
      throw new ForbiddenException('Approved expense cannot be rejected');
    }

    const trail = Array.isArray(expense.approvalTrail) ? expense.approvalTrail : [];
    trail.push({
      action: 'REJECTED',
      at: new Date().toISOString(),
      byUserId: user.userId,
      reason: reason ?? null,
    });

    return prisma.expense.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: reason,
        approvedBy: `${user.role}:${user.userId} (Rejected)`,
        approvalTrail: trail,
      },
    });
  }

  async remove(id: number) {
    const prisma = this.prisma as any;
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException(`Expense #${id} not found`);
    return this.prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } as any });
  }

  async importRecords(records: Record<string, any>[]): Promise<{ imported: number; errors: string[] }> {
    const prisma = this.prisma as any;
    let imported = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      try {
        await prisma.expense.create({
          data: {
            expenseDate:  r.expenseDate  ? new Date(String(r.expenseDate)) : undefined,
            category:     r.category     ? String(r.category)     : undefined,
            description:  r.description  ? String(r.description)  : undefined,
            amount:       r.amount       ? Number(r.amount)       : undefined,
            currency:     r.currency     ? String(r.currency)     : undefined,
            receiptImage: r.receiptImage ? String(r.receiptImage) : undefined,
            approvedBy:   r.approvedBy   ? String(r.approvedBy)   : undefined,
            status:       r.status       ? String(r.status)       : 'PENDING',
          },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message ?? 'Unknown error'}`);
      }
    }
    return { imported, errors };
  }

  async getByCategory(user: { userId: number; role: Role; employeeId?: number | null }) {
    const where = await this.getScopedWhere(user);
    const prisma = this.prisma as any;
    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
    } as any);
    const grouped: Record<string, typeof expenses> = {};
    for (const exp of expenses) {
      const key = exp.category ?? 'Uncategorized';
      if (grouped[key]) grouped[key].push(exp);
      else grouped[key] = [exp];
    }
    return grouped;
  }
}
