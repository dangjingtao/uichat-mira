import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

const testArtifactRoot = path.join(repoRoot, ".test-artifact", "server");

export const getTestArtifactDir = (...segments: string[]) => {
  const dir = path.join(testArtifactRoot, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export const createTestArtifactPath = (scope: string, fileName: string) =>
  path.join(getTestArtifactDir(scope), fileName);

export const createTimestampedTestArtifactPath = (
  scope: string,
  prefix: string,
  suffix = "",
) =>
  createTestArtifactPath(
    scope,
    `${prefix}-${process.pid}-${Date.now()}${suffix}`,
  );
