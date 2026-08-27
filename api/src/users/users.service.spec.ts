import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createMockPrismaService,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '../common/enums/role.enum';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { hashPassword } from './utils/hash-password';

// Mock hashPassword function
jest.mock('./utils/hash-password');
const mockHashPassword = hashPassword as jest.MockedFunction<
  typeof hashPassword
>;

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

describe('UsersService', () => {
  let service: UsersService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    jest.clearAllMocks();
    mockHashPassword.mockResolvedValue('hashed-password-123');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const authUser = createMockAuthUser(Role.ADMIN);
    const createUserDto: CreateUserDto = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: Role.EMPLOYEE,
    };

    it('should create a new user successfully (happy path)', async () => {
      // Arrange
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const expectedUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: Role.EMPLOYEE,
        isActive: true,
        employeeId: null,
        managerId: null,
        manager: null,
        createdAt: new Date(),
      };

      userDelegate.findFirst.mockResolvedValue(null);
      userDelegate.create.mockResolvedValue(expectedUser);

      // Act
      const result = await service.create(createUserDto, authUser);

      // Assert
      expect(userDelegate.findFirst).toHaveBeenCalledWith({
        where: { email: createUserDto.email, organizationId: 1 },
      });
      expect(mockHashPassword).toHaveBeenCalledWith(createUserDto.password);
      expect(userDelegate.create).toHaveBeenCalledWith({
        data: {
          organizationId: 1,
          name: createUserDto.name,
          email: createUserDto.email,
          password: 'hashed-password-123',
          role: createUserDto.role,
          employeeId: undefined,
          managerId: undefined,
        },
        select: expect.any(Object),
      });
      expect(result).toEqual(expectedUser);
    });

    it('should throw ConflictException when email already exists in the organization', async () => {
      // Arrange
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      userDelegate.findFirst.mockResolvedValue({
        id: 2,
        email: createUserDto.email,
      });

      // Act & Assert
      await expect(service.create(createUserDto, authUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create user with valid employeeId', async () => {
      // Arrange
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const dtoWithEmployeeId: CreateUserDto = {
        ...createUserDto,
        employeeId: 5,
      };

      userDelegate.findFirst.mockResolvedValue(null);
      employeeDelegate.findUnique.mockResolvedValue({
        id: 5,
        organizationId: 1,
      });
      const expectedUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: Role.EMPLOYEE,
        isActive: true,
        employeeId: 5,
        managerId: null,
        manager: null,
        createdAt: new Date(),
      };
      userDelegate.create.mockResolvedValue(expectedUser);

      // Act
      const result = await service.create(dtoWithEmployeeId, authUser);

      // Assert
      expect(employeeDelegate.findUnique).toHaveBeenCalledWith({
        where: { id: 5, organizationId: 1 },
      });
      expect(result).toEqual(expectedUser);
    });

    it('should throw NotFoundException when employeeId does not exist', async () => {
      // Arrange
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const dtoWithEmployeeId: CreateUserDto = {
        ...createUserDto,
        employeeId: 999,
      };

      userDelegate.findFirst.mockResolvedValue(null);
      employeeDelegate.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(dtoWithEmployeeId, authUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when employee already has a user', async () => {
      // Arrange
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const dtoWithEmployeeId: CreateUserDto = {
        ...createUserDto,
        employeeId: 5,
      };

      userDelegate.findFirst.mockResolvedValueOnce(null);
      employeeDelegate.findUnique.mockResolvedValue({
        id: 5,
        organizationId: 1,
      });
      userDelegate.findFirst.mockResolvedValueOnce({ id: 2, employeeId: 5 });

      // Act & Assert
      await expect(service.create(dtoWithEmployeeId, authUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create user with valid managerId (MANAGER role)', async () => {
      // Arrange
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const dtoWithManagerId: CreateUserDto = {
        ...createUserDto,
        managerId: 10,
      };

      userDelegate.findFirst.mockResolvedValue(null);
      userDelegate.findUnique.mockResolvedValue({ id: 10, role: Role.MANAGER });
      const expectedUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: Role.EMPLOYEE,
        isActive: true,
        employeeId: null,
        managerId: 10,
        manager: { id: 10, name: 'Manager User' },
        createdAt: new Date(),
      };
      userDelegate.create.mockResolvedValue(expectedUser);

      // Act
      const result = await service.create(dtoWithManagerId, authUser);

      // Assert
      expect(userDelegate.findUnique).toHaveBeenCalledWith({
        where: { id: 10, organizationId: 1 },
        select: { id: true, role: true },
      });
      expect(result).toEqual(expectedUser);
    });

    it('should throw NotFoundException when manager user not found', async () => {
      // Arrange
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const dtoWithManagerId: CreateUserDto = {
        ...createUserDto,
        managerId: 999,
      };

      userDelegate.findFirst.mockResolvedValue(null);
      userDelegate.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(dtoWithManagerId, authUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when manager does not have MANAGER role', async () => {
      // Arrange
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const dtoWithManagerId: CreateUserDto = {
        ...createUserDto,
        managerId: 10,
      };

      userDelegate.findFirst.mockResolvedValue(null);
      userDelegate.findUnique.mockResolvedValue({
        id: 10,
        role: Role.EMPLOYEE,
      });

      // Act & Assert
      await expect(service.create(dtoWithManagerId, authUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    const authUser = createMockAuthUser(Role.ADMIN);

    it('should return all users for the organization', async () => {
      // Arrange
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const expectedUsers = [
        {
          id: 1,
          name: 'User 1',
          email: 'user1@example.com',
          role: Role.EMPLOYEE,
        },
        {
          id: 2,
          name: 'User 2',
          email: 'user2@example.com',
          role: Role.MANAGER,
        },
      ];

      userDelegate.findMany.mockResolvedValue(expectedUsers);

      // Act
      const result = await service.findAll(authUser);

      // Assert
      expect(userDelegate.findMany).toHaveBeenCalledWith({
        where: { organizationId: 1 },
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });
      expect(result).toEqual(expectedUsers);
    });

    it('should return all users across organizations for platform admin', async () => {
      // Arrange
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const platformAdmin = createMockAuthUser(Role.ADMIN, {
        isPlatformAdmin: true,
        organizationId: null,
      });
      const expectedUsers = [
        {
          id: 1,
          name: 'User 1',
          email: 'user1@example.com',
          role: Role.EMPLOYEE,
        },
        {
          id: 2,
          name: 'User 2',
          email: 'user2@example.com',
          role: Role.MANAGER,
        },
      ];

      userDelegate.findMany.mockResolvedValue(expectedUsers);

      // Act
      const result = await service.findAll(platformAdmin);

      // Assert
      expect(userDelegate.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });
      expect(result).toEqual(expectedUsers);
    });
  });

  describe('update', () => {
    it('should update an existing user successfully', async () => {
      const authUser = createMockAuthUser(Role.ADMIN);
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const updatedUser = {
        id: 1,
        name: 'Updated Name',
        email: 'updated@example.com',
        role: Role.MANAGER,
        isActive: true,
        employeeId: null,
        managerId: null,
        manager: null,
        createdAt: new Date(),
      };

      userDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        email: 'old@example.com',
        organizationId: 1,
      });
      userDelegate.findFirst.mockResolvedValueOnce(null);
      userDelegate.update.mockResolvedValue(updatedUser);

      const result = await service.update(
        1,
        {
          name: 'Updated Name',
          email: 'updated@example.com',
          role: Role.MANAGER,
        },
        authUser,
      );

      expect(userDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, organizationId: 1 },
          data: expect.objectContaining({
            name: 'Updated Name',
            email: 'updated@example.com',
            role: Role.MANAGER,
          }),
        }),
      );
      expect(result).toEqual(updatedUser);
    });

    it('scopes user updates to the authenticated organization', async () => {
      const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 2 });
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      userDelegate.findFirst.mockResolvedValueOnce({
        id: 9,
        email: 'old@example.com',
        organizationId: 2,
      });
      userDelegate.findFirst.mockResolvedValueOnce(null);
      userDelegate.update.mockResolvedValue({
        id: 9,
        email: 'new@example.com',
        organizationId: 2,
      });

      await service.update(9, { email: 'new@example.com' }, authUser);

      expect(userDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9, organizationId: 2 } }),
      );
    });
  });

  describe('remove', () => {
    it('scopes user deletes to the authenticated organization', async () => {
      const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 3 });
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      userDelegate.findFirst.mockResolvedValue({
        id: 44,
        organizationId: 3,
      });
      userDelegate.delete.mockResolvedValue({});

      await service.remove(44, authUser);

      expect(userDelegate.delete).toHaveBeenCalledWith({
        where: { id: 44, organizationId: 3 },
      });
    });
  });

  describe('resetPassword', () => {
    it('should hash and persist a new password within the authenticated tenant', async () => {
      const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 2 });
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      userDelegate.findFirst.mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        organizationId: 2,
      });
      userDelegate.update.mockResolvedValue({});

      await service.resetPassword(1, 'new-password', authUser);

      expect(mockHashPassword).toHaveBeenCalledWith('new-password');
      expect(userDelegate.update).toHaveBeenCalledWith({
        where: { id: 1, organizationId: 2 },
        data: { password: 'hashed-password-123' },
      });
    });

    it('should reject resetting a password for a user outside the tenant', async () => {
      const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 2 });
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      userDelegate.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword(99, 'new-password', authUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unlock', () => {
    it('should unlock a user only within the same organization', async () => {
      const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 3 });
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      userDelegate.findFirst.mockResolvedValue({
        id: 8,
        organizationId: 3,
      });
      userDelegate.update.mockResolvedValue({
        id: 8,
        isActive: true,
      });

      await service.unlock(8, authUser);

      expect(userDelegate.update).toHaveBeenCalledWith({
        where: { id: 8, organizationId: 3 },
        data: { isActive: true },
        select: expect.any(Object),
      });
    });
  });

  describe('assignOrganization', () => {
    it('preserves platform-admin organization changes while keeping tenant admins scoped', async () => {
      const platformAdmin = createMockAuthUser(Role.ADMIN, {
        organizationId: null,
        isPlatformAdmin: true,
        isSuperAdmin: true,
      });
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      userDelegate.findFirst.mockResolvedValue({
        id: 11,
        organizationId: 7,
      });
      userDelegate.update.mockResolvedValue({
        id: 11,
        organizationId: 9,
      });

      await service.assignOrganization(11, 9, platformAdmin);

      expect(userDelegate.update).toHaveBeenCalledWith({
        where: { id: 11, organizationId: 7 },
        data: { organizationId: 9 },
        select: expect.any(Object),
      });
    });

    it('rejects same-role cross-tenant organization reassignment for a tenant-scoped admin', async () => {
      const tenantAdmin = createMockAuthUser(Role.ADMIN, { organizationId: 4 });
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      userDelegate.findFirst.mockResolvedValue(null);

      await expect(
        service.assignOrganization(77, 9, tenantAdmin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignManager', () => {
    it('should scope the final manager update to the authenticated organization', async () => {
      const authUser = createMockAuthUser(Role.ADMIN, { organizationId: 5 });
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');

      userDelegate.findFirst.mockResolvedValueOnce({
        id: 20,
        organizationId: 5,
        role: Role.EMPLOYEE,
      });
      userDelegate.findFirst.mockResolvedValueOnce({
        id: 30,
        organizationId: 5,
      });
      userDelegate.update.mockResolvedValue({
        id: 20,
        managerId: 30,
      });

      await service.assignManager(20, 30, authUser);

      expect(userDelegate.update).toHaveBeenCalledWith({
        where: { id: 20, organizationId: 5 },
        data: { managerId: 30 },
        select: expect.any(Object),
      });
    });
  });

  describe('assignRoles', () => {
    it('should replace the user role assignments', async () => {
      const authUser = createMockAuthUser(Role.ADMIN);
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const appRoleDelegate = getPrismaDelegate(mockPrisma, 'appRole');
      const userRoleDelegate = getPrismaDelegate(mockPrisma, 'userRole');

      userDelegate.findFirst.mockResolvedValue({ id: 1 });
      appRoleDelegate.findMany.mockResolvedValue([{ id: 2 }, { id: 3 }]);
      userRoleDelegate.deleteMany.mockResolvedValue({ count: 1 });
      userRoleDelegate.createMany.mockResolvedValue({ count: 2 });

      const result = await service.assignRoles(1, [2, 3], authUser);

      expect(userRoleDelegate.deleteMany).toHaveBeenCalledWith({
        where: { userId: 1 },
      });
      expect(userRoleDelegate.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 1, roleId: 2 },
          { userId: 1, roleId: 3 },
        ],
      });
      expect(result).toEqual({
        success: true,
        message: 'Roles assigned successfully',
      });
    });
  });

  describe('findAssignable', () => {
    it('should return all active non-admin users for ADMIN role', async () => {
      // Arrange
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const adminUser = createMockAuthUser(Role.ADMIN);
      const expectedUsers = [
        { id: 2, name: 'Employee', role: Role.EMPLOYEE, managerId: null },
        { id: 3, name: 'Manager', role: Role.MANAGER, managerId: null },
      ];

      userDelegate.findMany.mockResolvedValue(expectedUsers);

      // Act
      const result = await service.findAssignable(adminUser);

      // Assert
      expect(userDelegate.findMany).toHaveBeenCalledWith({
        where: { isActive: true, role: { not: Role.ADMIN }, organizationId: 1 },
        select: expect.any(Object),
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(expectedUsers);
    });

    it('should return all active non-admin users for HR role', async () => {
      // Arrange
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const hrUser = createMockAuthUser(Role.HR);
      const expectedUsers = [
        { id: 2, name: 'Employee', role: Role.EMPLOYEE, managerId: null },
        { id: 3, name: 'Manager', role: Role.MANAGER, managerId: null },
      ];

      userDelegate.findMany.mockResolvedValue(expectedUsers);

      // Act
      const result = await service.findAssignable(hrUser);

      // Assert
      expect(result).toEqual(expectedUsers);
    });

    it('should return active employees under them for MANAGER role', async () => {
      // Arrange
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const managerUser = createMockAuthUser(Role.MANAGER, { userId: 5 });
      const expectedUsers = [
        { id: 6, name: 'Employee 1', role: Role.EMPLOYEE, managerId: 5 },
        { id: 7, name: 'Employee 2', role: Role.EMPLOYEE, managerId: 5 },
      ];

      userDelegate.findMany.mockResolvedValue(expectedUsers);

      // Act
      const result = await service.findAssignable(managerUser);

      // Assert
      expect(userDelegate.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          role: Role.EMPLOYEE,
          managerId: 5,
          organizationId: 1,
        },
        select: expect.any(Object),
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(expectedUsers);
    });

    it('should return empty array for EMPLOYEE role', async () => {
      // Arrange
      const employeeUser = createMockAuthUser(Role.EMPLOYEE);

      // Act
      const result = await service.findAssignable(employeeUser);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
