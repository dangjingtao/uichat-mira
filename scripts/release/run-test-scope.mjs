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
const rawResultsPath = path.join(reportDir, "raw-results.json");
const includeCoverage = ["1", "true"].includes(
  process.env.MIRA_RELEASE_COVERAGE?.trim().toLowerCase() ?? "",
);

fs.rmSync(reportDir, { recursive: true, force: true });
fs.mkdirSync(reportDir, { recursive: true });

const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const args = [
  "exec",
  "vitest",
  "run",
  "--reporter=default",
  "--reporter=json",
  `--outputFile=${rawResultsPath}`,
];
if (includeCoverage) {
  args.push("--coverage");
}

console.log(
  `Running ${scope} release tests${includeCoverage ? " with coverage" : " without coverage"}...`,
);
const run = spawnSync(pnpmExecutable, args, {
  cwd: workspaceDir,
  stdio: "inherit",
  env: process.env,
  windowsHide: true,
});

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
    name:
      typeof suite.name === "string"
        ? path.relative(workspaceDir, suite.name).replaceAll("\\", "/")
        : "",
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
  raw = JSON.parse(fs.readFileSync(rawResultsPath, "utf8"));
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

const coverageReport = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope,
  summary: {},
  files: [],
  available: false,
  missingReason: includeCoverage
    ? "Coverage normalization is not part of the fast release path."
    : "Release validation skips coverage to minimize wall-clock time.",
};
fs.writeFileSync(
  path.join(reportDir, "coverage-report.json"),
  `${JSON.stringify(coverageReport, null, 2)}\n`,
);
fs.rmSync(rawResultsPath, { force: true });

console.log(
  `${scope} tests: ${testReport.summary.failedTests}/${testReport.summary.totalTests} failed in ${testReport.summary.durationMs}ms.`,
);

if (!testReport.summary.success) {
  process.exitCode = run.status || 1;
}
