import { Timesheet, Prisma } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';
import { OrganizationFactory } from './organization.factory';

export class TimesheetFactory {
  static async create(
    overrides: Partial<Prisma.TimesheetUncheckedCreateInput> = {},
  ): Promise<Timesheet> {
    const prisma = DatabaseHelper.getPrismaClient();
    // Ensure organizationId is present, create an organization if not
    let organizationId = overrides.organizationId;
    if (!organizationId) {
      const organization = await OrganizationFactory.create();
      organizationId = organization.id;
    }

    return prisma.timesheet.create({
      data: {
        organizationId,
        task: overrides.task || `Test Task ${Date.now()}`,
        date: overrides.date || new Date(),
        hours: overrides.hours || 8,
        status: overrides.status || 'PENDING',
        ...overrides,
      },
    });
  }

  static async createMany(
    count: number,
    organizationId: number,
  ): Promise<Timesheet[]> {
    const timesheets: Timesheet[] = [];
    for (let i = 0; i < count; i++) {
      timesheets.push(
        await this.create({
          organizationId,
          task: `Test Timesheet ${i}`,
        }),
      );
    }
    return timesheets;
  }
}
