import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  BaseEmailProvider,
  EmailParams,
  EmailResult,
} from './email-provider.interface';

/**
 * Resend Email Provider
 *
 * Modern email API provider with excellent developer experience.
 * Great for transactional emails with good deliverability.
 *
 * Required Environment Variables:
 * - RESEND_API_KEY: Your Resend API key
 * - RESEND_FROM_EMAIL: Default sender email address
 * - RESEND_FROM_NAME: Default sender name (optional)
 */
@Injectable()
export class ResendProvider extends BaseEmailProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private readonly resend: Resend;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    const fromEmail = configService.get<string>('RESEND_FROM_EMAIL') || '';
    const fromName = configService.get<string>('RESEND_FROM_NAME');
    super(fromEmail, fromName);

    const apiKey = configService.get<string>('RESEND_API_KEY');

    const missing: string[] = [];
    if (!apiKey) missing.push('RESEND_API_KEY');
    if (!fromEmail) missing.push('RESEND_FROM_EMAIL');

    if (missing.length > 0) {
      this.logger.warn(
        `Resend provider not initialized. Missing env vars: ${missing.join(', ')}. Required values: RESEND_API_KEY=re_xxx, RESEND_FROM_EMAIL=noreply@yourcompany.com, RESEND_FROM_NAME=Your Company ERP`,
      );
      this.resend = new Resend('dummy-key');
      return;
    }

    this.resend = new Resend(apiKey);
    this.isInitialized = true;
    this.logger.log('Resend provider initialized successfully');
  }

  getProviderName(): string {
    return 'resend';
  }

  async send(params: EmailParams): Promise<EmailResult> {
    if (!this.isInitialized) {
      return this.createErrorResult(
        'Resend provider not initialized. Check RESEND_API_KEY configuration.',
        'PROVIDER_NOT_INITIALIZED',
      );
    }

    try {
      const recipients = this.normalizeRecipients(params.to);

      const response = await this.resend.emails.send({
        from: this.getFromAddress(params),
        to: recipients,
        subject: params.subject,
        html: params.html,
        text: params.text,
        cc: params.cc,
        bcc: params.bcc,
        replyTo: params.replyTo,
        attachments: params.attachments?.map((att) => ({
          filename: att.filename,
          content:
            att.content instanceof Buffer
              ? att.content
              : Buffer.from(att.content),
        })),
        headers: params.headers,
        tags: params.tags?.map((tag) => ({ name: 'category', value: tag })),
      });

      if (response.error) {
        const errorMessage = this.getErrorMessage(response.error);
        this.logger.error(`Resend send failed: ${errorMessage}`);
        return this.createErrorResult(
          errorMessage,
          'RESEND_ERROR',
          this.buildErrorPayload(response.error),
        );
      }

      this.logger.log(
        `Email sent successfully via Resend. MessageID: ${response.data?.id}`,
      );

      return this.createSuccessResult(response.data?.id || '', {
        id: response.data?.id,
      });
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      const stack = this.getErrorStack(error);
      this.logger.error(`Resend send failed: ${message}`, stack);

      return this.createErrorResult(
        message || 'Failed to send email via Resend',
        this.getErrorCode(error) || 'RESEND_ERROR',
        this.buildErrorPayload(error),
      );
    }
  }

  async sendBatch(params: EmailParams[]): Promise<EmailResult[]> {
    if (!this.isInitialized) {
      return params.map(() =>
        this.createErrorResult(
          'Resend provider not initialized. Check RESEND_API_KEY configuration.',
          'PROVIDER_NOT_INITIALIZED',
        ),
      );
    }

    try {
      const emails = params.map((p) => ({
        from: this.getFromAddress(p),
        to: this.normalizeRecipients(p.to),
        subject: p.subject,
        html: p.html,
        text: p.text,
        cc: p.cc,
        bcc: p.bcc,
        reply_to: p.replyTo,
        attachments: p.attachments?.map((att) => ({
          filename: att.filename,
          content:
            att.content instanceof Buffer
              ? att.content
              : Buffer.from(att.content),
        })),
        headers: p.headers,
        tags: p.tags?.map((tag) => ({ name: 'category', value: tag })),
      }));

      const response = await this.resend.batch.send(emails);

      if (response.error) {
        const errorMessage = this.getErrorMessage(response.error);
        this.logger.error(`Resend batch send failed: ${errorMessage}`);
        return params.map(() =>
          this.createErrorResult(
            errorMessage,
            'RESEND_BATCH_ERROR',
            this.buildErrorPayload(response.error),
          ),
        );
      }

      this.logger.log(
        `Batch of ${params.length} emails sent successfully via Resend`,
      );

      return (response.data?.data || []).map((item) =>
        this.createSuccessResult(item.id || '', { id: item.id }),
      );
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      const stack = this.getErrorStack(error);
      this.logger.error(`Resend batch send failed: ${message}`, stack);

      return params.map(() =>
        this.createErrorResult(
          message || 'Failed to send batch emails via Resend',
          this.getErrorCode(error) || 'RESEND_BATCH_ERROR',
          this.buildErrorPayload(error),
        ),
      );
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      // Resend doesn't have a dedicated health check endpoint
      // We'll consider it healthy if initialized
      return true;
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error(`Resend connection verification failed: ${message}`);
      return false;
    }
  }

  async getHealthStatus(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    if (!this.isInitialized) {
      return {
        healthy: false,
        error: 'Provider not initialized',
      };
    }

    const startTime = Date.now();

    try {
      const isHealthy = await this.verifyConnection();
      const latency = Date.now() - startTime;

      return {
        healthy: isHealthy,
        latency,
      };
    } catch (error: unknown) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: this.getErrorMessage(error),
      };
    }
  }
}

// Made with Bob
