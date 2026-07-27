import { Test, TestingModule } from '@nestjs/testing';
import { TimesheetsService } from './timesheets.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createMockPrismaService,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { QueryTimesheetDto } from './dto/query-timesheet.dto';

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

describe('TimesheetsService', () => {
  let service: TimesheetsService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  const mockAdminUser = createMockAuthUser(Role.ADMIN, { userId: 1 });
  const _mockManagerUser = createMockAuthUser(Role.MANAGER, { userId: 2 });
  const _mockEmployeeUser = createMockAuthUser(Role.EMPLOYEE, {
    userId: 3,
    employeeId: 101,
  });

  beforeEach(async () => {
    // Create fresh mocks for each test!
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimesheetsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TimesheetsService>(TimesheetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getReport', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.getReport(
          {} as QueryTimesheetDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return report with pagination', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const mockTimesheets = [
        {
          id: 1,
          task: 'Test Task',
          date: new Date('2026-01-01'),
          hours: 8,
          status: 'PENDING',
        },
      ];
      timesheetDelegate.findMany.mockResolvedValueOnce(mockTimesheets);
      timesheetDelegate.count.mockResolvedValueOnce(1);

      const result = await service.getReport(
        { page: 1, limit: 10 } as QueryTimesheetDto,
        mockAdminUser,
      );
      expect(result.data.length).toEqual(1);
      expect(result.total).toEqual(1);
      expect(result.page).toEqual(1);
      expect(result.limit).toEqual(10);
    });

    it('should apply status and project filters to the report', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const mockTimesheets = [
        {
          id: 1,
          task: 'Test Task',
          project: 'Project X',
          status: 'APPROVED',
          date: new Date('2026-01-01'),
          hours: 8,
        },
      ];
      timesheetDelegate.findMany.mockResolvedValueOnce(mockTimesheets);
      timesheetDelegate.count.mockResolvedValueOnce(1);

      await service.getReport(
        { status: 'APPROVED', project: 'Project X' } as QueryTimesheetDto,
        mockAdminUser,
      );

      expect(timesheetDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 1,
            status: 'APPROVED',
            project: expect.objectContaining({
              contains: 'Project X',
              mode: 'insensitive',
            }),
          }),
        }),
      );
    });

    it('should apply dateFrom and dateTo filters', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const mockTimesheets = [
        {
          id: 1,
          task: 'Test Task',
          date: new Date('2026-01-15'),
          hours: 8,
          status: 'PENDING',
        },
      ];
      timesheetDelegate.findMany.mockResolvedValueOnce(mockTimesheets);
      timesheetDelegate.count.mockResolvedValueOnce(1);

      await service.getReport(
        { dateFrom: '2026-01-01', dateTo: '2026-01-31' } as QueryTimesheetDto,
        mockAdminUser,
      );

      expect(timesheetDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 1,
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should apply search filter across task, project, and notes', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const mockTimesheets = [
        {
          id: 1,
          task: 'Test Task',
          project: 'Test Project',
          notes: 'Test Notes',
          date: new Date('2026-01-01'),
          hours: 8,
          status: 'PENDING',
        },
      ];
      timesheetDelegate.findMany.mockResolvedValueOnce(mockTimesheets);
      timesheetDelegate.count.mockResolvedValueOnce(1);

      await service.getReport(
        { search: 'Test' } as QueryTimesheetDto,
        mockAdminUser,
      );

      expect(timesheetDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 1,
            OR: expect.arrayContaining([
              expect.objectContaining({
                task: expect.objectContaining({
                  contains: 'Test',
                  mode: 'insensitive',
                }),
              }),
              expect.objectContaining({
                project: expect.objectContaining({
                  contains: 'Test',
                  mode: 'insensitive',
                }),
              }),
              expect.objectContaining({
                notes: expect.objectContaining({
                  contains: 'Test',
                  mode: 'insensitive',
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('should throw ForbiddenException if user has no organizationId', async () => {
      await expect(
        service.create(
          {
            task: 'Test Task',
            date: '2026-01-01',
            hours: 8,
          } as CreateTimesheetDto,
          createMockAuthUser(Role.ADMIN, { organizationId: null }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create timesheet successfully for admin', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      timesheetDelegate.create.mockResolvedValueOnce({
        id: 1,
        task: 'Test Task',
      });

      const result = await service.create(
        {
          task: 'Test Task',
          date: '2026-01-01',
          hours: 8,
        } as CreateTimesheetDto,
        mockAdminUser,
      );
      expect(result).toEqual({ id: 1, task: 'Test Task' });
      expect(timesheetDelegate.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('importRecords', () => {
    it('should import valid records and skip invalid ones', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const records = [
        { task: 'Valid Task', date: '2026-01-01', hours: 8 },
        { invalid: 'no task' },
      ];
      timesheetDelegate.create.mockResolvedValueOnce({ id: 1 });

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
    });

    it('should throw error if no task', async () => {
      const _timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const records = [{ task: '', date: '2026-01-01', hours: 8 }];

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(0);
      expect(result.errors[0]).toContain("'task' is required");
    });

    it('should throw error if no date', async () => {
      const _timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const records = [{ task: 'Valid Task', date: '', hours: 8 }];

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(0);
      expect(result.errors[0]).toContain("'date' is required");
    });

    it('should throw error if no hours', async () => {
      const _timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const records = [{ task: 'Valid Task', date: '2026-01-01', hours: 0 }];

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(0);
      expect(result.errors[0]).toContain("'hours' is required");
    });

    it('should handle errors when create fails', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const records = [{ task: 'Valid Task', date: '2026-01-01', hours: 8 }];
      timesheetDelegate.create.mockRejectedValueOnce(new Error('Invalid data'));

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(0);
      expect(result.errors[0]).toContain('Invalid data');
    });
  });
});
