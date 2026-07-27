import { Project, Prisma } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';
import { OrganizationFactory } from './organization.factory';

export class ProjectFactory {
  static async create(
    overrides: Partial<Prisma.ProjectUncheckedCreateInput> = {},
  ): Promise<Project> {
    const prisma = DatabaseHelper.getPrismaClient();
    // Ensure organizationId is present, create an organization if not
    const organization = await OrganizationFactory.findOrCreate(
      overrides.organizationId,
    );
    const organizationId = organization.id;

    return prisma.project.create({
      data: {
        projectName: overrides.projectName || `Test Project ${Date.now()}`,
        organizationId,
        ...overrides,
      },
    });
  }

  static async createMany(
    count: number,
    organizationId: number,
  ): Promise<Project[]> {
    const projects: Project[] = [];
    for (let i = 0; i < count; i++) {
      projects.push(
        await this.create({
          organizationId,
          projectName: `Test Project ${i} ${Date.now()}`,
        }),
      );
    }
    return projects;
  }
}
