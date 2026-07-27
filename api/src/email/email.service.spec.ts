import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService', () => {
  it('renders a welcome template and sends it through the mail transport', async () => {
    const sendEmail = jest.fn().mockResolvedValue({
      success: true,
      messageId: 'msg-1',
      provider: 'nodemailer',
      timestamp: new Date(),
    });

    const mailService = { sendEmail } as any;
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          COMPANY_NAME: 'Acme ERP',
          COMPANY_LOGO_URL: 'https://example.com/logo.png',
          COMPANY_SUPPORT_EMAIL: 'support@example.com',
          COMPANY_SUPPORT_WEBSITE: 'https://example.com',
          COMPANY_ADDRESS: '1 Example Street',
          COMPANY_PRIMARY_COLOR: '#2563eb',
          COMPANY_SECONDARY_COLOR: '#0f172a',
          COMPANY_DANGER_COLOR: '#dc2626',
          COMPANY_WARNING_COLOR: '#d97706',
          COMPANY_SUCCESS_COLOR: '#16a34a',
          COMPANY_BACKGROUND_COLOR: '#f8fafc',
          MAIL_FROM: 'noreply@example.com',
          MAIL_FROM_NAME: 'Acme ERP',
        };
        return values[key] ?? undefined;
      }),
    } as unknown as ConfigService;

    const service = new EmailService(mailService, configService);

    const result = await service.sendWelcomeEmail({
      to: 'person@example.com',
      firstName: 'Asha',
      organization: 'Acme ERP',
      ctaUrl: 'https://example.com',
      ctaText: 'Open dashboard',
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'person@example.com',
        subject: expect.stringContaining('Welcome'),
        html: expect.stringContaining('Acme ERP'),
      }),
    );
    expect(result.success).toBe(true);
  });
});
