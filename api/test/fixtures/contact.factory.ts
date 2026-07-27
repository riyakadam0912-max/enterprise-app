import { Contact, Prisma } from '@prisma/client';
import { DatabaseHelper } from '../helpers/database.helper';
import { OrganizationFactory } from './organization.factory';

export class ContactFactory {
  static async create(
    overrides: Partial<Prisma.ContactUncheckedCreateInput> = {},
  ): Promise<Contact> {
    const prisma = DatabaseHelper.getPrismaClient();
    let organizationId = overrides.organizationId;
    if (!organizationId) {
      const org = await OrganizationFactory.create();
      organizationId = org.id;
    }

    return prisma.contact.create({
      data: {
        contactName: `Test Contact ${Date.now()}`,
        organizationId,
        ...overrides,
      },
    });
  }

  static async createMany(
    count: number,
    organizationId: number,
  ): Promise<Contact[]> {
    const contacts: Contact[] = [];
    for (let i = 0; i < count; i++) {
      contacts.push(
        await this.create({
          organizationId,
          contactName: `Test Contact ${i} ${Date.now()}`,
        }),
      );
    }
    return contacts;
  }
}
