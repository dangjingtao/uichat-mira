import fs from "node:fs";
import path from "node:path";
import { projectRoot } from "./payload-utils.mjs";
import {
  isValidationReleaseEligible,
  summarizeTestReport,
  validationManifestPath,
  validationRoot,
  writeValidationManifest,
} from "./validation-utils.mjs";

function readRequiredJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const fragmentsRoot = path.join(validationRoot, "fragments");
const typecheck = readRequiredJson(
  path.join(fragmentsRoot, "typecheck.json"),
  "typecheck validation fragment",
);
const environment = readRequiredJson(
  path.join(fragmentsRoot, "environment.json"),
  "environment validation fragment",
);

const clientReportPath = path.join(
  validationRoot,
  "reports",
  "client",
  "test-report.json",
);
const serverReportPath = path.join(
  validationRoot,
  "reports",
  "server",
  "test-report.json",
);

const validation = {
  environment,
  typecheck,
  tests: {
    client: summarizeTestReport(clientReportPath),
    server: summarizeTestReport(serverReportPath),
  },
};

const manifest = writeValidationManifest(validation);
console.log(`Combined parallel validation: ${validationManifestPath}`);
console.log(
  `Environment=${environment.status}, typecheck=${typecheck.status}, ` +
    `client=${validation.tests.client.status}, server=${validation.tests.server.status}, ` +
    `releaseEligible=${manifest.releaseEligible}`,
);

if (!isValidationReleaseEligible(validation)) {
  process.exitCode = 1;
}
