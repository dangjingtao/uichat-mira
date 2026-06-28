import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(pathToFileURL(path.join(process.cwd(), "package.json")));

function loadRuntimeConfig() {
  const candidates = [
    path.resolve(process.cwd(), "runtime.config.cjs"),
    path.resolve(process.cwd(), "..", "runtime.config.cjs"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  return {
    backend: {
      host: "127.0.0.1",
      port: 0,
    },
  };
}

const runtimeConfig = loadRuntimeConfig();

const CONFIG = {
  PORT: Number(
    process.env.UI_CHAT_BACKEND_PORT ??
      process.env.PORT ??
      runtimeConfig.backend.port,
  ),
  HOST:
    process.env.UI_CHAT_BACKEND_HOST ??
    process.env.HOST ??
    runtimeConfig.backend.host,
  DATABASE_DIR: process.env.UI_CHAT_DATABASE_DIR ?? "data",
  DATABASE_NAME: "uichat-rag-test.db",
  SWAGGER_PREFIX: "/api-docs",
  LOG_DIR: process.env.UI_CHAT_LOG_DIR ?? "logs",
  TOOLS_DIR: process.env.UI_CHAT_TOOLS_DIR ?? "tools",
  EXTEND_TOOLS_DIR: process.env.UI_CHAT_EXTEND_TOOLS_DIR ?? "extendTools",
  ATTACHMENTS_DIR: process.env.UI_CHAT_ATTACHMENTS_DIR ?? "data/attachments",
  WECOM_BIND_RELAY_BASE_URL: process.env.WECOM_BIND_RELAY_BASE_URL ?? "",
};

export default CONFIG;
