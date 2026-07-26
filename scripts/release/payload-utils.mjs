import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { captureExecutable } from "./process-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "..", "..");
export const artifactsRoot = path.join(projectRoot, ".artifacts");
export const payloadRoot = path.join(
  artifactsRoot,
  "release-payload",
  "windows-x64",
);
export const payloadManifestPath = path.join(payloadRoot, "manifest.json");

export function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

export function copyRequired(sourcePath, destinationPath, label) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing ${label}: ${sourcePath}`);
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    removePath(destinationPath);
    fs.cpSync(sourcePath, destinationPath, {
      recursive: true,
      dereference: true,
    });
  } else {
    fs.copyFileSync(sourcePath, destinationPath);
  }
  console.log(`Staged ${label}: ${destinationPath}`);
}

export function copyOptional(sourcePath, destinationPath, label) {
  if (!fs.existsSync(sourcePath)) {
    console.log(`Skipping optional ${label}: ${sourcePath}`);
    return false;
  }
  copyRequired(sourcePath, destinationPath, label);
  return true;
}

export function listFilesRecursive(rootPath, currentPath = rootPath) {
  if (!fs.existsSync(currentPath)) {
    return [];
  }

  return fs
    .readdirSync(currentPath, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursive(rootPath, fullPath);
      }
      return [
        {
          fullPath,
          relativePath: path.relative(rootPath, fullPath).replaceAll("\\", "/"),
        },
      ];
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function resolveGitCommit() {
  if (process.env.GITHUB_SHA?.trim()) {
    return process.env.GITHUB_SHA.trim();
  }
  try {
    return captureExecutable("git", ["rev-parse", "HEAD"], {
      cwd: projectRoot,
    });
  } catch {
    return "unknown";
  }
}

function readRootPackage() {
  return JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  );
}

function isReleaseEligibleValidation(validation) {
  return (
    validation?.typecheck?.status === "passed" &&
    validation?.tests?.client?.status === "passed" &&
    validation?.tests?.server?.status === "passed"
  );
}

function assertValidationContract(
  validation,
  { allowSkippedTests, allowFailedTests },
) {
  if (validation?.typecheck?.status !== "passed") {
    throw new Error("Payload validation is missing a passed typecheck result.");
  }

  for (const scope of ["client", "server"]) {
    const result = validation?.tests?.[scope];
    if (!result) {
      throw new Error(`Payload validation is missing ${scope} test results.`);
    }
    if (result.status === "passed") {
      continue;
    }
    if (result.status === "skipped" && allowSkippedTests) {
      continue;
    }
    if (result.status === "failed" && allowFailedTests) {
      continue;
    }
    throw new Error(
      `Payload validation requires passed ${scope} tests; received ${result.status ?? "missing"}.`,
    );
  }
}

export function writePayloadManifest(validation) {
  const packageJson = readRootPackage();
  const files = listFilesRecursive(payloadRoot)
    .filter((file) => file.relativePath !== "manifest.json")
    .map((file) => {
      const stat = fs.statSync(file.fullPath);
      return {
        path: file.relativePath,
        bytes: stat.size,
        sha256: sha256File(file.fullPath),
      };
    });

  const manifest = {
    schemaVersion: 3,
    product: packageJson.name,
    version: packageJson.version,
    platform: "windows",
    architecture: "x64",
    gitCommit: resolveGitCommit(),
    generatedAt: new Date().toISOString(),
    releaseEligible: isReleaseEligibleValidation(validation),
    validation,
    totalFiles: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    files,
  };

  fs.writeFileSync(payloadManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote release payload manifest: ${payloadManifestPath}`);
  return manifest;
}

