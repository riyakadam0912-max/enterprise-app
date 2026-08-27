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
import { BusinessUnitsService } from '../business-units/business-units.service';

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
        {
          provide: BusinessUnitsService,
          useValue: {
            resolveScope: jest.fn().mockResolvedValue({
              allUnits: true,
              unitIds: [],
            }),
          },
        },
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

  it('balances flexible-day shortfall across the payroll month', async () => {
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        status: 'PRESENT',
        workingHours: 5,
        requiredHours: 8,
        overtimeHours: 0,
        lateMinutes: 0,
      },
      {
        status: 'PRESENT',
        workingHours: 10,
        requiredHours: 8,
        overtimeHours: 2,
        lateMinutes: 0,
      },
    ]);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);

    const metrics = await (service as any).getAttendanceMetricsForCycle(
      7,
      8,
      2026,
      1,
    );

    expect(metrics.totalWorkedHours).toBe(15);
    expect(metrics.totalExpectedHours).toBe(16);
    expect(metrics.totalShortfallHours).toBe(1);
    expect(metrics.overtimeHours).toBe(2);
  });
});
