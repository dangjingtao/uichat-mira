import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const artifactsRoot = path.join(projectRoot, ".artifacts");
const desktopArtifactsRoot = path.join(artifactsRoot, "desktop", "dist");
const legacyServerArtifactsRoot = path.join(artifactsRoot, "server");
const serverBundleArtifactsRoot = path.join(artifactsRoot, "server-bundle");
const iconsArtifactsRoot = path.join(artifactsRoot, "icons");
const runtimeConfigArtifactsPath = path.join(artifactsRoot, "runtime.config.cjs");
const nodeRuntimeArtifactsRoot = path.join(artifactsRoot, "node-runtime");
const electronArtifactsRoot = path.join(artifactsRoot, "electron-app");
const serverAppMetaPath = path.join(projectRoot, "server", "app-meta.json");
const serverBundleAppMetaPath = path.join(serverBundleArtifactsRoot, "app-meta.json");
const appMetaGeneratorUrl = pathToFileURL(
  path.join(projectRoot, "scripts", "app-meta-generator.js"),
).href;

function removeDir(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
  console.log(`Removed ${label}: ${targetPath}`);
}

function copyPath(sourcePath, destinationPath, label) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing ${label}: ${sourcePath}`);
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const stat = fs.statSync(sourcePath);

  if (stat.isDirectory()) {
    fs.rmSync(destinationPath, { recursive: true, force: true });
    fs.cpSync(sourcePath, destinationPath, { recursive: true });
  } else {
    fs.copyFileSync(sourcePath, destinationPath);
  }

  console.log(`Copied ${label}: ${destinationPath}`);
}

console.log("Preparing shared desktop artifacts...");

removeDir(legacyServerArtifactsRoot, "legacy staged server bundle");

const { writeAppMetaJsons } = await import(appMetaGeneratorUrl);

writeAppMetaJsons(projectRoot, [serverAppMetaPath, serverBundleAppMetaPath]);

execSync("pnpm internal:build:desktop", { cwd: projectRoot, stdio: "inherit" });
execSync("pnpm internal:build:server", { cwd: projectRoot, stdio: "inherit" });

if (!fs.existsSync(serverBundleArtifactsRoot)) {
  throw new Error(`Missing server bundle: ${serverBundleArtifactsRoot}`);
}

copyPath(
  path.join(projectRoot, "desktop", "dist"),
  desktopArtifactsRoot,
  "desktop dist",
);
copyPath(
  path.join(projectRoot, "icons"),
  iconsArtifactsRoot,
  "icons",
);
copyPath(
  path.join(projectRoot, "runtime.config.cjs"),
  runtimeConfigArtifactsPath,
  "runtime config",
);

fs.mkdirSync(nodeRuntimeArtifactsRoot, { recursive: true });
const nodeRuntimeDest = path.join(
  nodeRuntimeArtifactsRoot,
  path.basename(process.execPath),
);
fs.copyFileSync(process.execPath, nodeRuntimeDest);
console.log(`Copied Node runtime: ${nodeRuntimeDest}`);

removeDir(electronArtifactsRoot, "old staged Electron app");
fs.mkdirSync(electronArtifactsRoot, { recursive: true });
copyPath(
  path.join(projectRoot, "electron", "main.cjs"),
  path.join(electronArtifactsRoot, "main.cjs"),
  "Electron main entry",
);
copyPath(
  path.join(projectRoot, "electron", "preload.cjs"),
  path.join(electronArtifactsRoot, "preload.cjs"),
  "Electron preload entry",
);
copyPath(
  path.join(projectRoot, "electron", "package.json"),
  path.join(electronArtifactsRoot, "package.json"),
  "Electron package manifest",
);
copyPath(
  path.join(projectRoot, "electron-builder.yml"),
  path.join(electronArtifactsRoot, "electron-builder.yml"),
  "electron-builder config",
);
copyPath(
  desktopArtifactsRoot,
  path.join(electronArtifactsRoot, "desktop", "dist"),
  "staged desktop dist",
);
const electronBackendRoot = path.join(electronArtifactsRoot, "backend");
copyPath(
  serverBundleArtifactsRoot,
  electronBackendRoot,
  "staged backend bundle",
);
copyPath(
  runtimeConfigArtifactsPath,
  path.join(electronArtifactsRoot, "runtime.config.cjs"),
  "staged runtime config",
);
copyPath(
  iconsArtifactsRoot,
  path.join(electronArtifactsRoot, "icons"),
  "staged icons",
);
copyPath(
  nodeRuntimeArtifactsRoot,
  path.join(electronArtifactsRoot, "node-runtime"),
  "staged Node runtime",
);

console.log("Desktop artifacts are ready.");
