import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityTimelineService } from './activity-timeline.service';

function normalizePriority(
  priority?: string | null,
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const value = (priority ?? 'MEDIUM').toUpperCase();
  return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(value)
    ? (value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
    : 'MEDIUM';
}

type AuditLogCreatedEvent = {
  id?: number;
  userId?: number | null;
  userName?: string | null;
  userRole?: string | null;
  module: string;
  entityType: string;
  entityId?: number | null;
  action: string;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  description?: string | null;
  ipAddress?: string | null;
  deviceInfo?: string | null;
  requestMethod?: string | null;
  endpoint?: string | null;
  status?: string;
  createdAt?: Date;
  organizationId?: number;
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
  comment?: string;
  organizationId?: number;
};

type LeaveRequestedEvent = {
  managerId?: number | null;
  managerName?: string | null;
  employeeId?: number;
  employeeName: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  organizationId?: number;
};

@Injectable()
export class ActivityTimelineListener {
  constructor(
    private readonly timelineService: ActivityTimelineService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('audit.log.created')
  async onAuditLogCreated(_event: AuditLogCreatedEvent) {
    // TODO: Re-enable this later!
  }

  @OnEvent('employee.leave_requested')
  async onLeaveRequested(event: LeaveRequestedEvent) {
    if (!event.managerId) return;

    await this.timelineService.createEvent(
      {
        module: 'Leave',
        entityType: 'LeaveRequest',
        entityId: event.employeeId ?? 0,
        eventType: 'STATUS_CHANGED',
        action: 'SUBMITTED',
        title: `Leave request submitted by ${event.employeeName}`,
        description: `${event.employeeName} requested ${event.leaveType} leave from ${event.startDate.toDateString()} to ${event.endDate.toDateString()}.`,
        performedBy: event.employeeId ?? null,
        status: 'OPEN',
        priority: normalizePriority('HIGH'),
        metadata: { reason: event.reason ?? null, managerId: event.managerId },
      },
      undefined,
      event.organizationId,
    );
  }

  @OnEvent('task.assigned')
  async onTaskAssigned(event: WorkflowEvent) {
    if (!event.entityId) return;

    await this.timelineService.logAssignment(
      {
        module: event.module || 'Tasks',
        entityType: event.entityType || 'Task',
        entityId: event.entityId,
        assignedTo: event.recipientIds?.[0] ?? event.userIds?.[0] ?? null,
        performedBy: event.actorUserId ?? null,
        title: event.title || 'Task assigned',
        description: event.message || 'A task has been assigned.',
        priority: normalizePriority(event.priority),
      },
      undefined,
      event.organizationId,
    );
  }

  @OnEvent('invoice.overdue')
  async onInvoiceOverdue(event: WorkflowEvent) {
    if (!event.entityId) return;

    await this.timelineService.createEvent(
      {
        module: event.module || 'Accounting',
        entityType: event.entityType || 'Invoice',
        entityId: event.entityId,
        eventType: 'ESCALATED',
        action: 'OVERDUE',
        title: event.title || 'Invoice overdue',
        description:
          event.message || 'An invoice is overdue and needs attention.',
        performedBy: event.actorUserId ?? null,
        status: 'WARNING',
        priority: normalizePriority(event.priority),
        metadata: { actionUrl: event.actionUrl ?? null },
      },
      undefined,
      event.organizationId,
    );
  }

  @OnEvent('workflow.rejected')
  async onWorkflowRejected(event: WorkflowEvent) {
    if (!event.entityId) return;

    await this.timelineService.logApproval(
      {
        module: event.module || 'Workflow',
        entityType: event.entityType || 'WorkflowInstance',
        entityId: event.entityId,
        approved: false,
        performedBy: event.actorUserId ?? null,
        title: event.title || 'Workflow rejected',
        description: event.message || 'A workflow step was rejected.',
        priority: normalizePriority(event.priority),
        metadata: { actionUrl: event.actionUrl ?? null },
      },
      undefined,
      event.organizationId,
    );
  }

  @OnEvent('mention.created')
  async onMentionCreated(event: WorkflowEvent) {
    const recipients = [
      ...(event.recipientIds ?? []),
      ...(event.userIds ?? []),
    ].filter((value) => Number.isInteger(value) && value > 0);
    if (recipients.length === 0 || !event.entityId) return;

    await this.timelineService.createEvent(
      {
        module: event.module || 'System',
        entityType: event.entityType || 'Mention',
        entityId: event.entityId,
        eventType: 'MENTIONED',
        action: 'MENTIONED',
        title: event.title || 'You were mentioned',
        description:
          event.message || 'You were mentioned in a comment or discussion.',
        performedBy: event.actorUserId ?? null,
        status: 'INFO',
        priority: normalizePriority('MEDIUM'),
        metadata: {
          recipientIds: recipients,
          actionUrl: event.actionUrl ?? null,
        },
      },
      undefined,
      event.organizationId,
    );
  }
}
