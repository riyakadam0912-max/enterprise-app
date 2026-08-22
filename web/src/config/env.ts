import { z } from 'zod';

const isLocalDevelopmentUrl = (value: string | undefined): boolean => {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
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
    return false;
  }
};

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().min(1).default('/api/v1'),
  NEXT_PUBLIC_NOTIFICATION_WS_URL: z.string().optional().default(''),
  NEXT_PUBLIC_POLLING_ENABLED: z
    .union([z.string(), z.boolean()])
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      return ['true', '1', 'yes'].includes(val.trim().toLowerCase());
    })
    .pipe(z.boolean())
    .default(true),
  NEXT_PUBLIC_POLLING_INTERVAL_MS: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === 'string' ? Number(val) : val;
      return Number.isFinite(num) && num > 0 ? num : 15000;
    })
    .pipe(z.number().int().positive())
    .default(15000),
  NEXT_PUBLIC_POLLING_INTERVAL_ACTIVE_MS: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === 'string' ? Number(val) : val;
      return Number.isFinite(num) && num > 0 ? num : 3000;
    })
    .pipe(z.number().int().positive())
    .default(3000),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

function formatError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('; ');
}

export function getClientEnv(): ClientEnv {
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel =
    String(process.env.NEXT_PUBLIC_VERCEL ?? '') === '1' ||
    String(process.env.NEXT_PUBLIC_VERCEL_ENV ?? '').length > 0 ||
    String(process.env.VERCEL ?? '') === '1' ||
    String(process.env.VERCEL_ENV ?? '').length > 0;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
  const rawWsUrl = process.env.NEXT_PUBLIC_NOTIFICATION_WS_URL ?? '';
  const wsUrl = isVercel ? '' : rawWsUrl;
  const pollingEnabledRaw = process.env.NEXT_PUBLIC_POLLING_ENABLED ?? 'true';
  const pollingEnabled =
    isVercel || ['true', '1', 'yes', ''].includes(String(pollingEnabledRaw).trim().toLowerCase());

  if (isProduction) {
    if (!apiUrl || isLocalDevelopmentUrl(apiUrl)) {
      throw new Error('Production NEXT_PUBLIC_API_URL must be set to a non-localhost origin.');
    }
    if (
      wsUrl &&
      wsUrl.length > 0 &&
      isLocalDevelopmentUrl(wsUrl) &&
      !isVercel
    ) {
      throw new Error('Production NEXT_PUBLIC_NOTIFICATION_WS_URL must be set to a non-localhost origin, or left empty to use REST polling fallback.');
    }
  }

  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_NOTIFICATION_WS_URL: wsUrl,
    NEXT_PUBLIC_POLLING_ENABLED: pollingEnabled,
    NEXT_PUBLIC_POLLING_INTERVAL_MS: process.env.NEXT_PUBLIC_POLLING_INTERVAL_MS,
    NEXT_PUBLIC_POLLING_INTERVAL_ACTIVE_MS: process.env.NEXT_PUBLIC_POLLING_INTERVAL_ACTIVE_MS,
  });

  if (!parsed.success) {
    throw new Error(`Invalid web environment configuration: ${formatError(parsed.error)}`);
  }

  return parsed.data;
}

export const clientEnv = getClientEnv();
