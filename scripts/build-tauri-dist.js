import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  cleanupArtifactsRoot,
  projectRoot,
  removeDir,
} from "./artifacts-utils.js";

const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"),
);
const version = packageJson.version;
const releaseRoot = path.join(projectRoot, "release");
const tauriBundleRoot = path.join(
  projectRoot,
  "tauri",
  "target",
  "release",
  "bundle",
);
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
const fullOutputPath = path.join(releaseRoot, outputDir, "tauri");
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

function copyBundleOutputs() {
  if (!fs.existsSync(tauriBundleRoot)) {
    throw new Error(`Missing Tauri bundle output: ${tauriBundleRoot}`);
  }

  removeDir(fullOutputPath, "old staged Tauri release output");
  fs.mkdirSync(path.dirname(fullOutputPath), { recursive: true });
  fs.cpSync(tauriBundleRoot, fullOutputPath, { recursive: true });
  console.log(`Copied Tauri bundle output: ${fullOutputPath}`);
}

try {
  console.log(`Building version: ${version}`);
  console.log(`Output directory: ${path.join(releaseRoot, outputDir, "tauri")}`);
  console.log(`Release retention count: ${releaseKeepCount}`);

  console.log("\n=== Syncing versions ===");
  execSync("pnpm version:sync", {
    stdio: "inherit",
    cwd: projectRoot,
  });

  console.log("\n=== Cleaning old Tauri bundle cache ===");
  removeDir(tauriBundleRoot, "old tauri target bundle cache");

  execSync(
    "cross-env CARGO_BUILD_JOBS=1 CARGO_INCREMENTAL=0 pnpm tauri build --config tauri/tauri.conf.json",
    {
      cwd: projectRoot,
      stdio: "inherit",
    },
  );

  copyBundleOutputs();

  console.log("\n=== Cleaning temporary build artifacts ===");
  cleanupArtifactsRoot();

  console.log("\n=== Cleaning old release outputs ===");
  cleanupOldReleaseOutputs();
} catch (error) {
  console.error("Tauri build failed:", error.message);
  process.exit(1);
}
