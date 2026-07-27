import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import type {
  NotificationEventDescriptor,
  NotificationPriority,
} from './notifications.types';

type LeaveRequestedEvent = {
  managerId?: number | null;
  managerName?: string | null;
  employeeId?: number;
  employeeName: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
};

type WorkflowEvent = {
  recipientIds?: number[];
  userIds?: number[];
  actorUserId?: number;
  entityType?: string;
  entityId?: number;
  module?: string;
  title?: string;
  message?: string;
  actionUrl?: string;
  priority?: string;
};

@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('employee.leave_requested')
  async onLeaveRequested(event: LeaveRequestedEvent) {
    if (!event.managerId) return;

    const descriptor: NotificationEventDescriptor = {
      recipientIds: [event.managerId],
      title: `Review Leave Request - ${event.employeeName}`,
      message:
        `${event.employeeName} requested ${event.leaveType} leave from ${event.startDate.toDateString()} to ${event.endDate.toDateString()}. ` +
        `Reason: ${event.reason || 'Not specified'}`,
      module: 'Leave',
      entityType: 'LeaveRequest',
      priority: 'HIGH' as NotificationPriority,
      category: 'APPROVAL',
      actionUrl: '/dashboard/leave',
    };

    await this.notificationsService.sendNotification({
      recipientIds: descriptor.recipientIds,
      title: descriptor.title,
      message: descriptor.message,
      module: descriptor.module,
      entityType: descriptor.entityType,
      entityId: descriptor.entityId,
      actionUrl: descriptor.actionUrl,
      type: 'APPROVAL',
      priority: descriptor.priority,
      category: descriptor.category,
    });
    this.logger.log(
      `Leave request notification sent to manager ${event.managerId}`,
    );
  }

  @OnEvent('task.assigned')
  async onTaskAssigned(event: WorkflowEvent) {
    const recipients = this.resolveRecipients(event);
    if (recipients.length === 0) return;

    await this.notificationsService.sendNotification({
      recipientIds: recipients,
      title: event.title || 'Task assigned',
      message: event.message || 'A task has been assigned to you.',
      module: event.module || 'Tasks',
      entityType: event.entityType || 'Task',
      entityId: event.entityId,
      actionUrl: event.actionUrl || '/dashboard/tasks',
      type: 'INFO',
      priority: (event.priority || 'MEDIUM') as NotificationPriority,
      category: 'TASK',
      createdBy: event.actorUserId ?? null,
    });
  }

  @OnEvent('invoice.overdue')
  async onInvoiceOverdue(event: WorkflowEvent) {
    const recipients = this.resolveRecipients(event);
    if (recipients.length === 0) return;

    await this.notificationsService.sendNotification({
      recipientIds: recipients,
      title: event.title || 'Invoice overdue',
      message: event.message || 'An invoice is overdue and needs attention.',
      module: event.module || 'Accounting',
      entityType: event.entityType || 'Invoice',
      entityId: event.entityId,
      actionUrl: event.actionUrl || '/dashboard/invoices',
      type: 'WARNING',
      priority: (event.priority || 'HIGH') as NotificationPriority,
      category: 'FINANCE',
      createdBy: event.actorUserId ?? null,
    });
  }

  @OnEvent('workflow.rejected')
  async onWorkflowRejected(event: WorkflowEvent) {
    const recipients = this.resolveRecipients(event);
    if (recipients.length === 0) return;

    await this.notificationsService.sendNotification({
      recipientIds: recipients,
      title: event.title || 'Workflow rejected',
      message: event.message || 'A workflow step was rejected.',
      module: event.module || 'Workflow',
      entityType: event.entityType || 'WorkflowInstance',
      entityId: event.entityId,
      actionUrl: event.actionUrl || '/dashboard/workflows',
      type: 'ERROR',
      priority: (event.priority || 'HIGH') as NotificationPriority,
      category: 'APPROVAL',
      createdBy: event.actorUserId ?? null,
    });
  }

  @OnEvent('mention.created')
  async onMentionCreated(event: WorkflowEvent) {
    const recipients = this.resolveRecipients(event);
    if (recipients.length === 0) return;

    await this.notificationsService.sendMentionNotification({
      recipientIds: recipients,
      title: event.title || 'You were mentioned',
      message:
        event.message || 'You were mentioned in a comment or discussion.',
      module: event.module || 'System',
      entityType: event.entityType || 'Mention',
      entityId: event.entityId,
      actionUrl: event.actionUrl || '/dashboard',
      createdBy: event.actorUserId ?? null,
    });
  }

  private resolveRecipients(event: WorkflowEvent): number[] {
    const recipients = [
      ...(event.recipientIds ?? []),
      ...(event.userIds ?? []),
    ].filter((value) => Number.isInteger(value) && value > 0);
    return Array.from(new Set(recipients));
  }
}
