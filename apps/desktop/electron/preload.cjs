const { contextBridge } = require("electron");

async function checkBackendHealth() {
  try {
    const response = await fetch("http://127.0.0.1:8787/health");

    return {
      ok: response.ok,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function checkDatabaseHealth() {
  try {
    const response = await fetch("http://127.0.0.1:8787/db/health");

    if (!response.ok) {
      return {
        ok: false,
        configured: false,
        detail: `数据库健康检查失败 · HTTP ${response.status}`,
      };
    }

    const payload = await response.json();

    return {
      ok: Boolean(payload.ok),
      configured: Boolean(payload.configured),
      detail: typeof payload.detail === "string" ? payload.detail : "未知状态",
    };
  } catch (error) {
    return {
      ok: false,
      configured: false,
      detail: error instanceof Error ? error.message : "数据库健康检查异常",
    };
  }
}

contextBridge.exposeInMainWorld("desktopApi", {
  platform: process.platform,
  isPackaged: process.env.NODE_ENV === "production",
  backendUrl: "http://127.0.0.1:8787",
  checkBackendHealth,
  checkDatabaseHealth,
});
