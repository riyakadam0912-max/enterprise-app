import { Injectable, Logger } from '@nestjs/common';
import {
  BaseEmailProvider,
  EmailParams,
  EmailResult,
} from './email-provider.interface';

@Injectable()
export class NoopEmailProvider extends BaseEmailProvider {
  private readonly logger = new Logger(NoopEmailProvider.name);

  constructor() {
    super('noop@localhost');
    this.logger.log('Noop email provider initialized');
  }

  getProviderName(): string {
    return 'noop';
  }

  async send(params: EmailParams): Promise<EmailResult> {
    const recipients = Array.isArray(params.to)
      ? params.to.join(', ')
      : params.to;
    const fromAddress = this.getFromAddress(params);
    this.logger.log(
      `Noop email provider: logged email FROM ${fromAddress} TO ${recipients} with subject "${params.subject}" and ${params.attachments?.length ?? 0} attachment(s)`,
    );

    return this.createSuccessResult('noop-message', {
      loggedOnly: true,
      from: fromAddress,
      to: recipients,
      subject: params.subject,
      attachmentCount: params.attachments?.length ?? 0,
    });
  }

  async sendBatch(params: EmailParams[]): Promise<EmailResult[]> {
    return Promise.all(params.map((email) => this.send(email)));
  }

  async verifyConnection(): Promise<boolean> {
    return true;
  }

  async getHealthStatus(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    return { healthy: true, latency: 0 };
  }
}
