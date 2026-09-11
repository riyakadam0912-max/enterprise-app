import { validateServerEnv } from './env';

describe('validateServerEnv', () => {
  const validProductionEnv = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://app:secret@db.example.com:5432/enterprise',
    JWT_ACCESS_SECRET: 'prod-access-secret-very-long-12345',
    JWT_REFRESH_SECRET: 'prod-refresh-secret-very-long-67890',
    JWT_ISSUER: 'https://api.example.com',
    JWT_AUDIENCE: 'https://api.example.com',
    FRONTEND_URL: 'https://app.example.com',
    FRONTEND_URLS: 'https://app.example.com',
    FRONTEND_ORIGIN: 'https://app.example.com',
    FRONTEND_ORIGINS: 'https://app.example.com',
    COOKIE_SECURE: 'true',
    COOKIE_SAME_SITE: 'none',
    EMAIL_PROVIDER: 'RESEND',
    RESEND_API_KEY: 're_example_key',
    RESEND_FROM_EMAIL: 'noreply@example.com',
    RESEND_FROM_NAME: 'Example ERP',
    REDIS_ENABLED: 'false',
  } as Record<string, unknown>;

  it('accepts a valid production environment', () => {
    expect(() => validateServerEnv(validProductionEnv)).not.toThrow();
  });

  it('accepts SMTP Nodemailer when production credentials are configured', () => {
    const smtpProductionEnv = {
      ...validProductionEnv,
      EMAIL_PROVIDER: 'NODEMAILER',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: 2525,
      SMTP_USER: 'smtp-user',
      SMTP_PASS: 'smtp-password',
      SMTP_FROM_EMAIL: 'noreply@company.test',
      SMTP_FROM_NAME: 'Enterprise ERP',
    } as Record<string, unknown>;

    expect(() => validateServerEnv(smtpProductionEnv)).not.toThrow();
  });

  it('defaults Vercel production cookies to secure cross-site settings', () => {
    const vercelProd = {
      ...validProductionEnv,
      VERCEL: '1',
      VERCEL_ENV: 'production',
      COOKIE_SECURE: 'true',
      COOKIE_SAME_SITE: undefined,
    } as Record<string, unknown>;

    expect(() => validateServerEnv(vercelProd)).not.toThrow();
    expect(validateServerEnv(vercelProd).COOKIE_SAME_SITE).toBe('none');
  });

  it('preserves explicit S3 storage configuration', () => {
    const configured = validateServerEnv({
      ...validProductionEnv,
      FILE_STORAGE_PROVIDER: 's3',
      AWS_S3_BUCKET: 'enterprise-assets',
      AWS_S3_REGION: 'eu-north-1',
    });

    expect(configured.FILE_STORAGE_PROVIDER).toBe('s3');
  });

  it('defaults the S3 prefix to erp', () => {
    expect(validateServerEnv(validProductionEnv).AWS_S3_PREFIX).toBe('erp');
  });

  it('rejects incomplete explicit S3 storage configuration', () => {
    expect(() =>
      validateServerEnv({
        ...validProductionEnv,
        FILE_STORAGE_PROVIDER: 's3',
      }),
    ).toThrow(/AWS_S3_BUCKET and AWS_S3_REGION/);
  });

  it('rejects unknown storage providers', () => {
    expect(() =>
      validateServerEnv({
        ...validProductionEnv,
        FILE_STORAGE_PROVIDER: 's3-compatible',
      }),
    ).toThrow(/expected local, s3, or cloudinary/);
  });

  it('rejects placeholder JWT secrets and localhost frontend origins in production', () => {
    const invalid = {
      ...validProductionEnv,
      JWT_ACCESS_SECRET: 'replace-with-secure-access-secret',
      JWT_REFRESH_SECRET: 'different-secret',
      FRONTEND_URL: 'http://localhost:3001',
      FRONTEND_URLS: 'http://localhost:3001',
    };

    expect(() => validateServerEnv(invalid)).toThrow(
      /placeholder or example values|localhost or LAN frontend origins/i,
    );
  });
});
