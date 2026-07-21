const fs = require("fs");
const path = require("path");

const localEnvLoaderPath = path.join(__dirname, "scripts", "load-local-env.cjs");
if (fs.existsSync(localEnvLoaderPath)) {
  require(localEnvLoaderPath)(__dirname);
}

function readPort(name, fallback) {
  const rawValue = process.env[name]?.trim() || String(fallback);
  const port = Number(rawValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }

  return port;
}

module.exports = {
  backend: {
    host: "127.0.0.1",
    port: readPort("UI_CHAT_BACKEND_PORT", 8787),
  },
  dev: {
    apiProxyPrefix: "/api",
    desktopPort: readPort("UI_CHAT_DESKTOP_PORT", 5173),
    docsSitePort: readPort("UI_CHAT_DOCS_SITE_PORT", 4180),
  },
};
