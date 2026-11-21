import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmployeeLeaveRequestedEvent } from '../events/employee-leave-requested.event';
import { NotificationsService } from '../../notifications/notifications.service';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { EmployeeLeaveDecisionEvent } from '../events/employee-leave-decision.event';

@Injectable()
export class LeaveRequestNotificationListener {
  private readonly logger = new Logger(LeaveRequestNotificationListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  @OnEvent('employee.leave_requested')
  async handleLeaveRequested(
    event: EmployeeLeaveRequestedEvent,
  ): Promise<void> {
    this.logger.debug(
      `Processing leave request event for employee: ${event.employeeName}`,
    );

    try {
      if (event.managerId) {
        await this.createManagerNotification(event);
        await this.sendManagerEmail(event);
      } else {
        await this.notifyOrganizationAdmins(event);
      }
    } catch (error) {
      this.logger.error(
        `Error processing leave request notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async createManagerNotification(
    event: EmployeeLeaveRequestedEvent,
  ): Promise<void> {
    const leaveEndDate = new Date(event.endDate);
    const daysRequested =
      event.duration === 'HALF_DAY'
        ? 0.5
        : this.calculateDays(event.startDate, event.endDate);

    const notificationMessage =
      `Employee ${event.employeeName} has requested ${daysRequested} day(s) of ` +
      `${event.leaveType} ${event.duration === 'HALF_DAY' ? 'half-day leave (5 work hours required per date)' : 'leave'} from ${event.startDate.toDateString()} to ${leaveEndDate.toDateString()}. ` +
      `Reason: ${event.reason || 'Not specified'}`;

    await this.notificationsService.create(
      {
        userId: event.managerId ?? undefined,
        title: `Review Leave Request - ${event.employeeName}`,
        message: notificationMessage,
      },
      event.organizationId,
    );

    this.logger.log(`Notification created for manager ID: ${event.managerId}`);
  }

  private async sendManagerEmail(
    event: EmployeeLeaveRequestedEvent,
  ): Promise<void> {
    if (!event.managerName || !event.managerEmail) {
      this.logger.warn(
        `Manager name or email is unavailable. Manager ID: ${event.managerId}`,
      );
      return;
    }

    await this.mailService.sendLeaveRequestNotification(
      event.managerEmail,
      event.managerName,
      event.employeeName,
      event.leaveType,
      event.startDate,
      event.endDate,
      event.reason,
    );

    this.logger.log(
      `Email sent to manager: ${event.managerName} (${event.managerEmail})`,
    );
  }

  private async notifyOrganizationAdmins(event: EmployeeLeaveRequestedEvent) {
    if (!event.organizationId) return;
    const admins = await this.prisma.user.findMany({
      where: {
        organizationId: event.organizationId,
        role: 'ADMIN',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, name: true, email: true },
    });
    if (admins.length === 0) {
      this.logger.warn(
        `No manager or organization admin found for leave request ${event.leaveRequestId}`,
      );
      return;
    }
    await Promise.all(
      admins.map(async (admin) => {
        await this.notificationsService.create(
          {
            userId: admin.id,
            title: `Review Leave Request - ${event.employeeName}`,
            message: `${event.employeeName} submitted a ${event.leaveType} request and has no assigned manager.`,
          },
          event.organizationId!,
        );
        if (admin.email) {
          await this.mailService.sendLeaveRequestNotification(
            admin.email,
            admin.name,
            event.employeeName,
            event.leaveType,
            event.startDate,
            event.endDate,
            event.reason,
          );
        }
      }),
    );
  }

  @OnEvent('employee.leave_approved')
  async handleLeaveApproved(event: EmployeeLeaveDecisionEvent): Promise<void> {
    await this.notifyEmployeeOfDecision(event, true);
  }

  @OnEvent('employee.leave_rejected')
  async handleLeaveRejected(event: EmployeeLeaveDecisionEvent): Promise<void> {
    await this.notifyEmployeeOfDecision(event, false);
  }

  private async notifyEmployeeOfDecision(
    event: EmployeeLeaveDecisionEvent,
    approved: boolean,
  ) {
    try {
      const status = approved ? 'approved' : 'rejected';
      const reason =
        !approved && event.reason ? ` Reason: ${event.reason}` : '';
      if (event.employeeUserId) {
        await this.notificationsService.create(
          {
            userId: event.employeeUserId,
            title: `Leave request ${status}`,
            message: `Your ${event.leaveType} request from ${event.startDate.toDateString()} to ${event.endDate.toDateString()} was ${status} by ${event.decidedByName}.${reason}`,
          },
          event.organizationId,
        );
      }
      if (!event.employeeEmail) {
        this.logger.warn(
          `Employee email unavailable for leave request ${event.leaveRequestId}`,
        );
        return;
      }
      const payload = {
        to: event.employeeEmail,
        firstName: event.employeeName,
        leaveType: event.leaveType,
        leaveDates: `${event.startDate.toDateString()} - ${event.endDate.toDateString()}`,
        approvalStatus: approved
          ? `Approved by ${event.decidedByName}`
          : `Rejected by ${event.decidedByName}`,
        rejectionReason: event.reason,
        ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/dashboard/leave`,
      };
      if (approved) await this.emailService.sendLeaveApproved(payload);
      else await this.emailService.sendLeaveRejected(payload);
    } catch (error) {
      this.logger.error(
        `Unable to send leave decision notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private calculateDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(
      1,
      Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1,
    );
  }
}
