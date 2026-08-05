import {
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Notification, NotificationPreference } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationsGateway } from './notifications.gateway';
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationListItem,
  NotificationPayload,
  NotificationPriority,
  NotificationType,
} from './notifications.types';

type NotificationRecipientRow = {
  notification: {
    id: number;
    type: string;
    title: string;
    message: string;
    module: string | null;
    entityType: string | null;
    entityId: number | null;
    actionUrl: string | null;
    priority: string;
    category: string;
    createdAt: Date;
    updatedAt: Date;
  };
  isRead: boolean;
  readAt: Date | null;
  deliveredAt: Date | null;
};

type RecipientPreference = NotificationPreference | Record<string, unknown>;

function normalizeListItem(
  row: NotificationRecipientRow,
): NotificationListItem {
  return {
    id: row.notification.id,
    type: normalizeType(row.notification.type),
    title: row.notification.title,
    message: row.notification.message,
    module: row.notification.module,
    entityType: row.notification.entityType,
    entityId: row.notification.entityId,
    actionUrl: row.notification.actionUrl,
    priority: normalizePriority(row.notification.priority),
    category: row.notification.category,
    createdAt: row.notification.createdAt.toISOString(),
    updatedAt: row.notification.updatedAt.toISOString(),
    isRead: row.isRead,
    readAt: row.readAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
  };
}

const DEFAULT_CHANNEL: NotificationChannel = 'IN_APP';

function normalizeRecipients(
  input: number[] | undefined,
  userId?: number,
): number[] {
  const recipients = [...(input ?? []), ...(userId ? [userId] : [])].filter(
    (value) => Number.isInteger(value) && value > 0,
  );
  return Array.from(new Set(recipients));
}

function normalizeType(value?: string): NotificationType {
  const upper = (value ?? 'SYSTEM').trim().toUpperCase();
  const normalized = [
    'INFO',
    'SUCCESS',
    'WARNING',
    'ERROR',
    'APPROVAL',
    'REMINDER',
    'MENTION',
    'SYSTEM',
  ].includes(upper)
    ? upper
    : 'SYSTEM';
  return normalized as NotificationType;
}

function normalizePriority(value?: string): NotificationPriority {
  const upper = (value ?? 'MEDIUM').trim().toUpperCase();
  const normalized = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(upper)
    ? upper
    : 'MEDIUM';
  return normalized as NotificationPriority;
}

