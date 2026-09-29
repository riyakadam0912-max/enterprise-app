import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';

describe('TasksService task countdown timer', () => {
  const organizationId = 12;
  const admin = {
    id: 5,
    userId: 5,
    organizationId,
    role: Role.ADMIN,
  } as AuthUser;

  const baseTask = {
    id: 8,
    organizationId,
    deletedAt: null,
    taskName: 'Prepare campaign assets',
    project: 'Spring campaign',
    projectId: 42,
    estimatedHours: 1,
    timerStatus: 'IDLE',
    timerDurationSeconds: 0,
    timerRemainingSeconds: 0,
    timerStartedAt: null,
    timerStartedByUserId: null,
    timerTotalSeconds: 0,
  };

  let service: TasksService;
  let prisma: {
    task: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      findFirstOrThrow: jest.Mock;
    };
    $transaction: jest.Mock;
    timesheet: { create: jest.Mock };
  };
  let transaction: {
    task: { updateMany: jest.Mock; findFirstOrThrow: jest.Mock };
    timesheet: { create: jest.Mock };
  };

  beforeEach(() => {
    transaction = {
      task: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: jest
          .fn()
          .mockResolvedValue({ ...baseTask, timerStatus: 'STOPPED' }),
      },
      timesheet: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    prisma = {
      task: {
        findFirst: jest.fn().mockResolvedValue(baseTask),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: jest
          .fn()
          .mockResolvedValue({ ...baseTask, timerStatus: 'RUNNING' }),
      },
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
      timesheet: { create: jest.fn() },
    };
    service = new TasksService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('starts an estimate-based countdown for an admin', async () => {
    prisma.task.findFirst
      .mockResolvedValueOnce(baseTask)
      .mockResolvedValueOnce(null);
    await service.updateTimer(8, { action: 'start' }, admin);

    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 8, organizationId, timerStatus: 'IDLE' },
        data: expect.objectContaining({
          timerStatus: 'RUNNING',
          timerDurationSeconds: 3600,
          timerRemainingSeconds: 3600,
          timerStartedByUserId: admin.userId,
        }),
      }),
    );
  });

  it('does not allow a user to run timers on two tasks simultaneously', async () => {
    prisma.task.findFirst
      .mockResolvedValueOnce(baseTask)
      .mockResolvedValueOnce({ id: 9, taskName: 'Review landing page' });

    await expect(
      service.updateTimer(8, { action: 'start' }, admin),
    ).rejects.toThrow('Timer is already running for task: Review landing page');
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('requires an estimate before starting', async () => {
    prisma.task.findFirst.mockResolvedValueOnce({
      ...baseTask,
      estimatedHours: null,
    });

    await expect(
      service.updateTimer(8, { action: 'start' }, admin),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('rejects employees from controlling timers', async () => {
    const employee = { ...admin, role: Role.EMPLOYEE } as AuthUser;

    await expect(
      service.updateTimer(8, { action: 'start' }, employee),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.task.findFirst).not.toHaveBeenCalled();
  });

  it('stops the timer and creates an attributed pending timesheet atomically', async () => {
    const startedAt = new Date(Date.now() - 30_000);
    prisma.task.findFirst.mockResolvedValueOnce({
      ...baseTask,
      timerStatus: 'RUNNING',
      timerDurationSeconds: 3600,
      timerRemainingSeconds: 3570,
      timerStartedAt: startedAt,
      timerStartedByUserId: 9,
    });

    await service.updateTimer(
      8,
      { action: 'stop', notes: 'Asset preparation' },
      admin,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.timesheet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        taskId: 8,
        projectId: 42,
        task: 'Prepare campaign assets',
        project: 'Spring campaign',
        status: 'PENDING',
        notes: 'Asset preparation',
        createdByUserId: 9,
        hours: expect.any(Number),
      }),
    });
    expect(transaction.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          timerStatus: 'STOPPED',
          timerRemainingSeconds: 0,
        }),
      }),
    );
  });
});
