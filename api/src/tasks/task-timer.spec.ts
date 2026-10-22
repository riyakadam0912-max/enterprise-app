import { ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';
import { AttendanceTaskHoursService } from '../timesheets/attendance-task-hours.service';

describe('TasksService per-user task timer sessions', () => {
  const organizationId = 12;
  const makeUser = (
    userId: number,
    role: Role,
    employeeId: number | null = null,
  ) =>
    ({
      id: userId,
      userId,
      organizationId,
      employeeId,
      role,
    }) as AuthUser;
  const admin = makeUser(5, Role.ADMIN, 105);
  const task = {
    id: 8,
    organizationId,
    deletedAt: null,
    taskName: 'Prepare campaign assets',
    project: 'Spring campaign',
    projectId: 42,
    estimatedHours: 1,
    assignedToUserId: 11,
    assignedToId: 101,
    projectRef: { assignedEmployees: [{ id: 101 }, { id: 102 }] },
  };

  let service: TasksService;
  const cacheManager = { del: jest.fn().mockResolvedValue(undefined) };
  const attendanceTaskHours = {
    recomputeTimesheetHours: jest.fn().mockResolvedValue(undefined),
  };
  let prisma: {
    task: { findFirst: jest.Mock; findFirstOrThrow: jest.Mock };
    taskTimerSession: {
      findFirst: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    employee: { findFirst: jest.Mock };
    attendance: { findFirst: jest.Mock };
    attendanceSession: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    taskTimerSession: {
      updateMany: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    taskTimerInterval: { create: jest.Mock };
    timesheet: { create: jest.Mock };
    attendance: { findMany: jest.Mock; findFirst: jest.Mock };
    attendanceBreak: { updateMany: jest.Mock };
    attendanceSession: { findFirst: jest.Mock };
    employee: { findFirst: jest.Mock };
    user: { findFirst: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(() => {
    tx = {
      taskTimerSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 101 }),
      },
      taskTimerInterval: { create: jest.fn().mockResolvedValue({ id: 51 }) },
      timesheet: { create: jest.fn().mockResolvedValue({ id: 77 }) },
      attendance: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: 201,
          shift: { type: 'FIXED' },
          breaks: [],
        }),
      },
      attendanceBreak: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      attendanceSession: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: {
        findFirst: jest.fn().mockResolvedValue({ shift: { type: 'FIXED' } }),
      },
      user: { findFirst: jest.fn().mockResolvedValue({ employeeId: 101 }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma = {
      task: {
        findFirst: jest.fn().mockResolvedValue(task),
        findFirstOrThrow: jest
          .fn()
          .mockResolvedValue({ ...task, timerSessions: [] }),
      },
      taskTimerSession: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 101 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue({ shift: { type: 'FIXED' } }),
      },
      attendance: {
        findFirst: jest.fn().mockResolvedValue({ id: 201 }),
      },
      attendanceSession: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    service = new TasksService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      cacheManager as never,
      attendanceTaskHours as unknown as AttendanceTaskHoursService,
    );
  });

  it('allows two assigned people to run independent timers on the same task', async () => {
    const firstWorker = makeUser(11, Role.EMPLOYEE, 101);
    const secondWorker = makeUser(12, Role.EMPLOYEE, 102);

    await service.updateTimer(8, { action: 'start' }, firstWorker);
    await service.updateTimer(8, { action: 'start' }, secondWorker);

    expect(tx.taskTimerSession.create).toHaveBeenCalledTimes(2);
    expect(tx.taskTimerSession.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        taskId: 8,
        userId: 11,
        organizationId,
        status: 'RUNNING',
      }),
    });
    expect(tx.taskTimerSession.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        taskId: 8,
        userId: 12,
        organizationId,
        status: 'RUNNING',
      }),
    });
  });

  it('allows an employee to track only an assigned task', async () => {
    prisma.task.findFirst.mockResolvedValueOnce({
      ...task,
      assignedToUserId: 90,
      assignedToId: 900,
      projectRef: { assignedEmployees: [] },
    });

    await expect(
      service.updateTimer(
        8,
        { action: 'start' },
        makeUser(11, Role.EMPLOYEE, 101),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(tx.taskTimerSession.create).not.toHaveBeenCalled();
  });

  it('stops open timers before starting a new timer without changing break state', async () => {
    const startedAt = new Date(Date.now() - 30_000);
    const worker = makeUser(11, Role.EMPLOYEE, 101);
    tx.taskTimerSession.findMany.mockResolvedValueOnce([
      {
        id: 101,
        taskId: 9,
        userId: 11,
        organizationId,
        status: 'RUNNING',
        durationSeconds: 0,
        remainingSeconds: 0,
        startedAt,
        totalSeconds: 0,
        createdAt: startedAt,
        task: { ...task, id: 9 },
      },
    ]);
    await service.updateTimer(8, { action: 'start' }, worker);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const [lockQuery] = tx.$queryRaw.mock.calls[0];
    expect(lockQuery.join(' ')).toContain('WITH lock_result AS MATERIALIZED');
    expect(lockQuery.join(' ')).toContain('SELECT 1 AS locked');
    expect(tx.attendanceBreak.updateMany).not.toHaveBeenCalled();
    expect(tx.taskTimerSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 101, status: 'RUNNING', startedAt },
        data: expect.objectContaining({ status: 'STOPPED' }),
      }),
    );
    expect(tx.timesheet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ timerSessionId: 101 }),
    });
    expect(tx.taskTimerSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: 8,
        status: 'RUNNING',
      }),
    });
    expect(attendanceTaskHours.recomputeTimesheetHours).toHaveBeenCalledWith(
      101,
      organizationId,
      expect.any(Date),
      tx,
    );
  });

  it('does not start a timer while a break is active', async () => {
    tx.attendance.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.updateTimer(
        8,
        { action: 'start' },
        makeUser(11, Role.EMPLOYEE, 101),
      ),
    ).rejects.toThrow('Check in and end any break');

    expect(tx.taskTimerSession.create).not.toHaveBeenCalled();
    expect(tx.attendanceBreak.updateMany).not.toHaveBeenCalled();
  });

  it('does not resume a paused timer while a flexible-shift break is active', async () => {
    prisma.taskTimerSession.findFirst.mockResolvedValueOnce({
      id: 101,
      status: 'PAUSED',
    });
    tx.employee.findFirst.mockResolvedValue({
      shift: { type: 'FLEXIBLE' },
    });
    tx.attendanceSession.findFirst.mockResolvedValueOnce({
      id: 201,
      breaks: [{ endedAt: null }],
    });

    await expect(
      service.updateTimer(
        8,
        { action: 'resume' },
        makeUser(11, Role.EMPLOYEE, 101),
      ),
    ).rejects.toThrow(
      'End your break before starting or resuming a task timer',
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.taskTimerSession.updateMany).not.toHaveBeenCalled();
  });

  it('resumes a paused timer after the break has ended', async () => {
    prisma.taskTimerSession.findFirst.mockResolvedValueOnce({
      id: 101,
      status: 'PAUSED',
    });
    tx.employee.findFirst.mockResolvedValue({
      shift: { type: 'FLEXIBLE' },
    });
    tx.attendanceSession.findFirst.mockResolvedValueOnce({
      id: 201,
      breaks: [],
    });

    await service.updateTimer(
      8,
      { action: 'resume' },
      makeUser(11, Role.EMPLOYEE, 101),
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.taskTimerSession.updateMany).toHaveBeenCalledWith({
      where: { id: 101, status: 'PAUSED' },
      data: { status: 'RUNNING', startedAt: expect.any(Date) },
    });
  });

  it('allows a timer to start without a task estimate', async () => {
    prisma.task.findFirst.mockResolvedValueOnce({
      ...task,
      estimatedHours: null,
    });

    await service.updateTimer(8, { action: 'start' }, admin);

    expect(tx.taskTimerSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: 8,
        userId: admin.userId,
        status: 'RUNNING',
        durationSeconds: 0,
        remainingSeconds: 0,
      }),
    });
  });

  it('requires the user to be checked in and off break before starting', async () => {
    tx.attendance.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.updateTimer(
        8,
        { action: 'start' },
        makeUser(11, Role.EMPLOYEE, 101),
      ),
    ).rejects.toThrow('Check in and end any break');
    expect(tx.taskTimerSession.create).not.toHaveBeenCalled();
  });

  it('allows a flexible employee to start a timer when no break is active', async () => {
    tx.employee.findFirst.mockResolvedValue({
      shift: { type: 'FLEXIBLE' },
    });
    tx.attendanceSession.findFirst.mockResolvedValueOnce({
      id: 201,
      breaks: [],
    });

    await service.updateTimer(
      8,
      { action: 'start' },
      makeUser(11, Role.EMPLOYEE, 101),
    );

    expect(tx.attendanceSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          endedAt: null,
        }),
        include: { breaks: true },
      }),
    );
    expect(tx.taskTimerSession.create).toHaveBeenCalledTimes(1);
  });

  it('allows an open flexible session to start a timer when the current shift is stale', async () => {
    tx.employee.findFirst.mockResolvedValue({
      shift: { type: 'FIXED' },
    });
    tx.attendanceSession.findFirst.mockResolvedValueOnce({
      id: 201,
      breaks: [],
    });

    await service.updateTimer(
      8,
      { action: 'start' },
      makeUser(11, Role.EMPLOYEE, 101),
    );

    expect(tx.attendance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 101,
          organizationId,
          checkIn: { not: null },
          checkOut: null,
        }),
      }),
    );
    expect(tx.taskTimerSession.create).toHaveBeenCalledTimes(1);
  });

  it('rejects starting a timer during an open flexible-session break when the current shift is stale', async () => {
    tx.employee.findFirst.mockResolvedValue({
      shift: { type: 'FIXED' },
    });
    tx.attendanceSession.findFirst.mockResolvedValueOnce({
      id: 201,
      breaks: [{ endedAt: null }],
    });

    await expect(
      service.updateTimer(
        8,
        { action: 'start' },
        makeUser(11, Role.EMPLOYEE, 101),
      ),
    ).rejects.toThrow(
      'End your break before starting or resuming a task timer',
    );

    expect(tx.attendance.findFirst).not.toHaveBeenCalled();
    expect(tx.taskTimerSession.create).not.toHaveBeenCalled();
  });

  it('allows a flexible timer from an open attendance row when its session is missing', async () => {
    tx.employee.findFirst.mockResolvedValue({
      shift: { type: 'FLEXIBLE' },
    });
    tx.attendance.findFirst.mockResolvedValueOnce({
      id: 201,
      shift: { type: 'FLEXIBLE' },
      breaks: [],
    });

    await service.updateTimer(
      8,
      { action: 'start' },
      makeUser(11, Role.EMPLOYEE, 101),
    );

    expect(tx.attendanceSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ endedAt: null }),
        include: { breaks: true },
      }),
    );
    expect(tx.taskTimerSession.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a flexible timer when a legacy open attendance break exists without a session', async () => {
    tx.employee.findFirst.mockResolvedValue({
      shift: { type: 'FLEXIBLE' },
    });
    tx.attendance.findFirst.mockResolvedValueOnce({
      id: 201,
      shift: { type: 'FLEXIBLE' },
      breaks: [{ endedAt: null }],
    });

    await expect(
      service.updateTimer(
        8,
        { action: 'start' },
        makeUser(11, Role.EMPLOYEE, 101),
      ),
    ).rejects.toThrow(
      'End your break before starting or resuming a task timer',
    );

    expect(tx.taskTimerSession.create).not.toHaveBeenCalled();
  });

  it('rejects a timer when a legacy attendance break is open beside a flexible session', async () => {
    tx.employee.findFirst.mockResolvedValue({
      shift: { type: 'FLEXIBLE' },
    });
    tx.attendanceSession.findFirst.mockResolvedValueOnce({
      id: 201,
      breaks: [],
    });
    tx.attendance.findFirst.mockResolvedValueOnce({
      id: 301,
      shift: { type: 'FLEXIBLE' },
      breaks: [{ endedAt: null }],
    });

    await expect(
      service.updateTimer(
        8,
        { action: 'start' },
        makeUser(11, Role.EMPLOYEE, 101),
      ),
    ).rejects.toThrow(
      'End your break before starting or resuming a task timer',
    );

    expect(tx.taskTimerSession.create).not.toHaveBeenCalled();
  });

  it('links a stopped session to exactly one attributed pending timesheet', async () => {
    const startedAt = new Date(Date.now() - 30_000);
    prisma.taskTimerSession.findFirst.mockResolvedValueOnce({
      id: 101,
      taskId: 8,
      userId: 11,
      organizationId,
      status: 'RUNNING',
      durationSeconds: 3600,
      remainingSeconds: 3570,
      startedAt,
      totalSeconds: 0,
      createdAt: new Date(startedAt.getTime() - 30_000),
    });

    await service.updateTimer(
      8,
      { action: 'stop' },
      makeUser(11, Role.EMPLOYEE, 101),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.taskTimerSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 101,
          status: 'RUNNING',
          startedAt,
        }),
        data: expect.objectContaining({
          status: 'STOPPED',
          remainingSeconds: 0,
        }),
      }),
    );
    expect(tx.timesheet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        taskId: 8,
        projectId: 42,
        timerSessionId: 101,
        employeeId: 101,
        status: 'PENDING',
        createdByUserId: 11,
        hours: expect.any(Number),
      }),
    });
    expect(tx.taskTimerInterval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        timerSessionId: 101,
        startedAt,
        endedAt: expect.any(Date),
      }),
    });
    expect(attendanceTaskHours.recomputeTimesheetHours).toHaveBeenCalledWith(
      101,
      organizationId,
      expect.any(Date),
      tx,
    );
  });

  it('persists the completed run segment when a timer is paused', async () => {
    const startedAt = new Date(Date.now() - 30_000);
    prisma.taskTimerSession.findFirst.mockResolvedValueOnce({
      id: 101,
      taskId: 8,
      userId: 11,
      organizationId,
      status: 'RUNNING',
      durationSeconds: 0,
      remainingSeconds: 0,
      startedAt,
      totalSeconds: 0,
      createdAt: startedAt,
    });

    await service.updateTimer(
      8,
      { action: 'pause' },
      makeUser(11, Role.EMPLOYEE, 101),
    );

    expect(tx.taskTimerInterval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        timerSessionId: 101,
        startedAt,
        endedAt: expect.any(Date),
      }),
    });
  });

  it('finalizes a running timer when attendance starts a break', async () => {
    const startedAt = new Date(Date.now() - 30_000);
    tx.taskTimerSession.findMany.mockResolvedValueOnce([
      {
        id: 101,
        taskId: 8,
        userId: 11,
        organizationId,
        status: 'RUNNING',
        durationSeconds: 0,
        remainingSeconds: 0,
        startedAt,
        totalSeconds: 0,
        createdAt: startedAt,
        task,
      },
    ]);

    await service.stopRunningTimersForUser(
      makeUser(11, Role.EMPLOYEE, 101),
      new Date(),
      tx as never,
    );

    expect(tx.taskTimerInterval.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        timerSessionId: 101,
        startedAt,
        endedAt: expect.any(Date),
      }),
    });
    expect(tx.timesheet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ timerSessionId: 101 }),
    });
  });

  it('stops only running timers when a break starts', async () => {
    await service.stopRunningTimersForUser(
      makeUser(11, Role.EMPLOYEE, 101),
      new Date(),
      tx as never,
    );

    expect(tx.taskTimerSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 11,
          organizationId,
          status: 'RUNNING',
        },
      }),
    );
  });

  it('does not create a timesheet for a timer with no tracked time', async () => {
    const startedAt = new Date();
    attendanceTaskHours.recomputeTimesheetHours.mockClear();
    tx.taskTimerSession.findMany.mockResolvedValueOnce([
      {
        id: 101,
        taskId: 8,
        userId: 11,
        organizationId,
        status: 'PAUSED',
        durationSeconds: 0,
        remainingSeconds: 0,
        startedAt: null,
        totalSeconds: 0,
        createdAt: startedAt,
        task,
      },
    ]);

    await service.stopAllOpenTimersForUser(
      makeUser(11, Role.EMPLOYEE, 101),
      new Date(),
      tx as never,
    );

    expect(tx.timesheet.create).not.toHaveBeenCalled();
    expect(attendanceTaskHours.recomputeTimesheetHours).not.toHaveBeenCalled();
  });

  it('treats repeated stop as idempotent after the session is already closed', async () => {
    await service.updateTimer(8, { action: 'stop' }, admin);

    expect(prisma.task.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 8, organizationId },
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
