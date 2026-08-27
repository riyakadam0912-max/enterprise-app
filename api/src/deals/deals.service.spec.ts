import { Test, TestingModule } from '@nestjs/testing';
import { DealsService } from './deals.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createMockPrismaService,
  createMockNotificationsService,
  createMockCacheManager,
  createMockEventEmitter2,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

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

describe('DealsService', () => {
  let service: DealsService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockNotificationsService: ReturnType<
    typeof createMockNotificationsService
  >;
  let mockEventEmitter: ReturnType<typeof createMockEventEmitter2>;
  let mockCacheManager: ReturnType<typeof createMockCacheManager>;

  const mockAdminUser = createMockAuthUser(Role.ADMIN, {
    userId: 1,
    isPlatformAdmin: true,
  });
  const _mockManagerUser = createMockAuthUser(Role.MANAGER, { userId: 2 });
  const mockEmployeeUser = createMockAuthUser(Role.EMPLOYEE, {
    userId: 3,
    employeeId: 101,
  });

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockNotificationsService = createMockNotificationsService();
    mockEventEmitter = createMockEventEmitter2();
    mockCacheManager = createMockCacheManager();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'CACHE_MANAGER', useValue: mockCacheManager },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<DealsService>(DealsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDealDto: CreateDealDto = {
      title: 'Test Deal',
      value: 5000,
    };

    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.create(
          createDealDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create deal successfully for admin', async () => {
      const dealDelegate = getPrismaDelegate(mockPrisma, 'deal');
      const expectedDeal = {
        id: 1,
        title: 'Test Deal',
        organizationId: 1,
        value: 5000,
        stage: 'NEW',
      };

      dealDelegate.create.mockResolvedValueOnce(expectedDeal);

      const result = await service.create(createDealDto, mockAdminUser);
      expect(result).toEqual(expectedDeal);
      expect(dealDelegate.create).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.del).toHaveBeenCalledTimes(1);
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

    it('should return all deals for admin', async () => {
      const dealDelegate = getPrismaDelegate(mockPrisma, 'deal');
      const mockDeals = [
        { id: 1, title: 'Deal 1' },
        { id: 2, title: 'Deal 2' },
      ];

      dealDelegate.findMany.mockResolvedValueOnce(mockDeals);

      const result = await service.findAll(mockAdminUser);
      expect(result).toEqual(mockDeals);
    });

    it('should return filtered deals for employee', async () => {
      const dealDelegate = getPrismaDelegate(mockPrisma, 'deal');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      const mockDeals = [{ id: 1, title: 'Employee Deal', assignedToId: 101 }];

      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 101,
        name: 'Test Employee',
      });
      dealDelegate.findMany.mockResolvedValueOnce(mockDeals);

      const result = await service.findAll(mockEmployeeUser);
      expect(result).toEqual(mockDeals);
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

    it('should throw NotFoundException if deal not found', async () => {
      const dealDelegate = getPrismaDelegate(mockPrisma, 'deal');
      dealDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(999, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if employee tries to access unassigned deal', async () => {
      const dealDelegate = getPrismaDelegate(mockPrisma, 'deal');
      const employeeDelegate = getPrismaDelegate(mockPrisma, 'employee');
      employeeDelegate.findFirst.mockResolvedValueOnce({
        id: 101,
        name: 'Test Employee',
      });
      dealDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        assignedToId: 999,
        owner: 'Someone Else',
      });

      await expect(service.findOne(1, mockEmployeeUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return deal if found for admin', async () => {
      const dealDelegate = getPrismaDelegate(mockPrisma, 'deal');
      const mockDeal = { id: 1, title: 'Test Deal' };

      dealDelegate.findFirst.mockResolvedValueOnce(mockDeal);

      const result = await service.findOne(1, mockAdminUser);
      expect(result).toEqual(mockDeal);
    });
  });

  describe('update', () => {
    const updateDealDto: UpdateDealDto = {
      title: 'Updated Deal',
      value: 6000,
    };

    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.update(
          1,
          updateDealDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update deal successfully', async () => {
      const dealDelegate = getPrismaDelegate(mockPrisma, 'deal');
      dealDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        title: 'Old Deal',
        stage: 'NEW',
      });
      dealDelegate.update.mockResolvedValueOnce({
        id: 1,
        title: 'Updated Deal',
        value: 6000,
        stage: 'NEW',
      });

      const result = await service.update(1, updateDealDto, mockAdminUser);
      expect(result.title).toEqual('Updated Deal');
      expect(result.value).toEqual(6000);
      expect(mockCacheManager.del).toHaveBeenCalledTimes(1);
    });

    it('should emit deal.status_updated event when stage changes', async () => {
      const dealDelegate = getPrismaDelegate(mockPrisma, 'deal');
      dealDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        title: 'Test Deal',
        stage: 'NEW',
      });
      dealDelegate.update.mockResolvedValueOnce({
        id: 1,
        title: 'Test Deal',
        stage: 'WON',
      });

      await service.update(1, { stage: 'WON' }, mockAdminUser);
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'deal.status_updated',
        expect.any(Object),
      );
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

    it('should soft delete deal successfully', async () => {
      const dealDelegate = getPrismaDelegate(mockPrisma, 'deal');
      dealDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        title: 'Test Deal',
      });
      dealDelegate.update.mockResolvedValueOnce({
        id: 1,
        deletedAt: new Date(),
      });

      await service.remove(1, mockAdminUser);
      expect(dealDelegate.update).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.del).toHaveBeenCalledTimes(1);
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
      const dealDelegate = getPrismaDelegate(mockPrisma, 'deal');
      const records = [
        { title: 'Valid Deal', value: 1000 },
        { invalid: 'no title' },
      ];

      dealDelegate.create.mockResolvedValueOnce({ id: 1 });

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
    });
  });

  describe('getPipeline', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.getPipeline(
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return deals grouped by pipeline stages', async () => {
      const dealDelegate = getPrismaDelegate(mockPrisma, 'deal');
      const mockDeals = [
        { id: 1, title: 'New Deal', stage: 'NEW' },
        { id: 2, title: 'Qualified Deal', stage: 'QUALIFIED' },
      ];

      dealDelegate.findMany.mockResolvedValueOnce(mockDeals);

      const result = await service.getPipeline(mockAdminUser);
      expect(result.new.length).toEqual(1);
      expect(result.qualified.length).toEqual(1);
    });
  });

  describe('handleDealWon', () => {
    it('should throw NotFoundException if deal ID is invalid', async () => {
      await expect(
        service.handleDealWon('invalid-id', mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update deal stage to WON', async () => {
      const dealDelegate = getPrismaDelegate(mockPrisma, 'deal');
      dealDelegate.findFirst.mockResolvedValueOnce({
        id: 1,
        title: 'Test Deal',
        stage: 'NEW',
      });
      dealDelegate.update.mockResolvedValueOnce({
        id: 1,
        title: 'Test Deal',
        stage: 'WON',
      });

      const result = await service.handleDealWon('1', mockAdminUser);
      expect(result.stage).toEqual('WON');
    });
  });
});
