import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';
import { createMockPrismaService } from '../../test/helpers/mocks.helper';

describe('PerformanceService', () => {
  let service: PerformanceService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const employee = (employeeId: number | null): AuthUser => ({
    id: 1,
    userId: 1,
    email: 'employee@example.com',
    name: 'Employee',
    role: Role.EMPLOYEE,
    roles: [Role.EMPLOYEE],
    permissions: [],
    employeeId,
    organizationId: 10,
    tokenType: 'Bearer',
    jti: null,
  });

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PerformanceService);
  });

  it('fails closed when an employee has no linked profile', async () => {
    await expect(service.listGoals(employee(null))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('prevents an employee from creating a goal for another employee', async () => {
    await expect(
      service.createGoal(
        {
          employeeId: 99,
          goalCycleId: 1,
          title: 'Goal',
        },
        employee(22),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.employee.findUnique).not.toHaveBeenCalled();
  });

  it('prevents an employee from submitting a review for another employee', async () => {
    await expect(
      service.submitReview(
        {
          employeeId: 99,
          goalCycleId: 1,
          rating: 4,
          summary: 'Review',
        },
        1,
        employee(22),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.employee.findUnique).not.toHaveBeenCalled();
  });
});
