const { execSync } = require('child_process');
const {
  banner,
  COLORS,
  getPortOwners,
  logStep,
} = require('../../scripts/dev-utils');

function killWindowsPid(pid) {
  try {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore', shell: true });
  } catch {
    // Process may have already exited.
  }
}

function killUnixPort(port) {
  try {
    execSync(`lsof -ti tcp:${port} | xargs -r kill -9`, {
      stdio: 'ignore',
      shell: true,
    });
  } catch {
    // Nothing to kill.
  }
}

function main() {
  banner('API Port Cleanup');

  const port = 3000;
  const owners = getPortOwners(port);

  if (!owners.length) {
    logStep('API', `Port ${port} is already free`, COLORS.green);
    return;
  }

  for (const owner of owners) {
    logStep(
      'API',
      `Stopping ${owner.command} (PID ${owner.pid}) on port ${port}`,
      COLORS.yellow,
    );
    if (process.platform === 'win32') {
      killWindowsPid(owner.pid);
    } else {
      killUnixPort(port);
    }
  }

  logStep('API', 'Port cleanup complete', COLORS.green);
}

main();
