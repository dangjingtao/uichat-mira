import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import loadLocalEnv from "./load-local-env.cjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
loadLocalEnv(projectRoot);
const artifactsRoot = path.join(projectRoot, ".artifacts");
const desktopArtifactsRoot = path.join(artifactsRoot, "desktop", "dist");
const serverBundleArtifactsRoot = path.join(artifactsRoot, "server-bundle");
const nodeRuntimeArtifactsRoot = path.join(artifactsRoot, "node-runtime");
const localModelDistRoot = path.join(artifactsRoot, "model-packs", "dist");
const onnxRuntimeWebDistRoot = path.join(
  projectRoot,
  "node_modules",
  "onnxruntime-web",
  "dist",
);
const tauriResourcesRoot = path.join(projectRoot, "tauri", "resources");
const tauriServerDir = path.join(tauriResourcesRoot, "server");
const nodeRuntimeDir = path.join(tauriResourcesRoot, "node-runtime");
const tauriModelPacksDir = path.join(tauriResourcesRoot, "model-packs");
const tauriModelRuntimeDir = path.join(
  tauriResourcesRoot,
  "model-runtime",
  "onnxruntime-web",
);
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
fs.mkdirSync(path.join(tauriResourcesRoot, "model-packs"), { recursive: true });
fs.mkdirSync(path.join(tauriResourcesRoot, "model-runtime"), { recursive: true });

fs.mkdirSync(nodeRuntimeDir, { recursive: true });
fs.copyFileSync(
  path.join(nodeRuntimeArtifactsRoot, path.basename(process.execPath)),
  nodeRuntimeDest,
);
fs.copyFileSync(runtimeConfigArtifactsPath, runtimeConfigDest);
if (fs.existsSync(localModelDistRoot)) {
  fs.cpSync(localModelDistRoot, tauriModelPacksDir, { recursive: true });
  fs.cpSync(onnxRuntimeWebDistRoot, tauriModelRuntimeDir, { recursive: true });
  console.log(`Prepared Tauri local model packs: ${tauriModelPacksDir}`);
  console.log(`Prepared Tauri ONNX Runtime Web files: ${tauriModelRuntimeDir}`);
} else {
  console.log(
    `Skipping Tauri local model resources because no archived model pack was found at: ${localModelDistRoot}`,
  );
}

console.log(`Prepared Tauri server assets: ${tauriServerDir}`);
console.log(`Copied Node runtime for Tauri: ${nodeRuntimeDest}`);
console.log(`Copied runtime config for Tauri: ${runtimeConfigDest}`);
console.log("Tauri desktop assets are ready.");
