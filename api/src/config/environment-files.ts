import { join } from 'node:path';
export function serverEnvironmentFiles(
  env: Record<string, unknown> = process.env,
  cwd = process.cwd(),
): string[] {
  return env.NODE_ENV === 'production'
    ? env.VERCEL === '1'
      ? []
      : [join(cwd, '.env.production')]
    : [join(cwd, '.env'), join(cwd, '..', '.env')];
}
