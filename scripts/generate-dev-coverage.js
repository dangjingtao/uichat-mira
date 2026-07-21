import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const args = process.argv.slice(2);
const shouldGenerate = args.includes("--test");
const shouldForce = args.includes("--force");

const reportTargets = [
  {
    scope: "client",
    sourceDir: path.join(projectRoot, "desktop", "test-report"),
    targetDir: path.join(projectRoot, "server", "client-coverage"),
  },
  {
    scope: "server",
    sourceDir: path.join(projectRoot, "server", "test-report"),
    targetDir: path.join(projectRoot, "server", "server-coverage"),
  },
];

const reportFiles = ["test-report.json", "coverage-report.json"];

function reportExists(reportDir) {
  return reportFiles.every((filename) =>
    fs.existsSync(path.join(reportDir, filename)),
  );
}

function copyReports(sourceDir, targetDir, scope) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing ${scope} official report directory: ${sourceDir}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });

  for (const filename of reportFiles) {
    const sourcePath = path.join(sourceDir, filename);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing ${scope} report file: ${sourcePath}`);
    }
    fs.copyFileSync(sourcePath, path.join(targetDir, filename));
  }
}

function generateOfficialReports() {
  console.log("[dev:coverage] Generating official full-run test reports...");
  execSync("node scripts/generate-test-report.js", {
    cwd: projectRoot,
    stdio: "inherit",
  });
}

function syncReportsToBackend({ force = false } = {}) {
  console.log("[dev:coverage] Syncing official reports to backend static directories...");

  for (const target of reportTargets) {
    if (!reportExists(target.sourceDir)) {
      throw new Error(
        `Missing ${target.scope} official report artifacts. Run node scripts/generate-dev-coverage.js --test first.`,
      );
    }

    if (!force && reportExists(target.targetDir)) {
      console.log(
        `[dev:coverage] Reusing existing ${target.scope} backend report directory: ${target.targetDir}`,
      );
      continue;
    }

    copyReports(target.sourceDir, target.targetDir, target.scope);
    console.log(
      `[dev:coverage] Synced ${target.scope} report JSON to ${target.targetDir}`,
    );
  }
}

function shouldGenerateReports() {
  if (shouldGenerate || shouldForce) {
    return true;
  }

  return reportTargets.some(
    (target) => shouldForce || !reportExists(target.sourceDir),
  );
}

function main() {
  if (shouldGenerateReports()) {
    generateOfficialReports();
  } else {
    console.log(
      "[dev:coverage] Reusing existing official test-report artifacts.",
    );
  }

  syncReportsToBackend({ force: shouldGenerate || shouldForce });
  console.log("[dev:coverage] Stable test reports are ready for development.");
}

main();
