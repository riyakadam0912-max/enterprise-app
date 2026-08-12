import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileManagementService } from './file-management.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FILE_STORAGE_PROVIDER } from './file-management.constants';
import { Role } from '../common/enums/role.enum';

function createStorageProvider() {
  return {
    name: 'local',
    upload: jest.fn(),
    getReadStream: jest.fn(),
    delete: jest.fn(),
  };
}

describe('FileManagementService', () => {
  let service: FileManagementService;
  let prisma: {
    organization: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      organization: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileManagementService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AuditLogsService,
          useValue: {
            logCreate: jest.fn(),
            logUpdate: jest.fn(),
            logDelete: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: FILE_STORAGE_PROVIDER,
          useValue: createStorageProvider(),
        },
      ],
    }).compile();

    service = module.get<FileManagementService>(FileManagementService);
  });

  it('falls back to a valid default organization for platform admins without an org', async () => {
    prisma.organization.findFirst.mockResolvedValue({ id: 42 });

    await expect(
      (service as any).validateOrganization({
        userId: 99,
        role: Role.SUPER_ADMIN,
        isPlatformAdmin: true,
        isSuperAdmin: true,
        organizationId: null,
      }),
    ).resolves.toBe(42);

    expect(prisma.organization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, status: 'ACTIVE' },
        orderBy: { id: 'asc' },
        select: { id: true },
      }),
    );
  });

  it('throws for tenant users missing organization context', async () => {
    await expect(
      (service as any).validateOrganization({
        userId: 7,
        role: Role.EMPLOYEE,
        organizationId: null,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
