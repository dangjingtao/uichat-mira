const net = require("net");
const path = require("path");
const fs = require("fs");
const { spawn, spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const DESKTOP_PORT = 5173;
const STARTUP_TIMEOUT_MS = 60000;
const childProcesses = [];
let isShuttingDown = false;

function loadRuntimeConfig() {
  const candidates = [
    path.join(__dirname, "..", "runtime.config.cjs"),
    path.join(process.cwd(), "runtime.config.cjs"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  throw new Error(`Unable to locate runtime config. Checked: ${candidates.join(", ")}`);
}

function waitForReadySignal(name, readyWhen, timeoutMs) {
  let resolveReady;
  let rejectReady;
  let settled = false;
  let buffer = "";

  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const timeoutId = setTimeout(() => {
    if (settled) {
      return;
    }

    settled = true;
    rejectReady(new Error(`Timed out waiting for ${name} to become ready`));
  }, timeoutMs);

  const markReady = () => {
    if (settled) {
      return;
    }

    settled = true;
    clearTimeout(timeoutId);
    resolveReady();
  };

  const fail = (error) => {
    if (settled) {
      return;
    }

    settled = true;
    clearTimeout(timeoutId);
    rejectReady(error);
  };

  const handleChunk = (chunk) => {
    if (settled) {
      return;
    }

    const text = stripAnsi(String(chunk));
    buffer = `${buffer}${text}`.slice(-8000);

    if (readyWhen(text, buffer)) {
      markReady();
    }
  };

  return {
    ready,
    handleChunk,
    fail,
  };
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function spawnManagedProcess(name, cwd, command, options = {}) {
  const shellCommand =
    process.platform === "win32"
      ? { file: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", command] }
      : { file: "sh", args: ["-lc", command] };

  const readiness = waitForReadySignal(
    name,
    options.readyWhen,
    options.timeoutMs ?? STARTUP_TIMEOUT_MS,
  );

  const child = spawn(shellCommand.file, shellCommand.args, {
    cwd,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: false,
  });

  childProcesses.push(child);

  if (child.stdout) {
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      readiness.handleChunk(chunk);
    });
  }

  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      readiness.handleChunk(chunk);
    });
  }

  child.on("exit", (code, signal) => {
    if (isShuttingDown) {
      return;
    }

    const reason =
      signal != null ? `${name} exited via signal ${signal}` : `${name} exited with code ${code ?? 0}`;
    readiness.fail(new Error(reason));
    console.error(reason);
    shutdown(code ?? 1);
  });

  child.on("error", (error) => {
    if (isShuttingDown) {
      return;
    }

    readiness.fail(error);
    console.error(`Failed to start ${name}:`, error);
    shutdown(1);
  });

  return readiness.ready;
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
          spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `taskkill /PID ${child.pid} /T /F`], {
            stdio: "ignore",
            windowsHide: true,
          });
        } else {
          child.kill("SIGTERM");
        }
      } catch {}
    }
  }

  setTimeout(() => process.exit(exitCode), 50);
}

async function isTcpPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    const cleanup = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1000);
    socket.once("connect", () => cleanup(true));
    socket.once("timeout", () => cleanup(false));
    socket.once("error", () => cleanup(false));
  });
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
  const { writeAppMetaJsons } = await import(
    pathToFileURL(path.join(workspaceRoot, "scripts", "app-meta-generator.js")).href
  );

  writeAppMetaJsons(workspaceRoot, [
    path.join(serverDir, "app-meta.json"),
    path.join(workspaceRoot, ".artifacts", "server-bundle", "app-meta.json"),
  ]);

  const desktopAlreadyRunning =
    (await isTcpPortOpen("localhost", DESKTOP_PORT)) ||
    (await isTcpPortOpen("127.0.0.1", DESKTOP_PORT));
  const backendAlreadyHealthy = await isBackendHealthy(backendHealthUrl);

  const waiters = [];

  if (backendAlreadyHealthy) {
    console.log(`Reusing existing backend at ${backendHealthUrl}`);
  } else {
    console.log("Starting backend dev server...");
    waiters.push(
      spawnManagedProcess("server", serverDir, "pnpm dev", {
        env: {
          UI_CHAT_ALLOW_BACKEND_REUSE: "1",
        },
        readyWhen: (_text, combined) =>
          combined.includes(`Server running on http://${backendHost}:${backendPort}`),
      }),
    );
  }

  if (desktopAlreadyRunning) {
    console.log(`Reusing existing desktop dev server on tcp://localhost:${DESKTOP_PORT}`);
  } else {
    console.log("Starting desktop dev server...");
    waiters.push(
      spawnManagedProcess("desktop", desktopDir, "pnpm dev", {
        readyWhen: (_text, combined) =>
          combined.includes(`http://localhost:${DESKTOP_PORT}/`) ||
          combined.includes(`http://127.0.0.1:${DESKTOP_PORT}/`),
      }),
    );
  }

  await Promise.all(waiters);
  console.log("Tauri dev services are ready.");
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("SIGBREAK", () => shutdown(0));
process.on("SIGHUP", () => shutdown(0));
process.on("beforeExit", () => shutdown(0));
process.on("uncaughtException", (error) => {
  console.error(error);
  shutdown(1);
});
process.on("unhandledRejection", (error) => {
  console.error(error);
  shutdown(1);
});

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
});
