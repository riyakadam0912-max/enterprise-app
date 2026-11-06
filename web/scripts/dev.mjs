import nextEnv from '@next/env';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import devUtils from '../../scripts/dev-utils.js';

const { banner, COLORS, ensurePortsFree, logStep } = devUtils;
const { loadEnvConfig } = nextEnv;
const webDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

loadEnvConfig(webDirectory, process.env.NODE_ENV !== 'production');

async function waitForBackend(timeoutMs = 120000, intervalMs = 1500) {
  const startedAt = Date.now();
  const apiOrigin = (process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
  const healthUrl = `${apiOrigin}/api/v1/health`;

  // A production API is intentionally used by local development in this
  // project. Do not block the Next server on a server-side health probe: the
  // developer's browser/runtime may have network access even when the shell
  // process is running in a restricted environment (CI, sandbox, VPN, etc.).
  // The proxy will surface an actionable 502 if the upstream is unavailable.
  const target = new URL(apiOrigin);
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(target.hostname);
  if (!isLoopback) {
    logStep('WEB', `Using external API target ${apiOrigin}; skipping local health wait`, COLORS.yellow);
    return;
  }

  logStep('WEB', `Waiting for backend health at ${healthUrl}`, COLORS.cyan);

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(healthUrl, { cache: 'no-store' });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the API is healthy.
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Backend health check timed out before the frontend could start');
}

async function main() {
  banner('WEB Development Runtime');
  await ensurePortsFree([3001]);

  await waitForBackend();
  logStep('WEB', 'Backend is healthy', COLORS.green);

  logStep('WEB', 'Running on port 3001', COLORS.green);
  const child = spawn('next', ['dev', '--webpack', '--port', '3001'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logStep('WEB', `Received ${signal}, shutting down`, COLORS.yellow);
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  child.once('exit', (code, signal) => {
    if (signal) {
      process.exit(0);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
