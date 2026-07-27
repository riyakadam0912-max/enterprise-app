import { EmailRecipient, EmailTemplateContext } from './email.interfaces';

export interface BaseEmailDto extends EmailRecipient {
  locale?: string;
  organization?: string;
  [key: string]: unknown;
}

export type EmailTemplateDto = BaseEmailDto & EmailTemplateContext;

export interface WelcomeEmailDto extends BaseEmailDto {
  firstName: string;
  lastName?: string;
  organization?: string;
  ctaUrl?: string;
  ctaText?: string;
}

export interface PasswordResetEmailDto extends BaseEmailDto {
  firstName: string;
  resetLink: string;
  ctaText?: string;
}

export interface PasswordChangedEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
}

export interface EmployeeInviteEmailDto extends BaseEmailDto {
  firstName: string;
  role?: string;
  organization?: string;
  ctaUrl: string;
  ctaText?: string;
}

export interface EmployeeOnboardedEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
}

export interface OrganizationCreatedEmailDto extends BaseEmailDto {
  firstName: string;
  organization: string;
}

export interface OrganizationInvitationEmailDto extends BaseEmailDto {
  firstName: string;
  organization: string;
  role?: string;
  ctaUrl: string;
  ctaText?: string;
}

export interface EmailVerificationEmailDto extends BaseEmailDto {
  firstName: string;
  verificationLink: string;
  ctaText?: string;
}

export interface LoginAlertEmailDto extends BaseEmailDto {
  firstName: string;
  loginLocation: string;
  browser?: string;
  device?: string;
  ip?: string;
}

export interface AccountLockedEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
  unlockUrl: string;
  ctaText?: string;
}

export interface LeaveRequestedEmailDto extends BaseEmailDto {
  firstName: string;
  leaveType: string;
  leaveDates: string;
  organization?: string;
}

export interface LeaveApprovedEmailDto extends BaseEmailDto {
  firstName: string;
  leaveType: string;
  leaveDates: string;
  approvalStatus?: string;
}

export interface LeaveRejectedEmailDto extends BaseEmailDto {
  firstName: string;
  leaveType: string;
  leaveDates: string;
  approvalStatus?: string;
}

export interface LeaveCancelledEmailDto extends BaseEmailDto {
  firstName: string;
  leaveType: string;
  leaveDates: string;
}

export interface AttendanceReminderEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
}

export interface AttendanceCorrectionApprovedEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
}

export interface AttendanceCorrectionRejectedEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
}

export interface PayrollGeneratedEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
}

export interface PayslipReadyEmailDto extends BaseEmailDto {
  firstName: string;
  employeeId?: string;
  organization?: string;
}

export interface InvoiceCreatedEmailDto extends BaseEmailDto {
  firstName: string;
  invoiceNumber: string;
  invoiceAmount: string;
  organization?: string;
}

export interface InvoicePaidEmailDto extends BaseEmailDto {
  firstName: string;
  invoiceNumber: string;
  invoiceAmount: string;
  organization?: string;
}

export interface InvoiceOverdueEmailDto extends BaseEmailDto {
  firstName: string;
  invoiceNumber: string;
  invoiceAmount: string;
  organization?: string;
}

export interface PaymentReceivedEmailDto extends BaseEmailDto {
  firstName: string;
  invoiceNumber: string;
  invoiceAmount: string;
  organization?: string;
}

export interface PaymentFailedEmailDto extends BaseEmailDto {
  firstName: string;
  invoiceNumber: string;
  invoiceAmount: string;
  organization?: string;
}

export interface ExpenseSubmittedEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
}

export interface ExpenseApprovedEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
}

export interface ExpenseRejectedEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
}

export interface TaskAssignedEmailDto extends BaseEmailDto {
  firstName: string;
  taskName: string;
  projectName?: string;
  ctaUrl: string;
  ctaText?: string;
}

export interface TaskCompletedEmailDto extends BaseEmailDto {
  firstName: string;
  taskName: string;
  projectName?: string;
}

export interface ProjectCreatedEmailDto extends BaseEmailDto {
  firstName: string;
  projectName: string;
  organization?: string;
  ctaUrl: string;
  ctaText?: string;
}

export interface ProjectDeadlineReminderEmailDto extends BaseEmailDto {
  firstName: string;
  projectName: string;
  organization?: string;
}

export interface AnnouncementEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
  message: string;
}

export interface WeeklySummaryEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
}

export interface MonthlySummaryEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
}

export interface SubscriptionActivatedEmailDto extends BaseEmailDto {
  firstName: string;
  subscriptionPlan: string;
  expiryDate: string;
  organization?: string;
}

export interface SubscriptionRenewedEmailDto extends BaseEmailDto {
  firstName: string;
  subscriptionPlan: string;
  expiryDate: string;
  organization?: string;
}

export interface SubscriptionExpiringEmailDto extends BaseEmailDto {
  firstName: string;
  subscriptionPlan: string;
  expiryDate: string;
  organization?: string;
}

export interface SubscriptionExpiredEmailDto extends BaseEmailDto {
  firstName: string;
  subscriptionPlan: string;
  expiryDate: string;
  organization?: string;
}

export interface RoleAssignedEmailDto extends BaseEmailDto {
  firstName: string;
  role: string;
  organization?: string;
}

export interface PermissionChangedEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
  role?: string;
}

export interface NewDeviceLoginEmailDto extends BaseEmailDto {
  firstName: string;
  loginLocation: string;
  browser?: string;
  device?: string;
  ip?: string;
}

export interface SecurityAlertEmailDto extends BaseEmailDto {
  firstName: string;
  organization?: string;
  loginLocation?: string;
}
