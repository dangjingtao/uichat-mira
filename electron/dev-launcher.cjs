const net = require("net");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const electronBinary = require("electron");

const DESKTOP_PORT = 5173;
const STARTUP_TIMEOUT_MS = 60000;
const POLL_INTERVAL_MS = 500;
const childProcesses = [];
let isShuttingDown = false;

function loadRuntimeConfig() {
  const candidates = [
    path.join(__dirname, "runtime.config.cjs"),
    path.join(__dirname, "..", "runtime.config.cjs"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  throw new Error(`Unable to locate runtime config. Checked: ${candidates.join(", ")}`);
}

function spawnManagedProcess(name, cwd, command) {
  const shellCommand =
    process.platform === "win32"
      ? { file: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", command] }
      : { file: "sh", args: ["-lc", command] };

  const child = spawn(shellCommand.file, shellCommand.args, {
    cwd,
    stdio: "inherit",
    windowsHide: false,
  });

  child.processName = name;
  childProcesses.push(child);

  child.on("exit", (code, signal) => {
    if (isShuttingDown) {
      return;
    }

    const reason =
      signal != null ? `${name} exited via signal ${signal}` : `${name} exited with code ${code ?? 0}`;
    console.error(reason);
    shutdown(code ?? 1);
  });

  child.on("error", (error) => {
    if (isShuttingDown) {
      return;
    }

    console.error(`Failed to start ${name}:`, error);
    shutdown(1);
  });

  return child;
}

function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  for (const child of childProcesses) {
    if (!child.killed) {
      try {
        if (process.platform === "win32") {
          spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `taskkill /PID ${child.pid} /T /F`], {
            stdio: "ignore",
            windowsHide: true,
          });
        } else {
          child.kill("SIGTERM");
        }
      } catch {}
    }
  }

  setTimeout(() => process.exit(exitCode), 300);
}

function waitForTcpPort(host, port, timeoutMs) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host, port });

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      socket.setTimeout(POLL_INTERVAL_MS);
      socket.once("connect", () => {
        cleanup();
        resolve();
      });
      socket.once("timeout", () => {
        cleanup();
        retry();
      });
      socket.once("error", () => {
        cleanup();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Timed out waiting for tcp://${host}:${port}`));
        return;
      }

      setTimeout(tryConnect, POLL_INTERVAL_MS);
    };

    tryConnect();
  });
}

async function waitForHttpOk(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function isTcpPortOpen(host, port) {
  try {
    await waitForTcpPort(host, port, 1500);
    return true;
  } catch {
    return false;
  }
}

async function isBackendHealthy(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const runtimeConfig = loadRuntimeConfig();
  const backendHost = runtimeConfig.backend.host;
  const backendPort = runtimeConfig.backend.port;
  const backendHealthUrl = `http://${backendHost}:${backendPort}/health`;

  const workspaceRoot = path.resolve(__dirname, "..");
  const serverDir = path.join(workspaceRoot, "server");
  const desktopDir = path.join(workspaceRoot, "desktop");

  const desktopAlreadyRunning = await isTcpPortOpen("localhost", DESKTOP_PORT);
  const backendAlreadyHealthy = await isBackendHealthy(backendHealthUrl);

  if (backendAlreadyHealthy) {
    console.log(`Reusing existing backend at ${backendHealthUrl}`);
  } else {
    console.log("Starting backend dev server...");
    spawnManagedProcess("server", serverDir, "pnpm exec tsx src/index.ts");
  }

  if (desktopAlreadyRunning) {
    console.log(`Reusing existing desktop dev server on tcp://localhost:${DESKTOP_PORT}`);
  } else {
    console.log("Starting desktop dev server...");
    spawnManagedProcess("desktop", desktopDir, "pnpm dev");
  }

  console.log(`Waiting for desktop dev server on tcp://localhost:${DESKTOP_PORT}`);
  await waitForTcpPort("localhost", DESKTOP_PORT, STARTUP_TIMEOUT_MS);

  console.log(`Waiting for backend health on ${backendHealthUrl}`);
  await waitForHttpOk(backendHealthUrl, STARTUP_TIMEOUT_MS);

  console.log("Desktop and backend are ready. Launching Electron...");
  const electronChild = spawn(electronBinary, ["."], {
    cwd: __dirname,
    stdio: "inherit",
    windowsHide: false,
  });

  childProcesses.push(electronChild);

  electronChild.on("exit", (code) => {
    shutdown(code ?? 0);
  });

  electronChild.on("error", (error) => {
    console.error("Failed to launch Electron:", error);
    shutdown(1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
});
