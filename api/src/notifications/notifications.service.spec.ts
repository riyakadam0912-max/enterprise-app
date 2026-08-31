import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationTemplateService } from './notification-template.service';
import { MailService } from '../mail/mail.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: { create: jest.Mock };
    notificationRecipient: { createMany: jest.Mock; findMany: jest.Mock };
    notificationDeliveryLog: { createMany: jest.Mock };
    user: { findUnique: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      notification: { create: jest.fn() },
      notificationRecipient: { createMany: jest.fn(), findMany: jest.fn() },
      notificationDeliveryLog: { createMany: jest.fn() },
      user: { findUnique: jest.fn(), findMany: jest.fn() },
    };

    service = new NotificationsService(
      prisma as unknown as PrismaService,
      {
        emit: jest.fn(),
        sendToUser: jest.fn(),
      } as unknown as NotificationsGateway,
      {} as NotificationTemplateService,
      {} as MailService,
      { logCustomAction: jest.fn() } as unknown as AuditLogsService,
    );
  });

  it('resolves organizationId from the user when none is provided', async () => {
    prisma.user.findUnique.mockResolvedValue({ organizationId: 7 });
    prisma.notification.create.mockResolvedValue({ id: 1 });
    prisma.notificationRecipient.createMany.mockResolvedValue({ count: 1 });
    prisma.notificationRecipient.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    jest
      .spyOn(
        service as never as { getUserPreferencesForRecipients: jest.Mock },
        'getUserPreferencesForRecipients',
      )
      .mockResolvedValue(new Map());

    const result = await service.sendNotification({
      userId: 42,
      recipientIds: [42],
      title: 'Task approved',
      message: 'Your task was approved',
    });

    expect(result).toEqual({ id: 1, recipients: [] });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      select: { organizationId: true },
    });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 7 }),
      }),
    );
  });

  it('returns empty notification counts when the user has no organization context', async () => {
    prisma.user.findUnique.mockResolvedValue({ organizationId: null });

    await expect(service.getCounts(42)).resolves.toEqual({
      unreadCount: 0,
      latestNotificationId: null,
      latestNotificationCreatedAt: null,
      latestReadAt: null,
      syncCursor: expect.any(String),
    });
  });
});
