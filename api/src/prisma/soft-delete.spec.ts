import {
  softDeleteMiddleware,
  withDeletedRecords,
} from '../../prisma/middleware/softDelete';

describe('soft-delete middleware', () => {
  it('excludes soft-deleted attendance from default reads', async () => {
    const middleware = softDeleteMiddleware() as any;
    const next = jest.fn(async (params) => params.args);
    const params = {
      model: 'Attendance',
      action: 'findMany',
      args: { where: { employeeId: 7 } },
    };

    await middleware(params, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        args: { where: { employeeId: 7, deletedAt: null } },
      }),
    );
  });

  it('allows explicit recovery reads to include deleted attendance', async () => {
    const middleware = softDeleteMiddleware() as any;
    const next = jest.fn(async (params) => params.args);
    const params = {
      model: 'Attendance',
      action: 'findUnique',
      args: {
        where: {
          employeeId_date: { employeeId: 7, date: new Date() },
        },
      },
    };

    await withDeletedRecords(() => middleware(params, next));

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'findUnique',
        args: params.args,
      }),
    );
  });

  it('keeps composite-key attendance lookups as unique reads while filtering deleted rows', async () => {
    const middleware = softDeleteMiddleware() as any;
    const next = jest.fn(async (params) => params.args);
    const params = {
      model: 'Attendance',
      action: 'findUnique',
      args: {
        where: {
          employeeId_date: { employeeId: 7, date: new Date() },
        },
      },
    };

    await middleware(params, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'findUnique',
        args: {
          where: {
            employeeId_date: params.args.where.employeeId_date,
            deletedAt: null,
          },
        },
      }),
    );
  });
});
