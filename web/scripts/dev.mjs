import { spawn } from 'node:child_process';
import devUtils from '../../scripts/dev-utils.js';

const { banner, COLORS, ensurePortsFree, logStep } = devUtils;

async function waitForBackend(timeoutMs = 120000, intervalMs = 1500) {
  const startedAt = Date.now();
  const healthUrl = 'http://127.0.0.1:3000/api/v1/health';

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