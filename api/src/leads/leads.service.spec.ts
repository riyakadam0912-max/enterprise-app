import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createMockPrismaService,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

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

describe('LeadsService', () => {
  let service: LeadsService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  const mockAdminUser = createMockAuthUser(Role.ADMIN, { userId: 1 });
  const _mockManagerUser = createMockAuthUser(Role.MANAGER, { userId: 2 });
  const mockEmployeeUser = createMockAuthUser(Role.EMPLOYEE, {
    userId: 3,
    employeeId: 101,
  });

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createLeadDto: CreateLeadDto = {
      name: 'Test Lead',
      company: 'Test Company',
      email: 'test@lead.com',
      status: 'New',
    };

    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.create(
          createLeadDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create lead successfully for admin', async () => {
      const leadDelegate = getPrismaDelegate(mockPrisma, 'lead');
      const expectedLead = {
        id: 1,
        name: 'Test Lead',
        organizationId: 1,
        status: 'New',
      };

      leadDelegate.create.mockResolvedValueOnce(expectedLead);

      const result = await service.create(createLeadDto, mockAdminUser);
      expect(result).toEqual(expectedLead);
      expect(leadDelegate.create).toHaveBeenCalledTimes(1);
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

    it('should return all leads for admin', async () => {
      const leadDelegate = getPrismaDelegate(mockPrisma, 'lead');
      const mockLeads = [
        { id: 1, name: 'Lead 1' },
        { id: 2, name: 'Lead 2' },
      ];

      leadDelegate.findMany.mockResolvedValueOnce(mockLeads);

      const result = await service.findAll(mockAdminUser);
      expect(result).toEqual(mockLeads);
    });

    it('should return filtered leads for employee', async () => {
      const leadDelegate = getPrismaDelegate(mockPrisma, 'lead');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const _userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const mockLeads = [{ id: 1, name: 'Employee Lead', assignedToId: 101 }];

      employeeDelegate.findUnique.mockResolvedValueOnce({
        id: 101,
        name: 'Test Employee',
      });
      leadDelegate.findMany.mockResolvedValueOnce(mockLeads);

      const result = await service.findAll(mockEmployeeUser);
      expect(result).toEqual(mockLeads);
    });

    it('should throw ForbiddenException if employee has no linked employee account', async () => {
      const userDelegate = getPrismaDelegate(mockPrisma, 'user');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      employeeDelegate.findUnique.mockResolvedValueOnce(null);
      userDelegate.findUnique.mockResolvedValueOnce({ employeeId: null });

      await expect(
        service.findAll(
          createMockAuthUser(Role.EMPLOYEE, { employeeId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.findOne(
          1,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if lead not found', async () => {
      const leadDelegate = getPrismaDelegate(mockPrisma, 'lead');
      leadDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(999, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if employee tries to access unassigned lead', async () => {
      const leadDelegate = getPrismaDelegate(mockPrisma, 'lead');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      employeeDelegate.findUnique.mockResolvedValueOnce({
        id: 101,
        name: 'Test Employee',
      });
      leadDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        assignedToId: 999,
        assignedTo: 'Someone Else',
      });

      await expect(service.findOne(1, mockEmployeeUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return lead if found for admin', async () => {
      const leadDelegate = getPrismaDelegate(mockPrisma, 'lead');
      const mockLead = { id: 1, name: 'Test Lead' };

      leadDelegate.findFirst.mockResolvedValueOnce(mockLead);

      const result = await service.findOne(1, mockAdminUser);
      expect(result).toEqual(mockLead);
    });
  });

  describe('getDetail', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.getDetail(
          1,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return lead details with activities and tasks', async () => {
      const leadDelegate = getPrismaDelegate(mockPrisma, 'lead');
      const activityDelegate = getPrismaDelegate(mockPrisma, 'activity');
      const taskDelegate = getPrismaDelegate(mockPrisma, 'task');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');

      const mockLead = { id: 1, name: 'Test Lead' };
      const mockActivities = [
        { id: 1, type: 'NOTE', description: 'Test note' },
      ];
      const mockTasks = [{ id: 1, title: 'Test Task' }];

      employeeDelegate.findUnique.mockResolvedValueOnce(null);
      leadDelegate.findFirst.mockResolvedValueOnce(mockLead);
      activityDelegate.findMany.mockResolvedValueOnce(mockActivities);
      taskDelegate.findMany.mockResolvedValueOnce(mockTasks);

      const result = await service.getDetail(1, mockAdminUser);
      expect(result.lead).toEqual(mockLead);
      expect(result.activities).toEqual(mockActivities);
      expect(result.tasks).toEqual(mockTasks);
    });
  });

  describe('findByStatus', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.findByStatus(
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return leads grouped by status', async () => {
      const leadDelegate = getPrismaDelegate(mockPrisma, 'lead');
      leadDelegate.findMany.mockResolvedValueOnce([
        { id: 1, status: 'New' },
        { id: 2, status: 'Contacted' },
        { id: 3, status: 'New' },
      ]);

      const result = await service.findByStatus(mockAdminUser);
      expect(result.New.length).toEqual(2);
      expect(result.Contacted.length).toEqual(1);
    });
  });

  describe('update', () => {
    const updateLeadDto: UpdateLeadDto = {
      name: 'Updated Lead',
      status: 'Contacted',
    };

    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.update(
          1,
          updateLeadDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update lead successfully', async () => {
      const leadDelegate = getPrismaDelegate(mockPrisma, 'lead');
      leadDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      leadDelegate.update.mockResolvedValueOnce({
        id: 1,
        name: 'Updated Lead',
        status: 'Contacted',
      });

      const result = await service.update(1, updateLeadDto, mockAdminUser);
      expect(result.name).toEqual('Updated Lead');
      expect(result.status).toEqual('Contacted');
    });
  });

  describe('remove', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.remove(
          1,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should soft delete lead successfully', async () => {
      const leadDelegate = getPrismaDelegate(mockPrisma, 'lead');
      leadDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      leadDelegate.update.mockResolvedValueOnce({
        id: 1,
        deletedAt: new Date(),
      });

      await service.remove(1, mockAdminUser);
      expect(leadDelegate.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('convertLead', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.convertLead(
          1,
          1,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should convert lead to contact and deal successfully', async () => {
      const leadDelegate = getPrismaDelegate(mockPrisma, 'lead');
      const contactDelegate = getPrismaDelegate(mockPrisma, 'contact');
      const dealDelegate = getPrismaDelegate(mockPrisma, 'deal');
      const activityDelegate = getPrismaDelegate(mockPrisma, 'activity');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');

      const mockLead = {
        id: 1,
        name: 'Test Lead',
        email: 'test@lead.com',
        phone: '1234567890',
        company: 'Test Company',
        source: 'Website',
        assignedTo: 'John Doe',
      };

      employeeDelegate.findUnique.mockResolvedValueOnce(null);
      leadDelegate.findFirst.mockResolvedValueOnce(mockLead);
      contactDelegate.create.mockResolvedValueOnce({ id: 1 });
      dealDelegate.create.mockResolvedValueOnce({ id: 1 });
      leadDelegate.update.mockResolvedValueOnce({
        ...mockLead,
        status: 'CONVERTED',
      });
      activityDelegate.create.mockResolvedValue({ id: 1 });

      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          return await callback({
            contact: contactDelegate,
            deal: dealDelegate,
            lead: leadDelegate,
            activity: activityDelegate,
          });
        },
      );

      const result = await service.convertLead(1, 1, mockAdminUser);
      expect(result.message).toEqual('Lead converted successfully');
      expect(result.dealId).toEqual(1);
      expect(result.contactId).toEqual(1);
    });
  });

  describe('importRecords', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.importRecords(
          [],
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should import valid records and skip invalid ones', async () => {
      const leadDelegate = getPrismaDelegate(mockPrisma, 'lead');
      const records = [
        { name: 'Valid Lead', company: 'Test Company' },
        { invalid: 'no name' },
      ];

      leadDelegate.create.mockResolvedValueOnce({ id: 1 });

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
    });

    it('should handle errors during import', async () => {
      const leadDelegate = getPrismaDelegate(mockPrisma, 'lead');
      const records = [{ name: 'Valid Lead' }, { name: 'Error Lead' }];

      leadDelegate.create
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error('Test error'));

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
    });
  });
});
