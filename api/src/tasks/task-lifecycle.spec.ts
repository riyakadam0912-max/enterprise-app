import { TasksService } from './tasks.service';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';

describe('Task lifecycle transaction boundaries', () => {
  const actor = { userId: 7, employeeId: 70, organizationId: 1, role: Role.ADMIN, roles: [Role.ADMIN] } as AuthUser;
  let service: TasksService;
  let stored: any;
  let workflowExists: boolean;
  let workflowStatus: string | null;
  let workflow: any;
  let workflowTransaction: any;
  let notifications: any;
  let database: any;
  let failReview: boolean;
  let tx: any;

  beforeEach(() => {
    stored = { id: 9, organizationId: 1, taskName: 'Task', taskType: 'GENERAL', status: 'IN_PROGRESS', assignedToUserId: 7, assignedToId: 70, shootCrew: [] };
    workflowExists = false;
    workflowStatus = null;
    failReview = false;
    notifications = { sendNotification: jest.fn().mockResolvedValue(undefined) };
    workflow = { forTransaction: jest.fn() };
    database = {
      $transaction: jest.fn(async (action) => {
        let draft = { ...stored };
        let draftWorkflow = workflowExists;
        tx = {
          $queryRaw: jest.fn(),
          task: {
            findFirst: jest.fn(async () => draft),
            update: jest.fn(async ({ data }) => (draft = { ...draft, ...data })),
          },
          project: { findFirst: jest.fn(async () => null) },
          workflowInstance: { delete: jest.fn(async () => { draftWorkflow = false; }) },
        };
        workflow.forTransaction.mockReturnValue(workflowTransaction = {
          getInstanceByEntity: jest.fn(async () => draftWorkflow ? { id: 1, status: workflowStatus } : null),
          submitWorkflow: jest.fn(async () => { draftWorkflow = true; workflowStatus = 'SUBMITTED'; }),
          approveWorkflow: jest.fn(async () => {
            expect(notifications.sendNotification).not.toHaveBeenCalled();
            if (failReview || !draftWorkflow) throw new Error('Workflow approval failed');
          }),
          rejectWorkflow: jest.fn(async () => {
            if (failReview || !draftWorkflow) throw new Error('Workflow rejection failed');
          }),
        });
        const result = await action(tx);
        stored = draft;
        workflowExists = draftWorkflow;
        return result;
      }),
    };
    service = new TasksService(database, workflow, notifications, {
      resolveScope: jest.fn(async () => ({ organizationId: 1 })),
      buildDirectBUWhere: jest.fn(() => ({})),
      buildEmployeeBUWhere: jest.fn(() => ({})),
    } as any, {} as any, {} as any);
  });

  it('creates a workflow through the existing status endpoint', async () => {
    await service.updateStatus(9, 'SUBMITTED', actor);
    expect(stored.status).toBe('SUBMITTED');
    expect(workflowExists).toBe(true);
    expect(tx.$queryRaw).toHaveBeenCalled();
  });

  it('rolls back task approval and suppresses notifications when workflow approval fails', async () => {
    stored.status = 'SUBMITTED';
    workflowExists = true;
    workflowStatus = 'SUBMITTED';
    failReview = true;
    await expect(service.reviewTask(9, { decision: 'APPROVED' }, actor)).rejects.toThrow('Workflow approval failed');
    expect(stored.status).toBe('SUBMITTED');
    expect(stored.reviewedBy).toBeUndefined();
    expect(notifications.sendNotification).not.toHaveBeenCalled();
  });

  it('keeps the admin direct-approval contract while creating its workflow', async () => {
    stored.status = 'PENDING';
    await service.updateStatus(9, 'APPROVED', actor);
    expect(stored.status).toBe('APPROVED');
    expect(workflowExists).toBe(true);
    expect(notifications.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('allows super admins to review ordinary submitted tasks', async () => {
    stored.status = 'SUBMITTED';
    workflowExists = true;
    workflowStatus = 'SUBMITTED';
    await service.reviewTask(9, { decision: 'APPROVED' }, { ...actor, role: Role.SUPER_ADMIN });
    expect(stored.status).toBe('APPROVED');
  });

  it('routes general edits through the same submission lifecycle', async () => {
    await service.update(9, { status: 'SUBMITTED', description: 'Edited' }, actor);
    expect(stored.description).toBe('Edited');
    expect(stored.status).toBe('SUBMITTED');
    expect(workflowExists).toBe(true);
    expect(database.$transaction).toHaveBeenCalledTimes(1);
  });

  it('treats a repeated submission as idempotent', async () => {
    stored.status = 'SUBMITTED';
    workflowExists = true;
    workflowStatus = 'SUBMITTED';

    const result = await service.submitWork(
      9,
      { submissionLink: 'updated link', note: 'updated note' },
      actor,
    );

    expect(result.status).toBe('SUBMITTED');
    expect(workflowTransaction.submitWorkflow).not.toHaveBeenCalled();
    expect(tx.task.update).not.toHaveBeenCalled();
    expect(notifications.sendNotification).not.toHaveBeenCalled();
  });

  it('retains the rejected workflow history when the task is resubmitted', async () => {
    stored.status = 'REJECTED';
    workflowExists = true;
    workflowStatus = 'REJECTED';

    await service.submitWork(
      9,
      { submissionLink: '', note: '' },
      actor,
    );

    expect(workflowTransaction.submitWorkflow).toHaveBeenCalledTimes(1);
    expect(tx.workflowInstance.delete).not.toHaveBeenCalled();
    expect(stored.status).toBe('SUBMITTED');
  });
});
