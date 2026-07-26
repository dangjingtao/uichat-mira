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
import { readAndVerifyValidationManifest } from "./validation-utils.mjs";

if (process.platform !== "win32") {
  throw new Error(
    `Windows payload assembly requires Windows. Current platform: ${process.platform}`,
  );
}

const validationArgument = process.argv.find((argument) =>
  argument.startsWith("--validation-manifest="),
);
const configuredValidationPath =
  process.env.MIRA_RELEASE_VALIDATION_MANIFEST?.trim() ||
  validationArgument?.slice("--validation-manifest=".length).trim() ||
  ".artifacts/release-validation/windows-x64/validation.json";
const validationPath = path.isAbsolute(configuredValidationPath)
  ? configuredValidationPath
  : path.resolve(projectRoot, configuredValidationPath);

const validationManifest = readAndVerifyValidationManifest(validationPath);
const validation = validationManifest.validation;
const validationDirectory = path.dirname(validationPath);

for (const scope of ["client", "server"]) {
  copyRequired(
    path.join(validationDirectory, "reports", scope),
    path.join(artifactsRoot, "server-bundle", `${scope}-coverage`),
    `${scope} release validation reports`,
  );
}

removePath(payloadRoot);
fs.mkdirSync(payloadRoot, { recursive: true });

for (const [source, destination, label] of [
  [path.join(artifactsRoot, "desktop", "dist"), path.join(payloadRoot, "app"), "desktop application"],
  [path.join(artifactsRoot, "server-bundle"), path.join(payloadRoot, "server"), "server bundle"],
  [path.join(artifactsRoot, "browser-extension"), path.join(payloadRoot, "browser-extension"), "browser extension"],
  [path.join(artifactsRoot, "node-runtime"), path.join(payloadRoot, "node-runtime"), "Node runtime"],
  [path.join(artifactsRoot, "terminal-runtime"), path.join(payloadRoot, "terminal-runtime"), "Terminal runtime"],
  [path.join(artifactsRoot, "micro-apps", "tts", "piper"), path.join(payloadRoot, "micro-apps", "tts", "piper"), "Piper runtime"],
  [path.join(artifactsRoot, "icons"), path.join(payloadRoot, "icons"), "desktop icons"],
  [path.join(artifactsRoot, "runtime.config.cjs"), path.join(payloadRoot, "runtime.config.cjs"), "runtime configuration"],
]) {
  copyRequired(source, destination, label);
}

const copiedModels = copyOptional(
  path.join(artifactsRoot, "model-packs", "dist"),
  path.join(payloadRoot, "model-packs"),
  "local model packs",
);
if (copiedModels) {
  copyRequired(
    path.join(artifactsRoot, "model-runtime", "onnxruntime-web"),
    path.join(payloadRoot, "model-runtime", "onnxruntime-web"),
    "ONNX Runtime Web",
  );
}

const manifest = writePayloadManifest(validation);
verifyPayload({ requireReleaseEligible: true });
console.log(
  `Assembled frozen Windows payload: ${manifest.totalFiles} files, ${manifest.totalBytes} bytes.`,
);
