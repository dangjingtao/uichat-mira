const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let mainWindow;
let backendProcess;

const isDev = !app.isPackaged;
const runtimeConfig = loadRuntimeConfig();

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

function getBackendUrl() {
  return `http://${runtimeConfig.backend.host}:${runtimeConfig.backend.port}`;
}

function resolveRendererEntry() {
  const candidates = [
    path.join(app.getAppPath(), "desktop", "dist", "index.html"),
    path.join(app.getAppPath(), "dist", "index.html"),
    path.join(__dirname, "desktop", "dist", "index.html"),
    path.join(__dirname, "dist", "index.html"),
    path.join(process.resourcesPath, "app.asar", "desktop", "dist", "index.html"),
    path.join(process.resourcesPath, "app.asar", "dist", "index.html"),
  ];

  for (const candidate of candidates) {
    console.log("Checking renderer entry:", candidate, fs.existsSync(candidate));
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to locate renderer entry. Checked: ${candidates.join(", ")}`,
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
    return;
  }

  const indexPath = resolveRendererEntry();
  console.log("Loading renderer from:", indexPath);
  mainWindow.loadFile(indexPath);
}

function startBackend() {
  if (isDev) {
    console.log("Dev mode: backend server already started via concurrently");
    return;
  }

  const backendPath = path.join(process.resourcesPath, "server", "server.cjs");
  const cwd = path.join(process.resourcesPath, "server");
  const bundledNodePath = path.join(process.resourcesPath, "node-runtime", "node.exe");
  const backendRuntime = fs.existsSync(bundledNodePath)
    ? bundledNodePath
    : process.execPath;
  const usesBundledNode = backendRuntime === bundledNodePath;

  console.log("Starting backend from:", backendPath);
  console.log("Working directory:", cwd);
  console.log("Backend runtime:", backendRuntime);

  backendProcess = spawn(backendRuntime, [backendPath], {
    cwd,
    env: {
      ...process.env,
      ...(usesBundledNode ? {} : { ELECTRON_RUN_AS_NODE: "1" }),
      NODE_ENV: "production",
      HOST: runtimeConfig.backend.host,
      PORT: String(runtimeConfig.backend.port),
      UI_CHAT_BACKEND_URL: getBackendUrl(),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  if (backendProcess.stdout) {
    backendProcess.stdout.on("data", (data) => {
      console.log(`Backend: ${data}`);
    });
  }

  if (backendProcess.stderr) {
    backendProcess.stderr.on("data", (data) => {
      console.error(`Backend error: ${data}`);
    });
  }

  backendProcess.on("close", (code) => {
    console.log(`Backend process exited with code ${code}`);
  });

  backendProcess.on("error", (error) => {
    console.error("Failed to start backend process:", error);
  });
}

app.whenReady().then(() => {
  console.log("App ready, isDev:", isDev);
  console.log("__dirname:", __dirname);
  console.log("app.getAppPath():", app.getAppPath());
  console.log("process.resourcesPath:", process.resourcesPath);

  if (!process.argv.includes("--no-backend")) {
    startBackend();
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
