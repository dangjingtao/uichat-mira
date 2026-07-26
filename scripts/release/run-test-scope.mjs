import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..", "..");
const args = process.argv.slice(2);
const readArg = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const scope = readArg("--scope");
const shard = readArg("--shard");
const mergeDirArg = readArg("--merge-dir");
const timeoutSeconds = Number(readArg("--timeout-seconds") || "480");

if (!scope || !["client", "server"].includes(scope)) {
  throw new Error("Expected --scope=client or --scope=server.");
}

const workspaceDir = path.join(projectRoot, scope === "client" ? "desktop" : "server");
const validationRoot = path.join(
  projectRoot,
  ".artifacts",
  "release-validation",
  "windows-x64",
);
const reportDir = path.join(validationRoot, "reports", scope);
const coverageDir = path.join(workspaceDir, "coverage");
const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function runProcess(commandArgs, { timeout = 0, env = process.env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(pnpmExecutable, commandArgs, {
      cwd: workspaceDir,
      stdio: "inherit",
      env,
      windowsHide: true,
    });

    let timedOut = false;
    let timer;
    if (timeout > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        console.error(
          `Release test watchdog fired after ${timeout}s for ${scope}${shard ? ` shard ${shard}` : ""}.`,
        );
        if (process.platform === "win32" && child.pid) {
          spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
            stdio: "inherit",
            windowsHide: true,
          });
        } else {
          child.kill("SIGKILL");
        }
      }, timeout * 1000);
    }

    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      resolve({ code: 1, signal: null, timedOut, error });
    });
    child.on("exit", (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? 1, signal, timedOut, error: null });
    });
  });
}

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

function writeMergedReports(rawResultsPath) {
  if (!fs.existsSync(rawResultsPath)) {
    throw new Error(`Vitest merge did not produce JSON results: ${rawResultsPath}`);
  }

  const raw = readJson(rawResultsPath);
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
      failedTests: Number(raw.numFailedTests ?? 0),
      pendingTests: Number(raw.numPendingTests ?? 0),
      todoTests: Number(raw.numTodoTests ?? 0),
      totalSuites: Number(raw.numTotalTestSuites ?? suites.length),
      passedSuites: Number(raw.numPassedTestSuites ?? 0),
      failedSuites: Number(raw.numFailedTestSuites ?? 0),
      pendingSuites: Number(raw.numPendingTestSuites ?? 0),
      success: raw.success !== false && Number(raw.numFailedTests ?? 0) === 0,
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

  const coverageSummaryPath = path.join(coverageDir, "coverage-summary.json");
  const coverageFinalPath = path.join(coverageDir, "coverage-final.json");
  if (!fs.existsSync(coverageSummaryPath) || !fs.existsSync(coverageFinalPath)) {
    throw new Error(`Vitest merge did not produce fresh ${scope} coverage.`);
  }

  const summary = readJson(coverageSummaryPath);
  const full = readJson(coverageFinalPath);
  const totalSummary = summary.total;
  const coverageReport = {
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
        lines: { map: entry.lineMap ?? {}, hits: toCountMap(entry.l) },
        statements: {
          map: entry.statementMap ?? {},
          hits: toCountMap(entry.s),
        },
        functions: { map: entry.fnMap ?? {}, hits: toCountMap(entry.f) },
        branches: toBranchMap(entry.branchMap, entry.b),
      };
    }),
    available: true,
  };

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, "test-report.json"),
    `${JSON.stringify(testReport, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(reportDir, "coverage-report.json"),
    `${JSON.stringify(coverageReport, null, 2)}\n`,
  );
  fs.rmSync(rawResultsPath, { force: true });

  console.log(
    `${scope} merged tests: ${testReport.summary.failedTests}/${testReport.summary.totalTests} failed; coverage=true.`,
  );
  if (!testReport.summary.success) process.exitCode = 1;
}

async function runShard() {
  if (!shard || !/^\d+\/\d+$/.test(shard)) {
    throw new Error("Shard mode requires --shard=<index>/<total>.");
  }
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error("--timeout-seconds must be a positive number.");
  }

  const safeShard = shard.replace("/", "-of-");
  const shardDir = path.join(validationRoot, "shards", scope, safeShard);
  const blobPath = path.join(shardDir, `vitest-${scope}-${safeShard}.blob.json`);
  const statusPath = path.join(shardDir, "status.json");
  fs.rmSync(shardDir, { recursive: true, force: true });
  fs.mkdirSync(shardDir, { recursive: true });

  const vitestArgs = [
    "exec",
    "vitest",
    "run",
    "--coverage",
    "--coverage.reportOnFailure",
    "--reporter=default",
    "--reporter=blob",
    "--reporter=hanging-process",
    `--outputFile.blob=${blobPath}`,
    `--shard=${shard}`,
    "--testTimeout=30000",
    "--hookTimeout=30000",
    "--teardownTimeout=15000",
  ];
  if (scope === "server") {
    vitestArgs.push("--pool=forks", "--maxWorkers=2");
  }

  const startedAt = new Date().toISOString();
  console.log(
    `Running ${scope} shard ${shard} with fresh coverage and a ${timeoutSeconds}s watchdog...`,
  );
  const result = await runProcess(vitestArgs, {
    timeout: timeoutSeconds,
    env: {
      ...process.env,
      VITEST_BLOB_LABEL: `${scope}-${safeShard}`,
    },
  });
  const status = {
    schemaVersion: 1,
    scope,
    shard,
    startedAt,
    finishedAt: new Date().toISOString(),
    timeoutSeconds,
    timedOut: result.timedOut,
    exitCode: result.code,
    signal: result.signal,
    blobProduced: fs.existsSync(blobPath),
    error: result.error?.message ?? null,
  };
  fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);

  if (result.timedOut) {
    console.error(
      `${scope} shard ${shard} was killed by the release watchdog. Inspect the final Vitest output for the last running test file.`,
    );
    process.exitCode = 124;
  } else if (result.code !== 0) {
    process.exitCode = result.code;
  }
}

async function mergeShards() {
  const mergeDir = mergeDirArg
    ? path.resolve(projectRoot, mergeDirArg)
    : path.join(validationRoot, "shards", scope);
  if (!fs.existsSync(mergeDir)) {
    throw new Error(`Missing ${scope} shard reports: ${mergeDir}`);
  }

  fs.rmSync(reportDir, { recursive: true, force: true });
  fs.rmSync(coverageDir, { recursive: true, force: true });
  fs.mkdirSync(reportDir, { recursive: true });
  const rawResultsPath = path.join(reportDir, "raw-results.json");

  console.log(`Merging ${scope} shard reports from ${mergeDir}...`);
  const result = await runProcess(
    [
      "exec",
      "vitest",
      `--merge-reports=${mergeDir}`,
      "--reporter=default",
      "--reporter=json",
      `--outputFile=${rawResultsPath}`,
      "--coverage",
      "--coverage.reportOnFailure",
    ],
    { timeout: 180 },
  );
  if (result.timedOut || result.error) {
    throw new Error(`Timed out or failed while merging ${scope} Vitest reports.`);
  }

  writeMergedReports(rawResultsPath);
  if (result.code !== 0) process.exitCode = result.code;
}

if (mergeDirArg) {
  await mergeShards();
} else {
  await runShard();
}
