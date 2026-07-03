import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const reportTargets = {
  client: {
    label: "frontend",
    workspaceDir: path.join(projectRoot, "desktop"),
    coverageDir: path.join(projectRoot, "desktop", "coverage"),
    reportDir: path.join(projectRoot, "desktop", "test-report"),
    command:
      "pnpm exec vitest run --coverage --reporter=default --reporter=json --outputFile=./coverage/test-results.json",
  },
  server: {
    label: "server",
    workspaceDir: path.join(projectRoot, "server"),
    coverageDir: path.join(projectRoot, "server", "coverage"),
    reportDir: path.join(projectRoot, "server", "test-report"),
    command:
      "pnpm exec vitest run --coverage --reporter=default --reporter=json --outputFile=./coverage/test-results.json",
  },
};

function removeDir(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
  console.log(`Removed ${label}: ${targetPath}`);
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function normalizePathForReport(filePath, workspaceDir) {
  const relativePath = path.relative(workspaceDir, filePath);
  return relativePath.split(path.sep).join("/");
}

function toCountMap(coverageObject = {}) {
  return Object.entries(coverageObject).reduce((result, [key, value]) => {
    result[String(key)] = Number(value ?? 0);
    return result;
  }, {});
}

function toBranchMap(branchMap = {}, branchCounts = {}) {
  return Object.entries(branchMap).map(([key, branch]) => ({
    id: String(key),
    line: branch?.line ?? null,
    type: branch?.type ?? "branch",
    locations: Array.isArray(branch?.locations)
      ? branch.locations.map((location, index) => ({
          index,
          start: location?.start ?? null,
          end: location?.end ?? null,
          count: Number(branchCounts?.[key]?.[index] ?? 0),
        }))
      : [],
  }));
}

function normalizeCoverageFile(fileCoverage, fileSummary, workspaceDir) {
  const normalizedPath = normalizePathForReport(fileCoverage.path, workspaceDir);

  return {
    path: normalizedPath,
    absolutePath: fileCoverage.path,
    summary: fileSummary,
    lines: {
      map: fileCoverage.lineMap ?? {},
      hits: toCountMap(fileCoverage.l),
    },
    statements: {
      map: fileCoverage.statementMap ?? {},
      hits: toCountMap(fileCoverage.s),
    },
    functions: {
      map: fileCoverage.fnMap ?? {},
      hits: toCountMap(fileCoverage.f),
    },
    branches: toBranchMap(fileCoverage.branchMap, fileCoverage.b),
  };
}

function normalizeCoverageReport(coverageDir, workspaceDir, scope) {
  const summaryPath = path.join(coverageDir, "coverage-summary.json");
  const fullPath = path.join(coverageDir, "coverage-final.json");

  if (!fs.existsSync(summaryPath) || !fs.existsSync(fullPath)) {
    console.log(
      `Coverage details were not emitted for ${scope}. Writing an unavailable placeholder report.`,
    );
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      scope,
      summary: {},
      files: [],
      available: false,
      missingReason: "Vitest did not emit coverage artifacts for this run.",
    };
  }

  const summary = readJson(summaryPath);
  const full = readJson(fullPath);
  const totalSummary = summary.total;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope,
    summary,
    files: Object.values(full).map((entry) => {
      const normalizedPath = normalizePathForReport(entry.path, workspaceDir);
      const fileSummary =
        summary[entry.path] ??
        summary[normalizedPath] ??
        summary[normalizedPath.split("/").join(path.sep)] ??
        totalSummary;

      return normalizeCoverageFile(entry, fileSummary, workspaceDir);
    }),
    available: true,
  };
}

function normalizeAssertionResult(assertion) {
  return {
    ancestorTitles: Array.isArray(assertion.ancestorTitles)
      ? assertion.ancestorTitles
      : [],
    fullName: assertion.fullName ?? assertion.title ?? "",
    title: assertion.title ?? "",
    status: assertion.status ?? "unknown",
    duration: typeof assertion.duration === "number" ? assertion.duration : null,
    failureMessages: Array.isArray(assertion.failureMessages)
      ? assertion.failureMessages
      : [],
    meta: assertion.meta ?? {},
  };
}

