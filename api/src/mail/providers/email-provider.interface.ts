/**
 * Email Provider Interface
 *
 * Defines the contract that all email providers must implement.
 * This abstraction allows switching between different email services
 * (SendGrid, AWS SES, Resend, Postmark, etc.) without changing business logic.
 */

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
}

export interface EmailParams {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider: string;
  timestamp: Date;
  error?: string;
  errorCode?: string;
  providerResponse?: Record<string, unknown> | undefined;
}

export interface IEmailProvider {
  /**
   * Send a single email
   */
  send(params: EmailParams): Promise<EmailResult>;

  /**
   * Send multiple emails in batch
   */
  sendBatch(params: EmailParams[]): Promise<EmailResult[]>;

  /**
   * Verify that the provider connection is working
   */
  verifyConnection(): Promise<boolean>;

  /**
   * Get the provider name (for logging and monitoring)
   */
  getProviderName(): string;

  /**
   * Get provider health status
   */
  getHealthStatus(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }>;
}

export abstract class BaseEmailProvider implements IEmailProvider {
  protected defaultFrom: string;
  protected defaultFromName?: string;

  constructor(defaultFrom: string, defaultFromName?: string) {
    this.defaultFrom = defaultFrom;
    this.defaultFromName = defaultFromName;
  }

  abstract send(params: EmailParams): Promise<EmailResult>;
  abstract sendBatch(params: EmailParams[]): Promise<EmailResult[]>;
  abstract verifyConnection(): Promise<boolean>;
  abstract getProviderName(): string;
  abstract getHealthStatus(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }>;

  protected getFromAddress(params: EmailParams): string {
    if (params.from) {
      return params.from;
    }
    if (this.defaultFromName) {
      return `${this.defaultFromName} <${this.defaultFrom}>`;
    }
    return this.defaultFrom;
  }

  protected normalizeRecipients(recipients: string | string[]): string[] {
    return Array.isArray(recipients) ? recipients : [recipients];
  }

  protected createSuccessResult(
    messageId: string,
    providerResponse?: Record<string, unknown>,
  ): EmailResult {
    return {
      success: true,
      messageId,
      provider: this.getProviderName(),
      timestamp: new Date(),
      providerResponse,
    };
  }

  protected createErrorResult(
    error: string,
    errorCode?: string,
    providerResponse?: Record<string, unknown>,
  ): EmailResult {
    return {
      success: false,
      provider: this.getProviderName(),
      timestamp: new Date(),
      error,
      errorCode,
      providerResponse,
    };
  }

  protected getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (this.isRecord(error) && typeof error.message === 'string') {
      return error.message;
    }

    return 'Unknown error occurred';
  }

  protected getErrorCode(error: unknown): string | undefined {
    if (this.isRecord(error)) {
      if (typeof error.code === 'string') {
        return error.code;
      }
      if (typeof error.name === 'string') {
        return error.name;
      }
    }

    return undefined;
  }

  protected getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }

    if (this.isRecord(error) && typeof error.stack === 'string') {
      return error.stack;
    }

    return undefined;
  }

  protected getErrorResponse(
    error: unknown,
  ): Record<string, unknown> | undefined {
    if (this.isRecord(error) && this.isRecord(error.response)) {
      return error.response;
    }

    return undefined;
  }

  protected getErrorStatusCode(error: unknown): string | number | undefined {
    if (this.isRecord(error)) {
      if (
        typeof error.statusCode === 'string' ||
        typeof error.statusCode === 'number'
      ) {
        return error.statusCode;
      }
      if (typeof error.code === 'string' || typeof error.code === 'number') {
        return error.code;
      }
    }

    return undefined;
  }

  protected buildErrorPayload(error: unknown): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const message = this.getErrorMessage(error);
    if (message) {
      payload.message = message;
    }

    const code = this.getErrorCode(error);
    if (code) {
      payload.code = code;
    }

    const stack = this.getErrorStack(error);
    if (stack) {
      payload.stack = stack;
    }

    const response = this.getErrorResponse(error);
    if (response) {
      payload.response = response;
    }

    const statusCode = this.getErrorStatusCode(error);
    if (statusCode !== undefined) {
      payload.statusCode = statusCode;
    }

    return payload;
  }

  protected isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}

// Made with Bob
