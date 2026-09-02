import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { NodemailerProvider } from './nodemailer.provider';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('NodemailerProvider', () => {
  it('parses SMTP_SECURE=false for STARTTLS', () => {
    const createTransport = nodemailer.createTransport as jest.Mock;
    createTransport.mockReturnValue({} as nodemailer.Transporter);
    const configService = new ConfigService({
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'smtp-user@company.com',
      SMTP_PASS: 'secret',
      SMTP_FROM_EMAIL: 'billing@company.com',
      SMTP_VERIFY_ON_STARTUP: 'false',
    });

    new NodemailerProvider(configService);

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'smtp-user@company.com',
          pass: 'secret',
        },
      }),
    );
  });
});