export function verifyPayload({
  allowSkippedTests = false,
  allowFailedTests = false,
  requireReleaseEligible,
} = {}) {
  if (!fs.existsSync(payloadManifestPath)) {
    throw new Error(`Missing release payload manifest: ${payloadManifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(payloadManifestPath, "utf8"));
  if (manifest.schemaVersion !== 3) {
    throw new Error(
      `Unsupported payload manifest schema: ${manifest.schemaVersion ?? "missing"}`,
    );
  }
  if (manifest.platform !== "windows" || manifest.architecture !== "x64") {
    throw new Error(
      `Unexpected payload target: ${manifest.platform}/${manifest.architecture}`,
    );
  }

  const packageJson = readRootPackage();
  if (manifest.product !== packageJson.name) {
    throw new Error(
      `Payload product mismatch: expected ${packageJson.name}, got ${manifest.product}`,
    );
  }
  if (manifest.version !== packageJson.version) {
    throw new Error(
      `Payload version mismatch: expected ${packageJson.version}, got ${manifest.version}`,
    );
  }

  const expectedCommit = process.env.GITHUB_SHA?.trim();
  if (
    expectedCommit &&
    manifest.gitCommit !== "unknown" &&
    manifest.gitCommit !== expectedCommit
  ) {
    throw new Error(
      `Payload commit mismatch: expected ${expectedCommit}, got ${manifest.gitCommit}`,
    );
  }

  const expectedEligibility = isReleaseEligibleValidation(manifest.validation);
  if (manifest.releaseEligible !== expectedEligibility) {
    throw new Error(
      `Payload eligibility mismatch: expected ${expectedEligibility}, got ${manifest.releaseEligible}.`,
    );
  }

  const mustBeReleaseEligible =
    requireReleaseEligible ?? (!allowSkippedTests && !allowFailedTests);
  if (mustBeReleaseEligible && !manifest.releaseEligible) {
    throw new Error(
      "Payload is diagnostic-only because release validation did not fully pass.",
    );
  }

  assertValidationContract(manifest.validation, {
    allowSkippedTests,
    allowFailedTests,
  });

  const actualFiles = listFilesRecursive(payloadRoot).filter(
    (file) => file.relativePath !== "manifest.json",
  );
  const actualPaths = new Set(actualFiles.map((file) => file.relativePath));
  const expectedPaths = new Set(manifest.files.map((file) => file.path));

  for (const expected of manifest.files) {
    const fullPath = path.join(payloadRoot, ...expected.path.split("/"));
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Payload file is missing: ${expected.path}`);
    }
    const stat = fs.statSync(fullPath);
    if (stat.size !== expected.bytes) {
      throw new Error(
        `Payload size mismatch for ${expected.path}: expected ${expected.bytes}, got ${stat.size}`,
      );
    }
    const actualSha256 = sha256File(fullPath);
    if (actualSha256 !== expected.sha256) {
      throw new Error(
        `Payload SHA-256 mismatch for ${expected.path}: expected ${expected.sha256}, got ${actualSha256}`,
      );
    }
  }

  for (const actualPath of actualPaths) {
    if (!expectedPaths.has(actualPath)) {
      throw new Error(`Payload contains an untracked file: ${actualPath}`);
    }
  }

  if (actualPaths.size !== expectedPaths.size) {
    throw new Error(
      `Payload file count mismatch: expected ${expectedPaths.size}, got ${actualPaths.size}`,
    );
  }

  const actualTotalBytes = actualFiles.reduce(
    (sum, file) => sum + fs.statSync(file.fullPath).size,
    0,
  );
  if (
    manifest.totalFiles !== actualFiles.length ||
    manifest.totalBytes !== actualTotalBytes
  ) {
    throw new Error(
      `Payload totals mismatch: expected ${manifest.totalFiles} files/${manifest.totalBytes} bytes, got ${actualFiles.length} files/${actualTotalBytes} bytes.`,
    );
  }

  console.log(
    `Verified release payload: ${manifest.totalFiles} files, ${manifest.totalBytes} bytes, releaseEligible=${manifest.releaseEligible}`,
  );
  return manifest;
}
