export type EmailTemplateContext = Record<string, unknown> & {
  to?: string | string[];
  firstName?: string;
  lastName?: string;
  organization?: string;
  role?: string;
  employeeId?: string;
  department?: string;
  projectName?: string;
  taskName?: string;
  invoiceNumber?: string;
  invoiceAmount?: string;
  leaveType?: string;
  leaveDates?: string;
  approvalStatus?: string;
  resetLink?: string;
  verificationLink?: string;
  loginLocation?: string;
  browser?: string;
  device?: string;
  ip?: string;
  subscriptionPlan?: string;
  expiryDate?: string;
  ctaUrl?: string;
  ctaText?: string;
  unlockUrl?: string;
  message?: string;
  title?: string;
  locale?: string;
  brand?: Record<string, unknown>;
};

export interface EmailRecipient {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
}

export interface EmailSendOptions extends EmailRecipient {
  subject: string;
  template: string;
  context?: EmailTemplateContext;
  category?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  headers?: Record<string, string>;
}

export interface EmailRenderResult {
  html: string;
  text: string;
}
