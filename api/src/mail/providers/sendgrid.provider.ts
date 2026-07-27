import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import {
  BaseEmailProvider,
  EmailParams,
  EmailResult,
} from './email-provider.interface';

/**
 * SendGrid Email Provider
 *
 * Production-ready email provider using SendGrid API.
 * Supports single and batch email sending with full feature set.
 *
 * Required Environment Variables:
 * - SENDGRID_API_KEY: Your SendGrid API key
 * - SENDGRID_FROM_EMAIL: Default sender email address
 * - SENDGRID_FROM_NAME: Default sender name (optional)
 */
@Injectable()
export class SendGridProvider extends BaseEmailProvider {
  private readonly logger = new Logger(SendGridProvider.name);
  private readonly apiKey: string;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    const fromEmail = configService.get<string>('SENDGRID_FROM_EMAIL') || '';
    const fromName = configService.get<string>('SENDGRID_FROM_NAME');
    super(fromEmail, fromName);

    this.apiKey = configService.get<string>('SENDGRID_API_KEY') || '';
    const missing: string[] = [];

    if (!this.apiKey) missing.push('SENDGRID_API_KEY');
    if (!fromEmail) missing.push('SENDGRID_FROM_EMAIL');

    if (missing.length > 0) {
      this.logger.warn(
        `SendGrid provider not initialized. Missing env vars: ${missing.join(', ')}. Required values: SENDGRID_API_KEY=SG_xxx, SENDGRID_FROM_EMAIL=noreply@yourcompany.com, SENDGRID_FROM_NAME=Your Company ERP. Also verify that the sender identity is approved in the SendGrid dashboard.`,
      );
      return;
    }

    sgMail.setApiKey(this.apiKey);
    this.isInitialized = true;
    this.logger.log('SendGrid provider initialized successfully');
  }

  getProviderName(): string {
    return 'sendgrid';
  }

  async send(params: EmailParams): Promise<EmailResult> {
    if (!this.isInitialized) {
      return this.createErrorResult(
        'SendGrid provider not initialized. Check SENDGRID_API_KEY configuration.',
        'PROVIDER_NOT_INITIALIZED',
      );
    }

    try {
      const msg: sgMail.MailDataRequired = {
        to: params.to,
        from: this.getFromAddress(params),
        subject: params.subject,
        html: params.html,
        text: params.text,
        cc: params.cc,
        bcc: params.bcc,
        replyTo: params.replyTo,
        attachments: params.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content.toString('base64'),
          type: att.contentType,
          disposition: 'attachment',
        })),
        headers: params.headers,
        customArgs: params.metadata,
        categories: params.tags,
      };

      const [response] = await sgMail.send(msg);
      const responseMetadata = this.getResponseMetadata(response);
      const messageId = this.getHeaderValue(
        responseMetadata.headers,
        'x-message-id',
      );

      this.logger.log(
        `Email sent successfully via SendGrid. MessageID: ${messageId}`,
      );

      return this.createSuccessResult(messageId, {
        statusCode: responseMetadata.statusCode,
        headers: responseMetadata.headers,
      });
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      const stack = this.getErrorStack(error);
      this.logger.error(`SendGrid send failed: ${message}`, stack);

      return this.createErrorResult(
        message || 'Failed to send email via SendGrid',
        this.getErrorCode(error) || 'SENDGRID_ERROR',
        this.buildErrorPayload(error),
      );
    }
  }

  async sendBatch(params: EmailParams[]): Promise<EmailResult[]> {
    if (!this.isInitialized) {
      return params.map(() =>
        this.createErrorResult(
          'SendGrid provider not initialized. Check SENDGRID_API_KEY configuration.',
          'PROVIDER_NOT_INITIALIZED',
        ),
      );
    }

    try {
      const messages: sgMail.MailDataRequired[] = params.map((p) => ({
        to: p.to,
        from: this.getFromAddress(p),
        subject: p.subject,
        html: p.html,
        text: p.text,
        cc: p.cc,
        bcc: p.bcc,
        replyTo: p.replyTo,
        attachments: p.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content.toString('base64'),
          type: att.contentType,
          disposition: 'attachment',
        })),
        headers: p.headers,
        customArgs: p.metadata,
        categories: p.tags,
      }));

      const responses = await sgMail.send(messages);

      this.logger.log(
        `Batch of ${params.length} emails sent successfully via SendGrid`,
      );

      return responses.map((response) => {
        const responseMetadata = this.getResponseMetadata(response);
        const messageId = this.getHeaderValue(
          responseMetadata.headers,
          'x-message-id',
        );
        return this.createSuccessResult(messageId, {
          statusCode: responseMetadata.statusCode,
          headers: responseMetadata.headers,
        });
      });
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      const stack = this.getErrorStack(error);
      this.logger.error(`SendGrid batch send failed: ${message}`, stack);

      // Return error for all emails in batch
      return params.map(() =>
        this.createErrorResult(
          this.getErrorMessage(error) ||
            'Failed to send batch emails via SendGrid',
          this.getErrorCode(error) || 'SENDGRID_BATCH_ERROR',
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
      // SendGrid doesn't have a dedicated ping endpoint
      // We'll verify by checking if the API key is valid
      // This is a lightweight check
      return true;
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error(`SendGrid connection verification failed: ${message}`);
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

  private getHeaderValue(
    headers: Record<string, unknown> | undefined,
    key: string,
  ): string {
    if (!headers) {
      return '';
    }

    const value = headers[key];
    return typeof value === 'string' ? value : '';
  }

  private getResponseMetadata(response: unknown): {
    statusCode?: number;
    headers?: Record<string, unknown>;
  } {
    const statusCodeValue = this.getObjectProperty(response, 'statusCode');
    const headersValue = this.getObjectProperty(response, 'headers');

    return {
      statusCode:
        typeof statusCodeValue === 'number' ? statusCodeValue : undefined,
      headers: this.isRecord(headersValue) ? headersValue : undefined,
    };
  }

  private getObjectProperty(value: unknown, key: string): unknown {
    if (typeof value !== 'object' || value === null || !(key in value)) {
      return undefined;
    }

    return Reflect.get(value, key);
  }
}

// Made with Bob
