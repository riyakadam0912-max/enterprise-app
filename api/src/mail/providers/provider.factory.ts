import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmailProvider } from './email-provider.interface';
import { NoopEmailProvider } from './noop.provider';
import { SendGridProvider } from './sendgrid.provider';
import { SESProvider } from './ses.provider';
import { ResendProvider } from './resend.provider';
import { NodemailerProvider } from './nodemailer.provider';

export type EmailProviderType =
  | 'sendgrid'
  | 'ses'
  | 'resend'
  | 'none'
  | 'postmark'
  | 'nodemailer';

/**
 * Email Provider Factory
 *
 * Creates and manages email provider instances based on configuration.
 * Supports multiple providers with automatic failover capability.
 *
 * Environment Variable:
 * - EMAIL_PROVIDER: Primary provider to use (sendgrid | ses | resend | none | postmark)
 * - EMAIL_FALLBACK_PROVIDER: Backup provider if primary fails (optional)
 */
@Injectable()
export class EmailProviderFactory {
  private readonly logger = new Logger(EmailProviderFactory.name);
  private primaryProvider: IEmailProvider;
  private fallbackProvider?: IEmailProvider;
  private readonly providerType: EmailProviderType;
  private readonly initializationSummary: {
    provider: EmailProviderType;
    initialized: boolean;
    missingEnv: string[];
  };

  constructor(private readonly configService: ConfigService) {
    this.providerType = this.getProviderType();
    const missingEnv = this.getMissingEnvVars(this.providerType);
    this.initializationSummary = {
      provider: this.providerType,
      initialized: missingEnv.length === 0,
      missingEnv,
    };

    this.primaryProvider = this.createProvider(this.providerType);

    const fallbackType = this.getFallbackProviderType(this.providerType);
    if (fallbackType) {
      this.fallbackProvider = this.createProvider(fallbackType);
      this.logger.log(
        `Fallback email provider configured: ${fallbackType.toUpperCase()}`,
      );
    }

    this.logger.log(`--- Email System Initialization ---`);
    this.logger.log(`Selected Provider: ${this.providerType.toUpperCase()}`);
    this.logger.log(
      `Provider Initialized: ${this.initializationSummary.initialized}`,
    );
    if (this.initializationSummary.missingEnv.length > 0) {
      this.logger.error(
        `Missing Env Vars for ${this.providerType.toUpperCase()}: ${this.initializationSummary.missingEnv.join(', ')}`,
      );
    }

    // Log provider-specific info
    let fromEmail = '';
    let fromName = '';
    switch (this.providerType) {
      case 'sendgrid':
        fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL') || '';
        fromName = this.configService.get<string>('SENDGRID_FROM_NAME') || '';
        break;
      case 'resend':
        fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || '';
        fromName = this.configService.get<string>('RESEND_FROM_NAME') || '';
        break;
      case 'ses':
        fromEmail = this.configService.get<string>('AWS_SES_FROM_EMAIL') || '';
        fromName = this.configService.get<string>('AWS_SES_FROM_NAME') || '';
        break;
      case 'nodemailer':
        fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') || '';
        fromName = this.configService.get<string>('SMTP_FROM_NAME') || '';
        this.logger.log(
          `SMTP Host: ${this.configService.get<string>('SMTP_HOST') ? 'configured' : '(not set)'}`,
        );
        this.logger.log(
          `SMTP Port: ${this.configService.get<string>('SMTP_PORT') ? 'configured' : '(not set)'}`,
        );
        this.logger.log(
          `SMTP User: ${this.configService.get<string>('SMTP_USER') ? 'configured' : '(not set)'}`,
        );
        break;
    }
    this.logger.log(`Sender Email: ${fromEmail || '(not set)'}`);
    this.logger.log(`Sender Name: ${fromName || '(not set)'}`);
    this.logger.log(`----------------------------------`);
  }

