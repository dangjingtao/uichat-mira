const { spawnSync } = require("child_process");
const path = require("path");

const runtimeConfig = require(path.join(__dirname, "..", "runtime.config.cjs"));
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const devConfig = JSON.stringify({
  build: {
    devUrl: `http://localhost:${runtimeConfig.dev.desktopPort}`,
  },
});

const result = spawnSync(
  pnpmCommand,
  [
    "tauri",
    "dev",
    "--config",
    "tauri/tauri.conf.json",
    "--config",
    devConfig,
  ],
  {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    env: {
      ...process.env,
      CARGO_BUILD_JOBS: "1",
      CARGO_INCREMENTAL: "0",
    },
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
