const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

const BACKEND_PORT = 8787;
const BACKEND_HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/health`;
const SHOULD_AUTOSTART_BACKEND = !process.argv.includes("--no-backend");
const SHOULD_OPEN_DEVTOOLS = process.env.ELECTRON_OPEN_DEVTOOLS !== "0";
let backendProcess;

const userDataFolderName = app.isPackaged
  ? "UI Chat RAG Tester"
  : "UI Chat RAG Tester Dev";
app.setPath("userData", path.join(app.getPath("appData"), userDataFolderName));

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: "UI Chat RAG Tester",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl =
    process.env.ELECTRON_START_URL || "http://localhost:5173";

  if (!app.isPackaged) {
    win.loadURL(devServerUrl);

    if (SHOULD_OPEN_DEVTOOLS) {
      win.webContents.openDevTools({ mode: "detach" });
    }

    return;
  }

  win.webContents.on(
    "did-fail-load",
    (_event, code, description, validatedURL) => {
      console.error(
        `Renderer failed to load (code=${code}) ${description}. url=${validatedURL}`,
      );
    },
  );

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

function getBackendEntry() {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "electron-backend",
      "server.cjs",
    );
  }

  return path.join(__dirname, "..", "electron-backend", "server.cjs");
}

function getDevBackendCommand() {
  const serverDir = path.join(__dirname, "..", "..", "server");

  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "corepack pnpm dev"],
      cwd: serverDir,
    };
  }

  return {
    command: "corepack",
    args: ["pnpm", "dev"],
    cwd: serverDir,
  };
}

async function isBackendRunning() {
  try {
    const response = await fetch(BACKEND_HEALTH_URL);
    return response.ok;
  } catch {
    return false;
  }
}

async function startBackend() {
  if (backendProcess) {
    return backendProcess;
  }

  if (await isBackendRunning()) {
    return undefined;
  }

  const isPackaged = app.isPackaged;
  const devCommand = getDevBackendCommand();
  const command = isPackaged ? process.execPath : devCommand.command;
  const args = isPackaged ? [getBackendEntry()] : devCommand.args;

  backendProcess = spawn(command, args, {
    cwd: isPackaged ? undefined : devCommand.cwd,
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      ...(isPackaged ? { ELECTRON_RUN_AS_NODE: "1" } : {}),
    },
    stdio: "inherit",
    windowsHide: true,
  });

  backendProcess.once("error", (error) => {
    console.error("Failed to start backend process:", error);
  });

  backendProcess.on("exit", (code, signal) => {
    backendProcess = undefined;

    if (!app.isQuitting && code !== 0 && signal !== "SIGTERM") {
      console.error(
        `Backend process exited unexpectedly (code=${code}, signal=${signal ?? "none"}).`,
      );
    }
  });

  return backendProcess;
}

async function waitForBackend(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the backend is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Backend did not become ready in time");
}

app
  .whenReady()
  .then(async () => {
    if (SHOULD_AUTOSTART_BACKEND) {
      await startBackend();
    }

    try {
      await waitForBackend(BACKEND_HEALTH_URL);
    } catch (error) {
      console.error(error);
    }

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch((error) => {
    console.error("Electron startup failed:", error);
    app.quit();
  });

app.on("window-all-closed", () => {
  app.isQuitting = true;

  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
