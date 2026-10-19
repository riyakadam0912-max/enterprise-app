import { Test, TestingModule } from '@nestjs/testing';
import { TimesheetsService } from './timesheets.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  createMockPrismaService,
  DelegateMock,
} from '../../test/helpers/mocks.helper';
import { Role } from '../common/enums/role.enum';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { QueryTimesheetDto } from './dto/query-timesheet.dto';
import { OrganizationScopeService } from '../organizations/organization-scope.service';
import { AttendanceTaskHoursService } from './attendance-task-hours.service';

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
  let mockAttendanceTaskHours: { recomputeTimesheetHours: jest.Mock };

  const mockAdminUser = createMockAuthUser(Role.ADMIN, { userId: 1 });
  const _mockManagerUser = createMockAuthUser(Role.MANAGER, { userId: 2 });
  const _mockEmployeeUser = createMockAuthUser(Role.EMPLOYEE, {
    userId: 3,
    employeeId: 101,
  });

  beforeEach(async () => {
    // Create fresh mocks for each test!
    mockPrisma = createMockPrismaService();
    mockPrisma.$transaction.mockImplementation(
      (operation: (transaction: typeof mockPrisma) => unknown) =>
        operation(mockPrisma),
    );
    getPrismaDelegate(mockPrisma, 'employee').findFirst.mockResolvedValue({
      id: 101,
    });
    mockAttendanceTaskHours = {
      recomputeTimesheetHours: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimesheetsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: AttendanceTaskHoursService,
          useValue: mockAttendanceTaskHours,
        },
        {
          provide: OrganizationScopeService,
          useValue: { getOrganizationIds: jest.fn().mockResolvedValue([1]) },
        },
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
          source: 'TASK_TIMER',
        },
      ];
      timesheetDelegate.findMany.mockResolvedValueOnce(mockTimesheets);
      timesheetDelegate.count.mockResolvedValueOnce(1);

      const result = await service.getReport(
        { page: 1, limit: 10 } as QueryTimesheetDto,
        mockAdminUser,
      );
      expect(result.data.length).toEqual(1);
      expect(result.data[0].source).toEqual('TASK_TIMER');
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
            AND: expect.arrayContaining([
              expect.objectContaining({
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
            ]),
          }),
        }),
      );
    });

    it('includes employee-attributed entries in an employee report', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      timesheetDelegate.findMany.mockResolvedValueOnce([]);
      timesheetDelegate.count.mockResolvedValueOnce(0);

      await service.getReport({} as QueryTimesheetDto, _mockEmployeeUser);

      expect(timesheetDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { createdByUserId: _mockEmployeeUser.userId },
              { employeeId: _mockEmployeeUser.employeeId },
            ],
          }),
        }),
      );
    });

    it('restricts manager reports to their own entries and managed projects, including with search', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      timesheetDelegate.findMany.mockResolvedValueOnce([]);
      timesheetDelegate.count.mockResolvedValueOnce(0);

      await service.getReport(
        { search: 'design' } as QueryTimesheetDto,
        _mockManagerUser,
      );

      expect(timesheetDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { createdByUserId: _mockManagerUser.userId },
              {
                createdByUser: {
                  OR: expect.arrayContaining([
                    { managerId: _mockManagerUser.userId },
                    {
                      reportingManagers: {
                        some: { managerId: _mockManagerUser.userId },
                      },
                    },
                  ]),
                },
              },
              { projectRef: { managerId: _mockManagerUser.userId } },
              {
                projectRef: {
                  coManagers: { some: { id: _mockManagerUser.userId } },
                },
              },
            ]),
            AND: expect.arrayContaining([
              expect.objectContaining({ OR: expect.any(Array) }),
            ]),
          }),
        }),
      );
    });

    it('returns the attributed employee separately from the creator', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      timesheetDelegate.findMany.mockResolvedValueOnce([
        {
          id: 3,
          task: 'Test Task',
          date: new Date('2026-01-01'),
          hours: 2,
          status: 'PENDING',
          createdByUserId: 9,
          createdByUser: { id: 9, name: 'Ava Worker' },
          employeeId: 101,
          employee: { id: 101, name: 'Sam Employee' },
        },
      ]);
      timesheetDelegate.count.mockResolvedValueOnce(1);

      const result = await service.getReport(
        {} as QueryTimesheetDto,
        mockAdminUser,
      );

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          employeeId: 101,
          employee: { id: 101, name: 'Sam Employee' },
          createdByUserId: 9,
          createdByUser: { id: 9, name: 'Ava Worker' },
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
            employeeId: 101,
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
          employeeId: 101,
        } as CreateTimesheetDto,
        mockAdminUser,
      );
      expect(result).toEqual({ id: 1, task: 'Test Task' });
      expect(timesheetDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 1,
            createdByUserId: mockAdminUser.userId,
            status: 'PENDING',
            source: 'MANUAL',
          }),
        }),
      );
      expect(
        mockAttendanceTaskHours.recomputeTimesheetHours,
      ).toHaveBeenCalledWith(101, 1, new Date('2026-01-01'), mockPrisma);
    });

    it('rejects a project from another organization', async () => {
      const projectDelegate = getPrismaDelegate(mockPrisma, 'project');
      projectDelegate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.create(
          {
            task: 'Cross organization project',
            projectId: 22,
            date: '2026-01-01',
            hours: 2,
          } as CreateTimesheetDto,
          mockAdminUser,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(
        getPrismaDelegate(mockPrisma, 'timesheet').create,
      ).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it("prevents employees from editing another user's timesheet", async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      timesheetDelegate.findFirst.mockResolvedValueOnce({
        id: 5,
        organizationId: 1,
        createdByUserId: 9,
        status: 'PENDING',
        date: new Date('2026-01-01'),
      });

      await expect(
        service.update(5, { hours: 2 }, _mockEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
      expect(timesheetDelegate.updateMany).not.toHaveBeenCalled();
    });

    it('prevents editing a submitted timesheet', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      timesheetDelegate.findFirst.mockResolvedValueOnce({
        id: 5,
        organizationId: 1,
        createdByUserId: _mockEmployeeUser.userId,
        status: 'SUBMITTED',
        date: new Date('2026-01-01'),
      });

      await expect(
        service.update(5, { hours: 2 }, _mockEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
      expect(timesheetDelegate.updateMany).not.toHaveBeenCalled();
    });

    it('moves credited hours when a pending entry changes dates', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const draft = {
        id: 5,
        organizationId: 1,
        createdByUserId: _mockEmployeeUser.userId,
        employeeId: 101,
        status: 'PENDING',
        date: new Date('2026-01-01'),
        hours: 2,
      };
      timesheetDelegate.findFirst
        .mockResolvedValueOnce(draft)
        .mockResolvedValueOnce({
          ...draft,
          date: new Date('2026-01-02'),
        });
      timesheetDelegate.updateMany.mockResolvedValueOnce({ count: 1 });

      await service.update(5, { date: '2026-01-02' }, _mockEmployeeUser);

      expect(
        mockAttendanceTaskHours.recomputeTimesheetHours,
      ).toHaveBeenNthCalledWith(1, 101, 1, new Date('2026-01-01'), mockPrisma);
      expect(
        mockAttendanceTaskHours.recomputeTimesheetHours,
      ).toHaveBeenNthCalledWith(2, 101, 1, new Date('2026-01-02'), mockPrisma);
    });

    it('updates only a draft and returns the refreshed entry', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const draft = {
        id: 5,
        organizationId: 1,
        createdByUserId: _mockEmployeeUser.userId,
        employeeId: 101,
        status: 'PENDING',
        date: new Date('2026-01-01'),
        hours: 2,
      };
      timesheetDelegate.findFirst
        .mockResolvedValueOnce(draft)
        .mockResolvedValueOnce({ ...draft, hours: 3 });
      timesheetDelegate.updateMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.update(5, { hours: 3 }, _mockEmployeeUser);

      expect(result.hours).toBe(3);
      expect(
        mockAttendanceTaskHours.recomputeTimesheetHours,
      ).toHaveBeenCalledWith(101, 1, new Date('2026-01-01'), mockPrisma);
      expect(timesheetDelegate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
            createdByUserId: _mockEmployeeUser.userId,
          }),
          data: { hours: 3 },
        }),
      );
    });
  });

  describe('submit and review', () => {
    it('allows the owner to submit a rejected entry for review again', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const rejected = {
        id: 5,
        organizationId: 1,
        createdByUserId: _mockEmployeeUser.userId,
        employeeId: 101,
        status: 'REJECTED',
        date: new Date('2026-01-01'),
      };
      timesheetDelegate.findFirst
        .mockResolvedValueOnce(rejected)
        .mockResolvedValueOnce({ ...rejected, status: 'SUBMITTED' });
      timesheetDelegate.updateMany.mockResolvedValueOnce({ count: 1 });

      await service.submit(5, _mockEmployeeUser);

      expect(timesheetDelegate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'REJECTED' }),
          data: expect.objectContaining({
            status: 'SUBMITTED',
            submittedAt: expect.any(Date),
          }),
        }),
      );
      expect(
        timesheetDelegate.updateMany.mock.calls[0][0].data,
      ).not.toHaveProperty('rejectionReason');
      expect(
        mockAttendanceTaskHours.recomputeTimesheetHours,
      ).toHaveBeenCalledWith(101, 1, new Date('2026-01-01'), mockPrisma);
    });

    it('allows only the owner to submit an entry', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      timesheetDelegate.findFirst.mockResolvedValueOnce({
        id: 5,
        organizationId: 1,
        createdByUserId: 9,
        status: 'PENDING',
        date: new Date('2026-01-01'),
      });

      await expect(service.submit(5, mockAdminUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(timesheetDelegate.updateMany).not.toHaveBeenCalled();
    });

    it('does not allow approved entries to be resubmitted', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      timesheetDelegate.findFirst.mockResolvedValueOnce({
        id: 5,
        organizationId: 1,
        createdByUserId: _mockEmployeeUser.userId,
        status: 'APPROVED',
        date: new Date('2026-01-01'),
      });

      await expect(service.submit(5, _mockEmployeeUser)).rejects.toThrow(
        BadRequestException,
      );
      expect(timesheetDelegate.updateMany).not.toHaveBeenCalled();
    });

    it('requires a reason when rejecting a submitted entry', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      timesheetDelegate.findFirst.mockResolvedValueOnce({
        id: 5,
        organizationId: 1,
        createdByUserId: _mockEmployeeUser.userId,
        employeeId: 101,
        status: 'SUBMITTED',
        date: new Date('2026-01-01'),
      });

      await expect(
        service.review(
          5,
          { decision: 'REJECTED' },
          createMockAuthUser(Role.MANAGER, { userId: 2 }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(timesheetDelegate.updateMany).not.toHaveBeenCalled();
    });

    it('prevents a manager from reviewing their own timesheet', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const manager = createMockAuthUser(Role.MANAGER, { userId: 2 });
      timesheetDelegate.findFirst.mockResolvedValueOnce({
        id: 5,
        organizationId: 1,
        createdByUserId: manager.userId,
        status: 'SUBMITTED',
        date: new Date('2026-01-01'),
      });

      await expect(
        service.review(5, { decision: 'APPROVED' }, manager),
      ).rejects.toThrow(ForbiddenException);
      expect(timesheetDelegate.updateMany).not.toHaveBeenCalled();
    });

    it('records the reviewer and decision when approving a submitted entry', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      timesheetDelegate.findFirst
        .mockResolvedValueOnce({
          id: 5,
          organizationId: 1,
          createdByUserId: _mockEmployeeUser.userId,
          status: 'SUBMITTED',
          date: new Date('2026-01-01'),
        })
        .mockResolvedValueOnce({
          id: 5,
          organizationId: 1,
          createdByUserId: _mockEmployeeUser.userId,
          status: 'APPROVED',
          date: new Date('2026-01-01'),
        });
      timesheetDelegate.updateMany.mockResolvedValueOnce({ count: 1 });

      await service.review(
        5,
        { decision: 'APPROVED' },
        createMockAuthUser(Role.MANAGER, { userId: 2 }),
      );

      expect(timesheetDelegate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SUBMITTED' }),
          data: expect.objectContaining({
            status: 'APPROVED',
            reviewedByUserId: 2,
            reviewedAt: expect.any(Date),
            rejectionReason: null,
          }),
        }),
      );
    });

    it('removes rejected submitted hours from attendance task hours', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const submitted = {
        id: 5,
        organizationId: 1,
        createdByUserId: _mockEmployeeUser.userId,
        employeeId: 101,
        status: 'SUBMITTED',
        date: new Date('2026-01-01'),
        hours: 2.5,
      };
      timesheetDelegate.findFirst
        .mockResolvedValueOnce(submitted)
        .mockResolvedValueOnce({ ...submitted, status: 'REJECTED' });
      timesheetDelegate.updateMany.mockResolvedValueOnce({ count: 1 });

      await service.review(
        5,
        { decision: 'REJECTED', reason: 'Incorrect hours' },
        createMockAuthUser(Role.MANAGER, { userId: 2 }),
      );

      expect(
        mockAttendanceTaskHours.recomputeTimesheetHours,
      ).toHaveBeenCalledWith(101, 1, new Date('2026-01-01'), mockPrisma);
    });
  });

  describe('importRecords', () => {
    it('should import valid records and skip invalid ones', async () => {
      const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
      const records = [
        { task: 'Valid Task', date: '2026-01-01', hours: 8, employeeId: 101 },
        { invalid: 'no task' },
      ];
      timesheetDelegate.create.mockResolvedValueOnce({ id: 1 });

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(1);
      expect(result.errors.length).toEqual(1);
      expect(timesheetDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            source: 'IMPORT',
          }),
        }),
      );
      expect(
        mockAttendanceTaskHours.recomputeTimesheetHours,
      ).toHaveBeenCalledWith(101, 1, new Date('2026-01-01'), mockPrisma);
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
      const records = [
        { task: 'Valid Task', date: '2026-01-01', hours: 8, employeeId: 101 },
      ];
      timesheetDelegate.create.mockRejectedValueOnce(new Error('Invalid data'));

      const result = await service.importRecords(records, mockAdminUser);
      expect(result.imported).toEqual(0);
      expect(result.errors[0]).toContain('Invalid data');
    });

    describe('remove', () => {
      it('removes credited hours when a pending entry is deleted', async () => {
        const timesheetDelegate = getPrismaDelegate(mockPrisma, 'timesheet');
        timesheetDelegate.findFirst.mockResolvedValueOnce({
          id: 5,
          organizationId: 1,
          createdByUserId: _mockEmployeeUser.userId,
          employeeId: 101,
          status: 'PENDING',
          date: new Date('2026-01-01'),
          hours: 2,
        });
        timesheetDelegate.updateMany.mockResolvedValueOnce({ count: 1 });

        await service.remove(5, _mockEmployeeUser);

        expect(timesheetDelegate.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { deletedAt: expect.any(Date) },
          }),
        );
        expect(
          mockAttendanceTaskHours.recomputeTimesheetHours,
        ).toHaveBeenCalledWith(101, 1, new Date('2026-01-01'), mockPrisma);
      });
    });
  });
});
