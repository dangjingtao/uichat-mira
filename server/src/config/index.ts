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
  DATABASE_DIR: "data",
  DATABASE_NAME: "uichat-rag-test.db",
  SWAGGER_PREFIX: "/docs",
  LOG_DIR: "logs",
};

export default CONFIG;