  /**
   * Get the active email provider
   * Returns primary provider, or fallback if primary is unhealthy
   */
  async getProvider(): Promise<IEmailProvider> {
    // Check primary provider health
    const primaryHealth = await this.primaryProvider.getHealthStatus();

    if (primaryHealth.healthy) {
      return this.primaryProvider;
    }

    this.logger.warn(
      `Primary provider (${this.primaryProvider.getProviderName()}) is unhealthy: ${primaryHealth.error}`,
    );

    // Try fallback provider if available
    if (this.fallbackProvider) {
      const fallbackHealth = await this.fallbackProvider.getHealthStatus();

      if (fallbackHealth.healthy) {
        this.logger.log(
          `Switching to fallback provider: ${this.fallbackProvider.getProviderName()}`,
        );
        return this.fallbackProvider;
      }

      this.logger.error(
        `Fallback provider (${this.fallbackProvider.getProviderName()}) is also unhealthy: ${fallbackHealth.error}`,
      );
    }

    // Return primary provider anyway (will fail gracefully)
    this.logger.error(
      'All email providers are unhealthy. Returning primary provider.',
    );
    return this.primaryProvider;
  }

  /**
   * Get provider without health check (for testing/admin purposes)
   */
  getPrimaryProvider(): IEmailProvider {
    return this.primaryProvider;
  }

  /**
   * Get fallback provider if configured
   */
  getFallbackProvider(): IEmailProvider | undefined {
    return this.fallbackProvider;
  }

  getStartupStatus(): {
    provider: EmailProviderType;
    initialized: boolean;
    missingEnv: string[];
  } {
    return this.initializationSummary;
  }

  getAuthorizedSenderEmails(): string[] {
    const configured =
      this.configService.get<string>('EMAIL_ALLOWED_SENDER_EMAILS') || '';
    return configured
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }

  isSenderEmailAuthorized(senderEmail: string): boolean {
    const normalized = senderEmail.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    const configuredSenders = this.getAuthorizedSenderEmails();
    if (configuredSenders.length === 0) {
      const defaultFromEmail =
        this.configService.get<string>('SMTP_FROM_EMAIL') ||
        this.configService.get<string>('SENDGRID_FROM_EMAIL') ||
        this.configService.get<string>('RESEND_FROM_EMAIL') ||
        this.configService.get<string>('AWS_SES_FROM_EMAIL') ||
        '';
      return normalized === defaultFromEmail.trim().toLowerCase();
    }

    return configuredSenders.includes(normalized);
  }

  /**
   * Get health status of all configured providers
   */
  async getAllProvidersHealth(): Promise<{
    primary: {
      name: string;
      healthy: boolean;
      latency?: number;
      error?: string;
    };
    fallback?: {
      name: string;
      healthy: boolean;
      latency?: number;
      error?: string;
    };
  }> {
    const primaryHealth = await this.primaryProvider.getHealthStatus();

    const result: {
      primary: {
        name: string;
        healthy: boolean;
        latency?: number;
        error?: string;
      };
      fallback?: {
        name: string;
        healthy: boolean;
        latency?: number;
        error?: string;
      };
    } = {
      primary: {
        name: this.primaryProvider.getProviderName(),
        ...primaryHealth,
      },
    };

    if (this.fallbackProvider) {
      const fallbackHealth = await this.fallbackProvider.getHealthStatus();
      result.fallback = {
        name: this.fallbackProvider.getProviderName(),
        ...fallbackHealth,
      };
    }

    return result;
  }

