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

  it('uses the configured SMTP sender when a request supplies another From address', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
    const createTransport = nodemailer.createTransport as jest.Mock;
    createTransport.mockReturnValue({
      sendMail,
      verify: jest.fn(),
    } as unknown as nodemailer.Transporter);
    const configService = new ConfigService({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: 'smtp-user@example.com',
      SMTP_PASS: 'secret',
      SMTP_FROM_EMAIL: 'edadmin@ekdrishti.com',
      SMTP_FROM_NAME: 'Enterprise ERP',
      SMTP_VERIFY_ON_STARTUP: 'false',
    });

    const provider = new NodemailerProvider(configService);

    await provider.send({
      to: 'target@example.com',
      from: 'actor@example.com',
      replyTo: 'actor@example.com',
      subject: 'Account updated',
      html: '<p>Updated</p>',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Enterprise ERP <edadmin@ekdrishti.com>',
        to: ['target@example.com'],
        replyTo: 'actor@example.com',
      }),
    );
  });

  it('passes PDF attachments through to Nodemailer', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'pdf-1' });
    const createTransport = nodemailer.createTransport as jest.Mock;
    createTransport.mockReturnValue({
      sendMail,
      verify: jest.fn(),
    } as unknown as nodemailer.Transporter);
    const configService = new ConfigService({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: 'smtp-user@example.com',
      SMTP_PASS: 'secret',
      SMTP_FROM_EMAIL: 'quotes@example.com',
      SMTP_VERIFY_ON_STARTUP: 'false',
    });

    const provider = new NodemailerProvider(configService);
    const pdf = Buffer.from('%PDF-1.4 test');

    await provider.send({
      to: 'customer@example.com',
      subject: 'Your quote',
      html: '<p>Your quote is attached.</p>',
      attachments: [
        {
          filename: 'quote-42.pdf',
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          {
            filename: 'quote-42.pdf',
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      }),
    );
  });
});
