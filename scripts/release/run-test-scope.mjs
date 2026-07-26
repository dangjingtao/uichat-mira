import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..", "..");
const scopeArg = process.argv.find((arg) => arg.startsWith("--scope="));
const scope = scopeArg?.slice("--scope=".length);

if (!scope || !["client", "server"].includes(scope)) {
  throw new Error("Expected --scope=client or --scope=server.");
}

const workspaceDir = path.join(projectRoot, scope === "client" ? "desktop" : "server");
const reportDir = path.join(
  projectRoot,
  ".artifacts",
  "release-validation",
  "windows-x64",
  "reports",
  scope,
);
const coverageDir = path.join(workspaceDir, "coverage");
const rawResultsPath = path.join(reportDir, "raw-results.json");

fs.rmSync(reportDir, { recursive: true, force: true });
fs.rmSync(coverageDir, { recursive: true, force: true });
fs.mkdirSync(reportDir, { recursive: true });

const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const args = [
  "exec",
  "vitest",
  "run",
  "--coverage",
  "--reporter=default",
  "--reporter=json",
  `--outputFile=${rawResultsPath}`,
];

console.log(`Running ${scope} release tests with fresh coverage...`);
const run = spawnSync(pnpmExecutable, args, {
  cwd: workspaceDir,
  stdio: "inherit",
  env: process.env,
  windowsHide: true,
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizePath(filePath) {
  return path.relative(workspaceDir, filePath).replaceAll("\\", "/");
}

function normalizeAssertion(assertion) {
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

function normalizeSuite(suite) {
  return {
    name: typeof suite.name === "string" ? normalizePath(suite.name) : "",
    absoluteName: suite.name ?? "",
    status: suite.status ?? "unknown",
    startTime: typeof suite.startTime === "number" ? suite.startTime : null,
    endTime: typeof suite.endTime === "number" ? suite.endTime : null,
    message: suite.message ?? "",
    assertionResults: Array.isArray(suite.assertionResults)
      ? suite.assertionResults.map(normalizeAssertion)
      : [],
  };
}

let raw;
if (fs.existsSync(rawResultsPath)) {
  raw = readJson(rawResultsPath);
} else {
  raw = {
    success: false,
    numTotalTests: 0,
    numPassedTests: 0,
    numFailedTests: 1,
    numPendingTests: 0,
    numTodoTests: 0,
    numTotalTestSuites: 1,
    numPassedTestSuites: 0,
    numFailedTestSuites: 1,
    numPendingTestSuites: 0,
    testResults: [
      {
        name: `${scope}-test-process`,
        status: "failed",
        message:
          run.error?.message ||
          `Vitest exited with code ${run.status ?? "unknown"} before producing JSON output.`,
        assertionResults: [],
      },
    ],
  };
}

const suites = Array.isArray(raw.testResults)
  ? raw.testResults.map(normalizeSuite)
  : [];
const startTimes = suites
  .map((suite) => suite.startTime)
  .filter((value) => typeof value === "number");
const endTimes = suites
  .map((suite) => suite.endTime)
  .filter((value) => typeof value === "number");

const testReport = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope,
  summary: {
    totalTests: Number(raw.numTotalTests ?? 0),
    passedTests: Number(raw.numPassedTests ?? 0),
    failedTests: Number(raw.numFailedTests ?? (run.status === 0 ? 0 : 1)),
    pendingTests: Number(raw.numPendingTests ?? 0),
    todoTests: Number(raw.numTodoTests ?? 0),
    totalSuites: Number(raw.numTotalTestSuites ?? suites.length),
    passedSuites: Number(raw.numPassedTestSuites ?? 0),
    failedSuites: Number(raw.numFailedTestSuites ?? (run.status === 0 ? 0 : 1)),
    pendingSuites: Number(raw.numPendingTestSuites ?? 0),
    success: run.status === 0 && raw.success !== false,
    startTime:
      typeof raw.startTime === "number"
        ? raw.startTime
        : startTimes.length > 0
          ? Math.min(...startTimes)
          : null,
    durationMs:
      startTimes.length > 0 && endTimes.length > 0
        ? Math.max(...endTimes) - Math.min(...startTimes)
        : 0,
  },
  suites,
};

fs.writeFileSync(
  path.join(reportDir, "test-report.json"),
  `${JSON.stringify(testReport, null, 2)}\n`,
);

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

const coverageSummaryPath = path.join(coverageDir, "coverage-summary.json");
const coverageFinalPath = path.join(coverageDir, "coverage-final.json");
let coverageReport;

if (fs.existsSync(coverageSummaryPath) && fs.existsSync(coverageFinalPath)) {
  const summary = readJson(coverageSummaryPath);
  const full = readJson(coverageFinalPath);
  const totalSummary = summary.total;

  coverageReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope,
    summary,
    files: Object.values(full).map((entry) => {
      const normalizedPath = normalizePath(entry.path);
      const fileSummary =
        summary[entry.path] ??
        summary[normalizedPath] ??
        summary[normalizedPath.split("/").join(path.sep)] ??
        totalSummary;

      return {
        path: normalizedPath,
        absolutePath: entry.path,
        summary: fileSummary,
        lines: {
          map: entry.lineMap ?? {},
          hits: toCountMap(entry.l),
        },
        statements: {
          map: entry.statementMap ?? {},
          hits: toCountMap(entry.s),
        },
        functions: {
          map: entry.fnMap ?? {},
          hits: toCountMap(entry.f),
        },
        branches: toBranchMap(entry.branchMap, entry.b),
      };
    }),
    available: true,
  };
} else {
  coverageReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope,
    summary: {},
    files: [],
    available: false,
    missingReason: "Vitest did not emit fresh coverage artifacts for this release run.",
  };
}

fs.writeFileSync(
  path.join(reportDir, "coverage-report.json"),
  `${JSON.stringify(coverageReport, null, 2)}\n`,
);
fs.rmSync(rawResultsPath, { force: true });

console.log(
  `${scope} tests: ${testReport.summary.failedTests}/${testReport.summary.totalTests} failed in ${testReport.summary.durationMs}ms; coverage=${coverageReport.available}.`,
);

if (!testReport.summary.success || !coverageReport.available) {
  process.exitCode = run.status || 1;
}
