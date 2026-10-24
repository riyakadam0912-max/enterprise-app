import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { runWithAuditContext } from './audit-context';
const url = process.env.TEST_AUDIT_DATABASE_URL;
const describeDatabase = url ? describe : describe.skip;

describeDatabase(
  'Audit ownership against an isolated migrated PostgreSQL database',
  () => {
    let raw: PrismaClient;
    let audited: PrismaService;
    let organizationId: number;
    const tag = randomUUID();
    beforeAll(async () => {
      raw = new PrismaClient({ datasources: { db: { url: url! } } });
      audited = new PrismaService(new ConfigService({ DATABASE_URL: url! }));
      const org = await raw.organization.create({
        data: { name: tag, code: tag, slug: tag },
      });
      organizationId = org.id;
    });
    afterAll(async () => {
      if (organizationId)
        await raw.organization.delete({ where: { id: organizationId } });
      await raw.systemAuditEvent.deleteMany({ where: { correlationId: tag } });
      await audited?.$disconnect();
      await raw?.$disconnect();
    });
    it('commits an interactive transaction and its tenant audit together', async () => {
      const employee = await runWithAuditContext(
        { organizationId, userName: tag },
        () =>
          audited.$transaction((tx) =>
            tx.employee.create({ data: { name: 'Committed', organizationId } }),
          ),
      );
      expect(
        await raw.auditLog.count({
          where: {
            entityType: 'Employee',
            entityId: employee.id,
            organizationId,
            action: 'CREATE',
          },
        }),
      ).toBe(1);
    });
    it('rolls back automatic audit events with the transaction', async () => {
      const name = 'rolled-back-' + tag;
      await expect(
        runWithAuditContext({ organizationId, userName: name }, () =>
          audited.$transaction(async (tx) => {
            await tx.employee.create({ data: { name, organizationId } });
            throw new Error('intentional rollback');
          }),
        ),
      ).rejects.toThrow('intentional rollback');
      expect(await raw.employee.count({ where: { name } })).toBe(0);
      expect(await raw.auditLog.count({ where: { userName: name } })).toBe(0);
    });
    it('keeps logical deletes and restores visible in the owner history', async () => {
      const employee = await audited.employee.create({
        data: { name: 'Restored', organizationId },
      });
      await audited.employee.delete({ where: { id: employee.id } });
      await audited.restoreById('Employee', employee.id);
      expect(
        await raw.auditLog.count({
          where: {
            entityType: 'Employee',
            entityId: employee.id,
            action: { in: ['DELETE', 'RESTORE'] },
            organizationId,
          },
        }),
      ).toBe(2);
    });
    it('quarantines tenant-context mismatches without putting rows in either tenant history', async () => {
      const employee = await runWithAuditContext(
        { organizationId: organizationId + 1000000, correlationId: tag },
        () =>
          audited.employee.create({
            data: { name: 'Mismatch', organizationId },
          }),
      );
      expect(
        await raw.auditLog.count({
          where: { entityType: 'Employee', entityId: employee.id },
        }),
      ).toBe(0);
      expect(
        await raw.systemAuditEvent.count({
          where: {
            entityType: 'Employee',
            entityId: employee.id,
            reason: 'CONTEXT_MISMATCH',
            targetOrganizationId: organizationId,
          },
        }),
      ).toBe(1);
    });
  },
);
