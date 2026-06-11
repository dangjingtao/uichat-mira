const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");
const fs = require("fs");

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

const runtimeConfig = loadRuntimeConfig();
const backendUrl =
  process.env.UI_CHAT_BACKEND_URL ||
  `http://${runtimeConfig.backend.host}:${runtimeConfig.backend.port}`;
const desktopRuntime = {
  hostKind: "electron",
  platform: process.platform,
  isPackaged: process.env.NODE_ENV !== "development",
  backendUrl,
};

contextBridge.exposeInMainWorld("desktopRuntime", desktopRuntime);

contextBridge.exposeInMainWorld("desktopApi", {
  platform: desktopRuntime.platform,
  isPackaged: desktopRuntime.isPackaged,
  backendUrl,
});

contextBridge.exposeInMainWorld("electronAPI", {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) =>
    ipcRenderer.on(channel, (event, ...args) => func(...args)),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
});
