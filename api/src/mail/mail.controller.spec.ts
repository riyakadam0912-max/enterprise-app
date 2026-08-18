import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../common/enums/role.enum';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

describe('MailController', () => {
  const createExecutionContext = (user: Record<string, unknown>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => undefined,
      getClass: () => MailController,
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    // Ensure NODE_ENV is test mode for these tests
    process.env.NODE_ENV = 'test';
  });

  it('rejects employee access via the role guard', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([Role.ADMIN, Role.SUPER_ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const request = createExecutionContext({
      role: Role.EMPLOYEE,
      roles: [Role.EMPLOYEE],
    });

    expect(() => guard.canActivate(request)).toThrow(ForbiddenException);
  });

  it('allows admin access via the role guard', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([Role.ADMIN, Role.SUPER_ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const request = createExecutionContext({
      role: Role.ADMIN,
      roles: [Role.ADMIN],
    });

    expect(guard.canActivate(request)).toBe(true);
  });

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

  it('blocks the mail diagnostic endpoint in production even for admins', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const sendEmail = jest.fn();
      const controller = new MailController({
        sendEmail,
      } as unknown as MailService);

      await expect(
        controller.sendTestEmail({ to: 'admin@example.com' }),
      ).rejects.toThrow(ForbiddenException);
      expect(sendEmail).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
