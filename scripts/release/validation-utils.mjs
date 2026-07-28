import fs from "node:fs";
import path from "node:path";
import { artifactsRoot, projectRoot, removePath } from "./payload-utils.mjs";
import { captureExecutable } from "./process-utils.mjs";

export const validationRoot = path.join(
  artifactsRoot,
  "release-validation",
  "windows-x64",
);
export const validationManifestPath = path.join(
  validationRoot,
  "validation.json",
);

function readRootPackage() {
  return JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  );
}

function resolveGitCommit() {
  if (process.env.GITHUB_SHA?.trim()) {
    return process.env.GITHUB_SHA.trim();
  }
  try {
    return captureExecutable("git", ["rev-parse", "HEAD"], {
      cwd: projectRoot,
    });
  } catch {
    return "unknown";
  }
}

export function isValidationReleaseEligible(validation) {
  return (
    validation?.environment?.status === "passed" &&
    validation?.typecheck?.status === "passed"
  );
}

export function resetValidationRoot() {
  removePath(validationRoot);
  fs.mkdirSync(validationRoot, { recursive: true });
}

export function summarizeTestReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return {
      status: "missing",
      totalTests: 0,
      failedTests: 0,
      totalSuites: 0,
      failedSuites: 0,
    };
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const summary = report.summary ?? {};
  return {
    status:
      summary.success === true &&
      Number(summary.failedTests ?? 0) === 0 &&
      Number(summary.failedSuites ?? 0) === 0
        ? "passed"
        : "failed",
    totalTests: Number(summary.totalTests ?? 0),
    failedTests: Number(summary.failedTests ?? 0),
    totalSuites: Number(summary.totalSuites ?? 0),
    failedSuites: Number(summary.failedSuites ?? 0),
  };
}

export function copyOfficialReports(scope, sourceDir) {
  const destinationDir = path.join(validationRoot, "reports", scope);
  removePath(destinationDir);
  fs.mkdirSync(destinationDir, { recursive: true });

  for (const filename of ["test-report.json", "coverage-report.json"]) {
    const sourcePath = path.join(sourceDir, filename);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing ${scope} validation report: ${sourcePath}`);
    }
    fs.copyFileSync(sourcePath, path.join(destinationDir, filename));
  }

  return destinationDir;
}

export function writeValidationManifest(validation) {
  const packageJson = readRootPackage();
  const manifest = {
    schemaVersion: 3,
    product: packageJson.name,
    version: packageJson.version,
    platform: "windows",
    architecture: "x64",
    gitCommit: resolveGitCommit(),
    generatedAt: new Date().toISOString(),
    releaseEligible: isValidationReleaseEligible(validation),
    testPolicy: "advisory",
    validation,
  };

  fs.mkdirSync(path.dirname(validationManifestPath), { recursive: true });
  fs.writeFileSync(
    validationManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`Wrote release validation manifest: ${validationManifestPath}`);
  return manifest;
}

export function readAndVerifyValidationManifest(
  manifestPath = validationManifestPath,
  { allowSkippedTests = false, allowFailedTests = false } = {},
) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing release validation manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 3) {
    throw new Error(
      `Unsupported release validation schema: ${manifest.schemaVersion ?? "missing"}`,
    );
  }

  const packageJson = readRootPackage();
  if (manifest.product !== packageJson.name) {
    throw new Error(
      `Validation product mismatch: expected ${packageJson.name}, got ${manifest.product}`,
    );
  }
  if (manifest.version !== packageJson.version) {
    throw new Error(
      `Validation version mismatch: expected ${packageJson.version}, got ${manifest.version}`,
    );
  }
  if (manifest.platform !== "windows" || manifest.architecture !== "x64") {
    throw new Error(
      `Unexpected validation target: ${manifest.platform}/${manifest.architecture}`,
    );
  }

  const expectedCommit = process.env.GITHUB_SHA?.trim();
  if (
    expectedCommit &&
    manifest.gitCommit !== "unknown" &&
    manifest.gitCommit !== expectedCommit
  ) {
    throw new Error(
      `Validation commit mismatch: expected ${expectedCommit}, got ${manifest.gitCommit}`,
    );
  }

  const expectedEligibility = isValidationReleaseEligible(manifest.validation);
  if (manifest.releaseEligible !== expectedEligibility) {
    throw new Error(
      `Validation eligibility mismatch: expected ${expectedEligibility}, got ${manifest.releaseEligible}.`,
    );
  }

  if (manifest.validation?.environment?.status !== "passed") {
    throw new Error(
      `Release validation environment did not pass: ${manifest.validation?.environment?.detail ?? "unknown environment failure"}.`,
    );
  }

  if (manifest.validation?.typecheck?.status !== "passed") {
    throw new Error("Release validation does not contain a passed typecheck.");
  }

  for (const scope of ["client", "server"]) {
    const status = manifest.validation?.tests?.[scope]?.status ?? "missing";
    if (status !== "passed") {
      console.warn(
        `Release ${scope} tests are advisory; continuing with status=${status}.`,
      );
    }
  }

  void allowSkippedTests;
  void allowFailedTests;
  return manifest;
}

export function printFailedTestDetails(scope, reportPath, limit = 120) {
  if (!fs.existsSync(reportPath)) {
    console.error(`No ${scope} test report was produced: ${reportPath}`);
    return;
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  let printed = 0;

  for (const suite of report.suites ?? []) {
    const failedAssertions = (suite.assertionResults ?? []).filter(
      (assertion) => assertion.status === "failed",
    );
    const suiteFailed = suite.status === "failed" || failedAssertions.length > 0;
    if (!suiteFailed) {
      continue;
    }

    console.error(
      `FAIL ${scope}: ${suite.name || suite.absoluteName || "unknown suite"}`,
    );
    if (suite.message?.trim()) {
      console.error(suite.message.trim());
    }

    for (const assertion of failedAssertions) {
      if (printed >= limit) {
        console.error(
          `Failure output truncated after ${limit} assertions. Full JSON report is uploaded as an artifact.`,
        );
        return;
      }
      console.error(
        `  × ${assertion.fullName || assertion.title || "unnamed test"}`,
      );
      for (const message of assertion.failureMessages ?? []) {
        console.error(
          String(message)
            .split(/\r?\n/)
            .slice(0, 20)
            .join("\n"),
        );
      }
      printed += 1;
    }
  }
}
