import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  cleanupArtifactsRoot,
  projectRoot,
  removeDir,
} from "./artifacts-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const electronArtifactsRoot = path.join(projectRoot, ".artifacts", "electron-app");

const platformArg = process.argv[2] || "win";
const platform = platformArg.toLowerCase();

const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"),
);
const version = packageJson.version;
const releaseRoot = path.join(projectRoot, "release");
const now = new Date();
const pad = (value) => String(value).padStart(2, "0");
const date = [
  now.getFullYear(),
  pad(now.getMonth() + 1),
  pad(now.getDate()),
].join("");
const time = [
  pad(now.getHours()),
  pad(now.getMinutes()),
  pad(now.getSeconds()),
].join("");
const outputDir = `v${version}_${date}_${time}`;
const fullOutputPath = path.join(releaseRoot, outputDir);
const parsedReleaseKeepCount = Number.parseInt(
  process.env.RELEASE_KEEP_COUNT ?? "3",
  10,
);
const releaseKeepCount = Number.isNaN(parsedReleaseKeepCount)
  ? 3
  : Math.max(0, parsedReleaseKeepCount);

function cleanupOldReleaseOutputs() {
  if (!fs.existsSync(releaseRoot) || releaseKeepCount <= 0) {
    return;
  }

  const entries = fs
    .readdirSync(releaseRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v.+_\d{8}(?:_\d{6})?$/.test(entry.name))
    .map((entry) => {
      const fullPath = path.join(releaseRoot, entry.name);
      return {
        name: entry.name,
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const staleEntries = entries.slice(releaseKeepCount);
  for (const entry of staleEntries) {
    removeDir(entry.fullPath, `stale release output (${entry.name})`);
  }
}

console.log(`Building version: ${version}`);
console.log(`Platform: ${platform}`);
console.log(`Output directory: ${outputDir}`);
console.log(`Release retention count: ${releaseKeepCount}`);

fs.mkdirSync(fullOutputPath, { recursive: true });

console.log("\n=== Cleaning old build artifacts ===");
removeDir(electronArtifactsRoot, "old .artifacts/electron-app");

try {
  console.log("\n=== Preparing desktop artifacts ===");
  execSync("pnpm internal:prepare:desktop-artifacts", {
    stdio: "inherit",
    cwd: projectRoot,
  });

  if (!fs.existsSync(electronArtifactsRoot)) {
    throw new Error(`Staged Electron app not found: ${electronArtifactsRoot}`);
  }

  console.log("\n=== Packaging with electron-builder ===");
  const relativeOutputPath = path.relative(electronArtifactsRoot, fullOutputPath);
  const platformFlag = platform === "mac" ? "--mac" : "--win";
  const buildCmd = `electron-builder ${platformFlag} --config.directories.output="${relativeOutputPath}" --publish never`;

  console.log(`Running in .artifacts/electron-app with output: ${relativeOutputPath}`);
  execSync(buildCmd, {
    stdio: "inherit",
    cwd: electronArtifactsRoot,
  });

  console.log("\nBuild completed successfully.");
  console.log(`Output directory: ${fullOutputPath}`);

  console.log("\n=== Cleaning temporary build artifacts ===");
  cleanupArtifactsRoot();

  console.log("\nAll done.");
  console.log("\n=== Cleaning old release outputs ===");
  cleanupOldReleaseOutputs();
} catch (error) {
  console.error("Build failed:", error.message);
  process.exit(1);
}
