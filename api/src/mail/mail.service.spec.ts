import { MailService } from './mail.service';

describe('MailService', () => {
  const createProviderFactory = () => ({
    getProvider: jest.fn(),
    getStartupStatus: jest.fn().mockReturnValue({
      provider: 'nodemailer',
      initialized: true,
      missingEnv: [],
    }),
    getAllProvidersHealth: jest.fn(),
  });

  const createSuccessResult = (messageId = 'msg-123') => ({
    success: true as const,
    messageId,
    provider: 'nodemailer',
    timestamp: new Date(),
  });

  const createProvider = (sendFn: jest.Mock) => ({
    getProviderName: () => 'nodemailer',
    send: sendFn,
    getHealthStatus: jest.fn().mockResolvedValue({ healthy: true }),
  });

  it('rejects blank subjects before sending', async () => {
    const providerFactory = createProviderFactory();
    const service = new MailService(providerFactory as any);

    const result = await service.sendEmail({
      to: 'person@example.com',
      subject: '   ',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_EMAIL_PARAMS');
    expect(result.error).toBe('Email subject is required');
    expect(providerFactory.getProvider).not.toHaveBeenCalled();
  });

  it('rejects empty subject string before sending', async () => {
    const providerFactory = createProviderFactory();
    const service = new MailService(providerFactory as any);

    const result = await service.sendEmail({
      to: 'person@example.com',
      subject: '',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_EMAIL_PARAMS');
    expect(providerFactory.getProvider).not.toHaveBeenCalled();
  });

  it('sends successfully with valid subject (happy path)', async () => {
    const sendFn = jest.fn().mockResolvedValue(createSuccessResult());
    const provider = createProvider(sendFn);

    const providerFactory = createProviderFactory();
    providerFactory.getProvider.mockResolvedValue(provider);

    const service = new MailService(providerFactory as any);

    const result = await service.sendEmail({
      to: 'person@example.com',
      subject: 'Valid Subject Here',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-123');
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('retries transient plain-object errors before success', async () => {
    const sendFn = jest
      .fn()
      .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Timed out' })
      .mockResolvedValueOnce(createSuccessResult('msg-after-retry'));

    const provider = createProvider(sendFn);
    const providerFactory = createProviderFactory();
    providerFactory.getProvider.mockResolvedValue(provider);

    const service = new MailService(providerFactory as any);

    const result = await service.sendEmail({
      to: 'person@example.com',
      subject: 'Retry Me',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-after-retry');
    expect(sendFn).toHaveBeenCalledTimes(2);
  });

  it('retries transient ECONNRESET Error instances (max 2 total attempts)', async () => {
    class TransientNetworkError extends Error {
      code: string;
      constructor(code: string, message: string) {
        super(message);
        this.name = 'SystemError';
        this.code = code;
      }
    }

    const sendFn = jest
      .fn()
      .mockRejectedValueOnce(
        new TransientNetworkError('ECONNRESET', 'Connection reset'),
      )
      .mockResolvedValueOnce(createSuccessResult('msg-econnreset'));

    const provider = createProvider(sendFn);
    const providerFactory = createProviderFactory();
    providerFactory.getProvider.mockResolvedValue(provider);

    const service = new MailService(providerFactory as any);

    const result = await service.sendEmail({
      to: 'person@example.com',
      subject: 'ECONNRESET Test',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-econnreset');
    expect(sendFn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry permanent provider failures (invalid credentials)', async () => {
    class PermanentAuthError extends Error {
      code: string;
      constructor() {
        super('Invalid username or password');
        this.name = 'Error';
        this.code = 'EAUTH';
      }
    }

    const sendFn = jest.fn().mockRejectedValueOnce(new PermanentAuthError());

    const provider = createProvider(sendFn);
    const providerFactory = createProviderFactory();
    providerFactory.getProvider.mockResolvedValue(provider);

    const service = new MailService(providerFactory as any);

    const result = await service.sendEmail({
      to: 'person@example.com',
      subject: 'Permanent Failure Test',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('UNEXPECTED_ERROR');
    expect(result.error).toContain('Invalid username or password');
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry provider result with permanent error code (e.g. invalid recipient)', async () => {
    const sendFn = jest.fn().mockResolvedValue({
      success: false as const,
      provider: 'nodemailer',
      timestamp: new Date(),
      error: 'Recipient address rejected',
      errorCode: 'INVALID_RECIPIENT',
    });

    const provider = createProvider(sendFn);
    const providerFactory = createProviderFactory();
    providerFactory.getProvider.mockResolvedValue(provider);

    const service = new MailService(providerFactory as any);

    const result = await service.sendEmail({
      to: 'bad-recipient@example.com',
      subject: 'Bad Recipient Test',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_RECIPIENT');
    expect(result.error).toBe('Recipient address rejected');
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('correctly uses retry count: 2 total attempts for persistent transient', async () => {
    const sendFn = jest
      .fn()
      .mockRejectedValueOnce({ code: 'ECONNREFUSED', message: 'Refused' })
      .mockRejectedValueOnce({ code: 'ECONNREFUSED', message: 'Refused 2' });

    const provider = createProvider(sendFn);
    const providerFactory = createProviderFactory();
    providerFactory.getProvider.mockResolvedValue(provider);

    const service = new MailService(providerFactory as any);

    const result = await service.sendEmail({
      to: 'person@example.com',
      subject: 'Always Fails',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('UNEXPECTED_ERROR');
    expect(sendFn).toHaveBeenCalledTimes(2);
  });

  it('keeps exceptions meaningful: includes error message in result', async () => {
    const sendFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Something went very wrong'));

    const provider = createProvider(sendFn);
    const providerFactory = createProviderFactory();
    providerFactory.getProvider.mockResolvedValue(provider);

    const service = new MailService(providerFactory as any);

    const result = await service.sendEmail({
      to: 'person@example.com',
      subject: 'Meaningful Error Test',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Something went very wrong');
    expect(result.errorCode).toBe('UNEXPECTED_ERROR');
  });

  it('rejects invalid recipient email before sending', async () => {
    const providerFactory = createProviderFactory();
    const service = new MailService(providerFactory as any);

    const result = await service.sendEmail({
      to: 'not-an-email',
      subject: 'Valid Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_EMAIL_PARAMS');
    expect(result.error).toContain('Invalid recipient');
    expect(providerFactory.getProvider).not.toHaveBeenCalled();
  });
});
