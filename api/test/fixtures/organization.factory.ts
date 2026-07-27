import { Organization, OrganizationStatus, Prisma } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';

export class OrganizationFactory {
  static async findOrCreate(
    organizationId?: number,
    overrides: Partial<Prisma.OrganizationUncheckedCreateInput> = {},
  ): Promise<Organization> {
    const prisma = DatabaseHelper.getPrismaClient();
    if (organizationId) {
      const existing = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (existing) {
        return existing;
      }
    }

    return await this.create(overrides);
  }

  static async create(
    overrides: Partial<Prisma.OrganizationUncheckedCreateInput> = {},
  ): Promise<Organization> {
    const prisma = DatabaseHelper.getPrismaClient();
    const rest: Partial<Prisma.OrganizationUncheckedCreateInput> = {
      ...overrides,
    };
    delete rest.id;
    return await prisma.organization.create({
      data: {
        name: overrides.name || `Test Org ${Date.now()}`,
        code: overrides.code || `org_${Date.now()}`,
        slug: overrides.slug || `test-org-${Date.now()}`,
        status: overrides.status || OrganizationStatus.ACTIVE,
        ...rest,
      },
    });
  }

  static async createMany(count: number): Promise<Organization[]> {
    const orgs: Organization[] = [];
    for (let i = 0; i < count; i++) {
      // Call create (which uses its own prisma)
      const org = await this.create();
      orgs.push(org);
    }
    return orgs;
  }
}
