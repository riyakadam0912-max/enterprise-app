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
import { OrganizationScopeService } from '../organizations/organization-scope.service';

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
  let mockBusinessUnitsService: {
    resolveScope: jest.Mock;
    buildDirectBUWhere: jest.Mock;
    buildEmployeeBUWhere: jest.Mock;
    assertRecordAccessible: jest.Mock;
  };

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
    mockBusinessUnitsService = {
      resolveScope: jest.fn().mockResolvedValue({
        organizationId: 1,
        allUnits: true,
        unitIds: [],
        assignedUnitId: null,
      }),
      buildDirectBUWhere: jest.fn().mockReturnValue({}),
      buildEmployeeBUWhere: jest.fn().mockReturnValue({}),
      assertRecordAccessible: jest.fn().mockResolvedValue(undefined),
    };
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
          useValue: mockBusinessUnitsService,
        },
        {
          provide: OrganizationScopeService,
          useValue: {
            getOrganizationIds: jest.fn().mockResolvedValue([1]),
            getRelatedOrganizationIds: jest.fn().mockResolvedValue([1]),
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

    it.each(['APPROVED', 'REJECTED'])(
      'does not allow creating a task in %s status',
      async (status) => {
        await expect(
          service.create(
            { title: 'Reviewed task', projectId: 1, status } as CreateTaskDto,
            mockAdminUser,
          ),
        ).rejects.toThrow(ForbiddenException);
        expect(getPrismaDelegate(mockPrisma, 'task').create).not.toHaveBeenCalled();
      },
    );

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

    it('allows a project manager to assign a task to an assigned employee outside their reporting tree', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      projectDelegate.findUnique.mockResolvedValueOnce({
        id: 1,
        projectName: 'Managed Project',
        organizationId: 1,
        managerId: mockManagerUser.userId,
        coManagers: [],
        assignedEmployees: [{ id: 103 }],
      });
      userDelegate.findUnique.mockResolvedValueOnce({
        id: 22,
        name: 'Project Employee',
        role: Role.EMPLOYEE,
        employeeId: 103,
        managerId: 99,
      });
      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 103,
        businessUnitId: null,
      });
      taskDelegate.create.mockResolvedValueOnce({ id: 10, taskName: 'Task' });

      await service.create(
        {
          title: 'Task',
          projectId: 1,
          assignedToUserId: 22,
          employeeId: 103,
        } as CreateTaskDto,
        mockManagerUser,
      );

      expect(taskDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 1,
            assignedToUserId: 22,
            assignedToId: 103,
          }),
        }),
      );
    });

    it('rejects a manager assigning a task to an employee outside the project team', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      projectDelegate.findUnique.mockResolvedValueOnce({
        id: 1,
        projectName: 'Managed Project',
        organizationId: 1,
        managerId: mockManagerUser.userId,
        coManagers: [],
        assignedEmployees: [],
      });
      userDelegate.findUnique.mockResolvedValueOnce({
        id: 22,
        name: 'Other Employee',
        role: Role.EMPLOYEE,
        employeeId: 103,
        managerId: mockManagerUser.userId,
      });

      await expect(
        service.create(
          {
            title: 'Task',
            projectId: 1,
            assignedToUserId: 22,
            employeeId: 103,
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

    it('allows a parent admin to assign a project task to a child employee', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const organizationScope = (service as any).organizationScopeService;
      jest
        .spyOn(organizationScope, 'getOrganizationIds')
        .mockResolvedValue([1, 2]);
      jest
        .spyOn(organizationScope, 'getRelatedOrganizationIds')
        .mockResolvedValue([1, 2]);
      projectDelegate.findFirst.mockResolvedValueOnce({
        id: 9,
        organizationId: 1,
        projectName: 'Parent Project',
        businessUnitId: null,
      });
      userDelegate.findFirst.mockResolvedValueOnce({
        id: 22,
        name: 'Child Employee',
        employeeId: 102,
        role: Role.EMPLOYEE,
        managerId: null,
      });
      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 102,
        businessUnitId: null,
      });
      taskDelegate.create.mockResolvedValueOnce({
        id: 10,
        taskName: 'Child task',
      });

      await service.create(
        {
          title: 'Child task',
          projectId: 9,
          assignedToUserId: 22,
          employeeId: 102,
        } as CreateTaskDto,
        mockAdminUser,
      );

      expect(taskDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 1,
            projectId: 9,
            assignedToId: 102,
            assignedToUserId: 22,
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('intersects manager task access with the manager BU scope', async () => {
      mockBusinessUnitsService.resolveScope.mockResolvedValueOnce({
        organizationId: 1,
        allUnits: false,
        unitIds: [10],
        assignedUnitId: 10,
      });
      mockBusinessUnitsService.buildDirectBUWhere.mockReturnValueOnce({
        organizationId: 1,
        businessUnitId: { in: [10] },
      });

      const where = await (service as any).getTaskAccessWhere(mockManagerUser);

      expect(where).toEqual({
        AND: [
          {
            organizationId: 1,
            OR: [
              { assignedToUserId: mockManagerUser.userId },
              { assignedByUserId: mockManagerUser.userId },
              { projectRef: { managerId: mockManagerUser.userId } },
              {
                projectRef: {
                  coManagers: { some: { id: mockManagerUser.userId } },
                },
              },
            ],
          },
          { organizationId: 1, businessUnitId: { in: [10] } },
        ],
      });
    });

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

    it('should persist task description and reference links independently', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING',
      });
      taskDelegate.update.mockResolvedValueOnce({
        id: 1,
        description: 'Step one\nStep two',
        links: 'https://example.com/spec',
      });

      await service.update(
        1,
        {
          description: 'Step one\nStep two',
          links: 'https://example.com/spec',
        } as UpdateTaskDto,
        mockAdminUser,
      );

      expect(taskDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Step one\nStep two',
            links: 'https://example.com/spec',
          }),
        }),
      );
    });

    it('records the acting admin when a task is reassigned', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      taskDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING',
        assignedToUserId: 3,
      });
      userDelegate.findUnique.mockResolvedValueOnce({
        id: 4,
        name: 'New Assignee',
        employeeId: 104,
        role: Role.EMPLOYEE,
        managerId: null,
      });
      taskDelegate.update.mockResolvedValueOnce({ id: 1 });

      await service.update(
        1,
        { assignedToUserId: 4 } as UpdateTaskDto,
        mockAdminUser,
      );

      expect(taskDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedToUserId: 4,
            assignedByUserId: mockAdminUser.userId,
          }),
        }),
      );
    });

    it('keeps the original assigner when the assignee does not change', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      taskDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING',
        assignedToUserId: 3,
      });
      userDelegate.findUnique.mockResolvedValueOnce({
        id: 3,
        name: 'Current Assignee',
        employeeId: 103,
        role: Role.EMPLOYEE,
        managerId: null,
      });
      taskDelegate.update.mockResolvedValueOnce({ id: 1 });

      await service.update(
        1,
        { assignedToUserId: 3 } as UpdateTaskDto,
        mockAdminUser,
      );

      const updateData = taskDelegate.update.mock.calls[0][0].data;
      expect(updateData.assignedToUserId).toBe(3);
      expect(updateData).not.toHaveProperty('assignedByUserId');
    });
  });

  describe('task messages', () => {
    it('allows an assigning manager to read and send task messages', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      const messageDelegate = getPrismaDelegate(mockPrisma, 'taskMessage');
      taskDelegate.findFirst.mockResolvedValue({ id: 1 });
      messageDelegate.findMany.mockResolvedValueOnce([]);
      messageDelegate.create.mockResolvedValueOnce({
        id: 'message-1',
        taskId: 1,
        senderId: mockManagerUser.userId,
        content: 'Please review the submission.',
      });

      await expect(service.getMessages(1, mockManagerUser)).resolves.toEqual(
        [],
      );
      await expect(
        service.sendMessage(
          1,
          { content: 'Please review the submission.' },
          mockManagerUser,
        ),
      ).resolves.toEqual(expect.objectContaining({ id: 'message-1' }));
      expect(messageDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskId: 1,
            senderId: mockManagerUser.userId,
            content: 'Please review the submission.',
          }),
        }),
      );
    });

    it('denies task messages when the user cannot access the task', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(service.getMessages(1, mockEmployeeUser)).rejects.toThrow(
        ForbiddenException,
      );
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
    it('should return tasks assigned to or created by an EMPLOYEE', async () => {
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      taskDelegate.findMany.mockResolvedValueOnce([]);

      await service.getByPriority(mockEmployeeUser);

      expect(taskDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { assignedToUserId: mockEmployeeUser.userId },
                  { assignedByUserId: mockEmployeeUser.userId },
                  { assignedToId: mockEmployeeUser.employeeId },
                  {
                    projectRef: {
                      assignedEmployees: {
                        some: { id: mockEmployeeUser.employeeId },
                      },
                    },
                  },
                ]),
              }),
            ]),
          }),
        }),
      );
    });

    it('includes assigned project tasks owned by a related organization', async () => {
      const organizationScope = (service as any).organizationScopeService;
      jest
        .spyOn(organizationScope, 'getRelatedOrganizationIds')
        .mockResolvedValue([1, 2]);

      const where = await (service as any).getTaskAccessWhere(
        mockEmployeeUser,
      );

      expect(where.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            organizationId: { in: [2] },
            OR: expect.arrayContaining([
              { assignedToUserId: mockEmployeeUser.userId },
              { assignedToId: mockEmployeeUser.employeeId },
            ]),
          }),
        ]),
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
