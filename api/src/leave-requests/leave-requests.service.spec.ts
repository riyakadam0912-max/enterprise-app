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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WorkflowEngineService, useValue: mockWorkflowEngine },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: BusinessUnitsService, useValue: mockBusinessUnitsService },
      ],
    }).compile();

    service = module.get<LeaveRequestsService>(LeaveRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
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

    it('should return the created request when workflow initialization fails', async () => {
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
      mockWorkflowEngine.submitWorkflow.mockRejectedValueOnce(
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
      ).resolves.toMatchObject({ id: 2, employeeId: 101 });
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
      employeeDelegate.update.mockResolvedValueOnce({});
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
