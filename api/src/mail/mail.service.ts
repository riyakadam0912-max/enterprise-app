import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { escapeHtml } from '../email/email.utils';
import { EmailProviderFactory } from './providers/provider.factory';
import { EmailParams, EmailResult } from './providers/email-provider.interface';

/**
 * Mail Service
 *
 * Production-ready email service that replaces the previous mock implementation.
 * Uses real email providers (SendGrid, AWS SES, Resend) with automatic failover.
 *
 * Features:
 * - Real email delivery via configured provider
 * - Automatic failover to backup provider
 * - Comprehensive error handling and logging
 * - Support for templates, attachments, and batch sending
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly providerFactory: EmailProviderFactory) {
    this.logger.log('Mail service initialized with production email providers');
  }

  onModuleInit() {
    const startup = this.providerFactory.getStartupStatus();
    this.logger.log(`Mail Provider: ${startup.provider.toUpperCase()}`);
    this.logger.log(`Provider Initialized: ${startup.initialized}`);

    if (!startup.initialized) {
      throw new Error(
        `Mail provider ${startup.provider.toUpperCase()} is not initialized. Missing env vars: ${startup.missingEnv.join(', ')}`,
      );
    }
  }

  /**
   * Send a templated email
   * @deprecated Use sendEmail with template rendering instead
   */
  async sendTemplatedEmail(params: {
    to: string;
    subject: string;
    template: string;
    context: Record<string, unknown>;
  }): Promise<EmailResult> {
    this.logger.log(
      `Sending templated email to ${params.to} using template: ${params.template}`,
    );

    // For now, convert context to simple HTML
    // In Phase 2, this will use the template renderer
    const html = this.contextToHtml(params.context);

    return this.sendEmail({
      to: params.to,
      subject: params.subject,
      html,
      tags: [params.template],
      metadata: { template: params.template, ...params.context },
    });
  }

  /**
   * Send an email using the configured provider
   */
  async sendEmail(params: EmailParams): Promise<EmailResult> {
    const validationError = this.validateEmailParams(params);
    if (validationError) {
      return {
        success: false,
        provider: 'mail-service',
        timestamp: new Date(),
        error: validationError,
        errorCode: 'INVALID_EMAIL_PARAMS',
      };
    }

    this.logger.log(
      `MailService.sendEmail called for ${this.describeRecipients(params.to)} with subject "${params.subject}"`,
    );

    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const provider = await this.providerFactory.getProvider();
        const providerName = provider.getProviderName();

        this.logger.log(
          `Sending email via ${providerName} to ${Array.isArray(params.to) ? params.to.join(', ') : params.to}`,
        );

        const result = await provider.send(params);

        if (result.success) {
          this.logger.log(
            `Email sent successfully via ${result.provider}. MessageID: ${result.messageId}`,
          );
          return result;
        }

        this.logger.error(
          `Email send failed via ${result.provider}: ${result.error}`,
          result.errorCode,
        );

        if (attempt < maxAttempts && this.shouldRetry(result)) {
          this.logger.warn(
            `Retrying email send after transient failure (${attempt}/${maxAttempts})`,
          );
          continue;
        }

        return result;
      } catch (error: unknown) {
        const message = this.getErrorMessage(error);
        const stack = this.getErrorStack(error);

        if (attempt < maxAttempts && this.shouldRetryError(error)) {
          this.logger.warn(
            `Retrying email send after transient exception (${attempt}/${maxAttempts}): ${message}`,
          );
          continue;
        }

        this.logger.error('Exception in MailService.sendEmail:', error);
        this.logger.error(`Unexpected error sending email: ${message}`, stack);

        return {
          success: false,
          provider: 'unknown',
          timestamp: new Date(),
          error: message || 'Unknown error occurred',
          errorCode: 'UNEXPECTED_ERROR',
        };
      }
    }

    return {
      success: false,
      provider: 'unknown',
      timestamp: new Date(),
      error: 'Email send failed after retries',
      errorCode: 'UNEXPECTED_ERROR',
    };
  }

  /**
   * Send batch emails
   */
  async sendBatchEmails(params: EmailParams[]): Promise<EmailResult[]> {
    try {
      const provider = await this.providerFactory.getProvider();

      this.logger.log(
        `Sending batch of ${params.length} emails via ${provider.getProviderName()}`,
      );

      const results = await provider.sendBatch(params);

      const successCount = results.filter((r) => r.success).length;
      this.logger.log(
        `Batch email complete. Success: ${successCount}/${params.length} via ${provider.getProviderName()}`,
      );

      return results;
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      const stack = this.getErrorStack(error);
      this.logger.error(
        `Unexpected error sending batch emails: ${message}`,
        stack,
      );

      return params.map(() => ({
        success: false,
        provider: 'unknown',
        timestamp: new Date(),
        error: message || 'Unknown error occurred',
        errorCode: 'UNEXPECTED_ERROR',
      }));
    }
  }

  /**
   * Send leave request notification to manager
   */
  async sendLeaveRequestNotification(
    managerEmail: string,
    managerName: string,
    employeeName: string,
    leaveType: string,
    startDate: Date,
    endDate: Date,
    reason?: string,
  ): Promise<EmailResult> {
    const daysRequested = this.calculateDays(startDate, endDate);
    const actionUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/leave-requests`;
    const safeManagerName = escapeHtml(managerName);
    const safeEmployeeName = escapeHtml(employeeName);
    const safeLeaveType = escapeHtml(leaveType);
    const safeReason = escapeHtml(reason ?? '');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 30px; }
            .details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .detail-row { margin: 10px 0; }
            .label { font-weight: bold; color: #6B7280; }
            .value { color: #111827; }
            .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Leave Request for Review</h1>
            </div>
            <div class="content">
              <p>Hello ${safeManagerName},</p>
              <p><strong>${safeEmployeeName}</strong> has submitted a leave request that requires your approval.</p>
              
              <div class="details">
                <div class="detail-row">
                  <span class="label">Employee:</span>
                  <span class="value">${safeEmployeeName}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Leave Type:</span>
                  <span class="value">${safeLeaveType}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Start Date:</span>
                  <span class="value">${startDate.toDateString()}</span>
                </div>
                <div class="detail-row">
                  <span class="label">End Date:</span>
                  <span class="value">${endDate.toDateString()}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Duration:</span>
                  <span class="value">${daysRequested} day(s)</span>
                </div>
                ${
                  reason
                    ? `
                <div class="detail-row">
                  <span class="label">Reason:</span>
                  <span class="value">${safeReason}</span>
                </div>
                `
                    : ''
                }
              </div>

              <div style="text-align: center;">
                <a href="${actionUrl}" class="button">Review Leave Request</a>
              </div>

              <p style="margin-top: 30px; color: #6B7280; font-size: 14px;">
                Please review and approve/reject this request at your earliest convenience.
              </p>
            </div>
            <div class="footer">
              <p>This is an automated notification from your ERP system.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: managerEmail,
      subject: `Leave Request for Review: ${employeeName}`,
      html,
      tags: ['leave-request', 'approval'],
      metadata: {
        employeeName,
        leaveType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        daysRequested,
      },
    });
  }

  /**
   * Send leave approval notification to employee
   */
  async sendLeaveApprovalNotification(
    employeeEmail: string,
    employeeName: string,
    leaveType: string,
    startDate: Date,
    endDate: Date,
    approvedBy: string,
  ): Promise<EmailResult> {
    const daysApproved = this.calculateDays(startDate, endDate);
    const safeEmployeeName = escapeHtml(employeeName);
    const safeLeaveType = escapeHtml(leaveType);
    const safeApprovedBy = escapeHtml(approvedBy);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 30px; }
            .details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .detail-row { margin: 10px 0; }
            .label { font-weight: bold; color: #6B7280; }
            .value { color: #111827; }
            .success-badge { background-color: #D1FAE5; color: #065F46; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 20px 0; }
            .footer { text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Leave Request Approved</h1>
            </div>
            <div class="content">
              <p>Hello ${safeEmployeeName},</p>
              <p>Good news! Your leave request has been approved.</p>
              
              <div style="text-align: center;">
                <span class="success-badge">APPROVED</span>
              </div>

              <div class="details">
                <div class="detail-row">
                  <span class="label">Leave Type:</span>
                  <span class="value">${safeLeaveType}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Start Date:</span>
                  <span class="value">${startDate.toDateString()}</span>
                </div>
                <div class="detail-row">
                  <span class="label">End Date:</span>
                  <span class="value">${endDate.toDateString()}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Duration:</span>
                  <span class="value">${daysApproved} day(s)</span>
                </div>
                <div class="detail-row">
                  <span class="label">Approved By:</span>
                  <span class="value">${safeApprovedBy}</span>
                </div>
              </div>

              <p style="margin-top: 30px; color: #6B7280; font-size: 14px;">
                Enjoy your time off!
              </p>
            </div>
            <div class="footer">
              <p>This is an automated notification from your ERP system.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: employeeEmail,
      subject: `Leave Request Approved: ${leaveType}`,
      html,
      tags: ['leave-approval', 'notification'],
      metadata: {
        employeeName,
        leaveType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        daysApproved,
        approvedBy,
      },
    });
  }

  /**
   * Send leave rejection notification to employee
   */
  async sendLeaveRejectionNotification(
    employeeEmail: string,
    employeeName: string,
    leaveType: string,
    reason: string,
    rejectedBy: string,
  ): Promise<EmailResult> {
    const safeEmployeeName = escapeHtml(employeeName);
    const safeLeaveType = escapeHtml(leaveType);
    const safeReason = escapeHtml(reason);
    const safeRejectedBy = escapeHtml(rejectedBy);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #EF4444; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 30px; }
            .details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .detail-row { margin: 10px 0; }
            .label { font-weight: bold; color: #6B7280; }
            .value { color: #111827; }
            .rejection-badge { background-color: #FEE2E2; color: #991B1B; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 20px 0; }
            .footer { text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Leave Request Not Approved</h1>
            </div>
            <div class="content">
              <p>Hello ${safeEmployeeName},</p>
              <p>Your leave request has not been approved.</p>
              
              <div style="text-align: center;">
                <span class="rejection-badge">NOT APPROVED</span>
              </div>

              <div class="details">
                <div class="detail-row">
                  <span class="label">Leave Type:</span>
                  <span class="value">${safeLeaveType}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Rejected By:</span>
                  <span class="value">${safeRejectedBy}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Reason:</span>
                  <span class="value">${safeReason}</span>
                </div>
              </div>

              <p style="margin-top: 30px; color: #6B7280; font-size: 14px;">
                Please contact your manager if you have any questions about this decision.
              </p>
            </div>
            <div class="footer">
              <p>This is an automated notification from your ERP system.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: employeeEmail,
      subject: `Leave Request Not Approved: ${leaveType}`,
      html,
      tags: ['leave-rejection', 'notification'],
      metadata: {
        employeeName,
        leaveType,
        reason,
        rejectedBy,
      },
    });
  }

  /**
   * Get provider health status
   */
  async getProviderHealth() {
    return this.providerFactory.getAllProvidersHealth();
  }

  /**
   * Calculate number of days between two dates
   */
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

  /**
   * Convert context object to simple HTML (temporary until template renderer is implemented)
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }

    return 'Unknown error occurred';
  }

  private getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }

    if (typeof error === 'object' && error !== null && 'stack' in error) {
      const stack = (error as { stack?: unknown }).stack;
      return typeof stack === 'string' ? stack : undefined;
    }

    return undefined;
  }

  private contextToHtml(context: Record<string, unknown>): string {
    const entries = Object.entries(context);
    const rows = entries
      .map(
        ([key, value]) =>
          `<tr><td><strong>${escapeHtml(key)}:</strong></td><td>${this.formatTemplateValue(value)}</td></tr>`,
      )
      .join('');

    const title = this.formatTemplateValue(context.title ?? 'Notification');
    const message = this.formatTemplateValue(context.message ?? '');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { border-collapse: collapse; width: 100%; }
            td { padding: 8px; border-bottom: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <h2>${title}</h2>
          <p>${message}</p>
          <table>${rows}</table>
        </body>
      </html>
    `;
  }

  private formatTemplateValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return escapeHtml(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return escapeHtml(String(value));
    }

    if (typeof value === 'bigint' || typeof value === 'symbol') {
      return escapeHtml(value.toString());
    }

    if (typeof value === 'object') {
      try {
        return escapeHtml(JSON.stringify(value));
      } catch {
        return escapeHtml('[object Object]');
      }
    }

    return '';
  }

  private validateEmailParams(params: EmailParams): string | undefined {
    const recipients = Array.isArray(params.to) ? params.to : [params.to];
    const invalidRecipients = recipients.filter(
      (recipient) => !this.isValidEmailAddress(recipient),
    );

    if (invalidRecipients.length > 0) {
      return `Invalid recipient email address: ${invalidRecipients.join(', ')}`;
    }

    if (!params.subject || !params.subject.trim()) {
      return 'Email subject is required';
    }

    const cc = params.cc ?? [];
    const bcc = params.bcc ?? [];
    const combined = [...cc, ...bcc];
    const invalidCopies = combined.filter(
      (recipient) => recipient && !this.isValidEmailAddress(recipient),
    );

    if (invalidCopies.length > 0) {
      return `Invalid copy recipient email address: ${invalidCopies.join(', ')}`;
    }

    if (params.replyTo && !this.isValidEmailAddress(params.replyTo)) {
      return `Invalid reply-to email address: ${params.replyTo}`;
    }

    return undefined;
  }

  private describeRecipients(recipients: string | string[]): string {
    return Array.isArray(recipients) ? recipients.join(', ') : recipients;
  }

  private isValidEmailAddress(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private shouldRetry(result: EmailResult): boolean {
    if (!result.errorCode) {
      return false;
    }

    return ['CONNECTION_TIMEOUT', 'SMTP_ERROR', 'UNEXPECTED_ERROR'].includes(
      result.errorCode,
    );
  }

  private shouldRetryError(error: unknown): boolean {
    const code = this.getErrorCode(error);
    return (
      code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ECONNREFUSED'
    );
  }

  private getErrorCode(error: unknown): string | undefined {
    if (error instanceof Error) {
      if ('code' in error) {
        const codeValue = (error as { code?: unknown }).code;
        if (typeof codeValue === 'string') {
          return codeValue;
        }
      }
      return error.name;
    }

    if (typeof error === 'object' && error !== null && 'code' in error) {
      const value = (error as { code?: unknown }).code;
      return typeof value === 'string' ? value : undefined;
    }

    return undefined;
  }
}

// Made with Bob
