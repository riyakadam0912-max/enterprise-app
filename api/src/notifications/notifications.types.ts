import type { Prisma } from '@prisma/client';

export type NotificationType =
  | 'INFO'
  | 'SUCCESS'
  | 'WARNING'
  | 'ERROR'
  | 'APPROVAL'
  | 'REMINDER'
  | 'MENTION'
  | 'SYSTEM';
export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NotificationChannel =
  | 'IN_APP'
  | 'EMAIL'
  | 'PUSH'
  | 'SMS'
  | 'WHATSAPP'
  | 'WEBHOOK';
export type NotificationDeliveryStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'SKIPPED'
  | 'READ';

export type NotificationListItem = {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  module?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  actionUrl?: string | null;
  priority: NotificationPriority;
  category: string;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  readAt?: string | null;
  deliveredAt?: string | null;
};

export type NotificationPayload = {
  recipientIds?: number[];
  userId?: number;
  type?: NotificationType;
  title: string;
  message: string;
  module?: string;
  entityType?: string;
  entityId?: number;
  actionUrl?: string;
  priority?: NotificationPriority;
  category?: string;
  createdBy?: number | null;
  channels?: NotificationChannel[];
  metadata?: Prisma.InputJsonValue | null;
  templateKey?: string;
  templateVariables?: Record<string, any>;
  organizationId?: number;
};

export type NotificationEventDescriptor = {
  recipientIds: number[];
  title: string;
  message: string;
  module: string;
  entityType: string;
  entityId?: number;
  actionUrl?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  category?: string;
  createdBy?: number | null;
  metadata?: Prisma.InputJsonValue | null;
  templateKey?: string;
  templateVariables?: Record<string, any>;
  organizationId?: number;
};

// Made with Bob