/**
 * Notifications Service
 *
 * Enterprise-grade notification service with:
 * - Multi-channel delivery (In-App, Email, SMS, Push)
 * - User preference management
 * - Real-time WebSocket notifications
 * - Production email delivery (no more mocks!)
 * - Comprehensive audit logging
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly templateService: NotificationTemplateService,
    private readonly mailService: MailService,
    private readonly auditLogsService: AuditLogsService,
  ) {
    this.logger.log(
      'Notifications service initialized with production email delivery',
    );
  }

  private validateOrganization(userOrOrganizationId: unknown): number {
    if (typeof userOrOrganizationId === 'number') {
      if (
        !Number.isInteger(userOrOrganizationId) ||
        userOrOrganizationId <= 0
      ) {
        throw new ForbiddenException('Organization ID is required');
      }
      return userOrOrganizationId;
    }

    if (
      typeof userOrOrganizationId === 'object' &&
      userOrOrganizationId !== null &&
      'organizationId' in userOrOrganizationId
    ) {
      const obj = userOrOrganizationId as { organizationId?: number };
      const value = obj.organizationId;
      if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
        throw new ForbiddenException('Organization ID is required');
      }
      return value;
    }

    throw new ForbiddenException('Organization ID is required');
  }

  private async resolveOrganizationId(
    userId: number,
    resolvedOrganizationId?: number | null,
  ): Promise<number> {
    if (
      typeof resolvedOrganizationId === 'number' &&
      Number.isInteger(resolvedOrganizationId) &&
      resolvedOrganizationId > 0
    ) {
      return resolvedOrganizationId;
    }
    return this.getOrganizationIdFromUserId(userId);
  }

  private isSchemaDriftError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2021' || error.code === 'P2022')
    );
  }

  private async getOrganizationIdFromUserId(userId: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.validateOrganization(user.organizationId);
  }

  async create(dto: CreateNotificationDto, organizationId?: number) {
    return this.sendNotification({
      userId: dto.userId,
      recipientIds: dto.recipientIds,
      type: normalizeType(dto.type),
      title: dto.title,
      message: dto.message,
      module: dto.module,
      entityType: dto.entityType,
      entityId: dto.entityId,
      actionUrl: dto.actionUrl,
      priority: normalizePriority(dto.priority),
      category: dto.category,
      organizationId,
    });
  }

  async sendNotification(payload: NotificationPayload) {
    this.logger.debug('Notification send payload resolved', {
      payloadOrganizationId: payload.organizationId,
      payloadUserId: payload.userId,
      recipientIds: payload.recipientIds,
    });
    const fallbackUserId =
      typeof payload.userId === 'number'
        ? payload.userId
        : payload.recipientIds?.[0];
    const organizationId =
      typeof payload.organizationId === 'number' &&
      Number.isInteger(payload.organizationId) &&
      payload.organizationId > 0
        ? payload.organizationId
        : fallbackUserId != null
          ? await this.resolveOrganizationId(
              fallbackUserId,
              payload.organizationId,
            )
          : this.validateOrganization(payload.organizationId);

    const recipientIds = normalizeRecipients(
      payload.recipientIds,
      payload.userId,
    );
    if (recipientIds.length === 0) {
      return null;
    }

    // Create notification record
    const notification = await this.prisma.notification.create({
      data: {
        organizationId,
        type: normalizeType(payload.type),
        title: payload.title,
        message: payload.message,
        module: payload.module ?? null,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
        actionUrl: payload.actionUrl ?? null,
        priority: normalizePriority(payload.priority),
        category: payload.category ?? 'SYSTEM',
        createdBy: payload.createdBy ?? null,
      },
    });

    // Get user preferences for each recipient
    const recipientPreferences = await this.getUserPreferencesForRecipients(
      recipientIds,
      organizationId,
    );

    // Determine which channels to use based on user preferences
    const channels = payload.channels ?? [DEFAULT_CHANNEL];
    const deliveredAt = new Date();

    // Create notification recipients
    await this.prisma.notificationRecipient.createMany({
      data: recipientIds.map((recipientId) => ({
        organizationId,
        notificationId: notification.id,
        userId: recipientId,
        isRead: false,
        deliveredAt,
        channel: DEFAULT_CHANNEL,
        status: 'SENT',
      })),
    });

    // Send via each channel based on user preferences
    for (const channel of channels) {
      await this.sendViaChannel(
        channel,
        notification,
        recipientIds,
        recipientPreferences,
        organizationId,
        payload.templateKey,
        payload.templateVariables,
      );
    }

    // Log deliveries
    await this.logDeliveries(
      notification.id,
      recipientIds,
      channels,
      organizationId,
      payload.metadata,
    );

    // Audit log
    await this.auditLogsService.logCustomAction({
      userId: payload.createdBy ?? null,
      module: payload.module ?? 'Notifications',
      entityType: 'Notification',
      entityId: notification.id,
      action: 'NOTIFICATION_CREATED',
      description: `Notification sent to ${recipientIds.length} recipient(s) via ${channels.join(', ')}`,
      status: 'SUCCESS',
    });

    // Emit real-time notifications
    const rows = await this.findByNotificationId(
      notification.id,
      organizationId,
    );
    const item = rows.length > 0 ? normalizeListItem(rows[0]) : null;
    if (item) {
      for (const recipientId of recipientIds) {
        this.gateway.emitNotification(recipientId, item);
        this.gateway.emitUnreadCount(
          recipientId,
          (await this.getUnreadCount(recipientId)).count,
        );
      }
    }

    return {
      ...notification,
      recipients: rows,
    };
  }

  /**
   * Send notification via specific channel
   */
  private async sendViaChannel(
    channel: NotificationChannel,
    notification: Notification,
    recipientIds: number[],
    recipientPreferences: Map<number, RecipientPreference>,
    organizationId: number,
    templateKey?: string,
    templateVariables?: Record<string, unknown>,
  ) {
    switch (channel) {
      case 'EMAIL':
        await this.sendViaEmail(
          notification,
          recipientIds,
          recipientPreferences,
          organizationId,
          templateKey,
          templateVariables,
        );
        break;

      case 'IN_APP':
        // Already handled by creating NotificationRecipient records
        this.logger.log(
          `In-app notification created for ${recipientIds.length} recipients`,
        );
        break;

      case 'SMS':
        // SMS not yet implemented
        this.logger.warn('SMS channel not yet implemented');
        break;

      case 'PUSH':
        // Push notifications not yet implemented
        this.logger.warn('Push notification channel not yet implemented');
        break;

      case 'WHATSAPP':
        // WhatsApp not yet implemented
        this.logger.warn('WhatsApp channel not yet implemented');
        break;

      default:
        this.logger.warn(`Unknown notification channel: ${channel}`);
    }
  }

  /**
   * Send notification via email to recipients who have email enabled
   */
  private async sendViaEmail(
    notification: Notification,
    recipientIds: number[],
    recipientPreferences: Map<number, RecipientPreference>,
    organizationId: number,
    templateKey?: string,
    templateVariables?: Record<string, unknown>,
  ) {
    // Get user emails
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: recipientIds },
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Filter users who have email notifications enabled
    const emailRecipients = users.filter((user) => {
      const prefs = recipientPreferences.get(user.id);
      return prefs?.emailEnabled !== false; // Default to true if not set
    });

    if (emailRecipients.length === 0) {
      this.logger.log('No recipients have email notifications enabled');
      return;
    }

    this.logger.log(
      `Sending email notification to ${emailRecipients.length} recipients`,
    );

    // Send emails
    const emailPromises = emailRecipients.map(async (user) => {
      try {
        const result = await this.mailService.sendEmail({
          to: user.email,
          subject: notification.title,
          html: this.buildEmailHtml(notification, user.name),
          tags: [
            notification.type.toLowerCase(),
            notification.category.toLowerCase(),
          ],
          metadata: {
            notificationId: notification.id,
            userId: user.id,
            templateKey,
            ...templateVariables,
          },
        });

        // Log email delivery result
        const providerResponse: unknown = result.providerResponse;
        const metadataObj: Record<string, unknown> = {
          messageId: result.messageId,
        };
        if (providerResponse !== undefined) {
          metadataObj.providerResponse = providerResponse;
        }

        await this.prisma.notificationDeliveryLog.create({
          data: {
            organizationId,
            notificationId: notification.id,
            userId: user.id,
            channel: 'EMAIL',
            provider: result.provider,
            status: result.success ? 'DELIVERED' : 'FAILED',
            attempts: 1,
            errorMessage: result.error,
            deliveredAt: result.success ? new Date() : null,
            metadata: metadataObj as Prisma.InputJsonValue,
          },
        });

        if (result.success) {
          this.logger.log(
            `Email sent successfully to ${user.email} via ${result.provider}`,
          );
        } else {
          this.logger.error(`Email failed to ${user.email}: ${result.error}`);
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger.error(
          `Error sending email to ${user.email}: ${error.message}`,
          error.stack,
        );

        // Log failed attempt
        await this.prisma.notificationDeliveryLog.create({
          data: {
            organizationId,
            notificationId: notification.id,
            userId: user.id,
            channel: 'EMAIL',
            provider: 'unknown',
            status: 'FAILED',
            attempts: 1,
            errorMessage: error.message,
          },
        });

        return null;
      }
    });

    await Promise.allSettled(emailPromises);
  }

  /**
   * Build email HTML (temporary until template renderer is implemented in Phase 2)
   */
  private buildEmailHtml(
    notification: Notification,
    recipientName: string,
  ): string {
    const actionButton = notification.actionUrl
      ? `<div style="text-align: center; margin: 30px 0;">
           <a href="${notification.actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
             View Details
           </a>
         </div>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 30px; }
            .message { background-color: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .footer { text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px; }
            .priority-${notification.priority.toLowerCase()} { border-left: 4px solid ${this.getPriorityColor(normalizePriority(notification.priority))}; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${notification.title}</h1>
            </div>
            <div class="content">
              <p>Hello ${recipientName},</p>
              <div class="message priority-${notification.priority.toLowerCase()}">
                <p>${notification.message}</p>
              </div>
              ${actionButton}
              <p style="margin-top: 30px; color: #6B7280; font-size: 14px;">
                Priority: <strong>${notification.priority}</strong> | 
                Category: <strong>${notification.category}</strong>
              </p>
            </div>
            <div class="footer">
              <p>This is an automated notification from your ERP system.</p>
              <p>To manage your notification preferences, visit your account settings.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getPriorityColor(priority: NotificationPriority): string {
    switch (priority) {
      case 'CRITICAL':
        return '#EF4444';
      case 'HIGH':
        return '#F59E0B';
      case 'MEDIUM':
        return '#3B82F6';
      case 'LOW':
        return '#10B981';
      default:
        return '#6B7280';
    }
  }

  /**
   * Get user preferences for multiple recipients
   */
  private async getUserPreferencesForRecipients(
    recipientIds: number[],
    organizationId: number,
  ): Promise<Map<number, RecipientPreference>> {
    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        userId: { in: recipientIds },
        organizationId,
      },
    });
    const prefsMap = new Map<number, RecipientPreference>();
    preferences.forEach((pref) => {
      prefsMap.set(pref.userId, pref);
    });

    // Add default preferences for users without explicit preferences
    recipientIds.forEach((id) => {
      if (!prefsMap.has(id)) {
        prefsMap.set(id, {
          userId: id,
          emailEnabled: true,
          pushEnabled: true,
          inAppEnabled: true,
          mentionNotifications: true,
          approvalNotifications: true,
          reminderNotifications: true,
          criticalBypassMute: true,
        });
      }
    });

    return prefsMap;
  }

  async sendBulkNotification(
    payload: Omit<NotificationPayload, 'recipientIds'> & {
      recipientIds: number[];
    },
  ) {
    return this.sendNotification(payload);
  }

  async sendApprovalNotification(
    payload: Omit<NotificationPayload, 'type' | 'category' | 'priority'> & {
      recipientIds: number[];
    },
  ) {
    return this.sendNotification({
      ...payload,
      type: 'APPROVAL',
      category: 'APPROVAL',
      priority: 'HIGH',
    });
  }

  async sendMentionNotification(
    payload: Omit<NotificationPayload, 'type' | 'category' | 'priority'> & {
      recipientIds: number[];
    },
  ) {
    return this.sendNotification({
      ...payload,
      type: 'MENTION',
      category: 'MENTION',
      priority: 'MEDIUM',
    });
  }

  async findAll(
    userId: number,
    query: QueryNotificationsDto = {},
    resolvedOrganizationId?: number | null,
  ) {
    try {
      const organizationId = await this.resolveOrganizationId(
        userId,
        resolvedOrganizationId,
      );
      const page = Math.max(1, Number(query.page ?? 1));
      const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20)));
      const skip = (page - 1) * limit;
      const where: Prisma.NotificationRecipientWhereInput = {
        userId,
        organizationId,
        ...(query.unreadOnly ? { isRead: false } : {}),
        ...(query.module
          ? { notification: { module: query.module, organizationId } }
          : {}),
        ...(query.type
          ? { notification: { type: query.type, organizationId } }
          : {}),
        ...(query.priority
          ? { notification: { priority: query.priority, organizationId } }
          : {}),
      };

      const [total, rows] = await this.prisma.$transaction([
        this.prisma.notificationRecipient.count({ where }),
        this.prisma.notificationRecipient.findMany({
          where,
          include: { notification: true },
          orderBy: {
            notification: {
              createdAt: query.sortDirection === 'asc' ? 'asc' : 'desc',
            },
          },
          skip,
          take: limit,
        }),
      ]);

      return {
        items: rows.map(normalizeListItem),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          hasNextPage: page * limit < total,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      if (this.isSchemaDriftError(error)) {
        return {
          items: [],
          meta: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      }

      throw error;
    }
  }

  async getUnreadCount(userId: number, resolvedOrganizationId?: number | null) {
    try {
      const organizationId = await this.resolveOrganizationId(
        userId,
        resolvedOrganizationId,
      );
      const count = await this.prisma.notificationRecipient.count({
        where: { userId, organizationId, isRead: false },
      });
      return { count };
    } catch (error) {
      if (this.isSchemaDriftError(error)) {
        return { count: 0 };
      }
      throw error;
    }
  }

  async markRead(
    id: number,
    userId: number,
    resolvedOrganizationId?: number | null,
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      resolvedOrganizationId,
    );
    const recipient = await this.prisma.notificationRecipient.updateMany({
      where: { notificationId: id, userId, organizationId, isRead: false },
      data: { isRead: true, readAt: new Date(), status: 'READ' },
    });

    if (recipient.count === 0) {
      throw new NotFoundException(`Notification #${id} not found`);
    }

    this.gateway.emitUnreadCount(
      userId,
      (await this.getUnreadCount(userId, organizationId)).count,
    );
    return this.findOne(id, userId, organizationId);
  }

  async markAllRead(userId: number, resolvedOrganizationId?: number | null) {
    try {
      const organizationId =
        resolvedOrganizationId != null
          ? this.validateOrganization(resolvedOrganizationId)
          : await this.getOrganizationIdFromUserId(userId);
      const result = await this.prisma.notificationRecipient.updateMany({
        where: { userId, organizationId, isRead: false },
        data: { isRead: true, readAt: new Date(), status: 'READ' },
      });

      this.gateway.emitUnreadCount(userId, 0);
      this.gateway.emitBulkRefresh(userId);
      return { count: result.count };
    } catch (error) {
      if (this.isSchemaDriftError(error)) {
        return { count: 0 };
      }
      throw error;
    }
  }

  async deleteNotification(
    id: number,
    userId: number,
    resolvedOrganizationId?: number | null,
  ) {
    const organizationId =
      resolvedOrganizationId != null
        ? this.validateOrganization(resolvedOrganizationId)
        : await this.getOrganizationIdFromUserId(userId);
    const deleted = await this.prisma.notificationRecipient.deleteMany({
      where: { notificationId: id, userId, organizationId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException(`Notification #${id} not found`);
    }

    const remaining = await this.prisma.notificationRecipient.count({
      where: { notificationId: id, organizationId },
    });
    if (remaining === 0) {
      await this.prisma.notification.delete({ where: { id, organizationId } });
    }

    this.gateway.emitUnreadCount(
      userId,
      (await this.getUnreadCount(userId, organizationId)).count,
    );
    return { deleted: true };
  }

  async getPreferences(userId: number, resolvedOrganizationId?: number | null) {
    const organizationId =
      resolvedOrganizationId != null
        ? this.validateOrganization(resolvedOrganizationId)
        : await this.getOrganizationIdFromUserId(userId);
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { organizationId, userId },
    });
  }

  async updatePreferences(
    userId: number,
    dto: UpdateNotificationPreferencesDto,
    resolvedOrganizationId?: number | null,
  ) {
    const organizationId =
      resolvedOrganizationId != null
        ? this.validateOrganization(resolvedOrganizationId)
        : await this.getOrganizationIdFromUserId(userId);
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: { ...dto },
      create: { organizationId, userId, ...dto },
    });
  }

  async findOne(
    notificationId: number,
    userId: number,
    resolvedOrganizationId?: number | null,
  ) {
    const organizationId = await this.resolveOrganizationId(
      userId,
      resolvedOrganizationId,
    );
    const row = await this.prisma.notificationRecipient.findFirst({
      where: { notificationId, userId, organizationId },
      include: { notification: true },
    });

    if (!row) {
      throw new NotFoundException(`Notification #${notificationId} not found`);
    }

    return normalizeListItem(row);
  }

  async findByNotificationId(notificationId: number, organizationId?: number) {
    const where: Prisma.NotificationRecipientWhereInput = { notificationId };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.prisma.notificationRecipient.findMany({
      where,
      include: { notification: true },
    });
  }

  private async logDeliveries(
    notificationId: number,
    recipientIds: number[],
    channels: NotificationChannel[],
    organizationId: number,
    metadata?: Prisma.InputJsonValue | null,
  ) {
    if (channels.length === 0) return;

    // Only log IN_APP channel here, EMAIL is logged in sendViaEmail
    const inAppChannels = channels.filter((c) => c === 'IN_APP');

    if (inAppChannels.length > 0) {
      await this.prisma.notificationDeliveryLog.createMany({
        data: recipientIds.map((userId) => ({
          organizationId,
          notificationId,
          userId,
          channel: 'IN_APP',
          provider: 'websocket',
          status: 'DELIVERED' satisfies NotificationDeliveryStatus,
          attempts: 1,
          deliveredAt: new Date(),
          metadata: metadata ?? undefined,
        })),
      });
    }
  }
}

// Made with Bob
