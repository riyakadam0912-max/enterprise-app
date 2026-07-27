import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';
import { EmailService } from './email.service';

@Module({
  imports: [ConfigModule, MailModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
