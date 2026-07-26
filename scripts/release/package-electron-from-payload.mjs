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
    `Electron Windows packaging requires Windows. Current platform: ${process.platform}`,
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

const electronRoot = path.join(
  artifactsRoot,
  "release-consumers",
  "electron-app",
);
const outputRoot = path.join(artifactsRoot, "release-packages", "electron");

removePath(electronRoot);
removePath(outputRoot);
fs.mkdirSync(electronRoot, { recursive: true });
fs.mkdirSync(outputRoot, { recursive: true });

for (const filename of ["main.cjs", "preload.cjs", "package.json"]) {
  copyRequired(
    path.join(projectRoot, "electron", filename),
    path.join(electronRoot, filename),
    `Electron ${filename}`,
  );
}
copyRequired(
  path.join(projectRoot, "electron-builder.yml"),
  path.join(electronRoot, "electron-builder.yml"),
  "Electron builder configuration",
);
copyRequired(
  path.join(payloadRoot, "app"),
  path.join(electronRoot, "desktop", "dist"),
  "payload application",
);
copyRequired(
  path.join(payloadRoot, "server"),
  path.join(electronRoot, "backend"),
  "payload server",
);

for (const name of [
  "runtime.config.cjs",
  "icons",
  "browser-extension",
  "node-runtime",
  "terminal-runtime",
  "micro-apps",
]) {
  copyRequired(
    path.join(payloadRoot, name),
    path.join(electronRoot, name),
    `payload ${name}`,
  );
}
copyOptional(
  path.join(payloadRoot, "model-packs"),
  path.join(electronRoot, "model-packs"),
  "payload model packs",
);
copyOptional(
  path.join(payloadRoot, "model-runtime"),
  path.join(electronRoot, "model-runtime"),
  "payload model runtime",
);

const relativeOutputPath = path.relative(electronRoot, outputRoot);
runPnpm(
  [
    "exec",
    "electron-builder",
    "--win",
    "--projectDir",
    electronRoot,
    "--config.directories.output",
    relativeOutputPath,
    "--publish",
    "never",
  ],
  { cwd: projectRoot },
);

const outputs = listFilesRecursive(outputRoot);
const setupExecutables = outputs.filter((file) =>
  /setup.*\.exe$/i.test(file.relativePath),
);
if (setupExecutables.length === 0) {
  throw new Error(
    `Electron packaging produced no Setup executable under: ${outputRoot}`,
  );
}

const packageSummary = {
  schemaVersion: 2,
  consumer: "electron",
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
  `Electron package ready from frozen payload: ${setupExecutables.length} setup executable(s), releaseEligible=${manifest.releaseEligible}.`,
);
