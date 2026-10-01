import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EmployeeSelfServiceService } from './employee-self-service.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/types/auth';
import {
  createMockPrismaService,
  getMockPrismaDelegate,
} from '../../test/helpers/mocks.helper';

describe('EmployeeSelfServiceService', () => {
  let service: EmployeeSelfServiceService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  const createUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
    id: 7,
    userId: 7,
    email: 'abc@gmail.com',
    name: 'Employee User',
    role: Role.EMPLOYEE,
    roles: [Role.EMPLOYEE],
    permissions: [],
    employeeId: null,
    organizationId: 2,
    tokenType: 'access',
    jti: null,
    ...overrides,
  });

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeSelfServiceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EmployeeSelfServiceService>(
      EmployeeSelfServiceService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves a linked employee only within the current organization and active records', async () => {
    const user = createUser();
    const userDelegate = getMockPrismaDelegate(mockPrisma, 'user');
    const employeeDelegate = getMockPrismaDelegate(mockPrisma, 'employee');

    userDelegate.findUnique.mockResolvedValue({
      id: user.id,
      organizationId: 2,
    });
    employeeDelegate.findFirst.mockResolvedValue({
      id: 22,
      email: user.email,
      organizationId: 2,
      deletedAt: null,
    });
    userDelegate.update.mockResolvedValue({
      id: user.id,
      employeeId: 22,
      organizationId: 2,
    });

    const result = await (service as any).resolveEmployeeId(user);

    expect(result).toBe(22);
    expect(employeeDelegate.findFirst).toHaveBeenCalledWith({
      where: {
        email: user.email,
        organizationId: 2,
        deletedAt: null,
      },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    expect(userDelegate.update).toHaveBeenCalledWith({
      where: { id: user.userId || user.id },
      data: { employeeId: 22 },
    });
  });

  it('records ESS check-ins late according to the organization timezone', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-13T03:46:00.000Z'));
    const user = createUser({ employeeId: 22 });
    const employeeDelegate = getMockPrismaDelegate(mockPrisma, 'employee');
    const organizationDelegate = getMockPrismaDelegate(mockPrisma, 'organization');
    const shiftDelegate = getMockPrismaDelegate(mockPrisma, 'shift');
    const attendanceDelegate = getMockPrismaDelegate(mockPrisma, 'attendance');

    employeeDelegate.findFirst.mockResolvedValue({ id: 22 });
    employeeDelegate.findUnique.mockResolvedValue({ id: 22, shiftId: 5 });
    organizationDelegate.findUnique.mockResolvedValue({ timezone: 'Asia/Kolkata' });
    attendanceDelegate.findUnique.mockResolvedValue(null);
    shiftDelegate.findUnique.mockResolvedValue({
      type: 'FIXED',
      name: 'Day',
      startTime: '09:00',
      endTime: '17:00',
      gracePeriodMinutes: 15,
      weeklyHolidayDay: 0,
    });
    attendanceDelegate.upsert.mockResolvedValue({
      checkIn: new Date('2026-03-13T03:46:00.000Z'),
      lateMinutes: 1,
    });

    const result = await service.checkIn(user);

    expect(attendanceDelegate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          date: new Date('2026-03-13T00:00:00.000Z'),
          lateMinutes: 1,
          status: 'PRESENT',
        }),
      }),
    );
    expect(result.data.lateMinutes).toBe(1);
  });

  it('sets ESS half-day status from hours worked at checkout', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-13T06:46:00.000Z'));
    const user = createUser({ employeeId: 22 });
    const employeeDelegate = getMockPrismaDelegate(mockPrisma, 'employee');
    const organizationDelegate = getMockPrismaDelegate(mockPrisma, 'organization');
    const attendanceDelegate = getMockPrismaDelegate(mockPrisma, 'attendance');

    employeeDelegate.findFirst.mockResolvedValue({ id: 22 });
    employeeDelegate.findUnique.mockResolvedValue({ id: 22 });
    organizationDelegate.findUnique.mockResolvedValue({ timezone: 'Asia/Kolkata' });
    attendanceDelegate.findUnique.mockResolvedValue({
      id: 4,
      checkIn: new Date('2026-03-13T03:46:00.000Z'),
      checkOut: null,
      shift: { requiredHours: 8, minPresentHours: 5 },
    });
    attendanceDelegate.update.mockResolvedValue({
      checkIn: new Date('2026-03-13T03:46:00.000Z'),
      checkOut: new Date('2026-03-13T06:46:00.000Z'),
      workingHours: 3,
      overtimeHours: 0,
      lateMinutes: 1,
    });

    await service.checkOut(user);

    expect(attendanceDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workingHours: 3,
          status: 'HALF_DAY',
          shortfallHours: 5,
        }),
      }),
    );
  });
});
