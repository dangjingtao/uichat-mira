import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const desktopCoverageDir = path.join(projectRoot, "desktop", "coverage");
const serverCoverageDir = path.join(projectRoot, "server", "coverage");
const backendClientCoverageDir = path.join(
  projectRoot,
  "server",
  "client-coverage",
);
const backendServerCoverageDir = path.join(
  projectRoot,
  "server",
  "server-coverage",
);

function reportExists(coverageDir) {
  return fs.existsSync(path.join(coverageDir, "index.html"));
}

function copyDir(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

function generateFrontendReport() {
  if (reportExists(desktopCoverageDir)) {
    console.log(
      "[dev:coverage] Frontend coverage report already exists. Skipping generation.",
    );
    return;
  }

  console.log("[dev:coverage] Generating frontend coverage report...");
  execSync("pnpm --filter @ui-chat-mira/desktop test:coverage", {
    cwd: projectRoot,
    stdio: "inherit",
  });
}

function generateServerReport() {
  if (reportExists(serverCoverageDir)) {
    console.log(
      "[dev:coverage] Server coverage report already exists. Skipping generation.",
    );
    return;
  }

  console.log("[dev:coverage] Generating server coverage report...");
  execSync("pnpm test:coverage", {
    cwd: path.join(projectRoot, "server"),
    stdio: "inherit",
  });
}

function syncReportsToBackend() {
  console.log(
    "[dev:coverage] Syncing coverage reports to backend static directories...",
  );

  if (fs.existsSync(desktopCoverageDir)) {
    copyDir(desktopCoverageDir, backendClientCoverageDir);
    console.log(
      `[dev:coverage] Frontend report synced to ${backendClientCoverageDir}`,
    );
  } else {
    console.log(
      `[dev:coverage] Frontend coverage directory not found, skipping sync: ${desktopCoverageDir}`,
    );
  }

  if (fs.existsSync(serverCoverageDir)) {
    copyDir(serverCoverageDir, backendServerCoverageDir);
    console.log(
      `[dev:coverage] Server report synced to ${backendServerCoverageDir}`,
    );
  } else {
    console.log(
      `[dev:coverage] Server coverage directory not found, skipping sync: ${serverCoverageDir}`,
    );
  }
}

function main() {
  generateFrontendReport();
  generateServerReport();
  // 无论是否跳过生成，都同步到后端，确保 backend 目录始终与源目录一致
  syncReportsToBackend();
  console.log(
    "[dev:coverage] All coverage reports are ready and synced to backend.",
  );
}

main();
