import { Expense, Prisma } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';
import { OrganizationFactory } from './organization.factory';
import { EmployeeFactory } from './employee.factory';

export class ExpenseFactory {
  static async create(
    overrides: Partial<Prisma.ExpenseUncheckedCreateInput> = {},
  ): Promise<Expense> {
    const prisma = DatabaseHelper.getPrismaClient();
    // Ensure organizationId is present, create an organization if not
    let organizationId = overrides.organizationId;
    let employeeId = overrides.employeeId;
    const submittedByUserId = overrides.submittedByUserId;

    if (!employeeId && !submittedByUserId) {
      // Neither provided: create employee, which will create user and org
      const employee = await EmployeeFactory.create({ organizationId });
      employeeId = employee.id;
      organizationId = employee.organizationId;
    } else if (employeeId && !organizationId) {
      // Employee provided, get org from employee
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });
      if (employee) {
        organizationId = employee.organizationId;
      }
    } else if (submittedByUserId && !organizationId) {
      // User provided, get org from user
      const user = await prisma.user.findUnique({
        where: { id: submittedByUserId },
      });
      if (user) {
        organizationId = user.organizationId ?? undefined;
      }
    }

    const organization = await OrganizationFactory.findOrCreate(organizationId);
    organizationId = organization.id;

    const rest: Partial<Prisma.ExpenseUncheckedCreateInput> = { ...overrides };
    delete rest.id;
    return prisma.expense.create({
      data: {
        organizationId: organizationId ?? 0,
        employeeId: employeeId ?? null,
        submittedByUserId,
        description: overrides.description || `Test Expense ${Date.now()}`,
        amount: overrides.amount ?? 100,
        ...rest,
      },
    });
  }

  static async createMany(
    count: number,
    organizationId: number,
  ): Promise<Expense[]> {
    const expenses: Expense[] = [];
    for (let i = 0; i < count; i++) {
      expenses.push(
        await this.create({
          organizationId,
          amount: 100 + i * 50,
          description: `Test Expense ${i} ${Date.now()}`,
        }),
      );
    }
    return expenses;
  }
}
