import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmployeeLeaveRequestedEvent } from '../events/employee-leave-requested.event';
import { NotificationsService } from '../../notifications/notifications.service';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class LeaveRequestNotificationListener {
  private readonly logger = new Logger(LeaveRequestNotificationListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  @OnEvent('employee.leave_requested')
  async handleLeaveRequested(event: EmployeeLeaveRequestedEvent): Promise<void> {
    this.logger.debug(`Processing leave request event for employee: ${event.employeeName}`);

    if (!event.managerId) {
      this.logger.warn(
        `Employee ${event.employeeName} (ID: ${event.employeeId}) has no manager assigned. Skipping notification.`,
      );
      return;
    }

    try {
      await this.createManagerNotification(event);
      await this.sendManagerEmail(event);
      this.logger.log(`Leave request notification completed for manager ID: ${event.managerId}`);
    } catch (error) {
      this.logger.error(
        `Error processing leave request notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async createManagerNotification(event: EmployeeLeaveRequestedEvent): Promise<void> {
    const leaveEndDate = new Date(event.endDate);
    const daysRequested = this.calculateDays(event.startDate, event.endDate);

    const notificationMessage =
      `Employee ${event.employeeName} has requested ${daysRequested} day(s) of ` +
      `${event.leaveType} leave from ${event.startDate.toDateString()} to ${leaveEndDate.toDateString()}. ` +
      `Reason: ${event.reason || 'Not specified'}`;

    await this.notificationsService.create({
      userId: event.managerId,
      title: `Review Leave Request - ${event.employeeName}`,
      message: notificationMessage,
    } as any);

    this.logger.log(`Notification created for manager ID: ${event.managerId}`);
  }

  private async sendManagerEmail(event: EmployeeLeaveRequestedEvent): Promise<void> {
    if (!event.managerName) {
      this.logger.warn(
        `Manager information not available for notification email. Manager ID: ${event.managerId}`,
      );
      return;
    }

    const managerEmail = event.employeeEmail || 'manager@company.com';

    await this.mailService.sendLeaveRequestNotification(
      managerEmail,
      event.managerName,
      event.employeeName,
      event.leaveType,
      event.startDate,
      event.endDate,
      event.reason,
    );

    this.logger.log(`Email sent to manager: ${event.managerName} (${managerEmail})`);
  }

  private calculateDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1);
  }
}