  private getProviderType(): EmailProviderType {
    const configured = this.configService.get<string>('EMAIL_PROVIDER');
    const isProduction = process.env.NODE_ENV === 'production';

    if (configured) {
      const provider = configured.toLowerCase();

      if (!this.isValidProviderType(provider)) {
        if (!isProduction) {
          this.logger.warn(
            `Invalid EMAIL_PROVIDER: ${configured}. Falling back to NONE in development.`,
          );
          return 'none';
        }

        throw new Error(
          `Invalid EMAIL_PROVIDER: ${configured}. Valid options: sendgrid, ses, resend, none, postmark`,
        );
      }

      if (provider === 'none') {
        if (isProduction) {
          throw new Error(
            'EMAIL_PROVIDER=NONE is not allowed in production. Configure SENDGRID, RESEND, or SES instead.',
          );
        }

        return 'none';
      }

      if (isProduction) {
        const placeholderChecks = [
          this.configService.get<string>('SENDGRID_API_KEY'),
          this.configService.get<string>('RESEND_API_KEY'),
          this.configService.get<string>('AWS_SES_ACCESS_KEY_ID'),
          this.configService.get<string>('SMTP_PASS'),
          this.configService.get<string>('SENDGRID_FROM_EMAIL'),
          this.configService.get<string>('RESEND_FROM_EMAIL'),
          this.configService.get<string>('AWS_SES_FROM_EMAIL'),
          this.configService.get<string>('SMTP_FROM_EMAIL'),
        ].filter((value): value is string => Boolean(value));

        if (
          placeholderChecks.some((value) =>
            /replace-with-|your_|your-|example|dummy|test-secret|localhost|@example\.com/i.test(
              value,
            ),
          )
        ) {
          throw new Error(
            'Production email configuration contains placeholder or non-production values.',
          );
        }
      }

      if (this.getMissingEnvVars(provider as EmailProviderType).length === 0) {
        return provider as EmailProviderType;
      }

      if (!isProduction) {
        this.logger.warn(
          `EMAIL_PROVIDER=${configured} is missing required env vars. Falling back to NONE in development.`,
        );
        return 'none';
      }

      throw new Error(
        this.buildMissingProviderError(provider as EmailProviderType),
      );
    }

    if (!isProduction) {
      this.logger.log(
        'EMAIL_PROVIDER not set. Using NONE for local development.',
      );
      return 'none';
    }

    throw new Error(this.buildNoProviderConfiguredError());
  }

  private getFallbackProviderType(
    primary: EmailProviderType,
  ): EmailProviderType | undefined {
    if (primary === 'none') {
      return undefined;
    }

    const configuredFallback = this.configService.get<string>(
      'EMAIL_FALLBACK_PROVIDER',
    );
    if (configuredFallback) {
      const normalized = configuredFallback.toLowerCase();
      if (this.isValidProviderType(normalized) && normalized !== primary) {
        return normalized as EmailProviderType;
      }
    }

    return undefined;
  }

  private getMissingEnvVars(provider: EmailProviderType): string[] {
    switch (provider) {
      case 'sendgrid': {
        const missing: string[] = [];
        if (!this.configService.get<string>('SENDGRID_API_KEY'))
          missing.push('SENDGRID_API_KEY');
        if (!this.configService.get<string>('SENDGRID_FROM_EMAIL'))
          missing.push('SENDGRID_FROM_EMAIL');
        return missing;
      }
      case 'ses': {
        const missing: string[] = [];
        if (!this.configService.get<string>('AWS_SES_REGION'))
          missing.push('AWS_SES_REGION');
        if (!this.configService.get<string>('AWS_SES_ACCESS_KEY_ID'))
          missing.push('AWS_SES_ACCESS_KEY_ID');
        if (!this.configService.get<string>('AWS_SES_SECRET_ACCESS_KEY'))
          missing.push('AWS_SES_SECRET_ACCESS_KEY');
        if (!this.configService.get<string>('AWS_SES_FROM_EMAIL'))
          missing.push('AWS_SES_FROM_EMAIL');
        return missing;
      }
      case 'resend': {
        const missing: string[] = [];
        if (!this.configService.get<string>('RESEND_API_KEY'))
          missing.push('RESEND_API_KEY');
        if (!this.configService.get<string>('RESEND_FROM_EMAIL'))
          missing.push('RESEND_FROM_EMAIL');
        return missing;
      }
      case 'nodemailer': {
        const missing: string[] = [];
        if (!this.configService.get<string>('SMTP_HOST'))
          missing.push('SMTP_HOST');
        if (!this.configService.get<string>('SMTP_PORT'))
          missing.push('SMTP_PORT');
        if (!this.configService.get<string>('SMTP_USER'))
          missing.push('SMTP_USER');
        if (!this.configService.get<string>('SMTP_PASS'))
          missing.push('SMTP_PASS');
        if (!this.configService.get<string>('SMTP_FROM_EMAIL'))
          missing.push('SMTP_FROM_EMAIL');
        return missing;
      }
      case 'none':
        return [];
      case 'postmark':
        return ['POSTMARK_SERVER_TOKEN', 'POSTMARK_FROM_EMAIL'];
      default:
        return [];
    }
  }

