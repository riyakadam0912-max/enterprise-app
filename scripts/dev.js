const concurrently = require('concurrently');
const { banner, COLORS, ensurePortsFree, logStep } = require('./dev-utils');

function assertString(name, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`[ROOT] Invalid ${name}: expected a non-empty string, received ${typeof value}`);
  }
}

function assertStringArray(name, value) {
  if (!Array.isArray(value)) {
    throw new Error(`[ROOT] Invalid ${name}: expected string[], received ${typeof value}`);
  }

  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new Error(`[ROOT] Invalid ${name}[${index}]: expected a non-empty string, received ${typeof entry}`);
    }
  });
}

function validateConcurrentlyConfig({ names, prefix, prefixColors, additionalArguments }) {
  assertStringArray('names', names);

  if (prefix !== undefined) {
    assertString('prefix', prefix);
  }

  if (prefixColors !== undefined) {
    assertStringArray('prefixColors', prefixColors);
  }

  if (additionalArguments !== undefined) {
    assertStringArray('additionalArguments', additionalArguments);
  }
}

function formatConcurrentFailure(error) {
  if (Array.isArray(error)) {
    return error
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return String(entry);
        }

        const command = 'command' in entry && entry.command && typeof entry.command === 'object' && 'command' in entry.command
          ? entry.command.command
          : 'unknown command';
        const exitCode = 'exitCode' in entry ? entry.exitCode : 'unknown exit code';
        return `${command} exited with ${exitCode}`;
      })
      .join('; ');
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    return JSON.stringify(error);
  }

  return String(error);
}

async function main() {
  banner('Enterprise ERP Dev Orchestrator');
  await ensurePortsFree([3000, 3001]);

  logStep('ROOT', 'Ports 3000 and 3001 are available', COLORS.green);
  logStep('ROOT', 'Launching API and WEB services with labeled output', COLORS.blue);

  const commands = [
    { command: 'npm --prefix api run dev', name: 'API' },
    { command: 'npm --prefix web run dev', name: 'WEB' },
  ];
  const concurrentlyConfig = {
    prefixColors: ['blue', 'green'],
    additionalArguments: [],
  };

  validateConcurrentlyConfig({
    names: commands.map((command) => command.name),
    prefix: undefined,
    prefixColors: concurrentlyConfig.prefixColors,
    additionalArguments: concurrentlyConfig.additionalArguments,
  });

  const { commands: runningCommands, result } = concurrently(commands, {
    killOthersOn: ['failure'],
    prefixColors: concurrentlyConfig.prefixColors,
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logStep('ROOT', `Received ${signal}, stopping orchestrator`, COLORS.yellow);
    runningCommands.forEach((command) => command.kill(signal));
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  result
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(formatConcurrentFailure(error));
      process.exit(1);
    });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});