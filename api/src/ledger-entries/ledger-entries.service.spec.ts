import { Test, TestingModule } from '@nestjs/testing';
import { LedgerEntriesService } from './ledger-entries.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createMockPrismaService,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';

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

describe('LedgerEntriesService', () => {
  let service: LedgerEntriesService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  const mockAdminUser = createMockAuthUser(Role.ADMIN, { userId: 1 });

  beforeEach(async () => {
    // Create fresh mocks for each test!
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerEntriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LedgerEntriesService>(LedgerEntriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      const dto: CreateLedgerEntryDto = {
        description: 'Test Entry',
        debit: 100,
        credit: 0,
        account: 'Cash',
      };
      await expect(
        service.create(
          dto,
          1,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a ledger entry successfully', async () => {
      const ledgerDelegate = getPrismaDelegate(mockPrisma, 'ledgerEntry');
      const mockEntry = {
        id: 1,
        organizationId: 1,
        description: 'Test Entry',
        debit: 100,
        credit: 0,
        user: { id: 1, name: 'Test', email: 'test@test.com' },
      };
      ledgerDelegate.create.mockResolvedValueOnce(mockEntry);

      const dto: CreateLedgerEntryDto = {
        description: 'Test Entry',
        debit: 100,
        credit: 0,
        account: 'Cash',
      };
      const result = await service.create(dto, 1, mockAdminUser);
      expect(result).toEqual(mockEntry);
      expect(ledgerDelegate.create).toHaveBeenCalledTimes(1);
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

    it('should return all ledger entries for organization', async () => {
      const ledgerDelegate = getPrismaDelegate(mockPrisma, 'ledgerEntry');
      const mockEntries = [
        {
          id: 1,
          organizationId: 1,
          description: 'Test Entry',
          user: { id: 1 },
        },
      ];
      ledgerDelegate.findMany.mockResolvedValueOnce(mockEntries);

      const result = await service.findAll(mockAdminUser);
      expect(result).toEqual(mockEntries);
      expect(ledgerDelegate.findMany).toHaveBeenCalledTimes(1);
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

    it('should throw NotFoundException if entry not found', async () => {
      const ledgerDelegate = getPrismaDelegate(mockPrisma, 'ledgerEntry');
      ledgerDelegate.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne(1, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return ledger entry if found', async () => {
      const ledgerDelegate = getPrismaDelegate(mockPrisma, 'ledgerEntry');
      const mockEntry = {
        id: 1,
        organizationId: 1,
        description: 'Test Entry',
        user: { id: 1 },
      };
      ledgerDelegate.findUnique.mockResolvedValueOnce(mockEntry);

      const result = await service.findOne(1, mockAdminUser);
      expect(result).toEqual(mockEntry);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      const dto: UpdateLedgerEntryDto = { description: 'Updated' };
      await expect(
        service.update(
          1,
          dto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update ledger entry successfully', async () => {
      const ledgerDelegate = getPrismaDelegate(mockPrisma, 'ledgerEntry');
      const mockEntry = {
        id: 1,
        organizationId: 1,
        description: 'Updated Entry',
        user: { id: 1 },
      };
      ledgerDelegate.findUnique.mockResolvedValueOnce(mockEntry);
      ledgerDelegate.update.mockResolvedValueOnce(mockEntry);

      const dto: UpdateLedgerEntryDto = { description: 'Updated Entry' };
      const result = await service.update(1, dto, mockAdminUser);
      expect(result).toEqual(mockEntry);
      expect(ledgerDelegate.update).toHaveBeenCalledTimes(1);
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

    it('should mark ledger entry as deleted', async () => {
      const ledgerDelegate = getPrismaDelegate(mockPrisma, 'ledgerEntry');
      const mockEntry = { id: 1, organizationId: 1, description: 'Test Entry' };
      ledgerDelegate.findUnique.mockResolvedValueOnce(mockEntry);
      ledgerDelegate.update.mockResolvedValueOnce(mockEntry);

      const result = await service.remove(1, mockAdminUser);
      expect(result).toEqual(mockEntry);
      expect(ledgerDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('importRecords', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.importRecords(
          [],
          1,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should import valid records and skip invalid', async () => {
      const ledgerDelegate = getPrismaDelegate(mockPrisma, 'ledgerEntry');
      const records = [
        { description: 'Valid', debit: 100, credit: 0 },
        { invalid: 'data' },
      ];
      ledgerDelegate.create.mockResolvedValueOnce({ id: 1 });
      ledgerDelegate.create.mockRejectedValueOnce(new Error('Invalid data'));

      const result = await service.importRecords(records, 1, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
    });
  });
});
