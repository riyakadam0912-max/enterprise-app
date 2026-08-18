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
