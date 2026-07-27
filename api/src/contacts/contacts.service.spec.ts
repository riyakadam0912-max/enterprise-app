import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createMockPrismaService,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

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

describe('ContactsService', () => {
  let service: ContactsService;
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
        ContactsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createContactDto: CreateContactDto = {
      contactName: 'Test Contact',
      email: 'test@contact.com',
      phoneNumber: '+1234567890',
      company: 'Test Company',
      jobTitle: 'Test Title',
      leadSource: 'Website',
      address: '123 Test St',
      website: 'https://test.com',
      linkedin: 'https://linkedin.com/test',
      contactStatus: 'Active',
    };

    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.create(
          createContactDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create contact successfully for admin', async () => {
      const contactDelegate = getPrismaDelegate(mockPrisma, 'contact');
      const expectedContact = {
        id: 1,
        contactName: 'Test Contact',
        organizationId: 1,
        email: 'test@contact.com',
      };

      contactDelegate.create.mockResolvedValueOnce(expectedContact);

      const result = await service.create(createContactDto, mockAdminUser);
      expect(result).toEqual(expectedContact);
      expect(contactDelegate.create).toHaveBeenCalledTimes(1);
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

    it('should return all contacts for admin', async () => {
      const contactDelegate = getPrismaDelegate(mockPrisma, 'contact');
      const mockContacts = [
        { id: 1, contactName: 'Contact 1' },
        { id: 2, contactName: 'Contact 2' },
      ];

      contactDelegate.findMany.mockResolvedValueOnce(mockContacts);

      const result = await service.findAll(mockAdminUser);
      expect(result).toEqual(mockContacts);
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

    it('should throw NotFoundException if contact not found', async () => {
      const contactDelegate = getPrismaDelegate(mockPrisma, 'contact');
      contactDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne(999, mockAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return contact if found for admin', async () => {
      const contactDelegate = getPrismaDelegate(mockPrisma, 'contact');
      const mockContact = { id: 1, contactName: 'Test Contact' };

      contactDelegate.findFirst.mockResolvedValueOnce(mockContact);

      const result = await service.findOne(1, mockAdminUser);
      expect(result).toEqual(mockContact);
    });
  });

  describe('update', () => {
    const updateContactDto: UpdateContactDto = {
      contactName: 'Updated Contact',
      email: 'updated@contact.com',
    };

    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.update(
          1,
          updateContactDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update contact successfully', async () => {
      const contactDelegate = getPrismaDelegate(mockPrisma, 'contact');
      contactDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      contactDelegate.update.mockResolvedValueOnce({
        id: 1,
        contactName: 'Updated Contact',
        email: 'updated@contact.com',
      });

      const result = await service.update(1, updateContactDto, mockAdminUser);
      expect(result.contactName).toEqual('Updated Contact');
      expect(result.email).toEqual('updated@contact.com');
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

    it('should soft delete contact successfully', async () => {
      const contactDelegate = getPrismaDelegate(mockPrisma, 'contact');
      contactDelegate.findFirst.mockResolvedValueOnce({ id: 1 });
      contactDelegate.update.mockResolvedValueOnce({
        id: 1,
        deletedAt: new Date(),
      });

      await service.remove(1, mockAdminUser);
      expect(contactDelegate.update).toHaveBeenCalledTimes(1);
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
      const contactDelegate = getPrismaDelegate(mockPrisma, 'contact');
      const records = [
        { contactName: 'Valid Contact' },
        { invalid: 'no name' },
      ];

      contactDelegate.create.mockResolvedValueOnce({ id: 1 });

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
    });

    it('should handle errors during import', async () => {
      const contactDelegate = getPrismaDelegate(mockPrisma, 'contact');
      const records = [
        { contactName: 'Valid Contact' },
        { contactName: 'Error Contact' },
      ];

      contactDelegate.create
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error('Test error'));

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
    });
  });

  describe('getByStatus', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.getByStatus(
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return contacts grouped by status', async () => {
      const contactDelegate = getPrismaDelegate(mockPrisma, 'contact');
      contactDelegate.findMany.mockResolvedValueOnce([
        { id: 1, contactStatus: 'Active' },
        { id: 2, contactStatus: 'On Hold' },
        { id: 3, contactStatus: 'Active' },
      ]);

      const result = await service.getByStatus(mockAdminUser);
      expect(result.Active.length).toEqual(2);
      expect(result['On Hold'].length).toEqual(1);
    });
  });
});
