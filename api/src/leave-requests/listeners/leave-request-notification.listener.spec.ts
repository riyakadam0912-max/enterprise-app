import { LeaveRequestNotificationListener } from './leave-request-notification.listener';

describe('LeaveRequestNotificationListener', () => {
  it('includes the organization id when creating manager notifications and uses the manager email for the email', async () => {
    const notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    const mailService = {
      sendLeaveRequestNotification: jest.fn().mockResolvedValue(undefined),
    };

    const prisma = { user: { findMany: jest.fn().mockResolvedValue([]) } };
    const emailService = {
      sendLeaveApproved: jest.fn().mockResolvedValue(undefined),
      sendLeaveRejected: jest.fn().mockResolvedValue(undefined),
    };

    const listener = new LeaveRequestNotificationListener(
      notificationsService as any,
      mailService as any,
      prisma as any,
      emailService as any,
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

  it('falls back to active organization admins when no manager is assigned', async () => {
    const notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const mailService = {
      sendLeaveRequestNotification: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 20, name: 'Org Admin', email: 'admin@example.com' },
          ]),
      },
    };
    const emailService = {
      sendLeaveApproved: jest.fn(),
      sendLeaveRejected: jest.fn(),
    };
    const listener = new LeaveRequestNotificationListener(
      notificationsService as any,
      mailService as any,
      prisma as any,
      emailService as any,
    );

    await listener.handleLeaveRequested({
      leaveRequestId: 13,
      employeeId: 6,
      employeeName: 'No Manager Employee',
      employeeEmail: 'employee@example.com',
      managerId: null,
      managerName: null,
      managerEmail: null,
      leaveType: 'CASUAL',
      startDate: new Date('2026-02-10'),
      endDate: new Date('2026-02-10'),
      organizationId: 42,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'ADMIN', organizationId: 42 }),
      }),
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 20 }),
      42,
    );
    expect(mailService.sendLeaveRequestNotification).toHaveBeenCalledWith(
      'admin@example.com',
      'Org Admin',
      'No Manager Employee',
      'CASUAL',
      expect.any(Date),
      expect.any(Date),
      undefined,
    );
  });

  it('emails and notifies the employee when leave is rejected', async () => {
    const notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const mailService = { sendLeaveRequestNotification: jest.fn() };
    const prisma = { user: { findMany: jest.fn() } };
    const emailService = {
      sendLeaveApproved: jest.fn(),
      sendLeaveRejected: jest.fn().mockResolvedValue(undefined),
    };
    const listener = new LeaveRequestNotificationListener(
      notificationsService as any,
      mailService as any,
      prisma as any,
      emailService as any,
    );

    await listener.handleLeaveRejected({
      leaveRequestId: 14,
      employeeUserId: 30,
      employeeName: 'Alice',
      employeeEmail: 'alice@example.com',
      leaveType: 'SICK',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-02'),
      organizationId: 42,
      decidedByName: 'MANAGER:8',
      reason: 'Coverage unavailable',
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 30,
        message: expect.stringContaining('Coverage unavailable'),
      }),
      42,
    );
    expect(emailService.sendLeaveRejected).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'alice@example.com',
        rejectionReason: 'Coverage unavailable',
      }),
    );
  });
});
