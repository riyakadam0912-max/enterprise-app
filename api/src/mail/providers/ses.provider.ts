import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  BaseEmailProvider,
  EmailParams,
  EmailResult,
} from './email-provider.interface';

/**
 * AWS SES Email Provider
 *
 * Production-ready email provider using AWS Simple Email Service.
 * Cost-effective solution for high-volume email sending.
 *
 * Required Environment Variables:
 * - AWS_SES_REGION: AWS region (e.g., us-east-1)
 * - AWS_SES_ACCESS_KEY_ID: AWS access key
 * - AWS_SES_SECRET_ACCESS_KEY: AWS secret key
 * - AWS_SES_FROM_EMAIL: Default sender email address
 * - AWS_SES_FROM_NAME: Default sender name (optional)
 */
@Injectable()
export class SESProvider extends BaseEmailProvider {
  private readonly logger = new Logger(SESProvider.name);
  private readonly sesClient: SESClient;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    const fromEmail = configService.get<string>('AWS_SES_FROM_EMAIL') || '';
    const fromName = configService.get<string>('AWS_SES_FROM_NAME');
    super(fromEmail, fromName);

    const region = configService.get<string>('AWS_SES_REGION');
    const accessKeyId = configService.get<string>('AWS_SES_ACCESS_KEY_ID');
    const secretAccessKey = configService.get<string>(
      'AWS_SES_SECRET_ACCESS_KEY',
    );

    if (!region || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'AWS SES credentials not fully configured. SES provider will not work.',
      );
      this.sesClient = new SESClient({ region: 'us-east-1' }); // Dummy client
    } else {
      this.sesClient = new SESClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.isInitialized = true;
      this.logger.log('AWS SES provider initialized successfully');
    }
  }

  getProviderName(): string {
    return 'aws-ses';
  }

  async send(params: EmailParams): Promise<EmailResult> {
    if (!this.isInitialized) {
      return this.createErrorResult(
        'AWS SES provider not initialized. Check AWS credentials configuration.',
        'PROVIDER_NOT_INITIALIZED',
      );
    }

    try {
      const recipients = this.normalizeRecipients(params.to);

      const command = new SendEmailCommand({
        Source: this.getFromAddress(params),
        Destination: {
          ToAddresses: recipients,
          CcAddresses: params.cc,
          BccAddresses: params.bcc,
        },
        Message: {
          Subject: {
            Data: params.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: params.html,
              Charset: 'UTF-8',
            },
            ...(params.text && {
              Text: {
                Data: params.text,
                Charset: 'UTF-8',
              },
            }),
          },
        },
        ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
        Tags: params.tags?.map((tag) => ({
          Name: 'category',
          Value: tag,
        })),
      });

      const response = await this.sesClient.send(command);
      const messageId = response.MessageId || '';

      this.logger.log(
        `Email sent successfully via AWS SES. MessageID: ${messageId}`,
      );

      return this.createSuccessResult(messageId, {
        messageId,
        requestId: response.$metadata.requestId,
      });
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      const stack = this.getErrorStack(error);
      this.logger.error(`AWS SES send failed: ${message}`, stack);

      return this.createErrorResult(
        message || 'Failed to send email via AWS SES',
        this.getErrorCode(error) || 'SES_ERROR',
        this.buildErrorPayload(error),
      );
    }
  }

  async sendBatch(params: EmailParams[]): Promise<EmailResult[]> {
    // AWS SES doesn't have a native batch send API
    // We'll send emails sequentially with error handling for each
    const results: EmailResult[] = [];

    for (const emailParams of params) {
      const result = await this.send(emailParams);
      results.push(result);

      // Add small delay to avoid rate limiting
      if (results.length < params.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.logger.log(
      `Batch of ${params.length} emails processed via AWS SES. Success: ${results.filter((r) => r.success).length}`,
    );

    return results;
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      // Try to get account sending statistics as a health check
      const { GetAccountSendingEnabledCommand } =
        await import('@aws-sdk/client-ses');
      const command = new GetAccountSendingEnabledCommand({});
      await this.sesClient.send(command);
      return true;
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error(`AWS SES connection verification failed: ${message}`);
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
