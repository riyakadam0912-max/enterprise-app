import { MailController } from './mail.controller';
import { MailService } from './mail.service';

describe('MailController', () => {
  it('sends a diagnostic email through the shared mail service', async () => {
    const sendEmail = jest.fn().mockResolvedValue({
      success: true,
      messageId: 'abc123',
      provider: 'nodemailer',
      timestamp: new Date(),
      providerResponse: { accepted: ['test@example.com'] },
    });

    const controller = new MailController({
      sendEmail,
    } as unknown as MailService);

    const response = await controller.sendDebugEmail({
      to: 'test@example.com',
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'SMTP Test',
        html: expect.stringContaining('This is a test email'),
      }),
    );
    expect(response.success).toBe(true);
    expect(response.provider).toBe('NODEMAILER');
  });

  it('rejects a debug request when no recipient is supplied', async () => {
    const sendEmail = jest.fn();
    const controller = new MailController({
      sendEmail,
    } as unknown as MailService);

    const response = await controller.sendDebugEmail({});

    expect(sendEmail).not.toHaveBeenCalled();
    expect(response).toEqual({
      success: false,
      error: 'Recipient email is required',
      provider: 'NONE',
    });
  });
});
