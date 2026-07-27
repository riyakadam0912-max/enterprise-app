type ServerEnv = {
  DATABASE_URL: string;
  PORT?: number;
  REDIS_ENABLED: boolean;
  FRONTEND_URL: string;
  FRONTEND_URLS: string;
  FRONTEND_ORIGIN: string;
  FRONTEND_ORIGINS: string;
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  COOKIE_DOMAIN: string;
  COOKIE_SAME_SITE: string;
  COOKIE_SECURE: boolean;
  EMAIL_PROVIDER: string;
  EMAIL_FALLBACK_PROVIDER?: string;
  SENDGRID_API_KEY?: string;
  SENDGRID_FROM_EMAIL?: string;
  SENDGRID_FROM_NAME?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FROM_NAME?: string;
  AWS_SES_REGION?: string;
  AWS_SES_ACCESS_KEY_ID?: string;
  AWS_SES_SECRET_ACCESS_KEY?: string;
  AWS_SES_FROM_EMAIL?: string;
  AWS_SES_FROM_NAME?: string;
  AWS_S3_BUCKET?: string;
  AWS_S3_REGION?: string;
  AWS_S3_ACCESS_KEY_ID?: string;
  AWS_S3_SECRET_ACCESS_KEY?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;
  EMAIL_ALLOWED_SENDER_EMAILS?: string;
  BOOTSTRAP_ADMIN_PASSWORD?: string;
  BOOTSTRAP_SUPER_ADMIN_PASSWORD?: string;
};

function readRequiredString(env: Record<string, unknown>, key: string): string {
  const value = env[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  throw new Error(`Missing required environment variable: ${key}`);
}

function readOptionalString(
  env: Record<string, unknown>,
  key: string,
  fallback = '',
): string {
  const value = env[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

function readOptionalNumber(
  env: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = env[key];
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  throw new Error(
    `Invalid environment variable ${key}: expected a positive number`,
  );
}

function readOptionalBoolean(
  env: Record<string, unknown>,
  key: string,
  fallback = false,
): boolean {
  const value = env[key];
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no'].includes(normalized)) {
      return false;
    }
  }

  throw new Error(
    `Invalid environment variable ${key}: expected a boolean value`,
  );
}

export function validateServerEnv(env: Record<string, unknown>): ServerEnv {
  return {
    DATABASE_URL: readRequiredString(env, 'DATABASE_URL'),
    PORT: readOptionalNumber(env, 'PORT', 3000),
    REDIS_ENABLED: readOptionalBoolean(env, 'REDIS_ENABLED', false),
    FRONTEND_URL: readOptionalString(
      env,
      'FRONTEND_URL',
      'http://localhost:3001',
    ),
    FRONTEND_URLS: readOptionalString(env, 'FRONTEND_URLS'),
    FRONTEND_ORIGIN: readOptionalString(env, 'FRONTEND_ORIGIN'),
    FRONTEND_ORIGINS: readOptionalString(env, 'FRONTEND_ORIGINS'),
    REDIS_URL: readOptionalString(env, 'REDIS_URL'),
    REDIS_HOST: readOptionalString(env, 'REDIS_HOST'),
    REDIS_PORT: readOptionalNumber(env, 'REDIS_PORT', 6379),
    JWT_ACCESS_SECRET: readRequiredString(env, 'JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: readRequiredString(env, 'JWT_REFRESH_SECRET'),
    JWT_ISSUER: readRequiredString(env, 'JWT_ISSUER'),
    JWT_AUDIENCE: readRequiredString(env, 'JWT_AUDIENCE'),
    JWT_ACCESS_EXPIRES_IN: readOptionalString(
      env,
      'JWT_ACCESS_EXPIRES_IN',
      '1d',
    ),
    JWT_REFRESH_EXPIRES_IN: readOptionalString(
      env,
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    ),
    COOKIE_DOMAIN: readOptionalString(env, 'COOKIE_DOMAIN'),
    COOKIE_SAME_SITE: readOptionalString(env, 'COOKIE_SAME_SITE', 'lax'),
    COOKIE_SECURE: readOptionalBoolean(
      env,
      'COOKIE_SECURE',
      process.env.NODE_ENV === 'production',
    ),
    EMAIL_PROVIDER: readOptionalString(env, 'EMAIL_PROVIDER', 'NONE'),
    EMAIL_FALLBACK_PROVIDER: readOptionalString(env, 'EMAIL_FALLBACK_PROVIDER'),
    SENDGRID_API_KEY: readOptionalString(env, 'SENDGRID_API_KEY'),
    SENDGRID_FROM_EMAIL: readOptionalString(env, 'SENDGRID_FROM_EMAIL'),
    SENDGRID_FROM_NAME: readOptionalString(env, 'SENDGRID_FROM_NAME'),
    RESEND_API_KEY: readOptionalString(env, 'RESEND_API_KEY'),
    RESEND_FROM_EMAIL: readOptionalString(env, 'RESEND_FROM_EMAIL'),
    RESEND_FROM_NAME: readOptionalString(env, 'RESEND_FROM_NAME'),
    AWS_SES_REGION: readOptionalString(env, 'AWS_SES_REGION'),
    AWS_SES_ACCESS_KEY_ID: readOptionalString(env, 'AWS_SES_ACCESS_KEY_ID'),
    AWS_SES_SECRET_ACCESS_KEY: readOptionalString(
      env,
      'AWS_SES_SECRET_ACCESS_KEY',
    ),
    AWS_SES_FROM_EMAIL: readOptionalString(env, 'AWS_SES_FROM_EMAIL'),
    AWS_SES_FROM_NAME: readOptionalString(env, 'AWS_SES_FROM_NAME'),
    AWS_S3_BUCKET: readOptionalString(env, 'AWS_S3_BUCKET'),
    AWS_S3_REGION: readOptionalString(env, 'AWS_S3_REGION'),
    AWS_S3_ACCESS_KEY_ID: readOptionalString(env, 'AWS_S3_ACCESS_KEY_ID'),
    AWS_S3_SECRET_ACCESS_KEY: readOptionalString(
      env,
      'AWS_S3_SECRET_ACCESS_KEY',
    ),
    SMTP_HOST: readOptionalString(env, 'SMTP_HOST'),
    SMTP_PORT: readOptionalNumber(env, 'SMTP_PORT', 587),
    SMTP_SECURE: readOptionalBoolean(env, 'SMTP_SECURE', false),
    SMTP_USER: readOptionalString(env, 'SMTP_USER'),
    SMTP_PASS: readOptionalString(env, 'SMTP_PASS'),
    SMTP_FROM_EMAIL: readOptionalString(env, 'SMTP_FROM_EMAIL'),
    SMTP_FROM_NAME: readOptionalString(env, 'SMTP_FROM_NAME'),
    EMAIL_ALLOWED_SENDER_EMAILS: readOptionalString(
      env,
      'EMAIL_ALLOWED_SENDER_EMAILS',
    ),
    BOOTSTRAP_ADMIN_PASSWORD: readOptionalString(
      env,
      'BOOTSTRAP_ADMIN_PASSWORD',
    ),
    BOOTSTRAP_SUPER_ADMIN_PASSWORD: readOptionalString(
      env,
      'BOOTSTRAP_SUPER_ADMIN_PASSWORD',
    ),
  };
}

export type { ServerEnv };
