import { AttendanceService } from './attendance.service';

describe('Attendance scheduled reminders', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ['2026-11-23T04:30:00.000Z', 'CHECK_IN_10', []],
    ['2026-11-23T08:30:00.000Z', 'CHECK_IN_14', []],
    [
      '2026-11-23T13:30:00.000Z',
      'CHECK_OUT_19',
      [
        {
          employeeId: 5,
          checkIn: new Date('2026-11-23T04:00:00.000Z'),
          checkOut: null,
        },
      ],
    ],
  ])(
    'sends %s attendance reminders once to eligible employees',
    async (now, expectedReminder, attendanceRows) => {
      jest.useFakeTimers().setSystemTime(new Date(now));
      const prisma = {
        notification: { findFirst: jest.fn().mockResolvedValue(null) },
        holiday: { findMany: jest.fn().mockResolvedValue([]) },
        employee: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 5,
              hireDate: new Date('2025-01-01T00:00:00.000Z'),
              user: { id: 50 },
              shiftAssignments: [],
              shift: {
                id: 1,
                name: 'Day',
                type: 'FIXED',
                startTime: '09:00',
                endTime: '18:00',
                requiredHours: 8,
                minPresentHours: 5,
                gracePeriodMinutes: 15,
                weeklyHolidayDay: 0,
                workingDays: [1, 2, 3, 4, 5],
              },
            },
          ]),
        },
        attendance: { findMany: jest.fn().mockResolvedValue(attendanceRows) },
        attendanceSession: { findMany: jest.fn().mockResolvedValue([]) },
        leaveRequest: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const notificationsService = {
        sendNotification: jest.fn().mockResolvedValue(undefined),
      };
      const service = new AttendanceService(
        prisma as any,
        { del: jest.fn() } as any,
        {} as any,
        {
          getOrganizationFamilyRootMap: jest
            .fn()
            .mockResolvedValue(new Map([[1, null]])),
        } as any,
        {} as any,
        notificationsService as any,
      );

      const result = await (service as any).sendScheduledAttendanceReminders([
        { id: 1, name: 'Example Org', timezone: 'Asia/Calcutta' },
      ]);

      expect(result).toEqual([
        expect.objectContaining({
          reminder: expectedReminder,
          recipients: 1,
          status: 'SENT',
        }),
      ]);
      expect(notificationsService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientIds: [50],
          channels: ['IN_APP', 'EMAIL'],
          metadata: expect.objectContaining({ reminder: expectedReminder }),
        }),
      );
    },
  );

  it('does not duplicate a reminder already sent for the local day', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-23T04:30:00.000Z'));
    const prisma = {
      notification: { findFirst: jest.fn().mockResolvedValue({ id: 99 }) },
      holiday: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const notificationsService = { sendNotification: jest.fn() };
    const service = new AttendanceService(
      prisma as any,
      { del: jest.fn() } as any,
      {} as any,
      {
        getOrganizationFamilyRootMap: jest
          .fn()
          .mockResolvedValue(new Map([[1, null]])),
      } as any,
      {} as any,
      notificationsService as any,
    );

    const result = await (service as any).sendScheduledAttendanceReminders([
      { id: 1, name: 'Example Org', timezone: 'Asia/Calcutta' },
    ]);

    expect(result[0].status).toBe('SKIPPED');
    expect(notificationsService.sendNotification).not.toHaveBeenCalled();
  });
});
