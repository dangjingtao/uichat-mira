import fs from "node:fs";
import path from "node:path";
import {
  artifactsRoot,
  copyOptional,
  copyRequired,
  listFilesRecursive,
  payloadRoot,
  projectRoot,
  removePath,
  verifyPayload,
} from "./payload-utils.mjs";
import { runPnpm } from "./process-utils.mjs";

if (process.platform !== "win32") {
  throw new Error(
    `Tauri Windows packaging requires Windows. Current platform: ${process.platform}`,
  );
}

const allowFailedTests = ["1", "true"].includes(
  process.env.MIRA_RELEASE_ALLOW_FAILED_TESTS?.trim().toLowerCase() ?? "",
);

runPnpm(["version:sync"], { cwd: projectRoot });
const manifest = verifyPayload({
  allowFailedTests,
  requireReleaseEligible: !allowFailedTests,
});

const tauriRoot = path.join(projectRoot, "tauri");
const resourcesRoot = path.join(tauriRoot, "resources");
const bundleRoot = path.join(tauriRoot, "target", "release", "bundle");
const outputRoot = path.join(artifactsRoot, "release-packages", "tauri");
const releaseConfigPath = path.join(
  tauriRoot,
  ".release-factory.tauri.conf.json",
);

removePath(resourcesRoot);
removePath(bundleRoot);
removePath(outputRoot);
fs.mkdirSync(resourcesRoot, { recursive: true });
fs.mkdirSync(outputRoot, { recursive: true });

copyRequired(
  path.join(payloadRoot, "runtime.config.cjs"),
  path.join(resourcesRoot, "runtime.config.cjs"),
  "payload runtime configuration",
);
for (const name of [
  "server",
  "browser-extension",
  "node-runtime",
  "terminal-runtime",
  "micro-apps",
]) {
  copyRequired(
    path.join(payloadRoot, name),
    path.join(resourcesRoot, name),
    `payload ${name}`,
  );
}

for (const name of ["model-packs", "model-runtime"]) {
  const copied = copyOptional(
    path.join(payloadRoot, name),
    path.join(resourcesRoot, name),
    `payload ${name}`,
  );
  if (!copied) {
    fs.mkdirSync(path.join(resourcesRoot, name), { recursive: true });
  }
}

copyRequired(
  path.join(payloadRoot, "icons"),
  path.join(artifactsRoot, "icons"),
  "payload desktop icons",
);

const sourceConfigPath = path.join(tauriRoot, "tauri.conf.json");
const releaseConfig = JSON.parse(fs.readFileSync(sourceConfigPath, "utf8"));
releaseConfig.build = {
  ...releaseConfig.build,
  beforeBuildCommand: "",
  frontendDist: "../.artifacts/release-payload/windows-x64/app",
};
fs.writeFileSync(
  releaseConfigPath,
  `${JSON.stringify(releaseConfig, null, 2)}\n`,
);

try {
  runPnpm(
    ["tauri", "build", "--config", releaseConfigPath],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        CARGO_BUILD_JOBS: "1",
        CARGO_INCREMENTAL: "0",
      },
    },
  );
} finally {
  fs.rmSync(releaseConfigPath, { force: true });
}

copyRequired(bundleRoot, outputRoot, "Tauri bundle outputs");

if (!manifest.releaseEligible) {
  fs.writeFileSync(
    path.join(outputRoot, "DIAGNOSTIC_ONLY.txt"),
    [
      "UIChat Mira diagnostic Tauri package",
      "",
      "This package was produced to validate the packaging pipeline.",
      "It is not eligible for publication because product validation did not fully pass.",
      `Version: ${manifest.version}`,
      `Commit: ${manifest.gitCommit}`,
      "",
    ].join("\n"),
  );
}

const outputs = listFilesRecursive(outputRoot);
const installers = outputs.filter((file) =>
  /\.(msi|exe)$/i.test(file.relativePath),
);
if (installers.length === 0) {
  throw new Error(
    `Tauri packaging produced no Windows installer under: ${outputRoot}`,
  );
}

const packageSummary = {
  schemaVersion: 2,
  consumer: "tauri",
  payloadVersion: manifest.version,
  payloadCommit: manifest.gitCommit,
  releaseEligible: manifest.releaseEligible,
  outputs: outputs.map((file) => ({
    path: file.relativePath,
    bytes: fs.statSync(file.fullPath).size,
  })),
};
fs.writeFileSync(
  path.join(outputRoot, "package-manifest.json"),
  `${JSON.stringify(packageSummary, null, 2)}\n`,
);

console.log(
  `Tauri package ready from frozen payload: ${installers.length} installer(s), releaseEligible=${manifest.releaseEligible}.`,
);