function normalizeSuiteResult(suite, workspaceDir) {
  return {
    name:
      typeof suite.name === "string"
        ? normalizePathForReport(suite.name, workspaceDir)
        : "",
    absoluteName: suite.name ?? "",
    status: suite.status ?? "unknown",
    startTime: typeof suite.startTime === "number" ? suite.startTime : null,
    endTime: typeof suite.endTime === "number" ? suite.endTime : null,
    message: suite.message ?? "",
    assertionResults: Array.isArray(suite.assertionResults)
      ? suite.assertionResults.map(normalizeAssertionResult)
      : [],
  };
}

function buildTestSummary(raw, suites) {
  const startTimes = suites
    .map((item) => item.startTime)
    .filter((value) => typeof value === "number");
  const endTimes = suites
    .map((item) => item.endTime)
    .filter((value) => typeof value === "number");
  const durationMs =
    startTimes.length > 0 && endTimes.length > 0
      ? Math.max(...endTimes) - Math.min(...startTimes)
      : 0;

  return {
    totalTests: raw.numTotalTests ?? 0,
    passedTests: raw.numPassedTests ?? 0,
    failedTests: raw.numFailedTests ?? 0,
    pendingTests: raw.numPendingTests ?? 0,
    todoTests: raw.numTodoTests ?? 0,
    totalSuites: raw.numTotalTestSuites ?? suites.length,
    passedSuites: raw.numPassedTestSuites ?? 0,
    failedSuites: raw.numFailedTestSuites ?? 0,
    pendingSuites: raw.numPendingTestSuites ?? 0,
    success: raw.success ?? raw.numFailedTests === 0,
    startTime:
      typeof raw.startTime === "number"
        ? raw.startTime
        : startTimes.length > 0
          ? Math.min(...startTimes)
          : null,
    durationMs,
  };
}

function normalizeTestReport(coverageDir, workspaceDir, scope) {
  const resultsPath = path.join(coverageDir, "test-results.json");
  if (!fs.existsSync(resultsPath)) {
    throw new Error(`Missing ${scope} test results: ${resultsPath}`);
  }

  const raw = readJson(resultsPath);
  const suites = Array.isArray(raw.testResults)
    ? raw.testResults.map((suite) => normalizeSuiteResult(suite, workspaceDir))
    : [];

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope,
    summary: buildTestSummary(raw, suites),
    suites,
  };
}

function assertOfficialReportFiles(reportDir, scope) {
  const requiredFiles = ["test-report.json", "coverage-report.json"];

  for (const filename of requiredFiles) {
    const filePath = path.join(reportDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing ${scope} official report file: ${filePath}`);
    }
  }
}

function runCoverage(command, cwd, label) {
  console.log(`Generating ${label} test reports...`);
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

function generateScopeReports(scope) {
  const target = reportTargets[scope];
  removeDir(target.coverageDir, `${target.label} transient coverage`);

  const run = runCoverage(target.command, target.workspaceDir, target.label);
  const testReport = normalizeTestReport(
    target.coverageDir,
    target.workspaceDir,
    scope,
  );
  const coverageReport = normalizeCoverageReport(
    target.coverageDir,
    target.workspaceDir,
    scope,
  );

  removeDir(target.reportDir, `${target.label} official report`);
  ensureDir(target.reportDir);
  writeJson(path.join(target.reportDir, "test-report.json"), testReport);
  writeJson(
    path.join(target.reportDir, "coverage-report.json"),
    coverageReport,
  );
  assertOfficialReportFiles(target.reportDir, scope);

  return {
    ok: run.ok,
    reportDir: target.reportDir,
    coverageDir: target.coverageDir,
  };
}

export function generateReleaseTestReports() {
  const client = generateScopeReports("client");
  const server = generateScopeReports("server");

  if (!client.ok || !server.ok) {
    console.log(
      "One or more test suites failed. Official JSON reports were still generated from this full run.",
    );
  }

  return {
    clientReportDir: client.reportDir,
    serverReportDir: server.reportDir,
    desktopCoverageDir: client.coverageDir,
    serverCoverageDir: server.coverageDir,
  };
}

export function generateFrontendTestReport() {
  return generateScopeReports("client").reportDir;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateReleaseTestReports();
}
