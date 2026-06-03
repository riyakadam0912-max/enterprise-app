const { execSync } = require('child_process');
const os = require('os');

const COLORS = {
  reset: '\u001b[0m',
  bright: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
  gray: '\u001b[90m',
};

function colorize(text, color) {
  return `${color}${text}${COLORS.reset}`;
}

function label(name, color = COLORS.cyan) {
  return colorize(`[${name}]`, color);
}

function banner(title) {
  const divider = '─'.repeat(Math.max(24, title.length + 10));
  console.log(`\n${colorize(divider, COLORS.gray)}`);
  console.log(colorize(title, `${COLORS.bright}${COLORS.cyan}`));
  console.log(colorize(divider, COLORS.gray));
}

function isWindows() {
  return os.platform() === 'win32';
}

function tasklistNameForPid(pid) {
  try {
    const output = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    })
      .toString()
      .trim();

    if (!output || output.includes('No tasks are running')) {
      return null;
    }

    const [imageName] = output.split('","');
    return imageName ? imageName.replace(/^"|"$/g, '') : null;
  } catch {
    return null;
  }
}

function getPortOwners(port) {
  try {
    if (isWindows()) {
      const psCommand = `$ErrorActionPreference='SilentlyContinue'; Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess -Unique`;
      const output = execSync(`powershell -NoProfile -Command "${psCommand}"`, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      })
        .toString()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^\d+$/.test(line));

      return [...new Set(output)].map((pidText) => {
        const pid = Number(pidText);
        const command = tasklistNameForPid(pid) ?? 'unknown process';
        return { pid, command };
      });
    }

    const output = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    })
      .toString()
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean);

    return output.map((line) => {
      const parts = line.split(/\s+/);
      return {
        command: parts[0] ?? 'unknown process',
        pid: Number(parts[1] ?? 0),
      };
    });
  } catch {
    return [];
  }
}

function formatOwners(port) {
  const owners = getPortOwners(port);
  if (!owners.length) {
    return null;
  }

  return owners
    .map((owner) => `${owner.command} (PID ${owner.pid})`)
    .join(', ');
}

async function ensurePortsFree(ports) {
  const occupied = ports
    .map((port) => ({ port, owner: formatOwners(port) }))
    .filter((entry) => entry.owner);

  if (!occupied.length) {
    return;
  }

  const details = occupied
    .map((entry) => `port ${entry.port} is already in use by ${entry.owner}`)
    .join('; ');

  throw new Error(details);
}

function logStep(service, message, color = COLORS.cyan) {
  console.log(`${label(service, color)} ${message}`);
}

module.exports = {
  COLORS,
  banner,
  colorize,
  ensurePortsFree,
  formatOwners,
  getPortOwners,
  label,
  logStep,
};