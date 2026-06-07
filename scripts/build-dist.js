import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const electronRoot = path.join(projectRoot, "electron");

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

function removeDir(targetPath, label) {
  if (fs.existsSync(targetPath)) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      console.log(`Removed ${label}: ${targetPath}`);
    } catch (error) {
      if (["EBUSY", "EPERM"].includes(error.code)) {
        console.warn(`Skipped locked ${label}: ${targetPath}`);
        return;
      }

      throw error;
    }
    return;
  }

  console.log(`No ${label} to clean: ${targetPath}`);
}

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
removeDir(path.join(electronRoot, "dist"), "old electron/dist");
removeDir(path.join(electronRoot, "desktop"), "old electron/desktop");
removeDir(path.join(electronRoot, "node-runtime"), "old electron/node-runtime");
removeDir(path.join(electronRoot, "icons"), "old electron/icons");

try {
  console.log("\n=== Building components ===");
  execSync("pnpm build", { stdio: "inherit", cwd: projectRoot });

  const desktopDistSource = path.join(projectRoot, "desktop", "dist");
  const desktopDistDest = path.join(electronRoot, "desktop", "dist");
  fs.mkdirSync(path.dirname(desktopDistDest), { recursive: true });
  fs.cpSync(desktopDistSource, desktopDistDest, { recursive: true });
  console.log(`Copied desktop dist: ${desktopDistDest}`);

  const nodeRuntimeDir = path.join(electronRoot, "node-runtime");
  const nodeRuntimeDest = path.join(nodeRuntimeDir, path.basename(process.execPath));
  fs.mkdirSync(nodeRuntimeDir, { recursive: true });
  fs.copyFileSync(process.execPath, nodeRuntimeDest);
  console.log(`Copied Node runtime: ${nodeRuntimeDest}`);

  const iconsSource = path.join(projectRoot, "icons");
  const iconsDest = path.join(electronRoot, "icons");
  if (fs.existsSync(iconsSource)) {
    fs.cpSync(iconsSource, iconsDest, { recursive: true });
    console.log(`Copied icons: ${iconsDest}`);
  }

  const configSource = path.join(projectRoot, "electron-builder.yml");
  const configDest = path.join(electronRoot, "electron-builder.yml");
  if (fs.existsSync(configSource)) {
    fs.copyFileSync(configSource, configDest);
    console.log(`Copied electron-builder config: ${configDest}`);
  }

  const runtimeConfigSource = path.join(projectRoot, "runtime.config.cjs");
  const runtimeConfigDest = path.join(electronRoot, "runtime.config.cjs");
  if (fs.existsSync(runtimeConfigSource)) {
    fs.copyFileSync(runtimeConfigSource, runtimeConfigDest);
    console.log(`Copied runtime config: ${runtimeConfigDest}`);
  }

  console.log("\n=== Packaging with electron-builder ===");
  const relativeOutputPath = path.relative(electronRoot, fullOutputPath);
  const platformFlag = platform === "mac" ? "--mac" : "--win";
  const buildCmd = `electron-builder ${platformFlag} --config.directories.output="${relativeOutputPath}" --publish never`;

  console.log(`Running in electron directory with output: ${relativeOutputPath}`);
  execSync(buildCmd, {
    stdio: "inherit",
    cwd: electronRoot,
  });

  console.log("\nBuild completed successfully.");
  console.log(`Output directory: ${fullOutputPath}`);

  console.log("\n=== Cleaning temporary build artifacts ===");
  removeDir(path.join(electronRoot, "backend"), "temporary electron/backend");
  removeDir(path.join(electronRoot, "dist"), "temporary electron/dist");
  removeDir(path.join(electronRoot, "desktop"), "temporary electron/desktop");
  removeDir(path.join(electronRoot, "node-runtime"), "temporary electron/node-runtime");
  removeDir(path.join(electronRoot, "icons"), "temporary electron/icons");

  const electronConfigPath = path.join(electronRoot, "electron-builder.yml");
  if (fs.existsSync(electronConfigPath)) {
    fs.rmSync(electronConfigPath, { force: true });
    console.log(`Removed temporary config: ${electronConfigPath}`);
  }

  const runtimeConfigPath = path.join(electronRoot, "runtime.config.cjs");
  if (fs.existsSync(runtimeConfigPath)) {
    fs.rmSync(runtimeConfigPath, { force: true });
    console.log(`Removed temporary runtime config: ${runtimeConfigPath}`);
  }

  console.log("\nAll done.");
  console.log("\n=== Cleaning old release outputs ===");
  cleanupOldReleaseOutputs();
} catch (error) {
  console.error("Build failed:", error.message);
  process.exit(1);
}
