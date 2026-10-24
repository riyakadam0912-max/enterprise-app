import {
  getAuditContext,
  runWithAuditContext,
  runWithSystemAuditContext,
  setAuditContext,
} from './audit-context';
import {
  withDeletedRecords,
  softDeleteMiddleware,
} from '../../prisma/middleware/softDelete';
import { Prisma } from '@prisma/client';

describe('Audit context isolation', () => {
  it('retains verified actor updates across awaited guard work', async () => {
    await runWithAuditContext({ organizationId: 7 }, async () => {
      await Promise.resolve().then(() =>
        setAuditContext({ userId: 42, isPlatformAdmin: true }),
      );
      expect(getAuditContext()).toMatchObject({
        organizationId: 7,
        userId: 42,
        isPlatformAdmin: true,
      });
    });
  });
  it('isolates concurrent requests and job scopes', async () => {
    await Promise.all(
      [7, 55].map((organizationId) =>
        runWithSystemAuditContext(organizationId, 'test', async () => {
          await Promise.resolve();
          expect(getAuditContext().organizationId).toBe(organizationId);
        }),
      ),
    );
    expect(getAuditContext()).toEqual({});
  });
  it('requires an explicit positive organization for tenant jobs', () => {
    expect(() => runWithSystemAuditContext(0, 'test', () => undefined)).toThrow(
      'requires an organization',
    );
  });
  it('includes deleted records only inside internal audit lookup scopes', async () => {
    const middleware = softDeleteMiddleware();
    const query = (): Prisma.MiddlewareParams => ({
      model: 'Task',
      action: 'findUnique',
      args: { where: { id: 1 } },
      dataPath: [],
      runInTransaction: false,
    });
    const next = jest.fn().mockResolvedValue(null);
    await withDeletedRecords(() => middleware(query(), next));
    expect(next.mock.calls[0][0].args.where).toEqual({ id: 1 });
    await middleware(query(), next);
    expect(next.mock.calls[1][0].args.where).toEqual({
      id: 1,
      deletedAt: null,
    });
  });
});
