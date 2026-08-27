import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function runCodesign(args, stdio = "inherit") {
  execFileSync("/usr/bin/codesign", args, { stdio });
}

function resolveElectronAppPath() {
  const electronPackagePath = require.resolve("electron/package.json");
  return path.join(path.dirname(electronPackagePath), "dist", "Electron.app");
}

function hasValidLocalSignature(appPath) {
  try {
    runCodesign(["--verify", "--deep", "--strict", appPath], "ignore");
    return true;
  } catch {
    return false;
  }
}

function hasAdHocSignature(appPath) {
  const result = spawnSync(
    "/usr/bin/codesign",
    ["--display", "--verbose=4", appPath],
    { encoding: "utf8" },
  );
  const details = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return result.status === 0 && details.includes("Signature=adhoc");
}

function passesGatekeeperAssessment(appPath) {
  try {
    execFileSync(
      "/usr/sbin/spctl",
      ["--assess", "--type", "execute", "--verbose=4", appPath],
      { stdio: "ignore" },
    );
    return true;
  } catch {
    return false;
  }
}

function prepareElectronMacosDev() {
  if (process.platform !== "darwin") {
    throw new Error("Electron macOS development preparation requires darwin");
  }

  const appPath = resolveElectronAppPath();
  if (!fs.existsSync(appPath)) {
    throw new Error(`Electron.app is missing: ${appPath}. Run pnpm install first.`);
  }

  const hasValidSignature = hasValidLocalSignature(appPath);
  if (
    hasValidSignature &&
    (hasAdHocSignature(appPath) || passesGatekeeperAssessment(appPath))
  ) {
    console.log(`[electron:mac] Reusing valid local signature: ${appPath}`);
    return;
  }

  // Raw Electron development bundles may carry a revoked upstream ticket on
  // newer macOS versions. Replace it only for local development; release apps
  // still require Developer ID signing and notarization.
  console.log(`[electron:mac] Applying local ad-hoc signature: ${appPath}`);
  runCodesign([
    "--force",
    "--deep",
    "--sign",
    "-",
    "--timestamp=none",
    appPath,
  ]);
  runCodesign(["--verify", "--deep", "--strict", "--verbose=2", appPath]);
}

prepareElectronMacosDev();
