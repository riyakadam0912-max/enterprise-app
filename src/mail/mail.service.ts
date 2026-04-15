import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  async sendLeaveRequestNotification(
    managerEmail: string,
    managerName: string,
    employeeName: string,
    leaveType: string,
    startDate: Date,
    endDate: Date,
    reason?: string,
  ): Promise<void> {
    const emailContent = {
      to: managerEmail,
      subject: `Leave Request for Review: ${employeeName}`,
      template: 'leave-request-notification',
      context: {
        managerName,
        employeeName,
        leaveType,
        startDate: startDate.toDateString(),
        endDate: endDate.toDateString(),
        reason: reason || 'Not specified',
        actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/leave-requests`,
        daysRequested: this.calculateDays(startDate, endDate),
      },
    };

    console.log('\n==================== MOCK EMAIL ====================');
    console.log(JSON.stringify(emailContent, null, 2));
    console.log('====================================================\n');
  }

  async sendLeaveApprovalNotification(
    employeeEmail: string,
    employeeName: string,
    leaveType: string,
    startDate: Date,
    endDate: Date,
    approvedBy: string,
  ): Promise<void> {
    const emailContent = {
      to: employeeEmail,
      subject: `Leave Request Approved: ${leaveType}`,
      template: 'leave-approval-notification',
      context: {
        employeeName,
        leaveType,
        startDate: startDate.toDateString(),
        endDate: endDate.toDateString(),
        approvedBy,
        daysApproved: this.calculateDays(startDate, endDate),
      },
    };

    console.log('\n==================== MOCK EMAIL ====================');
    console.log(JSON.stringify(emailContent, null, 2));
    console.log('====================================================\n');
  }

  async sendLeaveRejectionNotification(
    employeeEmail: string,
    employeeName: string,
    leaveType: string,
    reason: string,
    rejectedBy: string,
  ): Promise<void> {
    const emailContent = {
      to: employeeEmail,
      subject: `Leave Request Rejected: ${leaveType}`,
      template: 'leave-rejection-notification',
      context: {
        employeeName,
        leaveType,
        reason,
        rejectedBy,
      },
    };

    console.log('\n==================== MOCK EMAIL ====================');
    console.log(JSON.stringify(emailContent, null, 2));
    console.log('====================================================\n');
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
