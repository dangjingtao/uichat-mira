const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let mainWindow;
let backendProcess;
const BACKEND_START_TIMEOUT_MS = 15000;
const BACKEND_START_POLL_INTERVAL_MS = 300;

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

function ensureSecretFile(secretPath, secretName) {
  if (fs.existsSync(secretPath)) {
    const secret = fs.readFileSync(secretPath, "utf8").trim();
    if (secret) {
      return secret;
    }
  }

  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  const secret = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  fs.writeFileSync(secretPath, secret);
  console.log(`Created ${secretName} at: ${secretPath}`);
  return secret;
}

async function sleep(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function isBackendHealthy() {
  try {
    const response = await fetch(`${getBackendUrl()}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForBackendReady(timeoutMs = BACKEND_START_TIMEOUT_MS) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isBackendHealthy()) {
      return true;
    }

    if (backendProcess?.exitCode != null) {
      return false;
    }

    await sleep(BACKEND_START_POLL_INTERVAL_MS);
  }

  return false;
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
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDev) {
    void mainWindow
      .loadURL("http://localhost:5173")
      .then(() => {
        mainWindow?.webContents.openDevTools({ mode: "detach" });
      })
      .catch((error) => {
        console.error("Failed to load dev renderer:", error);
      });
    return;
  }

  const indexPath = resolveRendererEntry();
  void mainWindow.loadFile(indexPath).catch((error) => {
    console.error("Failed to load packaged renderer:", error);
  });
}

ipcMain.handle("desktop:open-external", async (_event, url) => {
  if (typeof url !== "string") {
    throw new Error("Invalid external URL");
  }

  const trimmedUrl = url.trim();
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    throw new Error("Only http(s) external URLs are allowed");
  }

  await shell.openExternal(trimmedUrl);
  return true;
});

async function startBackend() {
  if (isDev) {
    console.log("Dev mode: backend server already started via concurrently");
    return true;
  }

  const backendPath = path.join(process.resourcesPath, "server", "server.cjs");
  const cwd = path.join(process.resourcesPath, "server");
  const bundledNodePath = path.join(process.resourcesPath, "node-runtime", "node.exe");
  const localModelResourceRoot = path.join(process.resourcesPath, "model-packs");
  const localOnnxWasmRoot = path.join(
    process.resourcesPath,
    "model-runtime",
    "onnxruntime-web",
  );
  const backendRuntime = fs.existsSync(bundledNodePath)
    ? bundledNodePath
    : process.execPath;
  const usesBundledNode = backendRuntime === bundledNodePath;

  console.log("Starting backend from:", backendPath);
  console.log("Working directory:", cwd);
  console.log("Backend runtime:", backendRuntime);

  const userDataDir = app.getPath("userData");
  const dataDir = path.join(userDataDir, "data");
  const logDir = path.join(userDataDir, "logs");
  const secretsDir = path.join(userDataDir, "secrets");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  const jwtSecret = ensureSecretFile(
    path.join(secretsDir, "jwt-secret.txt"),
    "JWT secret",
  );
  const settingsSecret = ensureSecretFile(
    path.join(secretsDir, "settings-secret.txt"),
    "settings secret",
  );

  backendProcess = spawn(backendRuntime, [backendPath], {
    cwd,
    env: {
      ...process.env,
      ...(usesBundledNode ? {} : { ELECTRON_RUN_AS_NODE: "1" }),
      NODE_ENV: "production",
      HOST: runtimeConfig.backend.host,
      PORT: String(runtimeConfig.backend.port),
      JWT_SECRET: jwtSecret,
      SETTINGS_SECRET: settingsSecret,
      UI_CHAT_ALLOW_DEFAULT_BOOTSTRAP: "1",
      UI_CHAT_BACKEND_URL: getBackendUrl(),
      UI_CHAT_DATABASE_DIR: dataDir,
      UI_CHAT_LOG_DIR: logDir,
      LOCAL_MODEL_RESOURCE_ROOT: localModelResourceRoot,
      LOCAL_MODEL_USER_DATA_DIR: userDataDir,
      LOCAL_ONNX_WASM_ROOT: localOnnxWasmRoot,
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

  const backendReady = await waitForBackendReady();
  if (!backendReady) {
    console.error(
      `Backend did not become healthy within ${BACKEND_START_TIMEOUT_MS}ms: ${getBackendUrl()}/health`,
    );
  }

  return backendReady;
}

app.whenReady().then(async () => {
  console.log("App ready, isDev:", isDev);
  console.log("__dirname:", __dirname);
  console.log("app.getAppPath():", app.getAppPath());
  console.log("process.resourcesPath:", process.resourcesPath);

  if (!process.argv.includes("--no-backend")) {
    await startBackend();
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
