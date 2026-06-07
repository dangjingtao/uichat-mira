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

contextBridge.exposeInMainWorld("desktopApi", {
  platform: process.platform,
  isPackaged: process.env.NODE_ENV !== "development",
  backendUrl,

  async checkBackendHealth() {
    try {
      const response = await fetch(`${backendUrl}/health`);
      const payload = await response.json();
      return { success: payload.success, statusCode: response.status };
    } catch (err) {
      return { success: false, statusCode: 0, error: err.message };
    }
  },

  async checkDatabaseHealth() {
    try {
      const response = await fetch(`${backendUrl}/db/health`);
      const payload = await response.json();
      if (!payload.success) {
        return {
          success: false,
          ok: false,
          configured: false,
          mode: "unknown",
          detail: payload.message,
        };
      }
      return { success: true, ...payload.data };
    } catch (err) {
      return {
        success: false,
        ok: false,
        configured: false,
        mode: "unknown",
        detail: err.message,
      };
    }
  },
});

contextBridge.exposeInMainWorld("electronAPI", {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) =>
    ipcRenderer.on(channel, (event, ...args) => func(...args)),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
});
