import fs from "node:fs";
import path from "node:path";
import { generateReleaseTestReports } from "../generate-test-report.js";
import { projectRoot } from "./payload-utils.mjs";
import { runExecutable, runPnpm } from "./process-utils.mjs";
import {
  copyOfficialReports,
  printFailedTestDetails,
  resetValidationRoot,
  summarizeTestReport,
  validationManifestPath,
  writeValidationManifest,
} from "./validation-utils.mjs";

if (process.platform !== "win32") {
  throw new Error(
    `Windows release validation requires Windows. Current platform: ${process.platform}`,
  );
}

console.log("=== Release Factory: validate Windows release ===");
console.log(`Project root: ${projectRoot}`);

resetValidationRoot();

for (const directory of [
  path.join(projectRoot, ".test-artifact", "server"),
  path.join(projectRoot, ".test-artifact", "server", "workspace"),
  path.join(projectRoot, "server", ".test-artifact"),
]) {
  fs.mkdirSync(directory, { recursive: true });
}

console.log("Checking release validation runtime prerequisites...");
runExecutable(
  "python",
  [
    "-c",
    [
      "import docx",
      "import pptx",
      "import openpyxl",
      "print('Python Office validation dependencies are available')",
    ].join(";"),
  ],
  { cwd: projectRoot },
);
runExecutable("where.exe", ["pdftotext.exe"], { cwd: projectRoot });

const validation = {
  typecheck: {
    status: "pending",
  },
  tests: {
    client: {
      status: "not_run",
      totalTests: 0,
      failedTests: 0,
      totalSuites: 0,
      failedSuites: 0,
    },
    server: {
      status: "not_run",
      totalTests: 0,
      failedTests: 0,
      totalSuites: 0,
      failedSuites: 0,
    },
  },
};

runPnpm(["version:sync"], { cwd: projectRoot });

try {
  runPnpm(["check"], { cwd: projectRoot });
  validation.typecheck.status = "passed";
} catch (error) {
  validation.typecheck.status = "failed";
  writeValidationManifest(validation);
  throw error;
}

let reportResult;
try {
  reportResult = generateReleaseTestReports();
} catch (error) {
  validation.tests.client.status = "error";
  validation.tests.server.status = "error";
  writeValidationManifest(validation);
  throw error;
}

const clientReportDir = copyOfficialReports(
  "client",
  reportResult.clientReportDir,
);
const serverReportDir = copyOfficialReports(
  "server",
  reportResult.serverReportDir,
);

const clientReportPath = path.join(clientReportDir, "test-report.json");
const serverReportPath = path.join(serverReportDir, "test-report.json");
validation.tests.client = summarizeTestReport(clientReportPath);
validation.tests.server = summarizeTestReport(serverReportPath);

writeValidationManifest(validation);

console.log(
  `Client tests: ${validation.tests.client.status} ` +
    `(${validation.tests.client.failedTests}/${validation.tests.client.totalTests} failed)`,
);
console.log(
  `Server tests: ${validation.tests.server.status} ` +
    `(${validation.tests.server.failedTests}/${validation.tests.server.totalTests} failed)`,
);

let failed = false;
if (validation.tests.client.status !== "passed") {
  failed = true;
  printFailedTestDetails("client", clientReportPath);
}
if (validation.tests.server.status !== "passed") {
  failed = true;
  printFailedTestDetails("server", serverReportPath);
}

if (failed) {
  throw new Error(
    `Release validation failed. Diagnostic manifest: ${validationManifestPath}`,
  );
}

if (!fs.existsSync(validationManifestPath)) {
  throw new Error(`Validation manifest was not written: ${validationManifestPath}`);
}

console.log(`Release validation passed: ${validationManifestPath}`);
