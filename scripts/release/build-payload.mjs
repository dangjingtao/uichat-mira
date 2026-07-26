import fs from "node:fs";
import path from "node:path";
import {
  artifactsRoot,
  copyOptional,
  copyRequired,
  payloadRoot,
  projectRoot,
  removePath,
  verifyPayload,
  writePayloadManifest,
} from "./payload-utils.mjs";
import { runPnpm } from "./process-utils.mjs";

if (process.platform !== "win32") {
  throw new Error(
    `The Windows release payload must be built on Windows. Current platform: ${process.platform}`,
  );
}

const skipTests = process.argv.includes("--notest");
const childEnv = skipTests
  ? { ...process.env, UICHAT_MIRA_SKIP_TESTS: "1" }
  : process.env;

console.log("=== Release Factory: build shared Windows payload ===");
console.log(`Project root: ${projectRoot}`);
console.log(`Payload root: ${payloadRoot}`);
console.log(`Skip tests: ${skipTests}`);

runPnpm(["version:sync"], {
  cwd: projectRoot,
  env: childEnv,
});
runPnpm(["internal:prepare:desktop-artifacts"], {
  cwd: projectRoot,
  env: childEnv,
});

removePath(payloadRoot);
fs.mkdirSync(payloadRoot, { recursive: true });

copyRequired(
  path.join(artifactsRoot, "desktop", "dist"),
  path.join(payloadRoot, "app"),
  "desktop application",
);
copyRequired(
  path.join(artifactsRoot, "server-bundle"),
  path.join(payloadRoot, "server"),
  "server bundle",
);
copyRequired(
  path.join(artifactsRoot, "browser-extension"),
  path.join(payloadRoot, "browser-extension"),
  "browser extension",
);
copyRequired(
  path.join(artifactsRoot, "node-runtime"),
  path.join(payloadRoot, "node-runtime"),
  "Node runtime",
);
copyRequired(
  path.join(artifactsRoot, "terminal-runtime"),
  path.join(payloadRoot, "terminal-runtime"),
  "Terminal runtime",
);
copyRequired(
  path.join(artifactsRoot, "micro-apps", "tts", "piper"),
  path.join(payloadRoot, "micro-apps", "tts", "piper"),
  "Piper runtime",
);
copyRequired(
  path.join(artifactsRoot, "icons"),
  path.join(payloadRoot, "icons"),
  "desktop icons",
);
copyRequired(
  path.join(artifactsRoot, "runtime.config.cjs"),
  path.join(payloadRoot, "runtime.config.cjs"),
  "runtime configuration",
);

const copiedModels = copyOptional(
  path.join(artifactsRoot, "model-packs", "dist"),
  path.join(payloadRoot, "model-packs"),
  "local model packs",
);
if (copiedModels) {
  copyRequired(
    path.join(projectRoot, "node_modules", "onnxruntime-web", "dist"),
    path.join(payloadRoot, "model-runtime", "onnxruntime-web"),
    "ONNX Runtime Web",
  );
}

const manifest = writePayloadManifest();
verifyPayload();

console.log(
  `Shared Windows payload ready: ${manifest.totalFiles} files, ${manifest.totalBytes} bytes.`,
);
