import { LeaveRequestNotificationListener } from './leave-request-notification.listener';

describe('LeaveRequestNotificationListener', () => {
  it('includes the organization id when creating manager notifications and uses the manager email for the email', async () => {
    const notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    const mailService = {
      sendLeaveRequestNotification: jest.fn().mockResolvedValue(undefined),
    };

    const listener = new LeaveRequestNotificationListener(
      notificationsService as any,
      mailService as any,
    );

    const event = {
      leaveRequestId: 12,
      employeeId: 5,
      employeeName: 'Alice',
      employeeEmail: 'alice@example.com',
      managerId: 8,
      managerName: 'Bob',
      managerEmail: 'bob@example.com',
      leaveType: 'SICK',
      startDate: new Date('2026-01-10'),
      endDate: new Date('2026-01-12'),
      reason: 'Flu',
      organizationId: 42,
    };

    await (listener as any).createManagerNotification(event);
    await (listener as any).sendManagerEmail(event);

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 8,
      }),
      42,
    );

    expect(mailService.sendLeaveRequestNotification).toHaveBeenCalledWith(
      'bob@example.com',
      'Bob',
      'Alice',
      'SICK',
      expect.any(Date),
      expect.any(Date),
      'Flu',
    );
  });
});
