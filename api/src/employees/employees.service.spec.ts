import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createMockPrismaService,
  MockPrismaService,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/types/auth';
import { BusinessUnitsService } from '../business-units/business-units.service';

jest.mock('../users/utils/hash-password');
import { hashPassword } from '../users/utils/hash-password';
const mockHashPassword = hashPassword as jest.MockedFunction<
  typeof hashPassword
>;

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

function setupTransactionMock(mockPrisma: MockPrismaService) {
  mockPrisma.$transaction.mockImplementation(
    (callback: (tx: unknown) => Promise<unknown>) =>
      callback(mockPrisma as unknown as Parameters<typeof callback>[0]),
  );
}

function getDelegate(
  mockPrisma: MockPrismaService,
  delegate: keyof MockPrismaService,
): DelegateMock {
  return mockPrisma[delegate] as unknown as DelegateMock;
}

describe('EmployeesService', () => {
  let service: EmployeesService;
  let mockPrisma: MockPrismaService;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    jest.clearAllMocks();
    mockHashPassword.mockResolvedValue('bcrypt-hashed-password');
    setupTransactionMock(mockPrisma);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BusinessUnitsService, useValue: { resolveScope: jest.fn(), buildEmployeeBUWhere: jest.fn() } },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uses the effective tenant organization from the request context when JWT organizationId is missing', async () => {
    const employeePayload = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      department: 'Engineering',
      designation: 'Engineer',
      status: 'Active',
    };

    const employeeDelegate = getDelegate(mockPrisma, 'employee');
    employeeDelegate.create.mockResolvedValue({
      id: 42,
      name: employeePayload.name,
      email: employeePayload.email,
      department: employeePayload.department,
      designation: employeePayload.designation,
      status: employeePayload.status,
      organizationId: 7,
      user: null,
    });

    const result = await service.create(
      employeePayload,
      {
        id: 1,
        userId: 1,
        email: 'admin@example.com',
        name: 'Admin',
        role: Role.ADMIN,
        roles: ['ADMIN'],
        permissions: [],
        employeeId: null,
        organizationId: null,
        tokenType: 'access',
        jti: null,
      },
      7,
    );

    expect(employeeDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organization: { connect: { id: 7 } },
          name: 'Jane Doe',
        }),
      }),
    );
    expect(result).toMatchObject({ id: 42, organizationId: 7 });
  });

  it('accepts the IT department when creating an employee', async () => {
    const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 2 });
    const employeeDelegate = getDelegate(mockPrisma, 'employee');
    employeeDelegate.create.mockResolvedValue({
      id: 43,
      name: 'IT Employee',
      department: 'IT',
      organizationId: 2,
    });

    await expect(
      service.create({ name: 'IT Employee', department: 'IT' }, authUser),
    ).resolves.toMatchObject({ department: 'IT' });
    expect(employeeDelegate.create).toHaveBeenCalled();
  });

  describe('create without login credentials (backward compatible)', () => {
    it('creates only an Employee record when password is absent', async () => {
      const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 2 });
      const employeeDelegate = getDelegate(mockPrisma, 'employee');
      const userDelegate = getDelegate(mockPrisma, 'user');
      const appRoleDelegate = getDelegate(mockPrisma, 'appRole');
      const userRoleDelegate = getDelegate(mockPrisma, 'userRole');

      const expectedEmployee = {
        id: 9,
        name: 'Riya Kadam',
        email: null,
        department: 'Engineering',
        organizationId: 2,
        user: null,
      };
      employeeDelegate.create.mockResolvedValue(expectedEmployee);

      const result = await service.create(
        { name: 'Riya Kadam', department: 'Engineering' },
        authUser,
      );

      expect(userDelegate.findFirst).not.toHaveBeenCalled();
      expect(appRoleDelegate.upsert).not.toHaveBeenCalled();
      expect(userRoleDelegate.upsert).not.toHaveBeenCalled();
      expect(mockHashPassword).not.toHaveBeenCalled();
      expect(result).toEqual(expectedEmployee);
    });
  });

  describe('create with login credentials (atomic Employee + User)', () => {
    it('creates Employee + User + AppRole/UserRole atomically when password is provided', async () => {
      const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 2 });
      const employeeDelegate = getDelegate(mockPrisma, 'employee');
      const userDelegate = getDelegate(mockPrisma, 'user');
      const appRoleDelegate = getDelegate(mockPrisma, 'appRole');
      const userRoleDelegate = getDelegate(mockPrisma, 'userRole');

      const expectedEmployee = {
        id: 9,
        name: 'Riya Kadam',
        email: 'riya@example.com',
        department: 'Engineering',
        organizationId: 2,
        user: null,
      };
      const expectedUser = {
        id: 21,
        name: 'Riya Kadam',
        email: 'riya@example.com',
        role: Role.EMPLOYEE,
        isActive: true,
        employeeId: 9,
        managerId: null,
        organizationId: 2,
        createdAt: new Date(),
      };
      const expectedAppRole = { id: 5, name: Role.EMPLOYEE };

      userDelegate.findFirst.mockResolvedValue(null);
      employeeDelegate.create.mockResolvedValue(expectedEmployee);
      appRoleDelegate.upsert.mockResolvedValue(expectedAppRole);
      userDelegate.create.mockResolvedValue(expectedUser);
      userRoleDelegate.upsert.mockResolvedValue({
        userId: expectedUser.id,
        roleId: expectedAppRole.id,
      });

      const result = await service.create(
        {
          name: 'Riya Kadam',
          email: 'riya@example.com',
          department: 'Engineering',
          password: 'strong-password-123',
          role: Role.EMPLOYEE,
        },
        authUser,
      );

      expect(mockHashPassword).toHaveBeenCalledWith('strong-password-123');
      expect(userDelegate.findFirst).toHaveBeenCalledWith({
        where: { email: 'riya@example.com', organizationId: 2 },
        select: { id: true },
      });

      const createdUser = (result as { user: typeof expectedUser }).user;
      expect(createdUser).toBeDefined();
      expect(createdUser.employeeId).toBe(9);
      expect(createdUser.organizationId).toBe(2);
      expect(createdUser.role).toBe(Role.EMPLOYEE);

      expect(userDelegate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'riya@example.com',
          password: 'bcrypt-hashed-password',
          role: Role.EMPLOYEE,
          employeeId: 9,
          organizationId: 2,
        }),
        select: expect.any(Object),
      });

      expect(appRoleDelegate.upsert).toHaveBeenCalledWith({
        where: { name: Role.EMPLOYEE },
        update: {},
        create: expect.objectContaining({ name: Role.EMPLOYEE }),
      });

      expect(userRoleDelegate.upsert).toHaveBeenCalledWith({
        where: {
          userId_roleId: {
            userId: expectedUser.id,
            roleId: expectedAppRole.id,
          },
        },
        update: {},
        create: {
          userId: expectedUser.id,
          roleId: expectedAppRole.id,
        },
      });
    });

    it('assigns MANAGER role and managerId when provided by the caller', async () => {
      const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 3 });
      const employeeDelegate = getDelegate(mockPrisma, 'employee');
      const userDelegate = getDelegate(mockPrisma, 'user');
      const appRoleDelegate = getDelegate(mockPrisma, 'appRole');
      const userRoleDelegate = getDelegate(mockPrisma, 'userRole');

      userDelegate.findFirst.mockResolvedValueOnce(null);
      userDelegate.findUnique.mockResolvedValueOnce({
        id: 77,
        role: Role.MANAGER,
      });

      employeeDelegate.create.mockResolvedValue({
        id: 10,
        name: 'Manager Employee',
        email: 'mgr@example.com',
        organizationId: 3,
        user: null,
      });
      appRoleDelegate.upsert.mockResolvedValue({ id: 2, name: Role.MANAGER });
      userDelegate.create.mockResolvedValue({
        id: 50,
        name: 'Manager Employee',
        email: 'mgr@example.com',
        role: Role.MANAGER,
        isActive: true,
        employeeId: 10,
        managerId: 77,
        organizationId: 3,
        createdAt: new Date(),
      });
      userRoleDelegate.upsert.mockResolvedValue({} as never);

      await service.create(
        {
          name: 'Manager Employee',
          email: 'mgr@example.com',
          password: 'manager-password',
          role: Role.MANAGER,
          managerId: 77,
        },
        authUser,
      );

      expect(userDelegate.findUnique).toHaveBeenCalledWith({
        where: { id: 77, organizationId: 3 },
        select: { id: true, role: true },
      });

      expect(userDelegate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: Role.MANAGER,
          managerId: 77,
        }),
        select: expect.any(Object),
      });

      expect(appRoleDelegate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: Role.MANAGER } }),
      );
    });

    it('works identically for SUPER_ADMIN (cross-tenant override)', async () => {
      const superAdmin = createMockAuthUser(Role.SUPER_ADMIN, {
        organizationId: null,
        isPlatformAdmin: true,
      });
      const employeeDelegate = getDelegate(mockPrisma, 'employee');
      const userDelegate = getDelegate(mockPrisma, 'user');
      const appRoleDelegate = getDelegate(mockPrisma, 'appRole');
      const userRoleDelegate = getDelegate(mockPrisma, 'userRole');

      userDelegate.findFirst.mockResolvedValue(null);
      employeeDelegate.create.mockResolvedValue({
        id: 30,
        name: 'SA Employee',
        email: 'sa-emp@example.com',
        organizationId: 5,
        user: null,
      });
      appRoleDelegate.upsert.mockResolvedValue({ id: 1, name: Role.HR });
      userDelegate.create.mockResolvedValue({
        id: 60,
        name: 'SA Employee',
        email: 'sa-emp@example.com',
        role: Role.HR,
        isActive: true,
        employeeId: 30,
        managerId: null,
        organizationId: 5,
        createdAt: new Date(),
      });
      userRoleDelegate.upsert.mockResolvedValue({} as never);

      const result = await service.create(
        {
          name: 'SA Employee',
          email: 'sa-emp@example.com',
          department: 'HR',
          password: 'hr-password',
          role: Role.HR,
        },
        superAdmin,
        5,
      );

      expect(employeeDelegate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organization: { connect: { id: 5 } },
        }),
        include: { user: true },
      });

      const createdUser = (
        result as { user: { organizationId: number; employeeId: number } }
      ).user;
      expect(createdUser.organizationId).toBe(5);
      expect(createdUser.employeeId).toBe(30);
    });

    it('works identically for HR (tenant scoped)', async () => {
      const hrUser = createMockAuthUser(Role.HR, { organizationId: 4 });
      const employeeDelegate = getDelegate(mockPrisma, 'employee');
      const userDelegate = getDelegate(mockPrisma, 'user');
      const appRoleDelegate = getDelegate(mockPrisma, 'appRole');
      const userRoleDelegate = getDelegate(mockPrisma, 'userRole');

      userDelegate.findFirst.mockResolvedValue(null);
      employeeDelegate.create.mockResolvedValue({
        id: 100,
        name: 'HR Created Employee',
        email: 'hr-created@example.com',
        organizationId: 4,
        user: null,
      });
      appRoleDelegate.upsert.mockResolvedValue({ id: 9, name: Role.EMPLOYEE });
      userDelegate.create.mockResolvedValue({
        id: 200,
        name: 'HR Created Employee',
        email: 'hr-created@example.com',
        role: Role.EMPLOYEE,
        isActive: true,
        employeeId: 100,
        managerId: null,
        organizationId: 4,
        createdAt: new Date(),
      });
      userRoleDelegate.upsert.mockResolvedValue({} as never);

      const result = await service.create(
        {
          name: 'HR Created Employee',
          email: 'hr-created@example.com',
          password: 'hr-emp-password',
          role: Role.EMPLOYEE,
        },
        hrUser,
      );

      const createdUser = (
        result as { user: { organizationId: number; employeeId: number } }
      ).user;
      expect(createdUser.organizationId).toBe(4);
      expect(createdUser.employeeId).toBe(100);
    });
  });

  describe('validation guardrails (prevents orphans and duplicates)', () => {
    it('throws BadRequestException when password provided without email', async () => {
      const authUser = createMockAuthUser(Role.ADMIN);

      await expect(
        service.create(
          {
            name: 'No Email User',
            password: 'some-password',
          },
          authUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when role is not EMPLOYEE/MANAGER/HR', async () => {
      const authUser = createMockAuthUser(Role.ADMIN);
      const payload: Parameters<typeof service.create>[0] = {
        name: 'Bad Role',
        email: 'bad-role@example.com',
        password: 'password',
        role: Role.SUPER_ADMIN as unknown as Role,
      };

      await expect(service.create(payload, authUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when managerId does not exist in the org', async () => {
      const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 5 });
      const userDelegate = getDelegate(mockPrisma, 'user');

      userDelegate.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            name: 'Invalid Manager',
            email: 'invalid-mgr@example.com',
            password: 'password',
            managerId: 9999,
          },
          authUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when a User with the same email exists in the org', async () => {
      const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 2 });
      const userDelegate = getDelegate(mockPrisma, 'user');
      const employeeDelegate = getDelegate(mockPrisma, 'employee');

      userDelegate.findFirst.mockResolvedValue({ id: 99 });

      await expect(
        service.create(
          {
            name: 'Duplicate Email',
            email: 'duplicate@example.com',
            password: 'password',
          },
          authUser,
        ),
      ).rejects.toThrow(ConflictException);

      expect(employeeDelegate.create).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when ADMIN passes a different organizationIdOverride', async () => {
      const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 2 });
      const employeeDelegate = getDelegate(mockPrisma, 'employee');
      const userDelegate = getDelegate(mockPrisma, 'user');

      await expect(
        service.create(
          {
            name: 'Cross Org Attempt',
            email: 'cross@example.com',
            password: 'password',
          },
          authUser,
          99,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(userDelegate.findFirst).not.toHaveBeenCalled();
      expect(employeeDelegate.create).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when HR passes a different organizationIdOverride', async () => {
      const authUser = createMockAuthUser(Role.HR, { organizationId: 4 });
      const employeeDelegate = getDelegate(mockPrisma, 'employee');
      const userDelegate = getDelegate(mockPrisma, 'user');

      await expect(
        service.create(
          {
            name: 'HR Cross Org',
            email: 'hr-cross@example.com',
            password: 'password',
          },
          authUser,
          7,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(userDelegate.findFirst).not.toHaveBeenCalled();
      expect(employeeDelegate.create).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('allows SUPER_ADMIN to pass a different organizationIdOverride', async () => {
      const superAdmin = createMockAuthUser(Role.SUPER_ADMIN, {
        organizationId: null,
        isPlatformAdmin: true,
      });
      const employeeDelegate = getDelegate(mockPrisma, 'employee');
      const userDelegate = getDelegate(mockPrisma, 'user');
      const appRoleDelegate = getDelegate(mockPrisma, 'appRole');
      const userRoleDelegate = getDelegate(mockPrisma, 'userRole');

      userDelegate.findFirst.mockResolvedValue(null);
      employeeDelegate.create.mockResolvedValue({
        id: 77,
        name: 'SA Cross Org Emp',
        email: 'sa-cross@example.com',
        organizationId: 12,
        user: null,
      });
      appRoleDelegate.upsert.mockResolvedValue({ id: 1, name: Role.EMPLOYEE });
      userDelegate.create.mockResolvedValue({
        id: 88,
        name: 'SA Cross Org Emp',
        email: 'sa-cross@example.com',
        role: Role.EMPLOYEE,
        isActive: true,
        employeeId: 77,
        managerId: null,
        organizationId: 12,
        createdAt: new Date(),
      });
      userRoleDelegate.upsert.mockResolvedValue({} as never);

      const result = await service.create(
        {
          name: 'SA Cross Org Emp',
          email: 'sa-cross@example.com',
          password: 'password',
        },
        superAdmin,
        12,
      );

      const createdUser = (
        result as { user: { organizationId: number; employeeId: number } }
      ).user;
      expect(createdUser.organizationId).toBe(12);
      expect(createdUser.employeeId).toBe(77);
    });

    it('does not create a User if transaction fails at user creation', async () => {
      const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 3 });
      const employeeDelegate = getDelegate(mockPrisma, 'employee');
      const userDelegate = getDelegate(mockPrisma, 'user');
      const appRoleDelegate = getDelegate(mockPrisma, 'appRole');

      userDelegate.findFirst.mockResolvedValue(null);
      employeeDelegate.create.mockResolvedValue({
        id: 55,
        name: 'Rollback Test',
        email: 'rollback@example.com',
        organizationId: 3,
        user: null,
      });
      appRoleDelegate.upsert.mockResolvedValue({ id: 1, name: Role.EMPLOYEE });
      userDelegate.create.mockRejectedValue(
        new Error('Simulated DB failure on user insert'),
      );

      await expect(
        service.create(
          {
            name: 'Rollback Test',
            email: 'rollback@example.com',
            password: 'password',
          },
          authUser,
        ),
      ).rejects.toThrow(/Simulated DB failure/);
    });
  });
});
