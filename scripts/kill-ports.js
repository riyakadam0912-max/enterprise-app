const { execSync } = require('child_process');
const { banner, COLORS, getPortOwners, logStep } = require('./dev-utils');

function killWindowsPid(pid) {
  try {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore', shell: true });
  } catch {
    // Process may have already exited.
  }
}

function killUnixPort(port) {
  try {
    execSync(`lsof -ti tcp:${port} | xargs -r kill -9`, { stdio: 'ignore', shell: true });
  } catch {
    // Nothing to kill.
  }
}

function main() {
  banner('Enterprise ERP Port Cleanup');

  const ports = [3000, 3001];
  for (const port of ports) {
    const owners = getPortOwners(port);

    if (!owners.length) {
      logStep('KILL', `Port ${port} is already free`, COLORS.green);
      continue;
    }

    for (const owner of owners) {
      logStep('KILL', `Stopping ${owner.command} (PID ${owner.pid}) on port ${port}`, COLORS.yellow);
      if (process.platform === 'win32') {
        killWindowsPid(owner.pid);
      } else {
        killUnixPort(port);
      }
    }
  }

  logStep('KILL', 'Port cleanup complete', COLORS.green);
}

main();