  private buildMissingProviderError(provider: EmailProviderType): string {
    const missing = this.getMissingEnvVars(provider);
    const examples: Record<EmailProviderType, string> = {
      sendgrid:
        'EMAIL_PROVIDER=SENDGRID, SENDGRID_API_KEY=SG_xxx, SENDGRID_FROM_EMAIL=noreply@yourcompany.com, SENDGRID_FROM_NAME=Your Company ERP',
      ses: 'EMAIL_PROVIDER=SES, AWS_SES_REGION=us-east-1, AWS_SES_ACCESS_KEY_ID=..., AWS_SES_SECRET_ACCESS_KEY=..., AWS_SES_FROM_EMAIL=noreply@yourcompany.com, AWS_SES_FROM_NAME=Your Company ERP',
      resend:
        'EMAIL_PROVIDER=RESEND, RESEND_API_KEY=re_xxx, RESEND_FROM_EMAIL=noreply@yourcompany.com, RESEND_FROM_NAME=Your Company ERP',
      nodemailer:
        'EMAIL_PROVIDER=NODEMAILER, SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_SECURE=false, SMTP_USER=yourgmail@gmail.com, SMTP_PASS=your_app_password, SMTP_FROM_EMAIL=yourgmail@gmail.com, SMTP_FROM_NAME=Enterprise ERP',
      none: 'EMAIL_PROVIDER=NONE',
      postmark:
        'EMAIL_PROVIDER=POSTMARK, POSTMARK_SERVER_TOKEN=..., POSTMARK_FROM_EMAIL=noreply@yourcompany.com',
    };

    return `Mail provider ${provider.toUpperCase()} is not configured. Missing env vars: ${missing.join(', ')}. Required values: ${examples[provider]}`;
  }

  private buildNoProviderConfiguredError(): string {
    return [
      'No mail provider is configured.',
      'Set EMAIL_PROVIDER to NONE for development, or RESEND, SENDGRID, or SES for sending email.',
      'Examples:',
      'EMAIL_PROVIDER=NONE',
      'or',
      'EMAIL_PROVIDER=RESEND',
      'RESEND_API_KEY=re_xxx',
      'RESEND_FROM_EMAIL=noreply@yourcompany.com',
      'RESEND_FROM_NAME=Your Company ERP',
      'or',
      'EMAIL_PROVIDER=SENDGRID',
      'SENDGRID_API_KEY=SG_xxx',
      'SENDGRID_FROM_EMAIL=noreply@yourcompany.com',
      'SENDGRID_FROM_NAME=Your Company ERP',
    ].join(' ');
  }

  private isValidProviderType(provider: string): boolean {
    return ['sendgrid', 'ses', 'resend', 'postmark', 'nodemailer'].includes(
      provider.toLowerCase(),
    );
  }

  private createProvider(type: EmailProviderType): IEmailProvider {
    switch (type) {
      case 'none':
        return new NoopEmailProvider();

      case 'sendgrid':
        return new SendGridProvider(this.configService);

      case 'ses':
        return new SESProvider(this.configService);

      case 'resend':
        return new ResendProvider(this.configService);

      case 'nodemailer':
        return new NodemailerProvider(this.configService);

      case 'postmark':
        // Postmark provider not yet implemented
        this.logger.warn(
          'Postmark provider not yet implemented. Falling back to SendGrid.',
        );
        return new SendGridProvider(this.configService);

      default:
        this.logger.warn(
          'Unknown provider type. Falling back to Noop provider.',
        );
        return new NoopEmailProvider();
    }
  }
}

// Made with Bob
