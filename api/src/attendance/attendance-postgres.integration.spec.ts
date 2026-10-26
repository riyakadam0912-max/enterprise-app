import { PrismaClient, AttendanceStatus } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { Role } from '../common/enums/role.enum';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AttendanceController } from './attendance.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

const url = process.env.ATTENDANCE_TEST_DATABASE_URL;
// This suite is opt-in and refuses application/remote databases.
const local = url ? new URL(url) : null;
if (
  local &&
  (!['localhost', '127.0.0.1'].includes(local.hostname) ||
    local.pathname !== '/attendance_fix_test')
) {
  throw new Error(
    'Attendance integration tests require the isolated local attendance_fix_test database',
  );
}

(url ? describe : describe.skip)('Attendance PostgreSQL acceptance', () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  let service: AttendanceService;
  let employeeId: number;
  let organizationId: number;
  let shiftId: number;
  let user: {
    userId: number;
    employeeId: number;
    organizationId: number;
    role: Role;
  };
  const tasks = {
    lockTimerAndAttendanceStateForUser: jest.fn(
      async (_user: unknown, tx: any) => {
        await tx.$queryRaw`WITH locked AS MATERIALIZED (SELECT pg_advisory_xact_lock(137704::integer, 1::integer)) SELECT 1 FROM locked`;
      },
    ),
    stopActiveTimerForEmployee: jest.fn(async () => null),
  };
  beforeAll(async () => {
    const organization = await db.organization.create({
      data: {
        name: 'Attendance acceptance',
        code: `attendance-${Date.now()}`,
        slug: `attendance-${Date.now()}`,
        timezone: 'UTC',
      },
    });
    organizationId = organization.id;
    const shift = await db.shift.create({
      data: {
        name: 'Fixed acceptance',
        type: 'FIXED',
        startTime: '09:00',
        endTime: '17:00',
        organizationId,
        workingDays: [0, 1, 2, 3, 4, 5, 6],
      },
    });
    shiftId = shift.id;
    const employee = await db.employee.create({
      data: { name: 'Attendance fixture', organizationId, shiftId },
    });
    employeeId = employee.id;
    const actor = await db.user.create({
      data: {
        name: 'Attendance actor',
        email: `attendance-${Date.now()}@example.invalid`,
        password: 'test-only',
        role: 'ADMIN',
        organizationId,
        employeeId,
      },
    });
    user = { userId: actor.id, role: Role.ADMIN, organizationId, employeeId };
    service = new AttendanceService(
      db as any,
      { del: async () => undefined } as any,
      {
        resolveScope: async (actor: any) => ({
          organizationId: actor.organizationId,
          allUnits: true,
        }),
        buildEmployeeBUWhere: (scope: any) => ({
          organizationId: scope.organizationId,
          deletedAt: null,
        }),
        getEmployeeScopeFilterIds: async () => null,
      } as any,
      {
        getDescendantOrganizationIds: async (id: number) => [id],
        getOrganizationFamilyRootId: async (id: number) => id,
        getOrganizationIds: async (actor: any) => [actor.organizationId],
        getRelatedOrganizationIds: async (id: number) => [id],
      } as any,
      tasks as any,
    );
  });
  beforeEach(async () => {
    tasks.stopActiveTimerForEmployee.mockClear();
    await db.attendanceBreak.deleteMany({
      where: { attendance: { employeeId } },
    });
    await db.attendance.deleteMany({ where: { employeeId } });
    await db.attendanceSessionBreak.deleteMany({
      where: { attendanceSession: { employeeId } },
    });
    await db.attendanceSession.deleteMany({ where: { employeeId } });
    await db.employeeShiftAssignment.deleteMany({ where: { employeeId } });
    await db.employee.update({ where: { id: employeeId }, data: { shiftId } });
  });
  afterAll(async () => {
    // Keep the test database inspectable; its dedicated cluster is disposable.
    await db.$disconnect();
  });

  async function openAttendance() {
    const date = new Date(new Date().toISOString().slice(0, 10));
    return db.attendance.create({
      data: {
        employeeId,
        organizationId,
        shiftId,
        date,
        status: AttendanceStatus.PRESENT,
        checkIn: new Date(Date.now() - 4 * 3600000),
      },
    });
  }

  it('allows exactly one concurrent fixed checkout and increments the database version', async () => {
    const attendance = await openAttendance();
    const results = await Promise.allSettled([
      service.checkOut({}, user),
      service.checkOut({}, user),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(tasks.stopActiveTimerForEmployee).toHaveBeenCalledTimes(1);
    const current = await db.attendance.findUniqueOrThrow({
      where: { id: attendance.id },
    });
    expect(current.checkOut).not.toBeNull();
    expect(current.version).toBe(attendance.version + 1);
  });

  it('does not leave an open break when checkout races with starting a break', async () => {
    const attendance = await openAttendance();
    await Promise.allSettled([
      service.startBreak(user),
      service.checkOut({}, user),
    ]);
    const current = await db.attendance.findUniqueOrThrow({
      where: { id: attendance.id },
      include: { breaks: true },
    });
    expect(current.checkOut).not.toBeNull();
    expect(current.breaks.some((interval) => interval.endedAt === null)).toBe(
      false,
    );
  });

  it('rejects a stale admin correction without overwriting the winning correction', async () => {
    const attendance = await openAttendance();
    await service.update(
      attendance.id,
      {
        expectedVersion: attendance.version,
        status: AttendanceStatus.HALF_DAY,
      },
      user,
    );
    await expect(
      service.update(
        attendance.id,
        {
          expectedVersion: attendance.version,
          status: AttendanceStatus.ABSENT,
        },
        user,
      ),
    ).rejects.toThrow('Attendance changed');
    expect(
      (await db.attendance.findUniqueOrThrow({ where: { id: attendance.id } }))
        .status,
    ).toBe(AttendanceStatus.HALF_DAY);
  });

  it('database assignment guard rejects concurrent overlapping assignments', async () => {
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        db.employeeShiftAssignment.create({
          data: {
            employeeId,
            shiftId,
            effectiveFrom: new Date('2026-10-01T00:00:00Z'),
          },
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      await db.employeeShiftAssignment.count({ where: { employeeId } }),
    ).toBe(1);
  });

  it('database leases allow only one reconciliation owner and allow expiry recovery', async () => {
    const date = new Date('2026-10-01T00:00:00Z');
    await db.attendanceReconciliationJob.deleteMany({
      where: { organizationId },
    });
    const job = await db.attendanceReconciliationJob.create({
      data: { organizationId, date },
    });
    const claims = await Promise.all(
      ['first', 'second'].map((owner) =>
        db.attendanceReconciliationJob.updateMany({
          where: {
            id: job.id,
            completedAt: null,
            OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
          },
          data: {
            leaseOwner: owner,
            leaseUntil: new Date(Date.now() + 120000),
          },
        }),
      ),
    );
    expect(claims.reduce((sum, claim) => sum + claim.count, 0)).toBe(1);
    await db.attendanceReconciliationJob.update({
      where: { id: job.id },
      data: { leaseUntil: new Date(0) },
    });
    expect(
      (
        await db.attendanceReconciliationJob.updateMany({
          where: { id: job.id, leaseUntil: { lt: new Date() } },
          data: { leaseOwner: 'recovered' },
        })
      ).count,
    ).toBe(1);
  });

  it('corrects an overnight source session and rebuilds both daily projections atomically', async () => {
    const flexible = await db.shift.create({
      data: { name: 'Flexible acceptance', type: 'FLEXIBLE', organizationId },
    });
    await db.employee.update({
      where: { id: employeeId },
      data: { shiftId: flexible.id },
    });
    const start = new Date(Date.now() - 3 * 86400000);
    start.setUTCHours(22, 0, 0, 0);
    const end = new Date(start.getTime() + 8 * 3600000);
    const session = await db.attendanceSession.create({
      data: {
        employeeId,
        organizationId,
        shiftId: flexible.id,
        startedAt: start,
        endedAt: end,
      },
    });
    await db.$transaction((tx) =>
      (service as any).rebuildFlexibleAttendanceAfterReopen(
        tx,
        employeeId,
        organizationId,
        start,
        'UTC',
        new Date(),
        end,
      ),
    );
    await service.correctSession(
      session.id,
      {
        expectedSessionUpdatedAt: session.updatedAt.toISOString(),
        checkOut: new Date(end.getTime() + 3600000).toISOString(),
      },
      user,
    );
    const rows = await db.attendance.findMany({
      where: { employeeId },
      orderBy: { date: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.workingHours)).toEqual([2, 7]);
    await expect(
      service.correctSession(
        session.id,
        {
          expectedSessionUpdatedAt: session.updatedAt.toISOString(),
          checkOut: end.toISOString(),
        },
        user,
      ),
    ).rejects.toThrow('Session changed');
  });

  it('enforces HTTP calendar validation, roles and organization boundaries', async () => {
    const init = jest
      .spyOn(service, 'onModuleInit')
      .mockImplementation(() => undefined);
    const module = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [
        { provide: AttendanceService, useValue: service },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: any) {
          const req = context.switchToHttp().getRequest();
          if (!req.headers.authorization) return false;
          req.user = {
            ...user,
            role:
              req.headers.authorization === 'Fixture employee'
                ? Role.EMPLOYEE
                : Role.ADMIN,
          };
          return true;
        },
      })
      .compile();
    const app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    try {
      for (const path of [
        '/attendance?month=13',
        '/attendance?limit=0',
        '/attendance?date=2026-02-30',
        '/attendance/summary?month=2026-13',
      ]) {
        expect(
          (
            await request(app.getHttpServer())
              .get(path)
              .set('authorization', 'Fixture admin')
          ).status,
        ).toBe(400);
      }
      expect(
        (
          await request(app.getHttpServer())
            .patch('/attendance/sessions/1')
            .set('authorization', 'Fixture employee')
            .send({})
        ).status,
      ).toBe(403);
      const other = await db.organization.create({
        data: {
          name: 'Other attendance scope',
          code: `other-${Date.now()}`,
          slug: `other-${Date.now()}`,
        },
      });
      const outside = await db.employee.create({
        data: { name: 'Outside fixture', organizationId: other.id },
      });
      expect(
        (
          await request(app.getHttpServer())
            .get(`/attendance/employee/${outside.id}/sessions?date=2026-10-24`)
            .set('authorization', 'Fixture admin')
        ).status,
      ).toBe(404);
    } finally {
      await app.close();
      init.mockRestore();
    }
  });

  it('recovers an unambiguous legacy record without inventing a checkout', async () => {
    const flexible = await db.shift.create({ data: { name: 'Legacy recovery', type: 'FLEXIBLE', organizationId } });
    await db.employee.update({ where: { id: employeeId }, data: { shiftId: flexible.id } });
    const start = new Date(Date.now() - 3 * 3600000);
    const record = await db.attendance.create({ data: { employeeId, organizationId, shiftId: flexible.id, date: new Date(start.toISOString().slice(0, 10)), checkIn: start, status: 'PRESENT' } });
    const recovered = await service.recoverLegacySession(record.id, user);
    expect(recovered.startedAt).toEqual(start);
    expect(recovered.endedAt).toBeNull();
    expect((await db.attendance.findUniqueOrThrow({ where: { id: record.id } })).checkOut).toBeNull();
    await service.checkOut({}, user);
    expect((await db.attendanceSession.findUniqueOrThrow({ where: { id: recovered.id } })).endedAt).not.toBeNull();
  });

  it('refuses legacy reconstruction when later-day source history overlaps the open interval', async () => {
    const flexible = await db.shift.create({ data: { name: 'Legacy overlap', type: 'FLEXIBLE', organizationId } });
    await db.employee.update({ where: { id: employeeId }, data: { shiftId: flexible.id } });
    const start = new Date(Date.now() - 3 * 86400000);
    const record = await db.attendance.create({ data: { employeeId, organizationId, shiftId: flexible.id, date: new Date(start.toISOString().slice(0, 10)), checkIn: start, status: 'PRESENT' } });
    await db.attendanceSession.create({ data: { employeeId, organizationId, shiftId: flexible.id, startedAt: new Date(start.getTime() + 86400000), endedAt: new Date(start.getTime() + 90000000) } });
    await expect(service.recoverLegacySession(record.id, user)).rejects.toThrow('history is inconsistent');
    expect(await db.attendanceSession.count({ where: { employeeId, endedAt: null } })).toBe(0);
  });

  it('creates a policy revision while historical attendance retains the previous policy', async () => {
    const attendance = await openAttendance();
    const revision = await service.updateShift(
      shiftId,
      { requiredHours: 7 },
      user,
    );
    expect(revision.id).not.toBe(shiftId);
    expect(revision.requiredHours).toBe(7);
    expect(
      (await db.shift.findUniqueOrThrow({ where: { id: shiftId } }))
        .requiredHours,
    ).toBe(8);
    expect(
      (await db.attendance.findUniqueOrThrow({ where: { id: attendance.id } }))
        .shiftId,
    ).toBe(shiftId);
  });
});
