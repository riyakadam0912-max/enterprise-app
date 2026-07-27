import { Prisma, User, Employee } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';
import { OrganizationFactory } from './organization.factory';
import { UserFactory } from './user.factory';

export class EmployeeFactory {
  static async create(
    overrides: Partial<Prisma.EmployeeUncheckedCreateInput> & {
      userId?: number;
    } = {},
  ): Promise<Employee> {
    const prisma = DatabaseHelper.getPrismaClient();
    // Ensure organizationId is present, create an organization if not
    let organizationId = overrides.organizationId;
    let user: User | null = null;
    // If overrides has userId, get the user, otherwise create a user
    if (overrides.userId) {
      user = await prisma.user.findUnique({ where: { id: overrides.userId } });
      if (user && user.organizationId !== null) {
        organizationId = user.organizationId;
      }
    } else if (!overrides.userId) {
      const organization =
        await OrganizationFactory.findOrCreate(organizationId);
      organizationId = organization.id;
      user = await UserFactory.create({ organizationId });
      if (user.organizationId !== null) {
        organizationId = user.organizationId;
      }
    }

    if (!organizationId) {
      const organization = await OrganizationFactory.findOrCreate();
      organizationId = organization.id;
    }

    // Create the employee
    const data: Partial<Prisma.EmployeeUncheckedCreateInput> & {
      userId?: number;
    } = { ...overrides };
    delete data.userId;
    delete data.id;
    const employee = await prisma.employee.create({
      data: {
        name: overrides.name || `Test Employee ${Date.now()}`,
        organizationId,
        ...data,
      },
    });

    // If we have a user, update user's employeeId to point to this employee
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { employeeId: employee.id },
      });
    }

    return employee;
  }

  static async createMany(
    count: number,
    organizationId: number,
  ): Promise<Employee[]> {
    const employees: Employee[] = [];
    for (let i = 0; i < count; i++) {
      const employee = await this.create({
        organizationId,
        email: `emp-${i}-${Date.now()}@example.com`,
      });
      employees.push(employee);
    }
    return employees;
  }
}
