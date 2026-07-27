import { ConfigService } from '@nestjs/config';
import { EmailProviderFactory } from './provider.factory';

describe('EmailProviderFactory', () => {
  it('returns configured sender emails for nodemailer', () => {
    const configService = new ConfigService({
      EMAIL_PROVIDER: 'nodemailer',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: 'smtp-user@company.com',
      SMTP_PASS: 'secret',
      SMTP_FROM_EMAIL: 'billing@company.com',
      EMAIL_ALLOWED_SENDER_EMAILS: 'billing@company.com,accounts@company.com',
    });

    const factory = new EmailProviderFactory(configService);

    expect(factory.getAuthorizedSenderEmails()).toEqual([
      'billing@company.com',
      'accounts@company.com',
    ]);
  });
});
