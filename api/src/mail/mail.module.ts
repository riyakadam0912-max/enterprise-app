import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { EmailProviderFactory } from './providers/provider.factory';
import { MailController } from './mail.controller';

/**
 * Mail Module
 *
 * Provides enterprise-grade email functionality with:
 * - Multiple provider support (SendGrid, AWS SES, Resend)
 * - Automatic failover between providers
 * - Production-ready email delivery
 * - Comprehensive error handling and logging
 */
@Module({
  imports: [ConfigModule],
  controllers: [MailController],
  providers: [MailService, EmailProviderFactory],
  exports: [MailService],
})
export class MailModule {}

// Made with Bob
