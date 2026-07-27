import { DatabaseHelper } from '../helpers/database.helper';
import { OrganizationFactory } from '../fixtures/organization.factory';
import { UserFactory } from '../fixtures/user.factory';

describe('Database Validation', () => {
  const prisma = DatabaseHelper.getPrismaClient();

  beforeAll(async () => {
    // Ensure test database is set up
  });

  beforeEach(async () => {
    await DatabaseHelper.truncateAllTables();
  });

  afterAll(async () => {
    await DatabaseHelper.disconnect();
  });

  describe('Foreign Keys', () => {
    it('should not allow creating an employee without an organization', async () => {
      await expect(
        prisma.employee.create({
          data: {
            name: 'Test Employee',
            organization: { connect: { id: 1 } },
          },
        }),
      ).rejects.toThrow();
    });

    it('should not allow creating an employee with a non-existent organization', async () => {
      await expect(
        prisma.employee.create({
          data: {
            name: 'Test Employee',
            organization: { connect: { id: 9999 } }, // Non-existent ID
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Unique Constraints', () => {
    it('should not allow two users with the same email', async () => {
      const org = await OrganizationFactory.create();

      // Create first user
      await UserFactory.create({
        organizationId: org.id,
        email: 'duplicate@example.com',
      });

      // Try to create second user with same email
      await expect(
        UserFactory.create({
          organizationId: org.id,
          email: 'duplicate@example.com',
        }),
      ).rejects.toThrow();
    });

    it('should not allow two organizations with the same code', async () => {
      // Create first organization
      await OrganizationFactory.create({
        code: 'ORG-123',
      });

      // Try to create second organization with same code
      await expect(
        OrganizationFactory.create({
          code: 'ORG-123',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Organization Ownership', () => {
    it('should enforce that all created records have an organizationId', async () => {
      const org = await OrganizationFactory.create();
      const user = await UserFactory.create({ organizationId: org.id });

      expect(user.organizationId).toBe(org.id);
    });
  });
});
