const { spawn } = require('node:child_process');

const maxAttempts = 5;
const retryDelayMs = 5000;
const lockErrorPattern = /P1002|advisory lock|timed out trying to acquire/i;

function runMigration() {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(command, ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env,
    });
    let output = '';

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      output += chunk.toString();
    });
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
    child.on('error', (error) => resolve({ code: 1, output: error.message }));
  });
}

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.log(`[PRISMA] Migration attempt ${attempt}/${maxAttempts}`);
    const result = await runMigration();
    if (result.code === 0) {
      return;
    }

    const isLockContention = lockErrorPattern.test(result.output);
    if (!isLockContention || attempt === maxAttempts) {
      process.exit(result.code);
    }

    const delay = retryDelayMs * attempt;
    console.warn(`[PRISMA] Migration lock is busy; retrying in ${delay / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

main().catch((error) => {
  console.error('[PRISMA] Migration runner failed:', error);
  process.exit(1);
});
