import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../workflows/workflow-engine.service';
import {
  createMockPrismaService,
  createMockWorkflowEngineService,
  createMockCacheManager,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

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

describe('ExpensesService', () => {
  let service: ExpensesService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockWorkflowEngine: ReturnType<typeof createMockWorkflowEngineService>;
  let mockCacheManager: ReturnType<typeof createMockCacheManager>;

  const mockAdminUser = createMockAuthUser(Role.ADMIN, { userId: 1 });
  const mockManagerUser = createMockAuthUser(Role.MANAGER, { userId: 2 });
  const mockHrUser = createMockAuthUser(Role.HR, { userId: 4 });
  const mockEmployeeUser = createMockAuthUser(Role.EMPLOYEE, {
    userId: 3,
    employeeId: 101,
  });

  beforeEach(async () => {
    // Create fresh mocks for each test!
    mockPrisma = createMockPrismaService();
    mockWorkflowEngine = createMockWorkflowEngineService();
    mockCacheManager = createMockCacheManager();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WorkflowEngineService, useValue: mockWorkflowEngine },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.create(
          {} as CreateExpenseDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if employee tries to create expense for another employee', async () => {
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      userDelegate.findUnique.mockResolvedValueOnce({ employeeId: 101 });

      await expect(
        service.create(
          { employeeId: 999 } as CreateExpenseDto,
          mockEmployeeUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create expense successfully for admin', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      userDelegate.findUnique.mockResolvedValueOnce({ employeeId: 101 });
      expenseDelegate.create.mockResolvedValueOnce({
        id: 1,
        category: 'Test',
        amount: 100,
        employee: { id: 101 },
        submittedByUser: { id: 1, name: 'Test', email: 'test@test.com' },
      });
      (mockWorkflowEngine.submitWorkflow as jest.Mock).mockResolvedValueOnce(
        {},
      );

      const result = await service.create(
        { category: 'Test', amount: 100, employeeId: 101 } as CreateExpenseDto,
        mockAdminUser,
      );
      expect(result).toBeDefined();
      expect(expenseDelegate.create).toHaveBeenCalledTimes(1);
      expect(mockWorkflowEngine.submitWorkflow).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.del).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should return all expenses for admin', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      const mockExpenses = [{ id: 1, category: 'Test' }];
      expenseDelegate.findMany.mockResolvedValueOnce(mockExpenses);

      const result = await service.findAll(mockAdminUser);
      expect(result).toEqual(mockExpenses);
    });

    it('should return filtered expenses for employee', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      const mockExpenses = [{ id: 1, category: 'Employee Expense' }];
      expenseDelegate.findMany.mockResolvedValueOnce(mockExpenses);

      const result = await service.findAll(mockEmployeeUser);
      expect(result).toEqual(mockExpenses);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if expense not found', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      expenseDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(service.findOne(999, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return expense if found', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      const mockExpense = { id: 1, category: 'Test' };
      expenseDelegate.findFirst.mockResolvedValueOnce(mockExpense);

      const result = await service.findOne(1, mockAdminUser);
      expect(result).toEqual(mockExpense);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.update(
          1,
          {} as UpdateExpenseDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if employee tries to update finalized expense', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      expenseDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'APPROVED',
      });
      await expect(
        service.update(1, {} as UpdateExpenseDto, mockEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update expense successfully', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      expenseDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_MANAGER',
      });
      expenseDelegate.update.mockResolvedValueOnce({
        id: 1,
        category: 'Updated',
      });

      const result = await service.update(
        1,
        { category: 'Updated' } as UpdateExpenseDto,
        mockAdminUser,
      );
      expect(result.category).toEqual('Updated');
    });
  });

  describe('managerApprove', () => {
    it('should throw ForbiddenException if expense not pending manager approval', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      expenseDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_HR',
      });
      await expect(service.managerApprove(1, mockManagerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should approve expense successfully for manager', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      expenseDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_MANAGER',
        approvalTrail: [],
      });
      (mockWorkflowEngine.approveWorkflow as jest.Mock).mockResolvedValueOnce({
        legacyState: { approvalTrail: [] },
      });
      expenseDelegate.update.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_HR',
      });

      const result = await service.managerApprove(1, mockManagerUser);
      expect(result).toBeDefined();
    });
  });

  describe('hrApprove', () => {
    it('should throw NotFoundException if expense not found', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      expenseDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(service.hrApprove(999, mockHrUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if expense not pending HR approval', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      expenseDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_MANAGER',
      });
      await expect(service.hrApprove(1, mockHrUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should approve expense successfully for HR', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      expenseDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_HR',
        approvalTrail: [],
      });
      (mockWorkflowEngine.approveWorkflow as jest.Mock).mockResolvedValueOnce({
        legacyState: { approvalTrail: [] },
      });
      expenseDelegate.update.mockResolvedValueOnce({
        id: 1,
        status: 'APPROVED',
      });

      const result = await service.hrApprove(1, mockHrUser);
      expect(result).toBeDefined();
    });
  });

  describe('reject', () => {
    it('should throw ForbiddenException if expense is already approved', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      expenseDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'APPROVED',
      });
      await expect(service.reject(1, mockAdminUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject expense successfully', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      expenseDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        status: 'PENDING_MANAGER',
        approvalTrail: [],
      });
      (mockWorkflowEngine.rejectWorkflow as jest.Mock).mockResolvedValueOnce({
        legacyState: { approvalTrail: [] },
      });
      expenseDelegate.update.mockResolvedValueOnce({
        id: 1,
        status: 'REJECTED',
      });

      const result = await service.reject(1, mockAdminUser, 'Not approved');
      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if expense not found', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      expenseDelegate.findFirst.mockResolvedValueOnce(null);
      await expect(service.remove(999, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should soft delete expense for admin', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      expenseDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      expenseDelegate.update.mockResolvedValueOnce({
        id: 1,
        deletedAt: new Date(),
      });
      await service.remove(1, mockAdminUser);
      expect(expenseDelegate.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('importRecords', () => {
    it('should import valid records and skip invalid ones', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      const records = [{ category: 'Valid', amount: 100 }, { invalid: 'data' }];
      expenseDelegate.create.mockResolvedValueOnce({ id: 1 });
      expenseDelegate.create.mockRejectedValueOnce(new Error('Invalid record'));

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
    });
  });

  describe('getByCategory', () => {
    it('should return expenses grouped by category', async () => {
      const expenseDelegate = getPrismaDelegate(mockPrisma, 'expense');
      expenseDelegate.findMany.mockResolvedValueOnce([
        { id: 1, category: 'Travel' },
        { id: 2, category: 'Food' },
        { id: 3, category: null },
      ]);

      const result = await service.getByCategory(mockAdminUser);
      expect(result.Travel.length).toEqual(1);
      expect(result.Food.length).toEqual(1);
      expect(result.Uncategorized.length).toEqual(1);
    });
  });
});
