import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import loadLocalEnv from "./load-local-env.cjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
loadLocalEnv(projectRoot);
const artifactsRoot = path.join(projectRoot, ".artifacts");
const desktopArtifactsRoot = path.join(artifactsRoot, "desktop", "dist");
const legacyServerArtifactsRoot = path.join(artifactsRoot, "server");
const serverBundleArtifactsRoot = path.join(artifactsRoot, "server-bundle");
const iconsArtifactsRoot = path.join(artifactsRoot, "icons");
const runtimeConfigArtifactsPath = path.join(
  artifactsRoot,
  "runtime.config.cjs",
);
const nodeRuntimeArtifactsRoot = path.join(artifactsRoot, "node-runtime");
const electronArtifactsRoot = path.join(artifactsRoot, "electron-app");
const localModelDistRoot = path.join(artifactsRoot, "model-packs", "dist");
const onnxRuntimeWebDistRoot = path.join(
  projectRoot,
  "node_modules",
  "onnxruntime-web",
  "dist",
);
const brandingSourceIconPath = path.join(
  projectRoot,
  "desktop",
  "src",
  "assets",
  "branding",
  "uichat-logo-icon.png",
);
const serverAppMetaPath = path.join(projectRoot, "server", "app-meta.json");
const serverBundleAppMetaPath = path.join(
  serverBundleArtifactsRoot,
  "app-meta.json",
);
const appMetaGeneratorUrl = pathToFileURL(
  path.join(projectRoot, "scripts", "app-meta-generator.js"),
).href;
const testReportGeneratorUrl = pathToFileURL(
  path.join(projectRoot, "scripts", "generate-test-report.js"),
).href;
const iconGeneratorUrl = pathToFileURL(
  path.join(projectRoot, "scripts", "generate-icons.js"),
).href;
const shouldPrepareLocalModels =
  process.env.LOCAL_MODEL_RAW_ROOT?.trim() ||
  process.env.LOCAL_MODEL_ALLOW_NETWORK === "1" ||
  process.env.LOCAL_MODEL_ALLOW_NETWORK === "true" ||
  process.env.CI === "true";
const skipTests =
  process.env.UICHAT_MIRA_SKIP_TESTS === "1" ||
  process.env.UICHAT_MIRA_SKIP_TESTS === "true" ||
  process.argv.includes("--notest");

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

function copyTestResults(sourceDir, destinationDir, label) {
  const rawSource = path.join(sourceDir, "test-results.json");
  const summarySource = path.join(sourceDir, "test-results-summary.json");

  if (!fs.existsSync(rawSource)) {
    throw new Error(`Missing ${label} test results: ${rawSource}`);
  }
  if (!fs.existsSync(summarySource)) {
    throw new Error(`Missing ${label} test results summary: ${summarySource}`);
  }

  fs.rmSync(destinationDir, { recursive: true, force: true });
  fs.mkdirSync(destinationDir, { recursive: true });
  fs.copyFileSync(rawSource, path.join(destinationDir, "test-results.json"));
  fs.copyFileSync(
    summarySource,
    path.join(destinationDir, "test-results-summary.json"),
  );
  console.log(`Copied ${label} test results JSON: ${destinationDir}`);
}

console.log("Preparing shared desktop artifacts...");

removeDir(legacyServerArtifactsRoot, "legacy staged server bundle");

const { writeAppMetaJsons } = await import(appMetaGeneratorUrl);
const { generateReleaseTestReports } = await import(testReportGeneratorUrl);
const { generateDesktopIcons } = await import(iconGeneratorUrl);

writeAppMetaJsons(projectRoot, [serverAppMetaPath, serverBundleAppMetaPath]);
generateDesktopIcons(projectRoot, brandingSourceIconPath);

if (shouldPrepareLocalModels) {
  execSync("pnpm prepare:local-model-packs", {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });
  execSync("pnpm archive:local-model-packs", {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });
} else {
  console.log(
    "Skipping local model pack preparation because LOCAL_MODEL_RAW_ROOT/LOCAL_MODEL_ALLOW_NETWORK is not set.",
  );
}

let desktopCoveragePath;
let serverCoveragePath;

if (skipTests) {
  console.log("Skipping release test report generation because --notest was set.");
} else {
  const reportResult = generateReleaseTestReports();
  desktopCoveragePath = reportResult.desktopCoverageDir;
  serverCoveragePath = reportResult.serverCoverageDir;
}

execSync("pnpm internal:build:desktop", { cwd: projectRoot, stdio: "inherit" });
execSync("pnpm internal:build:server", { cwd: projectRoot, stdio: "inherit" });
execSync("pnpm docs:build", { cwd: projectRoot, stdio: "inherit" });

if (!fs.existsSync(serverBundleArtifactsRoot)) {
  throw new Error(`Missing server bundle: ${serverBundleArtifactsRoot}`);
}
if (!skipTests) {
  copyTestResults(
    desktopCoveragePath,
    path.join(serverBundleArtifactsRoot, "client-coverage"),
    "frontend",
  );
  copyTestResults(
    serverCoveragePath,
    path.join(serverBundleArtifactsRoot, "server-coverage"),
    "server",
  );
}
copyPath(
  path.join(projectRoot, "packages", "docs-site", "dist"),
  path.join(serverBundleArtifactsRoot, "docs-site"),
  "staged docs site",
);

copyPath(
  path.join(projectRoot, "desktop", "dist"),
  desktopArtifactsRoot,
  "desktop dist",
);
copyPath(path.join(projectRoot, "icons"), iconsArtifactsRoot, "icons");
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
fs.mkdirSync(path.join(electronArtifactsRoot, "model-packs"), { recursive: true });
fs.mkdirSync(path.join(electronArtifactsRoot, "model-runtime"), { recursive: true });
if (fs.existsSync(localModelDistRoot)) {
  copyPath(
    localModelDistRoot,
    path.join(electronArtifactsRoot, "model-packs"),
    "staged local model packs",
  );
  copyPath(
    onnxRuntimeWebDistRoot,
    path.join(electronArtifactsRoot, "model-runtime", "onnxruntime-web"),
    "staged ONNX Runtime Web files",
  );
} else {
  console.log(
    `Skipping local model resources because no archived model pack was found at: ${localModelDistRoot}`,
  );
}

console.log("Desktop artifacts are ready.");
