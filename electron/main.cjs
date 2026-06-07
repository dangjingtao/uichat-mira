const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { fork } = require("child_process");

let mainWindow;
let backendProcess;

// 更可靠的开发环境判断
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../desktop/dist/index.html"));
  }

  mainWindow.webContents.openDevTools();
}

function startBackend() {
  // 在开发环境下，后端服务器已经通过 concurrently 启动了
  if (isDev) {
    console.log("Dev mode: backend server already started via concurrently");
    return;
  }

  let backendPath;
  let cwd;

  backendPath = path.join(process.resourcesPath, "server", "server.cjs");
  cwd = path.join(process.resourcesPath, "server");

  console.log("Starting backend from:", backendPath);
  console.log("Working directory:", cwd);

  backendProcess = fork(backendPath, [], {
    cwd: cwd,
    env: { ...process.env, NODE_ENV: "production" },
    silent: false,
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr.on("data", (data) => {
    console.error(`Backend error: ${data}`);
  });

  backendProcess.on("close", (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

app.whenReady().then(() => {
  console.log("App ready, isDev:", isDev);
  console.log("__dirname:", __dirname);

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
