import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../src/email/email.service';
import { MailService } from '../src/mail/mail.service';
import { EmailProviderFactory } from '../src/mail/providers/provider.factory';
import * as dotenv from 'dotenv';

dotenv.config();

@Module({
  providers: [ConfigService, MailService, EmailProviderFactory, EmailService],
  exports: [EmailService],
})
class TestModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(TestModule);
  const emailService = app.get(EmailService);
  const result = await emailService.sendWelcomeEmail({
    to: 'copilot-smoke@example.com',
    firstName: 'Asha',
    organization: 'Enterprise ERP',
    ctaUrl: 'http://localhost:3001/dashboard',
    ctaText: 'Open dashboard',
  });

  console.log(JSON.stringify(result, null, 2));
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
