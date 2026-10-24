import { Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { automaticAuditMiddleware } from './automatic-audit.middleware';
import {
  runWithAuditContext,
  runWithSystemAuditContext,
} from './audit-context';
import { runWithAuditTransaction } from './audit-transaction';
import { softDeleteMiddleware } from '../../prisma/middleware/softDelete';
import { createMockPrismaService } from '../../test/helpers/mocks.helper';

describe('Automatic audit ownership and mutation coverage', () => {
  let prisma: ReturnType<typeof createMockPrismaService>;
  let middleware: Prisma.Middleware;
  const params = (
    action: Prisma.PrismaAction,
    args: Record<string, unknown> = {},
    model: Prisma.ModelName = 'Task',
    runInTransaction = false,
  ): Prisma.MiddlewareParams => ({
    model,
    action,
    args,
    dataPath: [],
    runInTransaction,
  });
  beforeEach(() => {
    prisma = createMockPrismaService();
    prisma.organization.findUnique.mockImplementation(async ({ where }) => ({
      id: where.id,
    }));
    prisma.auditLog.create.mockImplementation(async ({ data }) => ({
      id: 101,
      ...data,
    }));
    prisma.systemAuditEvent.create.mockImplementation(async ({ data }) => ({
      id: 102,
      ...data,
    }));
    middleware = automaticAuditMiddleware(prisma as unknown as PrismaClient);
  });

  it('uses the created entity owner without a request or actor lookup', async () => {
    prisma.task.findUnique.mockResolvedValue({
      id: 9,
      organizationId: 7,
      taskName: 'Task',
    });
    await middleware(
      params('create', { data: { organizationId: 7 } }),
      async () => ({ id: 9, organizationId: 7, taskName: 'Task' }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 7, action: 'CREATE' }),
      }),
    );
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('uses a successful create FK when the caller selects only its identifier', async () => {
    await middleware(
      params('create', {
        data: { organization: { connect: { id: 7 } } },
        select: { id: true },
      }),
      async () => ({ id: 9 }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 7 }),
      }),
    );
  });

  it('resolves child ownership from its parent, never the acting user', async () => {
    prisma.attendanceBreak.findUnique.mockResolvedValue({
      id: 3,
      attendanceId: 8,
      endedAt: new Date(),
    });
    prisma.attendance.findUnique.mockResolvedValue({
      id: 8,
      organizationId: 7,
    });
    await middleware(params('create', {}, 'AttendanceBreak'), async () => ({
      id: 3,
      attendanceId: 8,
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 7 }),
      }),
    );
  });

  it('quarantines mismatches for normal users', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 9, organizationId: 7 });
    await runWithAuditContext({ organizationId: 55, userId: 1 }, () =>
      middleware(params('create'), async () => ({ id: 9, organizationId: 7 })),
    );
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.systemAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'CONTEXT_MISMATCH',
          targetOrganizationId: 7,
          requestedOrganizationId: 55,
        }),
      }),
    );
  });

  it('preserves the actual owner for an explicitly identified platform administrator', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 9, organizationId: 7 });
    await runWithAuditContext(
      { organizationId: 55, isPlatformAdmin: true },
      () =>
        middleware(params('create'), async () => ({
          id: 9,
          organizationId: 7,
        })),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 7 }),
      }),
    );
  });

  it('stores global role changes in the system stream', async () => {
    await middleware(params('create', {}, 'Permission'), async () => ({
      id: 9,
      name: 'task.read',
    }));
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.systemAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'PLATFORM_EVENT' }),
      }),
    );
  });

  it('records a logical delete even after soft-delete middleware rewrites the action', async () => {
    const before = { id: 9, organizationId: 7, deletedAt: null };
    prisma.task.findUnique.mockResolvedValue(before);
    const softDelete = softDeleteMiddleware();
    await middleware(params('delete', { where: { id: 9 } }), (p) =>
      softDelete(p, async (rewritten) => {
        expect(rewritten.action).toBe('update');
        return { ...before, deletedAt: new Date() };
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'DELETE', organizationId: 7 }),
      }),
    );
  });

  it('records restores rather than ignoring deletedAt changes', async () => {
    prisma.task.findUnique
      .mockResolvedValueOnce({
        id: 9,
        organizationId: 7,
        deletedAt: new Date(),
      })
      .mockResolvedValueOnce({ id: 9, organizationId: 7, deletedAt: null });
    await middleware(
      params('update', { where: { id: 9 }, data: { deletedAt: null } }),
      async () => ({ id: 9, organizationId: 7, deletedAt: null }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'RESTORE' }),
      }),
    );
  });

  it('audits an upsert as an update when a previous record exists', async () => {
    prisma.task.findUnique
      .mockResolvedValueOnce({ id: 9, organizationId: 7, taskName: 'Before' })
      .mockResolvedValueOnce({ id: 9, organizationId: 7, taskName: 'After' });
    await middleware(params('upsert', { where: { id: 9 } }), async () => ({
      id: 9,
      organizationId: 7,
      taskName: 'After',
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'UPDATE',
          fieldName: 'taskName',
          oldValue: 'Before',
          newValue: 'After',
        }),
      }),
    );
  });

  it('does not silently attribute ownership transfers to either tenant', async () => {
    prisma.task.findUnique
      .mockResolvedValueOnce({ id: 9, organizationId: 7 })
      .mockResolvedValueOnce({ id: 9, organizationId: 55 });
    await middleware(params('update', { where: { id: 9 } }), async () => ({
      id: 9,
      organizationId: 55,
    }));
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.systemAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'OWNERSHIP_CHANGED' }),
      }),
    );
  });

  it.each(['createMany', 'updateMany', 'deleteMany'] as const)(
    'records %s as a system summary rather than inventing row owners',
    async (action) => {
      await middleware(
        params(action, { where: { organizationId: { in: [7, 55] } } }),
        async () => ({ count: 2 }),
      );
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(prisma.systemAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: 'BULK_WRITE_SUMMARY',
            newValue: expect.objectContaining({ count: 2 }),
          }),
        }),
      );
    },
  );

  it('records nested-operation coverage explicitly', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 9, organizationId: 7 });
    await middleware(
      params('create', {
        data: { shootCrew: { create: { userId: 1 } } },
      }),
      async () => ({ id: 9, organizationId: 7 }),
    );
    expect(prisma.systemAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'NESTED_WRITE_SUMMARY' }),
      }),
    );
  });

  it('redacts secrets in the persisted snapshots', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 9,
      organizationId: 7,
      password: 'do-not-store',
    });
    await middleware(params('create', {}, 'User'), async () => ({
      id: 9,
      organizationId: 7,
      password: 'do-not-store',
    }));
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain(
      'do-not-store',
    );
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).toContain('***');
  });

  it('does not turn a successful non-transactional mutation into a retryable error when auditing fails', async () => {
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    prisma.systemAuditEvent.create.mockRejectedValue(new Error('unavailable'));
    const next = jest.fn().mockResolvedValue({ id: 9 });
    await expect(middleware(params('create'), next)).resolves.toEqual({
      id: 9,
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('AUDIT_PERSISTENCE_FAILED'),
    );
    logger.mockRestore();
  });

  it('uses the interactive transaction client for both owner reads and audit writes', async () => {
    const tx = createMockPrismaService();
    tx.task.findUnique.mockResolvedValue({ id: 9, organizationId: 7 });
    tx.organization.findUnique.mockResolvedValue({ id: 7 });
    await runWithAuditTransaction(
      prisma,
      tx as unknown as Prisma.TransactionClient,
      () =>
        middleware(params('create', {}, 'Task', true), async () => ({
          id: 9,
          organizationId: 7,
        })),
    );
    expect(tx.auditLog.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('propagates transactional audit failures so the caller can roll back', async () => {
    const tx = createMockPrismaService();
    tx.systemAuditEvent.create.mockRejectedValue(
      new Error('audit write failed'),
    );
    await expect(
      runWithAuditTransaction(
        prisma,
        tx as unknown as Prisma.TransactionClient,
        () =>
          middleware(params('create', {}, 'Permission', true), async () => ({
            id: 9,
          })),
      ),
    ).rejects.toThrow('audit write failed');
  });

  it('does not claim that an array-transaction observation is a committed row audit', async () => {
    await middleware(params('create', {}, 'Task', true), async () => ({
      id: 9,
      organizationId: 7,
    }));
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.systemAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'BATCH_TRANSACTION_UNVERIFIED',
          status: 'UNVERIFIED',
        }),
      }),
    );
  });

  it('does not log successful mutations when the database rejects the write', async () => {
    await expect(
      middleware(params('create'), async () => {
        throw new Error('write failed');
      }),
    ).rejects.toThrow('write failed');
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.systemAuditEvent.create).not.toHaveBeenCalled();
  });

  it('clears request actor context for per-tenant background jobs', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 9, organizationId: 7 });
    await runWithAuditContext({ organizationId: 55, userId: 88 }, () =>
      runWithSystemAuditContext(7, 'test.job', () =>
        middleware(params('create'), async () => ({
          id: 9,
          organizationId: 7,
        })),
      ),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 7,
          userName: 'System',
          userRole: 'SYSTEM',
          userId: undefined,
        }),
      }),
    );
  });

  it('records secret-field changes while redacting both values', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: 9,
        organizationId: 7,
        password: 'old-secret',
      })
      .mockResolvedValueOnce({
        id: 9,
        organizationId: 7,
        password: 'new-secret',
      });
    await middleware(
      params('update', { where: { id: 9 } }, 'User'),
      async () => ({ id: 9, organizationId: 7, password: 'new-secret' }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fieldName: 'password',
          oldValue: '***',
          newValue: '***',
        }),
      }),
    );
  });
});
