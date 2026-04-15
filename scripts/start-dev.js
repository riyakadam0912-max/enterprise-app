const { execSync, spawn } = require('child_process');
const { platform } = require('os');
const net = require('net');

const PORT = process.env.PORT || '3000';

function killProcessOnPort(port) {
  try {
    if (platform() === 'win32') {
      const psCommand = `$ErrorActionPreference='SilentlyContinue'; Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique`;
      const output = execSync(`powershell -NoProfile -Command "${psCommand}"`, {
        stdio: ['ignore', 'pipe', 'pipe'],
      }).toString();

      const pids = [...new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => /^\d+$/.test(line)),
      )];

      for (const pid of pids) {
        // Ignore failures for already-exited processes.
        try {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
        } catch {
          // Process may have exited between lookup and kill.
        }
      }
      return;
    }

    execSync(`lsof -ti tcp:${port} | xargs -r kill -9`, { stdio: 'ignore' });
  } catch {
    // Nothing to kill or the port is already free.
  }
}

function waitForPortToBeFree(port, timeoutMs = 5000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port: Number(port) });

      socket.once('connect', () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Port ${port} is still in use after ${timeoutMs}ms`));
          return;
        }
        setTimeout(check, 150);
      });

      socket.once('error', () => {
        resolve();
      });
    };

    check();
  });
}

async function main() {
  killProcessOnPort(PORT);
  await waitForPortToBeFree(PORT);

  const child = spawn(process.execPath, ['--watch', '-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'src/main.ts'], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});