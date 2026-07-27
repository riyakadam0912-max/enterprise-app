const { spawnSync, spawn } = require('child_process');
const {
  banner,
  COLORS,
  ensurePortsFree,
  logStep,
} = require('../../scripts/dev-utils');

function runStep(command, args, stepLabel) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    const exitCode = typeof result.status === 'number' ? result.status : 1;
    throw new Error(`${stepLabel} failed with exit code ${exitCode}`);
  }
}

async function main() {
  banner('API Development Runtime');
  await ensurePortsFree([3000]);

  logStep('API', 'Generating Prisma client', COLORS.blue);
  runStep('npm', ['run', 'prisma:generate'], 'Prisma generate');
  logStep('PRISMA', 'Client generated', COLORS.green);

  // logStep('API', 'Applying Prisma migrations', COLORS.blue);
  // runStep('npm', ['run', 'prisma:migrate'], 'Prisma migrate');
  // logStep('PRISMA', 'Migrations applied', COLORS.green);

  logStep('API', 'Starting NestJS watch mode on port 3000', COLORS.blue);
  const child = spawn('nest', ['start', '--watch', '--preserveWatchOutput'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logStep('API', `Received ${signal}, shutting down`, COLORS.yellow);
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
