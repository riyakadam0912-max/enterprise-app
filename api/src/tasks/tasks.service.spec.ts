import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../workflows/workflow-engine.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  createMockPrismaService,
  createMockWorkflowEngineService,
  createMockNotificationsService,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { SubmitTaskWorkDto } from './dto/submit-task-work.dto';
import { ReviewTaskDto } from './dto/review-task.dto';
import { BusinessUnitsService } from '../business-units/business-units.service';

// Helper to create valid mock AuthUser
function createMockAuthUser(
  role: Role,
  overrides: Partial<AuthUser> = {},
): AuthUser {
  return {
    id: 1,
    userId: 1,
    email: 'test@example.com',
    name: 'Test User',
    role,
    roles: [role],
    permissions: [],
    employeeId: role === Role.EMPLOYEE ? 101 : null,
    organizationId: 1,
    tokenType: 'Bearer',
    jti: null,
    ...overrides,
  };
}

// Type assertion to ensure mock Prisma delegates are not undefined and have Jest mock properties
function getPrismaDelegate(
  mockPrisma: ReturnType<typeof createMockPrismaService>,
  delegate: keyof PrismaService,
): DelegateMock {
  return mockPrisma[delegate] as unknown as DelegateMock;
}

describe('TasksService', () => {
  let service: TasksService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockWorkflowEngine: ReturnType<typeof createMockWorkflowEngineService>;
  let mockNotifications: ReturnType<typeof createMockNotificationsService>;

  const mockAdminUser = createMockAuthUser(Role.ADMIN, { userId: 1 });
  const mockManagerUser = createMockAuthUser(Role.MANAGER, { userId: 2 });
  const mockEmployeeUser = createMockAuthUser(Role.EMPLOYEE, {
    userId: 3,
    employeeId: 101,
  });

  beforeEach(async () => {
    // Create fresh mocks for each test!
    mockPrisma = createMockPrismaService();
    mockWorkflowEngine = createMockWorkflowEngineService();
    mockNotifications = createMockNotificationsService();
    getPrismaDelegate(mockPrisma, 'employee').findFirst.mockResolvedValue({
      id: 101,
      businessUnitId: null,
    });
    getPrismaDelegate(mockPrisma, 'employee').findFirst.mockResolvedValue({
      id: 101,
      businessUnitId: null,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WorkflowEngineService, useValue: mockWorkflowEngine },
        { provide: NotificationsService, useValue: mockNotifications },
        {
          provide: BusinessUnitsService,
          useValue: {
            resolveScope: jest.fn().mockResolvedValue({
              organizationId: 1,
              allUnits: true,
              unitIds: [],
              assignedUnitId: null,
            }),
            buildDirectBUWhere: jest.fn().mockReturnValue({}),
            buildEmployeeBUWhere: jest.fn().mockReturnValue({}),
            assertRecordAccessible: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ForbiddenException if user is EMPLOYEE', async () => {
      await expect(
        service.create(
          { title: 'Test Task', projectId: 1 } as CreateTaskDto,
          createMockAuthUser(Role.EMPLOYEE, {
            userId: 3,
            employeeId: 101,
            organizationId: null,
          }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.create(
          { title: 'Test Task', projectId: 1 } as CreateTaskDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if no taskName/title provided', async () => {
      await expect(
        service.create(
          { projectId: 1 } as unknown as CreateTaskDto,
          mockAdminUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if no projectId provided', async () => {
      getPrismaDelegate(
        mockPrisma,
        'user',
      ).findUniqueOrThrow.mockRejectedValueOnce(
        new ForbiddenException('Project is required'),
      );
      await expect(
        service.create(
          { title: 'Test Task' } as unknown as CreateTaskDto,
          mockAdminUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if project not found', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create(
          { title: 'Test Task', projectId: 999 } as CreateTaskDto,
          mockAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if manager tries to create task in non-assigned project', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      getPrismaDelegate(mockPrisma, 'user').findUnique.mockResolvedValueOnce({
        id: 2,
        name: 'Other Manager',
        role: Role.MANAGER,
        employeeId: null,
        managerId: null,
      });
      projectDelegate.findUnique.mockResolvedValueOnce({
        id: 1,
        managerId: 99,
        organizationId: 1,
      });
      await expect(
        service.create(
          {
            title: 'Test Task',
            projectId: 1,
            assignedToUserId: 2,
          } as CreateTaskDto,
          mockManagerUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if assigned user not found', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      projectDelegate.findUnique.mockResolvedValueOnce({
        id: 1,
        managerId: 2,
        organizationId: 1,
      });
      userDelegate.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.create(
          {
            title: 'Test Task',
            projectId: 1,
            assignedToUserId: 999,
          } as CreateTaskDto,
          mockAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if manager tries to assign to non-employee', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      projectDelegate.findUnique.mockResolvedValueOnce({
        id: 1,
        managerId: 2,
        organizationId: 1,
      });
      userDelegate.findUnique.mockResolvedValueOnce({
        id: 4,
        name: 'Other Manager',
        role: Role.MANAGER,
      });
      await expect(
        service.create(
          {
            title: 'Test Task',
            projectId: 1,
            assignedToUserId: 4,
          } as CreateTaskDto,
          mockManagerUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create task successfully for admin', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      projectDelegate.findUnique.mockResolvedValueOnce({
        id: 1,
        projectName: 'Test Project',
        organizationId: 1,
      });
      userDelegate.findUnique.mockResolvedValueOnce({
        id: 3,
        name: 'Test Employee',
        role: Role.EMPLOYEE,
        employeeId: 101,
        managerId: 2,
      });
      taskDelegate.create.mockResolvedValueOnce({
        id: 1,
        taskName: 'Test Task',
      });

      const result = await service.create(
        {
          title: 'Test Task',
          projectId: 1,
          assignedToUserId: 3,
        } as CreateTaskDto,
        mockAdminUser,
      );
      expect(result).toEqual({ id: 1, taskName: 'Test Task' });
      expect(taskDelegate.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should return all tasks for admin', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      const mockTasks = [{ id: 1, taskName: 'Test Task' }];
      taskDelegate.findMany.mockResolvedValueOnce(mockTasks);

      const result = await service.findAll(mockAdminUser);
      expect(result).toEqual(mockTasks);
    });

    it('should return filtered tasks for employee', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      const mockTasks = [{ id: 1, taskName: 'Employee Task' }];
      taskDelegate.findMany.mockResolvedValueOnce(mockTasks);

      const result = await service.findAll(mockEmployeeUser);
      expect(result).toEqual(mockTasks);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if task not found', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(service.findOne(999, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return task if found', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      const mockTask = { id: 1, taskName: 'Test Task' };
      taskDelegate.findFirst.mockResolvedValueOnce(mockTask);

      const result = await service.findOne(1, mockAdminUser);
      expect(result).toEqual(mockTask);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException if user cannot manage task', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.update(1, {} as UpdateTaskDto, mockManagerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if task not found', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.update(1, {} as UpdateTaskDto, mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update task successfully', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING',
      });
      taskDelegate.update.mockResolvedValueOnce({
        id: 1,
        taskName: 'Updated Task',
      });

      const result = await service.update(
        1,
        { taskName: 'Updated Task' } as UpdateTaskDto,
        mockAdminUser,
      );
      expect(result).toEqual({ id: 1, taskName: 'Updated Task' });
    });
  });

  describe('remove', () => {
    it('should throw ForbiddenException if manager cannot manage task', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce(null); // canManageTask (for manager) finds no task
      await expect(service.remove(1, mockManagerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should soft delete task for admin', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      taskDelegate.update.mockResolvedValueOnce({ id: 1 });
      await service.remove(1, mockAdminUser);
      expect(taskDelegate.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('importRecords', () => {
    it('should import valid records and skip invalid ones', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      const records = [{ title: 'Valid Task' }, { invalid: 'no title' }];
      taskDelegate.create.mockResolvedValueOnce({ id: 1 });

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
    });
  });

  describe('getByPriority', () => {
    it('should throw ForbiddenException if user is EMPLOYEE', async () => {
      await expect(service.getByPriority(mockEmployeeUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return tasks grouped by priority', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findMany.mockResolvedValueOnce([
        { id: 1, priority: 'High' },
        { id: 2, priority: 'Medium' },
      ]);

      const result = await service.getByPriority(mockAdminUser);
      expect(result.High.length).toEqual(1);
      expect(result.Medium.length).toEqual(1);
    });
  });

  describe('getUpcoming', () => {
    it('should return upcoming tasks', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findMany.mockResolvedValueOnce([
        { id: 1, dueDate: new Date(Date.now() + 86400000) },
      ]);

      const result = await service.getUpcoming(mockAdminUser);
      expect(result.length).toEqual(1);
    });
  });

  describe('getByLead', () => {
    it('should return tasks for lead', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findMany.mockResolvedValueOnce([{ id: 1, leadId: 5 }]);

      const result = await service.getByLead(5, mockAdminUser);
      expect(result.length).toEqual(1);
    });
  });

  describe('getByDeal', () => {
    it('should return tasks for deal', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findMany.mockResolvedValueOnce([{ id: 1, dealId: 5 }]);

      const result = await service.getByDeal(5, mockAdminUser);
      expect(result.length).toEqual(1);
    });
  });

  describe('updateStatus', () => {
    it('should throw NotFoundException if task not found', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.updateStatus(999, 'IN_PROGRESS', mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if employee tries to update unassigned task', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING',
        assignedToUserId: 999,
        assignedToId: null,
        projectId: 1,
      });
      await expect(
        service.updateStatus(1, 'IN_PROGRESS', mockEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update status successfully for employee', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING',
        assignedToUserId: 3,
        assignedToId: null,
        projectId: 1,
      });
      taskDelegate.update.mockResolvedValueOnce({
        id: 1,
        status: 'IN_PROGRESS',
      });

      const result = await service.updateStatus(
        1,
        'IN_PROGRESS',
        mockEmployeeUser,
      );
      expect(result.status).toEqual('IN_PROGRESS');
    });
  });

  describe('submitWork', () => {
    it('should throw NotFoundException if task not found for employee', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.submitWork(
          1,
          {
            submissionLink: 'https://test.com',
            note: 'test note',
          } as SubmitTaskWorkDto,
          mockEmployeeUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should submit work successfully', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'IN_PROGRESS',
        projectId: 1,
        assignedToUserId: 3,
        projectRef: { managerId: 2 },
      });
      (
        mockWorkflowEngine.getInstanceByEntity as jest.Mock
      ).mockResolvedValueOnce(null);
      taskDelegate.update.mockResolvedValueOnce({
        id: 1,
        status: 'SUBMITTED',
      });
      (mockWorkflowEngine.submitWorkflow as jest.Mock).mockResolvedValueOnce(
        {},
      );

      const result = await service.submitWork(
        1,
        {
          submissionLink: 'https://test.com',
          note: 'test note',
        } as SubmitTaskWorkDto,
        mockEmployeeUser,
      );
      expect(result.status).toEqual('SUBMITTED');
      expect(mockWorkflowEngine.submitWorkflow).toHaveBeenCalledTimes(1);
    });
  });

  describe('reviewTask', () => {
    it('should throw ForbiddenException if user cannot manage task', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce(null); // canManageTask returns false
      taskDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'SUBMITTED',
      });
      await expect(
        service.reviewTask(
          1,
          { decision: 'APPROVED' } as ReviewTaskDto,
          mockManagerUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if task is already approved', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'APPROVED',
      });
      await expect(
        service.reviewTask(
          1,
          { decision: 'APPROVED' } as ReviewTaskDto,
          mockAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should approve task successfully', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'SUBMITTED',
      });
      taskDelegate.update.mockResolvedValueOnce({
        id: 1,
        status: 'APPROVED',
        assignedToUserId: 3,
        reviewedByUser: { id: 1, name: 'Admin' },
        taskName: 'Test Task',
      });
      (mockWorkflowEngine.approveWorkflow as jest.Mock).mockResolvedValueOnce(
        {},
      );

      const result = await service.reviewTask(
        1,
        { decision: 'APPROVED', remarks: 'Looks good!' } as ReviewTaskDto,
        mockAdminUser,
      );
      expect(result.status).toEqual('APPROVED');
      expect(mockWorkflowEngine.approveWorkflow).toHaveBeenCalledTimes(1);
    });

    it('should reject task successfully', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'SUBMITTED',
      });
      taskDelegate.update.mockResolvedValueOnce({
        id: 1,
        status: 'REJECTED',
        assignedToUserId: 3,
        reviewedByUser: { id: 1, name: 'Admin' },
        taskName: 'Test Task',
      });
      (mockWorkflowEngine.rejectWorkflow as jest.Mock).mockResolvedValueOnce(
        {},
      );

      const result = await service.reviewTask(
        1,
        { decision: 'REJECTED', remarks: 'Needs changes' } as ReviewTaskDto,
        mockAdminUser,
      );
      expect(result.status).toEqual('REJECTED');
      expect(mockWorkflowEngine.rejectWorkflow).toHaveBeenCalledTimes(1);
    });
  });
});
