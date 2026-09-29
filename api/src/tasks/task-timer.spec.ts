import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';

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
  const admin = makeUser(5, Role.ADMIN);
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
  let prisma: {
    task: { findFirst: jest.Mock; findFirstOrThrow: jest.Mock };
    taskTimerSession: {
      findFirst: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tx: {
    taskTimerSession: { updateMany: jest.Mock };
    timesheet: { create: jest.Mock };
  };

  beforeEach(() => {
    tx = {
      taskTimerSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      timesheet: { create: jest.fn().mockResolvedValue({ id: 77 }) },
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
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    service = new TasksService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('allows two assigned people to run independent timers on the same task', async () => {
    const firstWorker = makeUser(11, Role.EMPLOYEE, 101);
    const secondWorker = makeUser(12, Role.EMPLOYEE, 102);

    await service.updateTimer(8, { action: 'start' }, firstWorker);
    await service.updateTimer(8, { action: 'start' }, secondWorker);

    expect(prisma.taskTimerSession.create).toHaveBeenCalledTimes(2);
    expect(prisma.taskTimerSession.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        taskId: 8,
        userId: 11,
        organizationId,
        status: 'RUNNING',
      }),
    });
    expect(prisma.taskTimerSession.create).toHaveBeenNthCalledWith(2, {
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
    expect(prisma.taskTimerSession.create).not.toHaveBeenCalled();
  });

  it('requires an estimate before starting a countdown', async () => {
    prisma.task.findFirst.mockResolvedValueOnce({
      ...task,
      estimatedHours: null,
    });

    await expect(
      service.updateTimer(8, { action: 'start' }, admin),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.taskTimerSession.create).not.toHaveBeenCalled();
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
        status: 'PENDING',
        createdByUserId: 11,
        hours: expect.any(Number),
      }),
    });
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
