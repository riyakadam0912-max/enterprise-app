import { Test, TestingModule } from '@nestjs/testing';
import { CampaignLeadsService } from './campaign-leads.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createMockPrismaService,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { CreateCampaignLeadDto } from './dto/create-campaign-lead.dto';
import { UpdateCampaignLeadDto } from './dto/update-campaign-lead.dto';

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

describe('CampaignLeadsService', () => {
  let service: CampaignLeadsService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  const mockAdminUser = createMockAuthUser(Role.ADMIN, { userId: 1 });
  const _mockManagerUser = createMockAuthUser(Role.MANAGER, { userId: 2 });
  const _mockEmployeeUser = createMockAuthUser(Role.EMPLOYEE, {
    userId: 3,
    employeeId: 101,
  });

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignLeadsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CampaignLeadsService>(CampaignLeadsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createCampaignLeadDto: CreateCampaignLeadDto = {
      campaign: 'Test Campaign',
      leadId: 1,
      engagementScore: 85,
      sourceType: 'Email',
      lastInteraction: new Date().toISOString(),
      status: 'ENGAGED',
      notes: 'Test notes',
    };

    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.create(
          createCampaignLeadDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create campaign lead successfully for admin', async () => {
      const campaignLeadDelegate = getPrismaDelegate(
        mockPrisma,
        'campaignLead',
      );
      const expectedCampaignLead = {
        id: 1,
        campaign: 'Test Campaign',
        organizationId: 1,
        lead: { id: 1, name: 'Test Lead' },
      };

      campaignLeadDelegate.create.mockResolvedValueOnce(expectedCampaignLead);

      const result = await service.create(createCampaignLeadDto, mockAdminUser);
      expect(result).toEqual(expectedCampaignLead);
      expect(campaignLeadDelegate.create).toHaveBeenCalledTimes(1);
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

    it('should return all campaign leads for admin', async () => {
      const campaignLeadDelegate = getPrismaDelegate(
        mockPrisma,
        'campaignLead',
      );
      const mockCampaignLeads = [
        { id: 1, campaign: 'Campaign 1', lead: { id: 1, name: 'Lead 1' } },
        { id: 2, campaign: 'Campaign 2', lead: { id: 2, name: 'Lead 2' } },
      ];

      campaignLeadDelegate.findMany.mockResolvedValueOnce(mockCampaignLeads);

      const result = await service.findAll(mockAdminUser);
      expect(result).toEqual(mockCampaignLeads);
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

    it('should throw NotFoundException if campaign lead not found', async () => {
      const campaignLeadDelegate = getPrismaDelegate(
        mockPrisma,
        'campaignLead',
      );
      campaignLeadDelegate.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne(999, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return campaign lead if found for admin', async () => {
      const campaignLeadDelegate = getPrismaDelegate(
        mockPrisma,
        'campaignLead',
      );
      const mockCampaignLead = {
        id: 1,
        campaign: 'Test Campaign',
        lead: { id: 1, name: 'Test Lead' },
      };

      campaignLeadDelegate.findUnique.mockResolvedValueOnce(mockCampaignLead);

      const result = await service.findOne(1, mockAdminUser);
      expect(result).toEqual(mockCampaignLead);
    });
  });

  describe('update', () => {
    const updateCampaignLeadDto: UpdateCampaignLeadDto = {
      campaign: 'Updated Campaign',
      status: 'CONVERTED',
    };

    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.update(
          1,
          updateCampaignLeadDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update campaign lead successfully', async () => {
      const campaignLeadDelegate = getPrismaDelegate(
        mockPrisma,
        'campaignLead',
      );
      campaignLeadDelegate.findUnique.mockResolvedValueOnce({ id: 1 });
      campaignLeadDelegate.update.mockResolvedValueOnce({
        id: 1,
        campaign: 'Updated Campaign',
        status: 'CONVERTED',
        lead: { id: 1, name: 'Test Lead' },
      });

      const result = await service.update(
        1,
        updateCampaignLeadDto,
        mockAdminUser,
      );
      expect(result.campaign).toEqual('Updated Campaign');
      expect(result.status).toEqual('CONVERTED');
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

    it('should soft delete campaign lead successfully', async () => {
      const campaignLeadDelegate = getPrismaDelegate(
        mockPrisma,
        'campaignLead',
      );
      campaignLeadDelegate.findUnique.mockResolvedValueOnce({ id: 1 });
      campaignLeadDelegate.update.mockResolvedValueOnce({
        id: 1,
        deletedAt: new Date(),
      });

      await service.remove(1, mockAdminUser);
      expect(campaignLeadDelegate.update).toHaveBeenCalledTimes(1);
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
      const campaignLeadDelegate = getPrismaDelegate(
        mockPrisma,
        'campaignLead',
      );
      const records = [
        { campaign: 'Valid Campaign' },
        { invalid: 'no campaign' },
      ];

      campaignLeadDelegate.create.mockResolvedValueOnce({ id: 1 });

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
    });

    it('should handle errors during import', async () => {
      const campaignLeadDelegate = getPrismaDelegate(
        mockPrisma,
        'campaignLead',
      );
      const records = [
        { campaign: 'Valid Campaign' },
        { campaign: 'Error Campaign' },
      ];

      campaignLeadDelegate.create
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error('Test error'));

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
    });
  });
});
