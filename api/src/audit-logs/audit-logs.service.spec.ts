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
    mockPrisma.auditLog.create.mockImplementation(async ({ data }) => ({
      id: 101,
      ...data,
    }));
    mockPrisma.systemAuditEvent.create.mockImplementation(async ({ data }) => ({
      id: 102,
      ...data,
    }));
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

  it('stores platform-user events separately without selecting or creating a tenant', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      organizationId: null,
    });
    mockPrisma.systemAuditEvent.create.mockImplementation(async ({ data }) => ({
      id: 101,
      ...data,
    }));
    await service.create(
      {
        userId: 1,
        module: 'Auth',
        entityType: 'User',
        entityId: 1,
        action: 'LOGIN_SUCCESS',
      },
      createAuthUser(null),
    );
    expect(mockPrisma.systemAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'PLATFORM_EVENT' }),
      }),
    );
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    expect(mockPrisma.organization.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.organization.upsert).not.toHaveBeenCalled();
  });

  it('quarantines an unexplained context mismatch instead of trusting the request tenant', async () => {
    mockPrisma.task.findUnique.mockResolvedValue({ id: 10, organizationId: 7 });
    await runWithAuditContext({ organizationId: 55 }, () =>
      service.create(
        {
          userId: 2,
          module: 'Tasks',
          entityType: 'Task',
          entityId: 10,
          action: 'UPDATE',
        },
        createAuthUser(7),
      ),
    );
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    expect(mockPrisma.systemAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'CONTEXT_MISMATCH',
          targetOrganizationId: 7,
          requestedOrganizationId: 55,
        }),
      }),
    );
  });

  it('attributes a platform-admin action to the actual target rather than the selected tenant', async () => {
    mockPrisma.task.findUnique.mockResolvedValue({ id: 10, organizationId: 7 });
    mockPrisma.organization.findUnique.mockResolvedValue({ id: 7 });
    await runWithAuditContext(
      { organizationId: 55, isPlatformAdmin: true },
      () =>
        service.create(
          {
            userId: 1,
            module: 'Tasks',
            entityType: 'Task',
            entityId: 10,
            action: 'UPDATE',
          },
          createAuthUser(null),
        ),
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 7 }),
      }),
    );
    expect(mockPrisma.systemAuditEvent.create).not.toHaveBeenCalled();
  });

  it('preserves unknown-login events without using an actor home organization', async () => {
    await service.logLogin(
      {
        module: 'Auth',
        entityType: 'User',
        action: 'LOGIN_FAILURE',
        success: false,
      },
      createAuthUser(7),
    );
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    expect(mockPrisma.systemAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'OWNERSHIP_UNRESOLVED' }),
      }),
    );
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockEventEmitter.emit).not.toHaveBeenCalled();
  });

  it('propagates explicit audit-write failures instead of creating a default organization', async () => {
    mockPrisma.systemAuditEvent.create.mockRejectedValue(
      new Error('audit unavailable'),
    );
    await expect(
      service.logCustomAction({
        module: 'System',
        entityType: 'Permission',
        action: 'UPDATE',
      }),
    ).rejects.toThrow('audit unavailable');
    expect(mockPrisma.organization.upsert).not.toHaveBeenCalled();
  });

  it('denies system-audit access to tenant administrators and tenant super-admins', async () => {
    await expect(
      service.findSystemEvents({}, createAuthUser(7)),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.findSystemEvents(
        {},
        createAuthUser(7, {
          role: Role.SUPER_ADMIN,
          roles: [Role.SUPER_ADMIN],
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.systemAuditEvent.findMany).not.toHaveBeenCalled();
  });

  it('allows platform readers to inspect the separate system stream', async () => {
    mockPrisma.$transaction.mockResolvedValue([0, []]);
    await service.findSystemEvents(
      { reason: 'CONTEXT_MISMATCH' },
      createAuthUser(null),
    );
    expect(mockPrisma.systemAuditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reason: 'CONTEXT_MISMATCH' } }),
    );
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

  it('does not let an explicit event tenant mask conflicting request context', async () => {
    mockPrisma.task.findUnique.mockResolvedValue({ id: 10, organizationId: 7 });
    await runWithAuditContext({ organizationId: 55 }, () =>
      service.logCustomAction({
        organizationId: 7,
        module: 'Tasks',
        entityType: 'Task',
        entityId: 10,
        action: 'UPDATE',
      }),
    );
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    expect(mockPrisma.systemAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'CONTEXT_MISMATCH',
          targetOrganizationId: 7,
          requestedOrganizationId: 55,
        }),
      }),
    );
  });
});
