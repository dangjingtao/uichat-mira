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
import {
  readAndVerifyValidationManifest,
  summarizeTestReport,
} from "./validation-utils.mjs";

if (process.platform !== "win32") {
  throw new Error(
    `The Windows release payload must be built on Windows. Current platform: ${process.platform}`,
  );
}

const validationArgument = process.argv.find((argument) =>
  argument.startsWith("--validation-manifest="),
);
const configuredValidationPath =
  process.env.MIRA_RELEASE_VALIDATION_MANIFEST?.trim() ||
  validationArgument?.slice("--validation-manifest=".length).trim() ||
  "";
const externalValidationPath = configuredValidationPath
  ? path.isAbsolute(configuredValidationPath)
    ? configuredValidationPath
    : path.resolve(projectRoot, configuredValidationPath)
  : null;

const explicitlySkipTests = process.argv.includes("--notest");
const prepareWithoutTests = explicitlySkipTests || Boolean(externalValidationPath);
const childEnv = prepareWithoutTests
  ? { ...process.env, UICHAT_MIRA_SKIP_TESTS: "1" }
  : process.env;

function readLocalTestValidation(scope) {
  if (explicitlySkipTests) {
    return {
      status: "skipped",
      totalTests: 0,
      failedTests: 0,
      totalSuites: 0,
      failedSuites: 0,
    };
  }

  const reportPath = path.join(
    artifactsRoot,
    "server-bundle",
    `${scope}-coverage`,
    "test-report.json",
  );
  const validation = summarizeTestReport(reportPath);
  if (validation.status !== "passed") {
    throw new Error(
      `${scope} release tests failed: ${validation.failedTests} failed tests across ${validation.failedSuites} failed suites.`,
    );
  }
  return validation;
}

function stageExternalValidationReports(manifestPath) {
  const validationDirectory = path.dirname(manifestPath);
  for (const scope of ["client", "server"]) {
    copyRequired(
      path.join(validationDirectory, "reports", scope),
      path.join(artifactsRoot, "server-bundle", `${scope}-coverage`),
      `${scope} release validation reports`,
    );
  }
}

console.log("=== Release Factory: build shared Windows payload ===");
console.log(`Project root: ${projectRoot}`);
console.log(`Payload root: ${payloadRoot}`);
console.log(`External validation: ${externalValidationPath ?? "none"}`);
console.log(`Explicitly skip tests: ${explicitlySkipTests}`);

runPnpm(["version:sync"], {
  cwd: projectRoot,
  env: childEnv,
});

let validation;
if (externalValidationPath) {
  const validationManifest = readAndVerifyValidationManifest(
    externalValidationPath,
  );
  validation = validationManifest.validation;
  console.log(
    `Accepted release validation for ${validationManifest.version} at ${validationManifest.gitCommit}.`,
  );
} else {
  runPnpm(["check"], {
    cwd: projectRoot,
    env: childEnv,
  });
}

runPnpm(["internal:prepare:desktop-artifacts"], {
  cwd: projectRoot,
  env: childEnv,
});

if (externalValidationPath) {
  stageExternalValidationReports(externalValidationPath);
} else {
  validation = {
    typecheck: {
      status: "passed",
    },
    tests: {
      client: readLocalTestValidation("client"),
      server: readLocalTestValidation("server"),
    },
  };
}

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

const manifest = writePayloadManifest(validation);
verifyPayload({
  allowSkippedTests: explicitlySkipTests && !externalValidationPath,
});

console.log(
  `Shared Windows payload ready: ${manifest.totalFiles} files, ${manifest.totalBytes} bytes.`,
);
