import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AttendanceService } from './attendance.service';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { AttendanceSummaryQueryDto } from './dto/attendance-summary.dto';
import { Role } from '../common/enums/role.enum';

describe('Attendance audit fixes', () => {
  it('hydrates only the requested page when summary and derived filters are absent', async () => {
    const db = { organization: { findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }) }, employee: { count: jest.fn().mockResolvedValue(2000) } };
    const service = new AttendanceService(db as any, {} as any, {} as any, {} as any, {} as any);
    jest.spyOn(service as any, 'resolveOrganizationId').mockResolvedValue(1);
    jest.spyOn(service as any, 'getScopedEmployeeFilter').mockResolvedValue(null);
    jest.spyOn(service as any, 'dailyEmployeeWhere').mockResolvedValue({ organizationId: 1 });
    const snapshot = jest.spyOn(service as any, 'buildDailySnapshot').mockResolvedValue({ rows: [{ employeeId: 11 }] });
    const response = await service.findAll({ page: 2, limit: 10, summaryMode: 'none' }, { userId: 1, role: Role.ADMIN, organizationId: 1 });
    expect(response.total).toBe(2000);
    expect(response.summary).toBeUndefined();
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(snapshot).toHaveBeenCalledWith(expect.any(Date), null, expect.anything(), expect.objectContaining({ offset: 10, limit: 10 }));
  });
  it.each([
    { month: 13 },
    { limit: 0 },
    { page: -1 },
    { employeeId: 0 },
    { date: '2026-02-30' },
  ])('rejects invalid calendar/pagination input %j', async (input) => {
    expect(
      (await validate(plainToInstance(QueryAttendanceDto, input))).length,
    ).toBeGreaterThan(0);
  });
  it.each(['2026-00', '2026-13', '2026-1'])(
    'rejects invalid summary month %s',
    async (month) => {
      expect(
        (await validate(plainToInstance(AttendanceSummaryQueryDto, { month })))
          .length,
      ).toBeGreaterThan(0);
    },
  );
  it('preserves correct row totals and summaries across bounded daily snapshot batches', async () => {
    const db = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
      },
    };
    const service = new AttendanceService(
      db as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest.spyOn(service as any, 'resolveOrganizationId').mockResolvedValue(1);
    jest
      .spyOn(service as any, 'getScopedEmployeeFilter')
      .mockResolvedValue(null);
    const row = (id: number) => ({
      employeeId: id,
      employee: { organization: { id: 1 } },
      status: 'PRESENT',
      checkIn: '2026-10-24T09:00:00Z',
      workingHours: 8,
      taskHours: id === 1 || id === 101 ? 0.005 : 0,
      overtimeHours: 0,
      lateMinutes: 0,
      shiftDetails: { requiredHours: 8 },
    });
    const snapshot = jest
      .spyOn(service as any, 'buildDailySnapshot')
      .mockResolvedValueOnce({
        rows: Array.from({ length: 100 }, (_, i) => row(i + 1)),
        nextCursor: 100,
      })
      .mockResolvedValueOnce({ rows: [row(101), row(102)] });
    const response = await service.findAll(
      { page: 2, limit: 10 },
      { userId: 1, role: Role.ADMIN, organizationId: 1 },
    );
    expect(response.total).toBe(102);
    expect(response.data.map((item) => item.employeeId)).toEqual([
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
    expect(response.summary!.present).toBe(102);
    expect(response.summary!.totalWorkedHours).toBe(816.01);
    expect(response.summary!.totalTaskHours).toBe(0.01);
    expect(snapshot).toHaveBeenNthCalledWith(
      2,
      expect.any(Date),
      null,
      expect.anything(),
      expect.objectContaining({ cursor: 100 }),
    );
  });

  describe('scheduled reconciliation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-10-24T10:00:00Z'));
    });
    afterEach(() => jest.useRealTimers());
    function fixture(claimed: boolean) {
      const job = {
        id: 1,
        organizationId: 1,
        date: new Date('2026-10-21'),
        cursor: 25,
      };
      const db = {
        organization: {
          findMany: jest.fn().mockResolvedValue([{ id: 1, timezone: 'UTC' }]),
        },
        attendanceReconciliationJob: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(job),
          upsert: jest.fn().mockResolvedValue(job),
          updateMany: jest.fn().mockResolvedValue({ count: claimed ? 1 : 0 }),
        },
      };
      const service = new AttendanceService(
        db as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
      jest
        .spyOn(service, 'runAutoCheckoutAutomation')
        .mockResolvedValue({ processedAt: '2026-10-24' });
      const reconcile = jest
        .spyOn(service, 'runDailyAutomation')
        .mockResolvedValue({
          cursor: 75,
          hasMore: true,
          processedDate: '2026-10-21',
          alreadyProcessed: false,
        });
      return { db, service, reconcile };
    }
    it('does no work when another worker owns the lease', async () => {
      const { service, reconcile } = fixture(false);
      expect((await service.runScheduledAutomation()).reconciliation).toEqual(
        [],
      );
      expect(reconcile).not.toHaveBeenCalled();
    });
    it('previews reconciliation without closing attendance, claiming jobs or changing rows', async () => {
      const { service, db, reconcile } = fixture(true);
      const result = await service.runScheduledAutomation({ dryRun: true });
      expect(result.dryRun).toBe(true);
      expect(result.reconciliation[0].status).toBe('DRY_RUN');
      expect(service.runAutoCheckoutAutomation).not.toHaveBeenCalled();
      expect(db.attendanceReconciliationJob.upsert).not.toHaveBeenCalled();
      expect(db.attendanceReconciliationJob.updateMany).not.toHaveBeenCalled();
      expect(reconcile).not.toHaveBeenCalled();
    });
    it('resumes from the durable employee cursor and releases a partial batch', async () => {
      const { service, db, reconcile } = fixture(true);
      expect(
        (await service.runScheduledAutomation()).reconciliation[0].status,
      ).toBe('PARTIAL');
      expect(reconcile).toHaveBeenCalledWith(undefined, {
        organizationId: 1,
        dateKey: '2026-10-21',
        afterEmployeeId: 25,
        limit: 50,
      });
      expect(
        db.attendanceReconciliationJob.updateMany,
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cursor: 75,
            completedAt: null,
            leaseOwner: null,
          }),
        }),
      );
    });
    it('records retry state without advancing a failed batch or exposing internals', async () => {
      const { service, db, reconcile } = fixture(true);
      reconcile.mockRejectedValue(new Error('private database detail'));
      expect(
        (await service.runScheduledAutomation()).reconciliation[0].status,
      ).toBe('FAILED');
      expect(
        db.attendanceReconciliationJob.updateMany,
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: {
            lastError: 'Reconciliation failed; retry required',
            leaseUntil: null,
            leaseOwner: null,
          },
        }),
      );
    });
  });
});
