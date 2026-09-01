type ServerEnv = {
  DATABASE_URL: string;
  PORT?: number;
  REDIS_ENABLED: boolean;
  WEBSOCKET_ENABLED: boolean;
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
  COOKIE_SAME_SITE: 'lax' | 'strict' | 'none';
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
  BOOTSTRAP_SUPER_ADMIN_EMAIL?: string;
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

function readCookieSameSite(
  env: Record<string, unknown>,
  key: string,
  fallback: 'lax' | 'strict' | 'none' = 'lax',
): 'lax' | 'strict' | 'none' {
  const value = env[key];
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === 'lax' ||
      normalized === 'strict' ||
      normalized === 'none'
    ) {
      return normalized;
    }
  }

  throw new Error(
    `Invalid environment variable ${key}: expected one of "lax", "strict", "none"`,
  );
}

function normalizeEnvString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

function isPlaceholderValue(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return [
    'replace-with-secure-shared-secret',
    'replace-with-secure-access-secret',
    'replace-with-secure-refresh-secret',
    'your_secret_here',
    'your-secret-here',
    'example',
    'example-secret',
    'dummy',
    'changeme',
    'test-secret',
    'not-set',
    'noreply@localhost',
    'noreply@example.com',
  ].includes(normalized);
}

function isLocalFrontendOrigin(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  const normalized = value.trim();
  if (!normalized) {
    return true;
  }

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '[::1]' ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  } catch {
    return (
      /^localhost(?::\d+)?$/i.test(normalized) ||
      /^127\.0\.0\.1(?::\d+)?$/i.test(normalized) ||
      /^0\.0\.0\.0(?::\d+)?$/i.test(normalized) ||
      /^\[::1\](?::\d+)?$/i.test(normalized) ||
      /^192\.168\.\d+\.\d+(?::\d+)?$/i.test(normalized) ||
      /^10\.\d+\.\d+\.\d+(?::\d+)?$/i.test(normalized) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(?::\d+)?$/i.test(normalized)
    );
  }
}

