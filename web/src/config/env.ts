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
  NEXT_PUBLIC_NOTIFICATION_WS_URL: z.string().min(1).default('http://127.0.0.1:3000'),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

function formatError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('; ');
}

export function getClientEnv(): ClientEnv {
  const isProduction = process.env.NODE_ENV === 'production';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
  const notificationWsUrl = process.env.NEXT_PUBLIC_NOTIFICATION_WS_URL ?? 'http://127.0.0.1:3000';

  if (isProduction) {
    if (!apiUrl || isLocalDevelopmentUrl(apiUrl)) {
      throw new Error('Production NEXT_PUBLIC_API_URL must be set to a non-localhost origin.');
    }
    if (!notificationWsUrl || isLocalDevelopmentUrl(notificationWsUrl)) {
      throw new Error('Production NEXT_PUBLIC_NOTIFICATION_WS_URL must be set to a non-localhost origin.');
    }
  }

  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_NOTIFICATION_WS_URL: notificationWsUrl,
  });

  if (!parsed.success) {
    throw new Error(`Invalid web environment configuration: ${formatError(parsed.error)}`);
  }

  return parsed.data;
}

export const clientEnv = getClientEnv();
