import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const desktopDir = path.join(projectRoot, "desktop");
const serverDir = path.join(projectRoot, "server");
const desktopCoverageDir = path.join(desktopDir, "coverage");
const serverCoverageDir = path.join(serverDir, "coverage");

function removeDir(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
  console.log(`Removed ${label}: ${targetPath}`);
}

function buildTestResultsSummary(coverageDir) {
  const rawPath = path.join(coverageDir, "test-results.json");
  const summaryPath = path.join(coverageDir, "test-results-summary.json");

  if (!fs.existsSync(rawPath)) {
    console.log(`Missing test results JSON, skipping summary: ${rawPath}`);
    return null;
  }

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

  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Wrote test results summary: ${summaryPath}`);
  if (summary.failed > 0) {
    console.log(`Test failures detected in ${coverageDir}:`);
    for (const failedTest of failedTests) {
      console.log(`- ${failedTest}`);
    }
  }

  return summary;
}

function assertReportFiles(coverageDir, label) {
  const requiredFiles = [
    "coverage-summary.json",
    "test-results.json",
    "test-results-summary.json",
  ];

  for (const filename of requiredFiles) {
    const filePath = path.join(coverageDir, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`Missing ${label} report file: ${filePath}`);
      return false;
    }
  }

  return true;
}

function runCoverage(command, cwd, label) {
  console.log(`Generating ${label} test coverage report...`);
  try {
    execSync(command, {
      cwd,
      stdio: "inherit",
    });
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.log(`Tests completed with failures for ${label}: ${message}`);
    return { ok: false, error };
  }
}

export function generateReleaseTestReports() {
  removeDir(desktopCoverageDir, "old frontend coverage report");
  removeDir(serverCoverageDir, "old server coverage report");

  const desktopRun = runCoverage(
    "pnpm exec vitest run --coverage --reporter=default --reporter=json --outputFile=./coverage/test-results.json",
    desktopDir,
    "frontend",
  );
  buildTestResultsSummary(desktopCoverageDir);
  assertReportFiles(desktopCoverageDir, "frontend");

  const serverRun = runCoverage(
    "pnpm exec vitest run --coverage --reporter=default --reporter=json --outputFile=./coverage/test-results.json",
    serverDir,
    "server",
  );
  buildTestResultsSummary(serverCoverageDir);
  assertReportFiles(serverCoverageDir, "server");

  if (!desktopRun.ok || !serverRun.ok) {
    console.log(
      "One or more test suites failed. The release build will continue, but inspect the printed failures above.",
    );
  }

  return {
    desktopCoverageDir,
    serverCoverageDir,
  };
}

export function generateFrontendTestReport() {
  return generateReleaseTestReports().desktopCoverageDir;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateReleaseTestReports();
}
