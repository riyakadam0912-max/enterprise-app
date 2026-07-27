import { Task, Prisma } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';
import { OrganizationFactory } from './organization.factory';

export class TaskFactory {
  static async create(
    overrides: Partial<Prisma.TaskUncheckedCreateInput> = {},
  ): Promise<Task> {
    const prisma = DatabaseHelper.getPrismaClient();
    // Ensure organizationId is present, create an organization if not
    let organizationId = overrides.organizationId;
    if (!organizationId) {
      const org = await OrganizationFactory.create();
      organizationId = org.id;
    }

    return prisma.task.create({
      data: {
        taskName: overrides.taskName || `Test Task ${Date.now()}`,
        organizationId,
        ...overrides,
      },
    });
  }

  static async createMany(
    count: number,
    organizationId: number,
    projectId?: number,
  ): Promise<Task[]> {
    const tasks: Task[] = [];
    for (let i = 0; i < count; i++) {
      const data: Partial<Prisma.TaskUncheckedCreateInput> = {
        organizationId,
        taskName: `Test Task ${i} ${Date.now()}`,
      };
      if (projectId !== undefined) {
        data.projectId = projectId;
      }
      tasks.push(await this.create(data));
    }
    return tasks;
  }
}
