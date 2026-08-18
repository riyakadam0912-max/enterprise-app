import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowEngineService } from './workflow-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;
  let prisma: any;
  let notificationsService: { create: jest.Mock };
  let auditLogsService: { logCustomAction: jest.Mock };

  beforeEach(async () => {
    prisma = {
      workflowDefinition: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      workflowInstance: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      workflowStage: {
        deleteMany: jest.fn(),
      },
      workflowRule: {
        deleteMany: jest.fn(),
      },
      workflowAssignment: {
        createMany: jest.fn(),
      },
      workflowStep: {
        createMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      workflowHistory: {
        create: jest.fn(),
      },
      workflowNotification: {
        createMany: jest.fn(),
      },
      workflowAction: {
        createMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      employee: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    notificationsService = { create: jest.fn() };
    auditLogsService = { logCustomAction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AuditLogsService, useValue: auditLogsService },
      ],
    }).compile();

    service = module.get<WorkflowEngineService>(WorkflowEngineService);
  });

  it('repairs an existing workflow instance by creating initial steps before approval', async () => {
    const definition = {
      id: 10,
      key: 'expense-approval',
      name: 'Expense Approval',
      module: 'Finance',
      description: 'Expense approval flow',
      stages: [
        {
          id: 33,
          workflowDefinitionId: 10,
          key: 'manager-review',
          name: 'Manager Review',
          order: 1,
          approvalType: 'SEQUENTIAL',
          approvalPolicy: { mode: 'SINGLE', requiredApprovals: 1 },
          assignmentRule: { type: 'MANAGER' },
        },
      ],
      rules: [],
    };

    const existingInstance = {
      id: 99,
      workflowDefinitionId: 10,
      entityType: 'Expense',
      entityId: 42,
      status: 'SUBMITTED',
      currentStageOrder: 1,
      initiatedBy: 1,
      startedAt: new Date(),
      lastActionAt: new Date(),
      context: { employeeId: 5, requestorUserId: 7 },
      metadata: {},
      steps: [],
      organizationId: 1,
      workflowDefinition: definition,
      actions: [],
      comments: [],
      assignments: [],
      history: [],
      notifications: [],
    };

    prisma.workflowDefinition.findUnique.mockResolvedValue(definition);
    prisma.workflowInstance.findFirst.mockResolvedValue(existingInstance);
    prisma.$transaction.mockImplementation(async (callback: any) => {
      const transaction = {
        workflowStep: {
          create: jest.fn().mockResolvedValue({
            id: 1,
            workflowStageId: 33,
            status: 'PENDING',
          }),
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn().mockResolvedValue({ id: 1 }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        workflowHistory: {
          create: jest.fn().mockResolvedValue({ id: 1 }),
        },
        workflowInstance: {
          update: jest.fn().mockResolvedValue({
            id: 99,
            status: 'APPROVED',
            workflowDefinition: definition,
            steps: [{ id: 1, workflowStageId: 33, status: 'APPROVED' }],
            actions: [],
            comments: [],
            assignments: [],
            history: [],
            notifications: [],
          }),
        },
      };
      return callback(transaction);
    });

    const result = await service.approveWorkflow({
      definitionKey: 'expense-approval',
      entityType: 'Expense',
      entityId: 42,
      userId: 8,
      businessStatus: 'PENDING_HR',
      trailAction: 'MANAGER_APPROVED',
      approvedByLabel: 'MANAGER:8',
      organizationId: 1,
    });

    expect(result.workflow.status).toBe('APPROVED');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('routes HR self-submission to Admin or Super Admin when no other HR approvers exist', async () => {
    const stage = {
      id: 44,
      workflowDefinitionId: 10,
      key: 'hr-review',
      name: 'HR Review',
      order: 2,
      approvalType: 'SEQUENTIAL',
      approvalPolicy: { mode: 'SINGLE', requiredApprovals: 1 },
      assignmentRule: { type: 'ROLE', value: 'HR' },
    };

    prisma.user.findMany.mockResolvedValue([{ id: 9 }]);
    prisma.user.findUnique.mockResolvedValue({
      id: 9,
      role: 'HR',
      managerId: null,
      employeeId: 77,
      organizationId: 1,
      isActive: true,
    });

    const recipients = await (service as any).resolveRecipients(stage, {
      employeeId: 77,
      requestorUserId: 9,
    });

    expect(recipients).toEqual([]);

    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 9 }])
      .mockResolvedValueOnce([{ id: 12 }, { id: 15 }]);
    prisma.user.findUnique.mockResolvedValue({
      id: 9,
      role: 'HR',
      managerId: null,
      employeeId: 77,
      organizationId: 1,
      isActive: true,
    });

    const fallbackRecipients = await (service as any).resolveRecipients(stage, {
      employeeId: 77,
      requestorUserId: 9,
    });

    expect(fallbackRecipients).toEqual([12, 15]);
  });
});
