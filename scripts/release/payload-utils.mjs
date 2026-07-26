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

function listFilesRecursive(rootPath, currentPath = rootPath) {
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

export function writePayloadManifest() {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
  );
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
    schemaVersion: 1,
    product: packageJson.name,
    version: packageJson.version,
    platform: "windows",
    architecture: "x64",
    gitCommit: resolveGitCommit(),
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    files,
  };

  fs.writeFileSync(payloadManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote release payload manifest: ${payloadManifestPath}`);
  return manifest;
}

export function verifyPayload() {
  if (!fs.existsSync(payloadManifestPath)) {
    throw new Error(`Missing release payload manifest: ${payloadManifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(payloadManifestPath, "utf8"));
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

  console.log(
    `Verified release payload: ${manifest.totalFiles} files, ${manifest.totalBytes} bytes, manifest schema ${manifest.schemaVersion}`,
  );
  return manifest;
}
