import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  private readonly logger = new Logger(MailController.name);

  constructor(private readonly mailService: MailService) {}

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async sendTestEmail(@Body() body: { to: string }) {
    const recipient = body.to?.trim();

    if (!recipient) {
      return {
        success: false,
        error: 'Recipient email is required',
        provider: 'NONE',
      };
    }

    const result = await this.mailService.sendEmail({
      to: recipient,
      subject: 'SMTP Test',
      html: '<h1>SMTP Test</h1><p>This is a test email from your ERP system.</p>',
      text: 'This is a test email from your ERP system.',
    });

    this.logger.log(
      `Mail test result for recipient ${recipient.replace(/(.{2}).+@/, '$1***@')}: ${result.success ? 'sent' : 'failed'}`,
    );

    return {
      success: result.success,
      messageId: result.messageId,
      provider: (result.provider ?? 'NONE').toUpperCase(),
      accepted:
        result.providerResponse && 'accepted' in result.providerResponse
          ? result.providerResponse.accepted
          : undefined,
      rejected:
        result.providerResponse && 'rejected' in result.providerResponse
          ? result.providerResponse.rejected
          : undefined,
      error: result.error,
      errorCode: result.errorCode,
    };
  }

  @Post('debug/send-email')
  @HttpCode(HttpStatus.OK)
  async sendDebugEmail(@Body() body: { to?: string }) {
    const debugRecipient = body.to?.trim();

    if (!debugRecipient) {
      return {
        success: false,
        error: 'Recipient email is required',
        provider: 'NONE',
      };
    }

    this.logger.log(`Debug mail endpoint sending to ${debugRecipient}`);
    return this.sendTestEmail({ to: debugRecipient });
  }
}
