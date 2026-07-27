import { LeaveRequest, Prisma } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';
import { OrganizationFactory } from './organization.factory';

export class LeaveRequestFactory {
  static async create(
    overrides: Partial<Prisma.LeaveRequestUncheckedCreateInput> = {},
  ): Promise<LeaveRequest> {
    const prisma = DatabaseHelper.getPrismaClient();
    // Ensure organizationId is present, create an organization if not
    let organizationId = overrides.organizationId;
    if (!organizationId) {
      const org = await OrganizationFactory.create();
      organizationId = org.id;
    }

    return prisma.leaveRequest.create({
      data: {
        organizationId,
        leaveType: overrides.leaveType || 'VACATION',
        startDate: overrides.startDate || new Date(),
        endDate: overrides.endDate || new Date(Date.now() + 86400000),
        reason: overrides.reason || `Test Leave ${Date.now()}`,
        ...overrides,
      },
    });
  }

  static async createMany(
    count: number,
    organizationId: number,
  ): Promise<LeaveRequest[]> {
    const leaves: LeaveRequest[] = [];
    for (let i = 0; i < count; i++) {
      leaves.push(
        await this.create({
          organizationId,
          leaveType: i % 2 === 0 ? 'VACATION' : 'SICK',
        }),
      );
    }
    return leaves;
  }
}
