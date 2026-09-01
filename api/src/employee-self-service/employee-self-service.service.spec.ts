import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EmployeeSelfServiceService } from './employee-self-service.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/types/auth';
import {
  createMockPrismaService,
  getMockPrismaDelegate,
} from '../../test/helpers/mocks.helper';

describe('EmployeeSelfServiceService', () => {
  let service: EmployeeSelfServiceService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  const createUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
    id: 7,
    userId: 7,
    email: 'abc@gmail.com',
    name: 'Employee User',
    role: Role.EMPLOYEE,
    roles: [Role.EMPLOYEE],
    permissions: [],
    employeeId: null,
    organizationId: 2,
    tokenType: 'access',
    jti: null,
    ...overrides,
  });

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeSelfServiceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EmployeeSelfServiceService>(EmployeeSelfServiceService);
  });

  it('resolves a linked employee only within the current organization and active records', async () => {
    const user = createUser();
    const userDelegate = getMockPrismaDelegate(mockPrisma, 'user');
    const employeeDelegate = getMockPrismaDelegate(mockPrisma, 'employee');

    userDelegate.findUnique.mockResolvedValue({
      id: user.id,
      organizationId: 2,
    });
    employeeDelegate.findFirst.mockResolvedValue({
      id: 22,
      email: user.email,
      organizationId: 2,
      deletedAt: null,
    });
    userDelegate.update.mockResolvedValue({
      id: user.id,
      employeeId: 22,
      organizationId: 2,
    });

    const result = await (service as any).resolveEmployeeId(user);

    expect(result).toBe(22);
    expect(employeeDelegate.findFirst).toHaveBeenCalledWith({
      where: {
        email: user.email,
        organizationId: 2,
        deletedAt: null,
      },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    expect(userDelegate.update).toHaveBeenCalledWith({
      where: { id: user.userId || user.id },
      data: { employeeId: 22 },
    });
  });
});
