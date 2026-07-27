import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  BaseEmailProvider,
  EmailParams,
  EmailResult,
} from './email-provider.interface';

@Injectable()
export class NodemailerProvider extends BaseEmailProvider {
  private readonly logger = new Logger(NodemailerProvider.name);
  private transporter: nodemailer.Transporter;
  private isInitialized = false;
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly smtpUser: string;
  private readonly smtpSecure: boolean;

  constructor(private readonly configService: ConfigService) {
    const fromEmail = configService.get<string>('SMTP_FROM_EMAIL') || '';
    const fromName = configService.get<string>('SMTP_FROM_NAME');
    super(fromEmail, fromName);

    this.smtpHost = (configService.get<string>('SMTP_HOST') || '').trim();
    this.smtpPort = Number(configService.get<number>('SMTP_PORT') ?? 2525);
    this.smtpSecure = configService.get<boolean>('SMTP_SECURE') ?? false;
    this.smtpUser = (configService.get<string>('SMTP_USER') || '').trim();
    const smtpPass = (configService.get<string>('SMTP_PASS') || '').trim();

    const missing: string[] = [];
    if (!this.smtpHost) missing.push('SMTP_HOST');
    if (!this.smtpUser) missing.push('SMTP_USER');
    if (!smtpPass) missing.push('SMTP_PASS');
    if (!fromEmail) missing.push('SMTP_FROM_EMAIL');

    if (missing.length > 0) {
      this.logger.warn(
        `Nodemailer provider not initialized. Missing env vars: ${missing.join(', ')}`,
      );
      this.transporter = nodemailer.createTransport({
        host: 'localhost',
        port: 25,
        secure: false,
      });
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpSecure,
      auth: {
        user: this.smtpUser,
        pass: smtpPass,
      },
      logger: false,
      debug: false,
    });

    this.isInitialized = true;
    this.logger.log('Nodemailer provider initialized successfully');

    const verifyOnStartup =
      this.configService.get<boolean>('SMTP_VERIFY_ON_STARTUP') ?? true;
    if (verifyOnStartup) {
      this.verifyConnection()
        .then((connected) => {
          this.logger.log(
            `SMTP connection status: ${connected ? 'SUCCESS' : 'FAILED'}`,
          );
        })
        .catch((error) => {
          this.logger.error(
            'SMTP connection verification failed on startup',
            error,
          );
        });
    }
  }

  getProviderName(): string {
    return 'nodemailer';
  }

  async send(params: EmailParams): Promise<EmailResult> {
    this.logger.log('NodemailerProvider.send called');
    if (!this.isInitialized) {
      return this.createErrorResult(
        'Nodemailer provider not initialized. Check SMTP configuration.',
        'PROVIDER_NOT_INITIALIZED',
      );
    }

    try {
      const to = this.normalizeRecipients(params.to);
      const from = this.getFromAddress(params);

      const mailOptions: nodemailer.SendMailOptions = {
        to,
        from,
        subject: params.subject,
        html: params.html,
        text: params.text,
        cc: params.cc,
        bcc: params.bcc,
        replyTo: params.replyTo,
        attachments: params.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
        headers: params.headers,
      };

      this.logger.log(
        `Sending mail via ${this.smtpHost}:${this.smtpPort} to ${to.join(', ')}`,
      );

      const info = (await this.transporter.sendMail(mailOptions)) as {
        messageId?: string;
        accepted?: string[];
        rejected?: string[];
        response?: string;
      };
      const messageId =
        typeof info.messageId === 'string' ? info.messageId : '';
      this.logger.log(
        `Email sent successfully via Nodemailer. MessageID: ${messageId}. Response: ${info.response ?? 'n/a'}`,
      );

      return this.createSuccessResult(messageId, {
        messageId,
        accepted: Array.isArray(info.accepted) ? info.accepted : undefined,
        rejected: Array.isArray(info.rejected) ? info.rejected : undefined,
        response: info.response,
      });
    } catch (error: unknown) {
      this.logger.error('Exception in NodemailerProvider.send:', error);
      const message = this.getErrorMessage(error);
      const stack = this.getErrorStack(error);
      this.logger.error(`Nodemailer send failed: ${message}`, stack);

      let errorCode = 'SMTP_ERROR';
      const errorRecord = this.getErrorRecord(error);
      if (errorRecord?.code === 'EAUTH') {
        errorCode = 'AUTHENTICATION_FAILURE';
      } else if (errorRecord?.code === 'ECONNREFUSED') {
        errorCode = 'CONNECTION_REFUSED';
      } else if (errorRecord?.code === 'ETIMEDOUT') {
        errorCode = 'CONNECTION_TIMEOUT';
      }

      return this.createErrorResult(
        message || 'Failed to send email via Nodemailer',
        errorCode,
        this.buildErrorPayload(error),
      );
    }
  }

  async sendBatch(params: EmailParams[]): Promise<EmailResult[]> {
    if (!this.isInitialized) {
      return params.map(() =>
        this.createErrorResult(
          'Nodemailer provider not initialized. Check SMTP configuration.',
          'PROVIDER_NOT_INITIALIZED',
        ),
      );
    }

    const results: EmailResult[] = [];
    for (const emailParams of params) {
      const result = await this.send(emailParams);
      results.push(result);
    }
    return results;
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      return Promise.resolve(this.transporter.verify());
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error(
        `Nodemailer connection verification failed: ${message}`,
      );
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

  private getErrorRecord(error: unknown): { code?: string } | undefined {
    if (typeof error === 'object' && error !== null) {
      const record = error as { code?: unknown };
      if (typeof record.code === 'string') {
        return { code: record.code };
      }
    }

    return undefined;
  }

  getSmtpInfo() {
    return {
      host: this.smtpHost,
      port: this.smtpPort,
      user: this.smtpUser,
      fromEmail: this.defaultFrom,
    };
  }
}
