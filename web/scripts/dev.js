const { execSync, spawn } = require('child_process');
const { platform } = require('os');
const net = require('net');

const PORT = Number(process.env.PORT ?? 3001);

function killProcessOnPort(port) {
  try {
    if (platform() === 'win32') {
      const psCommand = `$ErrorActionPreference='SilentlyContinue'; Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess -Unique`;
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
      const socket = net.createConnection({ host: '127.0.0.1', port });

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

function spawnProcess(commandLine, options = {}) {
  return spawn(commandLine, [], {
    stdio: 'inherit',
    shell: true,
    ...options,
  });
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function main() {
  killProcessOnPort(PORT);
  await waitForPortToBeFree(PORT);

  const nextProcess = spawnProcess(`next dev --webpack --port ${PORT}`);
  const nextExit = waitForExit(nextProcess);

  const shutdown = async () => {
    if (!nextProcess.killed) {
      nextProcess.kill();
    }
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  const finished = await nextExit;

  await shutdown();

  process.exit(finished.code ?? 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});