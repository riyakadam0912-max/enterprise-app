import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditLogsService } from './audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { runWithAuditContext } from './audit-context';
import {
  createMockEventEmitter2,
  createMockPrismaService,
  getMockPrismaDelegate,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import type { AuthUser } from '../common/types/auth';
import { ForbiddenException } from '@nestjs/common';

describe('AuditLogsService', () => {
  let service: AuditLogsService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockEventEmitter: ReturnType<typeof createMockEventEmitter2>;

  const createAuthUser = (
    organizationId: number | null,
    overrides: Partial<AuthUser> = {},
  ): AuthUser => ({
    id: organizationId === null ? 1 : 2,
    userId: organizationId === null ? 1 : 2,
    email:
      organizationId === null ? 'platform@example.com' : 'tenant@example.com',
    name: organizationId === null ? 'Platform User' : 'Tenant User',
    role: organizationId === null ? Role.SUPER_ADMIN : Role.ADMIN,
    roles: [organizationId === null ? Role.SUPER_ADMIN : Role.ADMIN],
    permissions: [],
    employeeId: null,
    organizationId,
    tokenType: 'access',
    jti: null,
    ...overrides,
  });

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockEventEmitter = createMockEventEmitter2();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  it('stores platform audit logs with a default organizationId', async () => {
    const auditLogDelegate = getMockPrismaDelegate(mockPrisma, 'auditLog');
    const userDelegate = getMockPrismaDelegate(mockPrisma, 'user');
    const organizationDelegate = getMockPrismaDelegate(
      mockPrisma,
      'organization',
    );
    const platformUser = createAuthUser(null);

    userDelegate.findUnique.mockResolvedValue({ organizationId: null });
    organizationDelegate.findFirst.mockResolvedValue({ id: 1 });
    auditLogDelegate.create.mockImplementation(async ({ data }) => ({
      id: 101,
      ...data,
    }));

    await service.create(
      {
        userId: platformUser.userId,
        userName: platformUser.name,
        userRole: platformUser.role,
        module: 'Auth',
        entityType: 'User',
        action: 'LOGIN_SUCCESS',
        entityId: platformUser.userId,
        description: 'Platform login succeeded',
        status: 'SUCCESS',
      },
      platformUser,
    );

    expect(auditLogDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 1,
        }),
      }),
    );
  });

  it('prefers request audit context organizationId over the user payload', async () => {
    const auditLogDelegate = getMockPrismaDelegate(mockPrisma, 'auditLog');
    const userDelegate = getMockPrismaDelegate(mockPrisma, 'user');
    const tenantUser = createAuthUser(7);

    auditLogDelegate.create.mockImplementation(async ({ data }) => ({
      id: 102,
      ...data,
    }));
    userDelegate.findUnique.mockResolvedValue({ organizationId: 7 });

    await runWithAuditContext({ organizationId: 55 }, async () => {
      await service.create(
        {
          userId: tenantUser.userId,
          userName: tenantUser.name,
          userRole: tenantUser.role,
          module: 'Tasks',
          entityType: 'Task',
          action: 'UPDATE',
          entityId: 10,
          description: 'Task updated',
          status: 'SUCCESS',
        },
        tenantUser,
      );
    });

    expect(auditLogDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 55,
        }),
      }),
    );
    expect(userDelegate.findUnique).not.toHaveBeenCalled();
  });

  it('keeps tenant-scoped audit log queries filtered by organizationId', async () => {
    const auditLogDelegate = getMockPrismaDelegate(mockPrisma, 'auditLog');
    const tenantUser = createAuthUser(7);

    auditLogDelegate.count.mockReturnValue('count-query');
    auditLogDelegate.findMany.mockReturnValue('findMany-query');
    mockPrisma.$transaction.mockResolvedValue([1, []]);

    await service.findAll({}, tenantUser);

    expect(auditLogDelegate.count).toHaveBeenCalledWith({
      where: { organizationId: 7 },
    });
    expect(auditLogDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 7 },
      }),
    );
  });

  it('allows super admins to query audit logs without an organization filter', async () => {
    const auditLogDelegate = getMockPrismaDelegate(mockPrisma, 'auditLog');
    const platformUser = createAuthUser(null);

    auditLogDelegate.count.mockReturnValue('count-query');
    auditLogDelegate.findMany.mockReturnValue('findMany-query');
    mockPrisma.$transaction.mockResolvedValue([2, []]);

    await service.findAll({}, platformUser);

    expect(auditLogDelegate.count).toHaveBeenCalledWith({ where: {} });
    expect(auditLogDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('rejects null-organization readers who are not super admins', async () => {
    const tenantAdminWithoutOrg = createAuthUser(null, {
      role: Role.ADMIN,
      roles: [Role.ADMIN],
    });

    await expect(service.findAll({}, tenantAdminWithoutOrg)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('keeps findOne tenant-scoped for non-platform readers', async () => {
    const auditLogDelegate = getMockPrismaDelegate(mockPrisma, 'auditLog');
    const complianceUser = createAuthUser(7, {
      role: Role.COMPLIANCE_MANAGER,
      roles: [Role.COMPLIANCE_MANAGER],
    });

    auditLogDelegate.findFirst.mockResolvedValue(null);

    await service.findOne(42, complianceUser);

    expect(auditLogDelegate.findFirst).toHaveBeenCalledWith({
      where: { id: 42, organizationId: 7 },
    });
  });

  it('keeps entity lookups tenant-scoped for non-platform readers', async () => {
    const auditLogDelegate = getMockPrismaDelegate(mockPrisma, 'auditLog');
    const tenantUser = createAuthUser(7, {
      role: Role.ADMIN,
      roles: [Role.ADMIN],
    });

    auditLogDelegate.findMany.mockResolvedValue([]);

    await service.findByEntity('Task', 10, tenantUser);

    expect(auditLogDelegate.findMany).toHaveBeenCalledWith({
      where: { entityType: 'Task', entityId: 10, organizationId: 7 },
      orderBy: { createdAt: 'desc' },
    });
  });
});