export function validateServerEnv(env: Record<string, unknown>): ServerEnv {
  const isProduction =
    String(env.NODE_ENV ?? process.env.NODE_ENV ?? 'development') ===
    'production';

  const isVercel =
    String(env.VERCEL ?? process.env.VERCEL ?? '') === '1' ||
    String(env.VERCEL_ENV ?? process.env.VERCEL_ENV ?? '').length > 0;

  if (isProduction) {
    const jwtAccessSecret = normalizeEnvString(env.JWT_ACCESS_SECRET);
    const jwtRefreshSecret = normalizeEnvString(env.JWT_REFRESH_SECRET);
    const jwtIssuer = normalizeEnvString(env.JWT_ISSUER);
    const jwtAudience = normalizeEnvString(env.JWT_AUDIENCE);
    const frontendUrl =
      normalizeEnvString(env.FRONTEND_URL) ??
      normalizeEnvString(env.FRONTEND_ORIGIN);
    const configuredFrontendValues = [
      normalizeEnvString(env.FRONTEND_URL),
      normalizeEnvString(env.FRONTEND_ORIGIN),
      normalizeEnvString(env.FRONTEND_URLS),
      normalizeEnvString(env.FRONTEND_ORIGINS),
    ].filter((value): value is string => Boolean(value));
    const cookieSecure = env.COOKIE_SECURE;
    const cookieSameSite = normalizeEnvString(env.COOKIE_SAME_SITE);
    const emailProvider = normalizeEnvString(env.EMAIL_PROVIDER);

    if (!jwtAccessSecret) {
      throw new Error('Production environment requires JWT_ACCESS_SECRET.');
    }
    if (!jwtRefreshSecret) {
      throw new Error('Production environment requires JWT_REFRESH_SECRET.');
    }
    if (
      isPlaceholderValue(jwtAccessSecret) ||
      isPlaceholderValue(jwtRefreshSecret)
    ) {
      throw new Error(
        'Production JWT secrets must not use placeholder or example values.',
      );
    }
    if (jwtAccessSecret === jwtRefreshSecret) {
      throw new Error(
        'Production JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.',
      );
    }
    if (!jwtIssuer) {
      throw new Error('Production environment requires JWT_ISSUER.');
    }
    if (!jwtAudience) {
      throw new Error('Production environment requires JWT_AUDIENCE.');
    }
    if (!frontendUrl) {
      throw new Error(
        'Production environment requires FRONTEND_URL or FRONTEND_ORIGIN.',
      );
    }
    if (configuredFrontendValues.length === 0) {
      throw new Error(
        'Production environment requires FRONTEND_URLS or FRONTEND_ORIGINS.',
      );
    }
    if (
      configuredFrontendValues.some((origin) => isLocalFrontendOrigin(origin))
    ) {
      throw new Error(
        'Production environment must not use localhost or LAN frontend origins.',
      );
    }
    if (
      cookieSecure === undefined ||
      cookieSecure === null ||
      cookieSecure === ''
    ) {
      throw new Error('Production environment requires COOKIE_SECURE=true.');
    }
    const cookieSecureValue = readOptionalBoolean(env, 'COOKIE_SECURE', true);
    if (!cookieSecureValue) {
      throw new Error('Production environment requires COOKIE_SECURE=true.');
    }
    if (!cookieSameSite && !isVercel) {
      throw new Error('Production environment requires COOKIE_SAME_SITE.');
    }
    const normalizedSameSite = readCookieSameSite(
      env,
      'COOKIE_SAME_SITE',
      isVercel ? 'none' : 'lax',
    );
    if (normalizedSameSite === 'none' && !cookieSecureValue) {
      throw new Error('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true.');
    }
    if (!emailProvider) {
      throw new Error('Production environment requires EMAIL_PROVIDER.');
    }
    if (emailProvider.toLowerCase() === 'none') {
      throw new Error(
        'Production email provider cannot be NONE. Configure RESEND, SENDGRID, or SES.',
      );
    }
    if (emailProvider.toLowerCase() === 'nodemailer') {
      const smtpHost = normalizeEnvString(env.SMTP_HOST)?.toLowerCase() ?? '';
      if (smtpHost.includes('mailtrap') || smtpHost.includes('sandbox')) {
        throw new Error(
          'Production environment cannot use Mailtrap or sandbox SMTP.',
        );
      }
    }
  }

  const COOKIE_SECURE = readOptionalBoolean(
    env,
    'COOKIE_SECURE',
    isProduction ? true : false,
  );
  const cookieSameSiteDefault: 'lax' | 'strict' | 'none' =
    isProduction && isVercel ? 'none' : 'lax';
  const COOKIE_SAME_SITE = readCookieSameSite(
    env,
    'COOKIE_SAME_SITE',
    cookieSameSiteDefault,
  );
  if (COOKIE_SAME_SITE === 'none' && !COOKIE_SECURE) {
    throw new Error(
      'Invalid cookie configuration: COOKIE_SAME_SITE="none" requires COOKIE_SECURE=true',
    );
  }

  const redisEnabledRaw = readOptionalBoolean(env, 'REDIS_ENABLED', false);
  const redisEnabled = isVercel ? false : redisEnabledRaw;

  const websocketEnabledRaw = readOptionalBoolean(
    env,
    'WEBSOCKET_ENABLED',
    !isProduction,
  );
  const websocketEnabledVercelSafe = isVercel ? false : websocketEnabledRaw;
  const websocketEnabled =
    websocketEnabledVercelSafe && (redisEnabled || !isProduction)
      ? true
      : websocketEnabledVercelSafe && isProduction && !redisEnabled
        ? false
        : websocketEnabledVercelSafe;

  if (isProduction && !isVercel && websocketEnabledRaw && !redisEnabled) {
    throw new Error(
      'Production WEBSOCKET_ENABLED=true requires REDIS_ENABLED=true and a shared Redis adapter. Either disable WebSocket realtime (WEBSOCKET_ENABLED=false) and use polling, or configure Redis + a persistent WebSocket host. On Vercel, WebSocket realtime is automatically disabled in favor of REST polling.',
    );
  }

  return {
    DATABASE_URL: readRequiredString(env, 'DATABASE_URL'),
    PORT: readOptionalNumber(env, 'PORT', 3000),
    REDIS_ENABLED: redisEnabled,
    WEBSOCKET_ENABLED: websocketEnabled,
    FRONTEND_URL:
      readOptionalString(
        env,
        'FRONTEND_URL',
        isProduction ? undefined : 'http://localhost:3001',
      ) || (isProduction ? '' : 'http://localhost:3001'),
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
    COOKIE_SAME_SITE,
    COOKIE_SECURE,
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
    BOOTSTRAP_SUPER_ADMIN_EMAIL: readOptionalString(
      env,
      'BOOTSTRAP_SUPER_ADMIN_EMAIL',
    ),
    BOOTSTRAP_SUPER_ADMIN_PASSWORD: readOptionalString(
      env,
      'BOOTSTRAP_SUPER_ADMIN_PASSWORD',
    ),
  };
}

export type { ServerEnv };
