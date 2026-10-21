import { Test, TestingModule } from '@nestjs/testing';
import { LeaveRequestsService } from './leave-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../workflows/workflow-engine.service';
import {
  createMockPrismaService,
  createMockWorkflowEngineService,
  createMockCacheManager,
  createMockEventEmitter2,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BusinessUnitsService } from '../business-units/business-units.service';
import { OrganizationScopeService } from '../organizations/organization-scope.service';
import { LeaveEntitlementsService } from './leave-entitlements.service';

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

describe('LeaveRequestsService', () => {
  let service: LeaveRequestsService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockWorkflowEngine: ReturnType<typeof createMockWorkflowEngineService>;
  let mockCacheManager: ReturnType<typeof createMockCacheManager>;
  let mockEventEmitter: ReturnType<typeof createMockEventEmitter2>;
  let mockBusinessUnitsService: {
    resolveScope: jest.Mock;
    buildEmployeeBUWhere: jest.Mock;
  };
  let mockLeaveEntitlementsService: {
    countScheduledLeaveDays: jest.Mock;
    getScheduledLeaveDates: jest.Mock;
    getAvailableBalance: jest.Mock;
    recordUsage: jest.Mock;
  };

  const mockAdminUser = createMockAuthUser(Role.ADMIN, { userId: 1 });
  const mockHRUser = createMockAuthUser(Role.HR, { userId: 2 });
  const mockManagerUser = createMockAuthUser(Role.MANAGER, { userId: 3 });
  const mockEmployeeUser = createMockAuthUser(Role.EMPLOYEE, {
    userId: 4,
    employeeId: 101,
  });

  beforeEach(async () => {
    // Create fresh mocks for each test!
    mockPrisma = createMockPrismaService();
    mockWorkflowEngine = createMockWorkflowEngineService();
    mockCacheManager = createMockCacheManager();
    mockEventEmitter = createMockEventEmitter2();
    mockBusinessUnitsService = {
      resolveScope: jest.fn().mockResolvedValue({
        organizationId: 1,
        allUnits: true,
        unitIds: [],
        assignedUnitId: null,
      }),
      buildEmployeeBUWhere: jest.fn().mockReturnValue({}),
    };
    mockLeaveEntitlementsService = {
      countScheduledLeaveDays: jest.fn().mockResolvedValue(2),
      getScheduledLeaveDates: jest.fn().mockResolvedValue([
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-01-02T00:00:00.000Z'),
      ]),
      getAvailableBalance: jest.fn().mockResolvedValue(10),
      recordUsage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WorkflowEngineService, useValue: mockWorkflowEngine },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: BusinessUnitsService, useValue: mockBusinessUnitsService },
        {
          provide: LeaveEntitlementsService,
          useValue: mockLeaveEntitlementsService,
        },
        {
          provide: OrganizationScopeService,
          useValue: {
            getOrganizationIds: jest.fn().mockResolvedValue([1]),
          },
        },
      ],
    }).compile();

    service = module.get<LeaveRequestsService>(LeaveRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a half-day request spanning multiple dates', async () => {
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 101,
        organizationId: 1,
        user: null,
      });
      leaveRequestDelegate.create.mockResolvedValueOnce({
        id: 10,
        employeeId: 101,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-03'),
        duration: 'HALF_DAY',
      });

      const result = await service.create(
        {
          startDate: '2026-01-01',
          endDate: '2026-01-03',
          leaveType: 'CASUAL',
          duration: 'HALF_DAY',
          employeeId: 101,
        } as CreateLeaveRequestDto,
        mockAdminUser,
      );

      expect(result).toEqual(
        expect.objectContaining({ id: 10, duration: 'HALF_DAY' }),
      );
      expect(leaveRequestDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-01-03'),
            duration: 'HALF_DAY',
          }),
        }),
      );
    });

    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.create(
          {
            startDate: '2026-01-01',
            endDate: '2026-01-02',
            leaveType: 'SICK',
          } as CreateLeaveRequestDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if employee tries to create request for someone else', async () => {
      await expect(
        service.create(
          {
            startDate: '2026-01-01',
            endDate: '2026-01-02',
            leaveType: 'SICK',
            employeeId: 999,
          } as CreateLeaveRequestDto,
          mockEmployeeUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow a manager to create a leave request for themselves', async () => {
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      const manager = createMockAuthUser(Role.MANAGER, {
        userId: 3,
        employeeId: 303,
      });
      employeeDelegate.findFirst
        .mockResolvedValueOnce({ id: 303 })
        .mockResolvedValueOnce({
          id: 303,
          organizationId: 1,
          user: {
            id: 3,
            name: 'Test Manager',
            email: 'manager@example.com',
            managerId: null,
          },
        });
      leaveRequestDelegate.create.mockResolvedValueOnce({
        id: 11,
        employeeId: 303,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-02'),
      });

      await expect(
        service.create(
          {
            startDate: '2026-01-01',
            endDate: '2026-01-02',
            leaveType: 'SICK',
          } as CreateLeaveRequestDto,
          manager,
        ),
      ).resolves.toMatchObject({ id: 11, employeeId: 303 });
      expect(leaveRequestDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ employeeId: 303 }),
        }),
      );
    });

    it('should forbid a manager from creating a leave request for another employee', async () => {
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      employeeDelegate.findFirst.mockResolvedValueOnce({ id: 303 });

      await expect(
        service.create(
          {
            startDate: '2026-01-01',
            endDate: '2026-01-02',
            leaveType: 'SICK',
            employeeId: 304,
          } as CreateLeaveRequestDto,
          createMockAuthUser(Role.MANAGER, {
            userId: 3,
            employeeId: 303,
          }),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(leaveRequestDelegate.create).not.toHaveBeenCalled();
    });

    it('should resolve a stale employee claim by email within the organization', async () => {
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      employeeDelegate.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 101 })
        .mockResolvedValueOnce({
          id: 101,
          organizationId: 1,
          user: {
            id: 4,
            name: 'Test Employee',
            email: 'test@example.com',
            managerId: 3,
          },
        });
      leaveRequestDelegate.create.mockResolvedValueOnce({
        id: 3,
        employeeId: 101,
        leaveType: 'SICK',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-02'),
      });

      await expect(
        service.create(
          {
            startDate: '2026-01-01',
            endDate: '2026-01-02',
            leaveType: 'SICK',
          } as CreateLeaveRequestDto,
          createMockAuthUser(Role.EMPLOYEE, {
            employeeId: 999,
            email: 'test@example.com',
          }),
        ),
      ).resolves.toMatchObject({ id: 3, employeeId: 101 });
    });

    it('should allow self-service leave when the employee has no business unit', async () => {
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      mockBusinessUnitsService.resolveScope.mockResolvedValueOnce({
        organizationId: 1,
        allUnits: false,
        unitIds: [],
        assignedUnitId: null,
      });
      mockBusinessUnitsService.buildEmployeeBUWhere.mockReturnValueOnce({
        organizationId: 1,
        deletedAt: null,
        id: -1,
      });
      employeeDelegate.findFirst
        .mockResolvedValueOnce({ id: 101 })
        .mockResolvedValueOnce({
          id: 101,
          organizationId: 1,
          user: {
            id: 4,
            name: 'Test Employee',
            email: 'test@example.com',
            managerId: 3,
          },
        });
      leaveRequestDelegate.create.mockResolvedValueOnce({
        id: 4,
        employeeId: 101,
        leaveType: 'SICK',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-02'),
      });

      await expect(
        service.create(
          {
            startDate: '2026-01-01',
            endDate: '2026-01-02',
            leaveType: 'SICK',
          } as CreateLeaveRequestDto,
          mockEmployeeUser,
        ),
      ).resolves.toMatchObject({ id: 4, employeeId: 101 });
    });

    it('should throw NotFoundException if employee not found', async () => {
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      employeeDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.create(
          {
            startDate: '2026-01-01',
            endDate: '2026-01-02',
            leaveType: 'SICK',
            employeeId: 999,
          } as CreateLeaveRequestDto,
          mockAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create leave request successfully for admin', async () => {
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 101,
        organizationId: 1,
        user: {
          id: 4,
          name: 'Test Employee',
          email: 'emp@example.com',
          managerId: 3,
        },
      });
      leaveRequestDelegate.create.mockResolvedValueOnce({
        id: 1,
        employeeId: 101,
        leaveType: 'SICK',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-02'),
      });
      userDelegate.findUnique.mockResolvedValueOnce({ name: 'Test Manager' });

      const result = await service.create(
        {
          startDate: '2026-01-01',
          endDate: '2026-01-02',
          leaveType: 'SICK',
          status: 'APPROVED',
          approvedBy: 'ADMIN',
          appliedOn: '2026-01-01',
          employeeId: 101,
        } as unknown as CreateLeaveRequestDto,
        mockAdminUser,
      );

      expect(result).toEqual({
        id: 1,
        employeeId: 101,
        leaveType: 'SICK',
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      });
      expect(leaveRequestDelegate.create).toHaveBeenCalledTimes(1);
      expect(leaveRequestDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING_MANAGER',
            appliedOn: expect.any(Date),
          }),
        }),
      );
    });

    it('creates a child employee leave request under the child organization', async () => {
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      const organizationScope = (service as any).organizationScopeService;
      jest
        .spyOn(organizationScope, 'getOrganizationIds')
        .mockResolvedValue([1, 2]);
      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 202,
        organizationId: 2,
        user: null,
      });
      leaveRequestDelegate.create.mockResolvedValueOnce({
        id: 20,
        organizationId: 2,
        employeeId: 202,
        leaveType: 'SICK',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-02'),
      });
      (mockWorkflowEngine.submitWorkflow as jest.Mock).mockResolvedValueOnce(
        {},
      );

      await service.create(
        {
          startDate: '2026-01-01',
          endDate: '2026-01-02',
          leaveType: 'SICK',
          employeeId: 202,
        } as CreateLeaveRequestDto,
        mockAdminUser,
      );

      expect(leaveRequestDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 2 }),
        }),
      );
      expect(mockWorkflowEngine.submitWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 2 }),
      );
    });

    it('creates a WFH request as a full-day workflow request without a leave type', async () => {
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 101,
        organizationId: 1,
        user: null,
      });
      leaveRequestDelegate.create.mockResolvedValueOnce({
        id: 21,
        organizationId: 1,
        employeeId: 101,
        requestType: 'WORK_FROM_HOME',
        duration: 'FULL_DAY',
        leaveType: 'OTHER',
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        endDate: new Date('2026-10-01T00:00:00.000Z'),
      });
      (mockWorkflowEngine.submitWorkflow as jest.Mock).mockResolvedValueOnce(
        {},
      );

      await service.create(
        {
          requestType: 'WORK_FROM_HOME',
          startDate: '2026-10-01',
          endDate: '2026-10-01',
          employeeId: 101,
        } as CreateLeaveRequestDto,
        mockAdminUser,
      );

      expect(leaveRequestDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestType: 'WORK_FROM_HOME',
            duration: 'FULL_DAY',
            leaveType: 'OTHER',
          }),
        }),
      );
      expect(mockWorkflowEngine.submitWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            requestType: 'WORK_FROM_HOME',
          }),
        }),
      );
    });

    it('removes the request and surfaces a workflow initialization failure', async () => {
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 101,
        organizationId: 1,
        user: {
          id: 4,
          name: 'Test Employee',
          email: 'emp@example.com',
          managerId: 3,
        },
      });
      leaveRequestDelegate.create.mockResolvedValueOnce({
        id: 2,
        employeeId: 101,
        leaveType: 'SICK',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-02'),
      });
      (mockWorkflowEngine.submitWorkflow as jest.Mock).mockRejectedValueOnce(
        new Error('Workflow definition is unavailable'),
      );

      await expect(
        service.create(
          {
            startDate: '2026-01-01',
            endDate: '2026-01-02',
            leaveType: 'SICK',
            employeeId: 101,
          } as CreateLeaveRequestDto,
          mockAdminUser,
        ),
      ).rejects.toThrow(
        'The leave request could not be submitted for approval. Please try again.',
      );
      expect(leaveRequestDelegate.delete).toHaveBeenCalledWith({
        where: { id: 2, organizationId: 1 },
      });
    });
  });

  describe('update', () => {
    it('prevents employees from reassigning a pending leave request', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValueOnce({
        id: 8,
        organizationId: 1,
        employeeId: 101,
        status: 'PENDING_MANAGER',
      } as never);

      await expect(
        service.update(
          8,
          { employeeId: 202 } as UpdateLeaveRequestDto,
          mockEmployeeUser,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(
        getPrismaDelegate(mockPrisma, 'leaveRequest').update,
      ).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.findAll(
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return all leave requests for admin', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      const mockRequests = [{ id: 1, leaveType: 'SICK' }];
      leaveRequestDelegate.findMany.mockResolvedValueOnce(mockRequests);

      const result = await service.findAll(mockAdminUser);
      expect(result).toEqual(mockRequests);
    });

    it('includes descendant employees in a parent admin leave scope', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      const organizationScope = (service as any).organizationScopeService;
      jest
        .spyOn(organizationScope, 'getOrganizationIds')
        .mockResolvedValue([1, 2]);
      leaveRequestDelegate.findMany.mockResolvedValueOnce([]);

      await service.findAll(mockAdminUser);

      expect(leaveRequestDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: { in: [1, 2] },
            employee: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({ organizationId: { in: [2] } }),
              ]),
            }),
          }),
        }),
      );
    });

    it('should show an employee their own requests without a business unit', async () => {
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      mockBusinessUnitsService.resolveScope.mockResolvedValueOnce({
        organizationId: 1,
        allUnits: false,
        unitIds: [],
        assignedUnitId: null,
      });
      mockBusinessUnitsService.buildEmployeeBUWhere.mockReturnValueOnce({
        organizationId: 1,
        deletedAt: null,
        id: -1,
      });
      employeeDelegate.findFirst.mockResolvedValueOnce({ id: 101 });
      leaveRequestDelegate.findMany.mockResolvedValueOnce([
        { id: 4, employeeId: 101, leaveType: 'SICK' },
      ]);

      const result = await service.findAll(mockEmployeeUser);

      expect(result).toEqual([{ id: 4, employeeId: 101, leaveType: 'SICK' }]);
      expect(leaveRequestDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 1,
            employeeId: 101,
            employee: { organizationId: 1, deletedAt: null },
          }),
        }),
      );
    });

    it('includes a manager own leave request alongside their team requests', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      const manager = createMockAuthUser(Role.MANAGER, { userId: 3 });
      leaveRequestDelegate.findMany.mockResolvedValueOnce([]);

      await service.findAll(manager);

      expect(leaveRequestDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employee: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  user: { id: manager.userId },
                }),
                expect.objectContaining({
                  AND: expect.arrayContaining([
                    expect.objectContaining({
                      user: { managerId: manager.userId },
                    }),
                  ]),
                }),
              ]),
            }),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if leave request not found', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(service.findOne(999, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return leave request if found', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      const mockRequest = { id: 1, leaveType: 'SICK' };
      leaveRequestDelegate.findFirst.mockResolvedValueOnce(mockRequest);

      const result = await service.findOne(1, mockAdminUser);
      expect(result).toEqual(mockRequest);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.update(
          1,
          {} as UpdateLeaveRequestDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if leave request not found', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.update(1, {} as UpdateLeaveRequestDto, mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if employee tries to update finalized request', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'APPROVED',
      });
      await expect(
        service.update(1, {} as UpdateLeaveRequestDto, mockEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update leave request successfully', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      leaveRequestDelegate.update.mockResolvedValueOnce({
        id: 1,
        leaveType: 'CASUAL',
      });

      const result = await service.update(
        1,
        { leaveType: 'CASUAL' } as UpdateLeaveRequestDto,
        mockAdminUser,
      );
      expect(result).toEqual({ id: 1, leaveType: 'CASUAL' });
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if leave request not found', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(service.remove(1, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should soft delete leave request for admin', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      leaveRequestDelegate.update.mockResolvedValueOnce({ id: 1 });
      await service.remove(1, mockAdminUser);
      expect(leaveRequestDelegate.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('importRecords', () => {
    it('should import valid records and skip invalid ones', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      const records = [
        { startDate: '2026-01-01', endDate: '2026-01-02', leaveType: 'SICK' },
        { invalid: 'no dates' },
      ];
      leaveRequestDelegate.create.mockResolvedValueOnce({ id: 1 });

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
    });
  });

  describe('managerApprove', () => {
    it('should throw NotFoundException if leave request not found', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.managerApprove(999, mockManagerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if request not pending manager', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_HR',
      });
      await expect(service.managerApprove(1, mockManagerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should approve request successfully for manager', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_MANAGER',
        approvalTrail: null,
      });
      (mockWorkflowEngine.approveWorkflow as jest.Mock).mockResolvedValueOnce({
        legacyState: { approvalTrail: [] },
      });
      leaveRequestDelegate.update.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_HR',
      });

      const result = await service.managerApprove(1, mockManagerUser);
      expect(result).toEqual({ id: 1, status: 'PENDING_HR' });
      expect(mockWorkflowEngine.approveWorkflow).toHaveBeenCalledTimes(1);
    });

    it('should forbid a manager from approving their own leave request', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        employeeId: 303,
        status: 'PENDING_MANAGER',
        approvalTrail: null,
        employee: { user: { id: mockManagerUser.userId } },
      });

      await expect(
        service.managerApprove(1, mockManagerUser),
      ).rejects.toThrow(ForbiddenException);
      expect(mockWorkflowEngine.approveWorkflow).not.toHaveBeenCalled();
    });
  });

  describe('hrApprove', () => {
    it('should throw NotFoundException if leave request not found', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(service.hrApprove(999, mockHRUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if request not pending HR', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_MANAGER',
      });
      await expect(service.hrApprove(1, mockHRUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should prevent HR from approving their own leave request', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_HR',
        approvalTrail: null,
        employeeId: 50,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-02'),
        leaveType: 'SICK',
      });

      await expect(
        service.hrApprove(
          1,
          createMockAuthUser(Role.HR, { userId: 7, employeeId: 50 }),
        ),
      ).rejects.toThrow(
        'HR cannot approve their own leave request. This requires Admin or Super Admin approval.',
      );
    });

    it('should approve request successfully for HR', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const attendanceDelegate = getPrismaDelegate(mockPrisma, 'attendance');
      leaveRequestDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_HR',
        approvalTrail: null,
        employeeId: 101,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-02'),
        leaveType: 'SICK',
      });
      (mockWorkflowEngine.approveWorkflow as jest.Mock).mockResolvedValueOnce({
        legacyState: { approvalTrail: [] },
      });
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) =>
        fn(mockPrisma),
      );
      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 101,
        organizationId: 1,
        leaveBalance: 10,
        shiftId: 1,
      });
      leaveRequestDelegate.update.mockResolvedValueOnce({
        id: 1,
        status: 'APPROVED',
        isPaid: true,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-02'),
      });
      attendanceDelegate.upsert.mockResolvedValueOnce({});

      const result = await service.hrApprove(1, mockHRUser);
      expect(result).toEqual(
        expect.objectContaining({ id: 1, status: 'APPROVED', isPaid: true }),
      );
      expect(mockWorkflowEngine.approveWorkflow).toHaveBeenCalledTimes(1);
      expect(mockLeaveEntitlementsService.recordUsage).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          category: 'PAID_LEAVE',
          amount: 2,
          sourceKey: 'leave-usage:1:2026',
        }),
      );
      expect(attendanceDelegate.upsert).toHaveBeenCalledTimes(2);
      expect(attendanceDelegate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: 'LEAVE',
            checkIn: null,
            checkOut: null,
          }),
          create: expect.objectContaining({ status: 'LEAVE' }),
        }),
      );
    });

    it('deducts half a day per date and does not write full-day attendance rows', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const attendanceDelegate = getPrismaDelegate(mockPrisma, 'attendance');
      leaveRequestDelegate.findFirst.mockResolvedValueOnce({
        id: 2,
        status: 'PENDING_HR',
        approvalTrail: null,
        employeeId: 101,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-03'),
        duration: 'HALF_DAY',
        leaveType: 'CASUAL',
      });
      mockLeaveEntitlementsService.getScheduledLeaveDates.mockResolvedValueOnce(
        [
          new Date('2026-01-01T00:00:00.000Z'),
          new Date('2026-01-02T00:00:00.000Z'),
          new Date('2026-01-03T00:00:00.000Z'),
        ],
      );
      (mockWorkflowEngine.approveWorkflow as jest.Mock).mockResolvedValueOnce({
        legacyState: { approvalTrail: [] },
      });
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) =>
        fn(mockPrisma),
      );
      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 101,
        organizationId: 1,
        leaveBalance: 2,
        shiftId: 1,
      });
      leaveRequestDelegate.update.mockResolvedValueOnce({
        id: 2,
        status: 'APPROVED',
        duration: 'HALF_DAY',
      });

      await service.hrApprove(2, mockHRUser);

      expect(mockLeaveEntitlementsService.recordUsage).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          category: 'PAID_LEAVE',
          amount: 1.5,
          sourceKey: 'leave-usage:2:2026',
        }),
      );
      expect(attendanceDelegate.upsert).not.toHaveBeenCalled();
    });

    it('approves WFH without debiting leave or creating leave attendance rows', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const attendanceDelegate = getPrismaDelegate(mockPrisma, 'attendance');
      leaveRequestDelegate.findFirst.mockResolvedValueOnce({
        id: 22,
        status: 'PENDING_HR',
        requestType: 'WORK_FROM_HOME',
        approvalTrail: null,
        employeeId: 101,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        endDate: new Date('2026-10-01T00:00:00.000Z'),
        duration: 'FULL_DAY',
        leaveType: 'OTHER',
      });
      (mockWorkflowEngine.approveWorkflow as jest.Mock).mockResolvedValueOnce({
        legacyState: { approvalTrail: [] },
      });
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) =>
        fn(mockPrisma),
      );
      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 101,
        organizationId: 1,
        shiftId: 1,
      });
      leaveRequestDelegate.update.mockResolvedValueOnce({
        id: 22,
        status: 'APPROVED',
        requestType: 'WORK_FROM_HOME',
        isPaid: true,
      });

      await service.hrApprove(22, mockHRUser);

      expect(mockLeaveEntitlementsService.recordUsage).not.toHaveBeenCalled();
      expect(attendanceDelegate.upsert).not.toHaveBeenCalled();
      expect(leaveRequestDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPaid: true }),
        }),
      );
    });
  });

  describe('approveCompOffClaim', () => {
    it.each([
      [4, 0.5],
      [7.99, 0.5],
      [8, 1],
    ])('grants %s work hours as %s comp-off day(s)', async (hours, days) => {
      const claimDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveCompOffClaim',
      );
      const ledgerDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveBalanceEntry',
      );
      const claim = {
        id: 17,
        employeeId: 101,
        organizationId: 1,
        workDate: new Date('2026-10-18T00:00:00.000Z'),
        hours,
        status: 'PENDING',
        employee: { user: { id: 22 } },
      };
      claimDelegate.findFirst.mockResolvedValue(claim);
      claimDelegate.updateMany.mockResolvedValue({ count: 1 });
      ledgerDelegate.create.mockResolvedValue({});
      const policyDelegate = getPrismaDelegate(mockPrisma, 'leavePolicy');
      policyDelegate.findUnique.mockResolvedValue({ compOffExpiryDays: 90 });
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn) =>
        fn(mockPrisma),
      );

      await service.approveCompOffClaim(17, mockHRUser);

      expect(ledgerDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'COMP_OFF',
            entryType: 'COMPOFF_EARNED',
            amount: days,
            sourceKey: 'compoff-claim:17',
          }),
        }),
      );
      expect(claimDelegate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 17, organizationId: 1, status: 'PENDING' },
          data: expect.objectContaining({
            status: 'APPROVED',
            reviewedById: mockHRUser.userId,
          }),
        }),
      );
    });
  });

  describe('reject', () => {
    it('should throw NotFoundException if leave request not found', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(service.reject(999, mockManagerUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject request successfully', async () => {
      const leaveRequestDelegate = getPrismaDelegate(
        mockPrisma,
        'leaveRequest',
      );
      leaveRequestDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_MANAGER',
        approvalTrail: null,
      });
      (mockWorkflowEngine.rejectWorkflow as jest.Mock).mockResolvedValueOnce({
        legacyState: { approvalTrail: [] },
      });
      leaveRequestDelegate.update.mockResolvedValueOnce({
        id: 1,
        status: 'REJECTED',
      });

      const result = await service.reject(1, mockManagerUser, 'Test reason');
      expect(result).toEqual({ id: 1, status: 'REJECTED' });
      expect(mockWorkflowEngine.rejectWorkflow).toHaveBeenCalledTimes(1);
    });
  });
});
