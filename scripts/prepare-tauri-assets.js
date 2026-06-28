import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const artifactsRoot = path.join(projectRoot, ".artifacts");
const desktopArtifactsRoot = path.join(artifactsRoot, "desktop", "dist");
const serverBundleArtifactsRoot = path.join(artifactsRoot, "server-bundle");
const nodeRuntimeArtifactsRoot = path.join(artifactsRoot, "node-runtime");
const tauriResourcesRoot = path.join(projectRoot, "tauri", "resources");
const tauriServerDir = path.join(tauriResourcesRoot, "server");
const nodeRuntimeDir = path.join(tauriResourcesRoot, "node-runtime");
const nodeRuntimeDest = path.join(nodeRuntimeDir, path.basename(process.execPath));
const runtimeConfigDest = path.join(tauriResourcesRoot, "runtime.config.cjs");

const runtimeConfigArtifactsPath = path.join(artifactsRoot, "runtime.config.cjs");
const skipTests =
  process.env.UICHAT_MIRA_SKIP_TESTS === "1" ||
  process.env.UICHAT_MIRA_SKIP_TESTS === "true" ||
  process.argv.includes("--notest");

console.log("Preparing Tauri desktop assets...");

execSync("pnpm internal:prepare:desktop-artifacts", {
  cwd: projectRoot,
  stdio: "inherit",
  env: skipTests ? { ...process.env, UICHAT_MIRA_SKIP_TESTS: "1" } : process.env,
});

if (!fs.existsSync(desktopArtifactsRoot)) {
  throw new Error(`Missing staged desktop dist: ${desktopArtifactsRoot}`);
}

if (!fs.existsSync(serverBundleArtifactsRoot)) {
  throw new Error(`Missing staged server bundle: ${serverBundleArtifactsRoot}`);
}

if (!fs.existsSync(runtimeConfigArtifactsPath)) {
  throw new Error(`Missing staged runtime config: ${runtimeConfigArtifactsPath}`);
}

fs.rmSync(tauriResourcesRoot, { recursive: true, force: true });
fs.mkdirSync(tauriResourcesRoot, { recursive: true });
fs.cpSync(serverBundleArtifactsRoot, tauriServerDir, { recursive: true });

fs.mkdirSync(nodeRuntimeDir, { recursive: true });
fs.copyFileSync(
  path.join(nodeRuntimeArtifactsRoot, path.basename(process.execPath)),
  nodeRuntimeDest,
);
fs.copyFileSync(runtimeConfigArtifactsPath, runtimeConfigDest);

console.log(`Prepared Tauri server assets: ${tauriServerDir}`);
console.log(`Copied Node runtime for Tauri: ${nodeRuntimeDest}`);
console.log(`Copied runtime config for Tauri: ${runtimeConfigDest}`);
console.log("Tauri desktop assets are ready.");
