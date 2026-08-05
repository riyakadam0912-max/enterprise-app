import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PayrollService } from './payroll.service';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayslipGenerationService } from './payslip-generation.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createMockCacheManager,
  createMockPrismaService,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';

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
    employeeId: null,
    organizationId: 1,
    tokenType: 'Bearer',
    jti: null,
    ...overrides,
  };
}

describe('PayrollService', () => {
  let service: PayrollService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: PayrollCalculationService,
          useValue: { calculatePayroll: jest.fn() },
        },
        {
          provide: PayslipGenerationService,
          useValue: {
            generatePayslip: jest.fn(),
            generatePayslipHTML: jest.fn(),
          },
        },
        { provide: CACHE_MANAGER, useValue: createMockCacheManager() },
      ],
    }).compile();

    service = module.get<PayrollService>(PayrollService);
  });

  it('should throw ConflictException when a payroll cycle already exists for the same month and year', async () => {
    const user = createMockAuthUser(Role.ADMIN);
    mockPrisma.payrollCycle.findFirst.mockResolvedValueOnce({
      id: 99,
      month: 8,
      year: 2026,
    });

    await expect(
      service.createCycle(
        { name: 'August Payroll', month: 8, year: 2026, notes: '' },
        user,
      ),
    ).rejects.toThrow(ConflictException);

    expect(mockPrisma.payrollCycle.create).not.toHaveBeenCalled();
  });
});
