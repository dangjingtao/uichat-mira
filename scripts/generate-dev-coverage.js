import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const serverDir = path.join(projectRoot, "server");

const args = process.argv.slice(2);
const shouldGenerate = args.includes("--test");
const shouldForce = args.includes("--force");

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
  return fs.existsSync(path.join(coverageDir, "test-results.json"));
}

function copyTestJsonFiles(sourceDir, targetDir, label) {
  const files = ["test-results.json", "test-results-summary.json"];

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });

  for (const filename of files) {
    const sourcePath = path.join(sourceDir, filename);
    if (!fs.existsSync(sourcePath)) {
      console.log(`[dev:coverage] Missing ${label} ${filename}: ${sourcePath}`);
      continue;
    }

    fs.copyFileSync(sourcePath, path.join(targetDir, filename));
  }
}

function buildTestResultsSummary(coverageDir) {
  const rawPath = path.join(coverageDir, "test-results.json");
  const summaryPath = path.join(coverageDir, "test-results-summary.json");

  if (!fs.existsSync(rawPath)) {
    console.log(
      `[dev:coverage] test-results.json not found, skipping summary: ${rawPath}`,
    );
    return;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(rawPath, "utf-8"));
    const results = Array.isArray(raw.testResults) ? raw.testResults : [];

    const startTimes = results
      .map((item) => item.startTime)
      .filter((value) => typeof value === "number");
    const endTimes = results
      .map((item) => item.endTime)
      .filter((value) => typeof value === "number");

    const durationMs =
      startTimes.length > 0 && endTimes.length > 0
        ? Math.max(...endTimes) - Math.min(...startTimes)
        : 0;

    const failedTests = results
      .filter((item) => item.status === "failed")
      .map((item) => item.name)
      .filter((value) => typeof value === "string");

    const summary = {
      total: raw.numTotalTests ?? 0,
      passed: raw.numPassedTests ?? 0,
      failed: raw.numFailedTests ?? 0,
      skipped: raw.numSkippedTests ?? 0,
      durationMs,
      failedTests,
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(
      `[dev:coverage] Test results summary written to ${summaryPath}`,
    );
  } catch (error) {
    console.error(
      `[dev:coverage] Failed to build test results summary: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function generateFrontendReport() {
  if (!shouldForce && reportExists(desktopCoverageDir)) {
    console.log(
      "[dev:coverage] Frontend coverage report already exists. Skipping generation.",
    );
    return;
  }

  console.log("[dev:coverage] Generating frontend coverage report...");
  execSync(
    "pnpm --filter @ui-chat-mira/desktop exec vitest run --coverage --reporter=default --reporter=json --outputFile=./coverage/test-results.json",
    {
      cwd: projectRoot,
      stdio: "inherit",
    },
  );
  buildTestResultsSummary(desktopCoverageDir);
}

function generateServerReport() {
  if (!shouldForce && reportExists(serverCoverageDir)) {
    console.log(
      "[dev:coverage] Server coverage report already exists. Skipping generation.",
    );
    return;
  }

  console.log("[dev:coverage] Generating server coverage report...");
  execSync(
    "pnpm exec vitest run --coverage --reporter=default --reporter=json --outputFile=./coverage/test-results.json",
    {
      cwd: serverDir,
      stdio: "inherit",
    },
  );
  buildTestResultsSummary(serverCoverageDir);
}

function syncReportsToBackend() {
  console.log(
    "[dev:coverage] Syncing coverage reports to backend static directories...",
  );

  if (fs.existsSync(desktopCoverageDir)) {
    copyTestJsonFiles(
      desktopCoverageDir,
      backendClientCoverageDir,
      "frontend",
    );
    console.log(
      `[dev:coverage] Frontend test result JSON synced to ${backendClientCoverageDir}`,
    );
  } else {
    console.log(
      `[dev:coverage] Frontend coverage directory not found, skipping sync: ${desktopCoverageDir}`,
    );
  }

  if (fs.existsSync(serverCoverageDir)) {
    copyTestJsonFiles(serverCoverageDir, backendServerCoverageDir, "server");
    console.log(
      `[dev:coverage] Server test result JSON synced to ${backendServerCoverageDir}`,
    );
  } else {
    console.log(
      `[dev:coverage] Server coverage directory not found, skipping sync: ${serverCoverageDir}`,
    );
  }
}

function main() {
  if (shouldGenerate || shouldForce) {
    generateFrontendReport();
    generateServerReport();
  } else {
    console.log(
      "[dev:coverage] No --test or --force flag provided. Skipping report generation.",
    );
  }

  // 无论是否生成，都同步到后端，确保 backend 目录始终与源目录一致
  syncReportsToBackend();
  console.log(
    "[dev:coverage] All coverage reports are ready and synced to backend.",
  );
}

main();
