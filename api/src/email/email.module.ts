import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';
import { EmailPreviewController } from './email-preview.controller';
import { EmailService } from './email.service';

@Module({
  imports: [ConfigModule, MailModule],
  controllers: [EmailPreviewController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
