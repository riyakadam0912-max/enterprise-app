import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().min(1).default('/api/v1'),
  NEXT_PUBLIC_NOTIFICATION_WS_URL: z.string().min(1).default('http://localhost:3000'),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

function formatError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('; ');
}

export function getClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_NOTIFICATION_WS_URL: process.env.NEXT_PUBLIC_NOTIFICATION_WS_URL,
  });

  if (!parsed.success) {
    throw new Error(`Invalid web environment configuration: ${formatError(parsed.error)}`);
  }

  return parsed.data;
}

export const clientEnv = getClientEnv();