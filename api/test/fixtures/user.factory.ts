import { Role, Prisma, User } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';
import { OrganizationFactory } from './organization.factory';
import * as bcrypt from 'bcrypt';

export class UserFactory {
  static async create(
    overrides: Partial<Prisma.UserUncheckedCreateInput> & {
      password?: string;
    } = {},
  ): Promise<User> {
    const prisma = DatabaseHelper.getPrismaClient();
    const password = overrides.password || 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const restOverrides: Partial<Prisma.UserUncheckedCreateInput> & {
      password?: string;
    } = { ...overrides };
    delete restOverrides.password;

    let organizationId: number | null | undefined;
    if ('organizationId' in restOverrides) {
      organizationId = restOverrides.organizationId ?? null;
    } else {
      const organization = await OrganizationFactory.findOrCreate(undefined);
      organizationId = organization.id;
    }

    const rest: Partial<Prisma.UserUncheckedCreateInput> = { ...restOverrides };
    delete rest.id;
    delete rest.organizationId;
    return await prisma.user.create({
      data: {
        name: rest.name || `Test User ${Date.now()}`,
        email: rest.email || `test-${Date.now()}@example.com`,
        password: hashedPassword,
        role: rest.role || Role.ADMIN,
        isActive: rest.isActive !== undefined ? rest.isActive : true,
        organizationId: organizationId as number | undefined,
        ...rest,
      },
    });
  }

  static async createMany(
    count: number,
    organizationId: number,
  ): Promise<User[]> {
    const users: User[] = [];
    for (let i = 0; i < count; i++) {
      const user = await this.create({
        organizationId,
        email: `test-${i}-${Date.now()}@example.com`,
      });
      users.push(user);
    }
    return users;
  }
}
