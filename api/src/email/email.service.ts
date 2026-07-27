import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { EmailResult } from '../mail/providers/email-provider.interface';
import { EmailSendOptions, EmailTemplateContext } from './email.interfaces';
import {
  AccountLockedEmailDto,
  AnnouncementEmailDto,
  AttendanceCorrectionApprovedEmailDto,
  AttendanceCorrectionRejectedEmailDto,
  AttendanceReminderEmailDto,
  EmployeeInviteEmailDto,
  EmployeeOnboardedEmailDto,
  EmailVerificationEmailDto,
  ExpenseApprovedEmailDto,
  ExpenseRejectedEmailDto,
  ExpenseSubmittedEmailDto,
  InvoiceCreatedEmailDto,
  InvoiceOverdueEmailDto,
  InvoicePaidEmailDto,
  LeaveApprovedEmailDto,
  LeaveCancelledEmailDto,
  LeaveRejectedEmailDto,
  LeaveRequestedEmailDto,
  LoginAlertEmailDto,
  MonthlySummaryEmailDto,
  NewDeviceLoginEmailDto,
  OrganizationCreatedEmailDto,
  OrganizationInvitationEmailDto,
  PasswordChangedEmailDto,
  PasswordResetEmailDto,
  PaymentFailedEmailDto,
  PaymentReceivedEmailDto,
  PayrollGeneratedEmailDto,
  PayslipReadyEmailDto,
  PermissionChangedEmailDto,
  ProjectCreatedEmailDto,
  ProjectDeadlineReminderEmailDto,
  RoleAssignedEmailDto,
  SecurityAlertEmailDto,
  SubscriptionActivatedEmailDto,
  SubscriptionExpiredEmailDto,
  SubscriptionExpiringEmailDto,
  SubscriptionRenewedEmailDto,
  TaskAssignedEmailDto,
  TaskCompletedEmailDto,
  WelcomeEmailDto,
  WeeklySummaryEmailDto,
} from './email.types';
import {
  buildEmailOptions,
  renderEmailTemplate,
  validateTemplateContext,
} from './email.utils';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async sendWelcomeEmail(dto: WelcomeEmailDto): Promise<EmailResult> {
    return this.sendTemplate('welcome', dto, 'Welcome to your workspace');
  }

  async sendPasswordReset(dto: PasswordResetEmailDto): Promise<EmailResult> {
    return this.sendTemplate('password-reset', dto, 'Reset your password');
  }

  async sendPasswordChanged(
    dto: PasswordChangedEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate(
      'password-changed',
      dto,
      'Your password was changed',
    );
  }

  async sendEmployeeInvite(dto: EmployeeInviteEmailDto): Promise<EmailResult> {
    return this.sendTemplate('employee-invite', dto, 'You are invited to join');
  }

  async sendEmployeeOnboarded(
    dto: EmployeeOnboardedEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate('employee-onboarded', dto, 'Welcome aboard');
  }

  async sendOrganizationCreated(
    dto: OrganizationCreatedEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate(
      'organization-created',
      dto,
      'Your organization is ready',
    );
  }

  async sendOrganizationInvitation(
    dto: OrganizationInvitationEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate(
      'organization-invitation',
      dto,
      'You have an invitation',
    );
  }

  async sendEmailVerification(
    dto: EmailVerificationEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate('email-verification', dto, 'Verify your email');
  }

  async sendLoginAlert(dto: LoginAlertEmailDto): Promise<EmailResult> {
    return this.sendTemplate('login-alert', dto, 'New sign-in detected');
  }

  async sendAccountLocked(dto: AccountLockedEmailDto): Promise<EmailResult> {
    return this.sendTemplate(
      'account-locked',
      dto,
      'Your account has been locked',
    );
  }

  async sendLeaveRequested(dto: LeaveRequestedEmailDto): Promise<EmailResult> {
    return this.sendTemplate('leave-requested', dto, 'Leave request submitted');
  }

  async sendLeaveApproved(dto: LeaveApprovedEmailDto): Promise<EmailResult> {
    return this.sendTemplate('leave-approved', dto, 'Leave approved');
  }

  async sendLeaveRejected(dto: LeaveRejectedEmailDto): Promise<EmailResult> {
    return this.sendTemplate('leave-rejected', dto, 'Leave rejected');
  }

  async sendLeaveCancelled(dto: LeaveCancelledEmailDto): Promise<EmailResult> {
    return this.sendTemplate('leave-cancelled', dto, 'Leave cancelled');
  }

  async sendAttendanceReminder(
    dto: AttendanceReminderEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate('attendance-reminder', dto, 'Attendance reminder');
  }

  async sendAttendanceCorrectionApproved(
    dto: AttendanceCorrectionApprovedEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate(
      'attendance-correction-approved',
      dto,
      'Attendance correction approved',
    );
  }

  async sendAttendanceCorrectionRejected(
    dto: AttendanceCorrectionRejectedEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate(
      'attendance-correction-rejected',
      dto,
      'Attendance correction rejected',
    );
  }

  async sendPayrollGenerated(
    dto: PayrollGeneratedEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate('payroll-generated', dto, 'Payroll generated');
  }

  async sendPayslipReady(dto: PayslipReadyEmailDto): Promise<EmailResult> {
    return this.sendTemplate('payslip-ready', dto, 'Payslip ready');
  }

  async sendInvoiceCreated(dto: InvoiceCreatedEmailDto): Promise<EmailResult> {
    return this.sendTemplate('invoice-created', dto, 'Invoice created');
  }

  async sendInvoicePaid(dto: InvoicePaidEmailDto): Promise<EmailResult> {
    return this.sendTemplate('invoice-paid', dto, 'Invoice paid');
  }

  async sendInvoiceOverdue(dto: InvoiceOverdueEmailDto): Promise<EmailResult> {
    return this.sendTemplate('invoice-overdue', dto, 'Invoice overdue');
  }

  async sendPaymentReceived(
    dto: PaymentReceivedEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate('payment-received', dto, 'Payment received');
  }

  async sendPaymentFailed(dto: PaymentFailedEmailDto): Promise<EmailResult> {
    return this.sendTemplate('payment-failed', dto, 'Payment failed');
  }

  async sendExpenseSubmitted(
    dto: ExpenseSubmittedEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate('expense-submitted', dto, 'Expense submitted');
  }

  async sendExpenseApproved(
    dto: ExpenseApprovedEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate('expense-approved', dto, 'Expense approved');
  }

  async sendExpenseRejected(
    dto: ExpenseRejectedEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate('expense-rejected', dto, 'Expense rejected');
  }

  async sendTaskAssigned(dto: TaskAssignedEmailDto): Promise<EmailResult> {
    return this.sendTemplate('task-assigned', dto, 'Task assigned');
  }

  async sendTaskCompleted(dto: TaskCompletedEmailDto): Promise<EmailResult> {
    return this.sendTemplate('task-completed', dto, 'Task completed');
  }

  async sendProjectCreated(dto: ProjectCreatedEmailDto): Promise<EmailResult> {
    return this.sendTemplate('project-created', dto, 'Project created');
  }

  async sendProjectDeadlineReminder(
    dto: ProjectDeadlineReminderEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate(
      'project-deadline-reminder',
      dto,
      'Project deadline reminder',
    );
  }

  async sendAnnouncement(dto: AnnouncementEmailDto): Promise<EmailResult> {
    return this.sendTemplate('announcement', dto, 'Announcement');
  }

  async sendWeeklySummary(dto: WeeklySummaryEmailDto): Promise<EmailResult> {
    return this.sendTemplate('weekly-summary', dto, 'Weekly summary');
  }

  async sendMonthlySummary(dto: MonthlySummaryEmailDto): Promise<EmailResult> {
    return this.sendTemplate('monthly-summary', dto, 'Monthly summary');
  }

  async sendSubscriptionActivated(
    dto: SubscriptionActivatedEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate(
      'subscription-activated',
      dto,
      'Subscription activated',
    );
  }

  async sendSubscriptionRenewed(
    dto: SubscriptionRenewedEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate(
      'subscription-renewed',
      dto,
      'Subscription renewed',
    );
  }

  async sendSubscriptionExpiring(
    dto: SubscriptionExpiringEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate(
      'subscription-expiring',
      dto,
      'Subscription expiring',
    );
  }

  async sendSubscriptionExpired(
    dto: SubscriptionExpiredEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate(
      'subscription-expired',
      dto,
      'Subscription expired',
    );
  }

  async sendRoleAssigned(dto: RoleAssignedEmailDto): Promise<EmailResult> {
    return this.sendTemplate('role-assigned', dto, 'Role assigned');
  }

  async sendPermissionChanged(
    dto: PermissionChangedEmailDto,
  ): Promise<EmailResult> {
    return this.sendTemplate('permission-changed', dto, 'Permissions updated');
  }

  async sendNewDeviceLogin(dto: NewDeviceLoginEmailDto): Promise<EmailResult> {
    return this.sendTemplate(
      'new-device-login',
      dto,
      'New device login detected',
    );
  }

  async sendSecurityAlert(dto: SecurityAlertEmailDto): Promise<EmailResult> {
    return this.sendTemplate('security-alert', dto, 'Security alert');
  }

  async sendEmailTemplate(options: EmailSendOptions): Promise<EmailResult> {
    const normalized = buildEmailOptions(options);
    const missing = validateTemplateContext(
      normalized.template,
      normalized.context ?? {},
    );
    if (missing.length > 0) {
      throw new Error(
        `Template ${normalized.template} is missing required values: ${missing.join(', ')}`,
      );
    }

    const { html, text } = renderEmailTemplate(
      normalized.template,
      normalized.context ?? {},
    );
    return this.mailService.sendEmail({
      to: normalized.to,
      cc: normalized.cc,
      bcc: normalized.bcc,
      replyTo: normalized.replyTo,
      subject: normalized.subject,
      html,
      text,
      tags: [normalized.template, normalized.category ?? 'system'],
      metadata: {
        template: normalized.template,
        category: normalized.category ?? 'system',
      },
    });
  }

  private async sendTemplate(
    templateName: string,
    context: EmailTemplateContext,
    subject: string,
  ): Promise<EmailResult> {
    const recipient = Array.isArray(context.to) ? context.to[0] : context.to;
    if (!recipient) {
      throw new Error('Recipient email is required');
    }

    const normalizedContext = {
      ...context,
      to: recipient,
    } as EmailTemplateContext;

    return this.sendEmailTemplate({
      to: recipient,
      subject,
      template: templateName,
      context: normalizedContext,
      category: templateName,
    });
  }
}
