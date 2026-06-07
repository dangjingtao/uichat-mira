const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApi", {
  platform: process.platform,
  isPackaged: process.env.NODE_ENV !== "development",
  backendUrl: "http://127.0.0.1:8787",

  async checkBackendHealth() {
    try {
      const response = await fetch("http://127.0.0.1:8787/health");
      const payload = await response.json();
      return { success: payload.success, statusCode: response.status };
    } catch (err) {
      return { success: false, statusCode: 0, error: err.message };
    }
  },

  async checkDatabaseHealth() {
    try {
      const response = await fetch("http://127.0.0.1:8787/db/health");
      const payload = await response.json();
      if (!payload.success) {
        return { success: false, configured: false, detail: payload.message };
      }
      return { success: true, ...payload.data };
    } catch (err) {
      return { success: false, configured: false, detail: err.message };
    }
  },
});

contextBridge.exposeInMainWorld("electronAPI", {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) =>
    ipcRenderer.on(channel, (event, ...args) => func(...args)),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
});
