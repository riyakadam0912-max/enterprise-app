import { ConflictException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { AttendanceService } from './attendance.service';

function createPrismaMock() {
  return {
    employee: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    attendance: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    leaveRequest: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AttendanceService(prisma as any);
  });

  it('allows an employee to check in once per day', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 7, name: 'Ava' });
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.leaveRequest.count.mockResolvedValue(0);
    prisma.attendance.create.mockResolvedValue({ id: 1, employeeId: 7, status: AttendanceStatus.PRESENT });

    const result = await service.checkIn({
      employeeId: 7,
      date: '2026-03-13',
      timestamp: '2026-03-13T09:00:00.000Z',
    });

    expect(result).toEqual({ id: 1, employeeId: 7, status: AttendanceStatus.PRESENT });
    expect(prisma.attendance.create).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate check-in attempts on the same day', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 7, name: 'Ava' });
    prisma.attendance.findUnique.mockResolvedValue({
      id: 10,
      employeeId: 7,
      checkIn: new Date('2026-03-13T09:00:00.000Z'),
    });

    await expect(service.checkIn({ employeeId: 7, date: '2026-03-13' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.attendance.create).not.toHaveBeenCalled();
  });

  it('updates working hours and status on check-out', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 7, name: 'Ava' });
    prisma.attendance.findUnique.mockResolvedValue({
      id: 10,
      employeeId: 7,
      date: new Date('2026-03-13T00:00:00.000Z'),
      checkIn: new Date('2026-03-13T09:00:00.000Z'),
      checkOut: null,
      workingHours: null,
      status: AttendanceStatus.PRESENT,
    });
    prisma.attendance.update.mockResolvedValue({
      id: 10,
      employeeId: 7,
      workingHours: 5,
      status: AttendanceStatus.PRESENT,
    });

    const result = await service.checkOut({
      employeeId: 7,
      date: '2026-03-13',
      timestamp: '2026-03-13T14:00:00.000Z',
    });

    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workingHours: 5,
          status: AttendanceStatus.PRESENT,
        }),
      }),
    );
    expect(result).toEqual({ id: 10, employeeId: 7, workingHours: 5, status: AttendanceStatus.PRESENT });
  });

  it('builds the daily attendance table with absent and leave statuses', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 1, name: 'Ava', department: 'Sales', designation: 'Executive' },
      { id: 2, name: 'Ben', department: 'HR', designation: 'Manager' },
      { id: 3, name: 'Cara', department: 'Ops', designation: 'Analyst' },
    ]);
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 101,
        employeeId: 1,
        checkIn: new Date('2026-03-13T09:00:00.000Z'),
        checkOut: new Date('2026-03-13T17:00:00.000Z'),
        workingHours: 8,
        status: AttendanceStatus.PRESENT,
      },
    ]);
    prisma.leaveRequest.findMany.mockResolvedValue([{ employeeId: 2 }]);

    const result = await service.getToday('2026-03-13');

    expect(result.summary).toEqual({ present: 1, absent: 1, leave: 1, halfDay: 0 });
    expect(result.rows.map((row) => [row.employee.name, row.status])).toEqual([
      ['Ava', AttendanceStatus.PRESENT],
      ['Ben', AttendanceStatus.LEAVE],
      ['Cara', AttendanceStatus.ABSENT],
    ]);
  });

  it('returns monthly employee attendance data for calendar rendering', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 4, name: 'Dina', department: 'Finance', designation: 'Lead' });
    prisma.attendance.findMany.mockResolvedValue([
      {
        id: 201,
        employeeId: 4,
        date: new Date('2026-03-02T00:00:00.000Z'),
        checkIn: new Date('2026-03-02T09:00:00.000Z'),
        checkOut: new Date('2026-03-02T18:00:00.000Z'),
        workingHours: 9,
        status: AttendanceStatus.PRESENT,
        createdAt: new Date('2026-03-02T09:00:00.000Z'),
      },
    ]);
    prisma.leaveRequest.findMany.mockResolvedValue([
      {
        employeeId: 4,
        startDate: new Date('2026-03-03T00:00:00.000Z'),
        endDate: new Date('2026-03-03T23:59:59.000Z'),
      },
    ]);

    const result = await service.getEmployeeAttendance(4, '2026-03');

    expect(result.month).toBe('2026-03');
    expect(result.days[1].status).toBe(AttendanceStatus.PRESENT);
    expect(result.days[2].status).toBe(AttendanceStatus.LEAVE);
    expect(result.summary.present).toBeGreaterThanOrEqual(1);
    expect(result.summary.leave).toBeGreaterThanOrEqual(1);
  });
});