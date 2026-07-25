import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import loadLocalEnv from "./load-local-env.cjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
loadLocalEnv(projectRoot);

const pinnedVersion =
  process.env.MIRA_VIVLIOSTYLE_VERSION?.trim() || "11.1.0";
const configuredRuntimeRoot =
  process.env.MIRA_VIVLIOSTYLE_RUNTIME_PATH?.trim() || "";
const runtimeCacheRoot =
  process.env.MIRA_VIVLIOSTYLE_CACHE_ROOT?.trim() ||
  path.join(
    projectRoot,
    ".local-runtimes",
    "vivliostyle",
    pinnedVersion,
  );
const runtimeStageRoot =
  process.env.MIRA_VIVLIOSTYLE_STAGE_ROOT?.trim() ||
  path.join(projectRoot, ".artifacts", "vivliostyle-runtime");

const packageJsonPath = (root) =>
  path.join(root, "node_modules", "@vivliostyle", "cli", "package.json");
const cliPath = (root) =>
  path.join(
    root,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "vivliostyle.cmd" : "vivliostyle",
  );

function removeDir(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function readInstalledVersion(root) {
  const target = packageJsonPath(root);
  if (!fs.existsSync(target)) return "";
  try {
    return JSON.parse(fs.readFileSync(target, "utf-8")).version || "";
  } catch {
    return "";
  }
}

function assertRuntime(root) {
  const installedVersion = readInstalledVersion(root);
  if (installedVersion !== pinnedVersion) {
    throw new Error(
      `Vivliostyle runtime version mismatch. Expected ${pinnedVersion}, received ${installedVersion || "missing"}.`,
    );
  }
  const executable = cliPath(root);
  if (!fs.existsSync(executable)) {
    throw new Error(`Vivliostyle CLI executable is missing: ${executable}`);
  }
  return executable;
}

function installRuntime() {
  removeDir(runtimeCacheRoot);
  ensureDir(runtimeCacheRoot);
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  console.log(`Installing Vivliostyle CLI ${pinnedVersion}...`);
  execFileSync(
    npmCommand,
    [
      "install",
      "--prefix",
      runtimeCacheRoot,
      "--omit=dev",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      `@vivliostyle/cli@${pinnedVersion}`,
    ],
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        PUPPETEER_SKIP_DOWNLOAD: "true",
        PUPPETEER_SKIP_CHROME_DOWNLOAD: "true",
      },
    },
  );
}

function resolveRuntimeSource() {
  if (configuredRuntimeRoot) {
    if (!fs.existsSync(configuredRuntimeRoot)) {
      throw new Error(
        `MIRA_VIVLIOSTYLE_RUNTIME_PATH does not exist: ${configuredRuntimeRoot}`,
      );
    }
    assertRuntime(configuredRuntimeRoot);
    return configuredRuntimeRoot;
  }

  if (readInstalledVersion(runtimeCacheRoot) !== pinnedVersion) {
    installRuntime();
  } else {
    console.log(`Using cached Vivliostyle runtime: ${runtimeCacheRoot}`);
  }
  assertRuntime(runtimeCacheRoot);
  return runtimeCacheRoot;
}

function stageRuntime(sourceRoot) {
  removeDir(runtimeStageRoot);
  ensureDir(path.dirname(runtimeStageRoot));
  fs.cpSync(sourceRoot, runtimeStageRoot, {
    recursive: true,
    dereference: true,
  });
  const executable = assertRuntime(runtimeStageRoot);
  const manifest = {
    schemaVersion: 1,
    package: "@vivliostyle/cli",
    version: pinnedVersion,
    executablePath: path.relative(runtimeStageRoot, executable),
    browserRuntime: "system-chrome-or-edge",
    preparedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(runtimeStageRoot, "mira-runtime-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`Prepared staged Vivliostyle runtime: ${runtimeStageRoot}`);
}

const sourceRoot = resolveRuntimeSource();
stageRuntime(sourceRoot);
