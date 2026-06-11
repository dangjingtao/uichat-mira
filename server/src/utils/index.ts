import os from "os";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

export * from "./response.js";
export * from "./errors.js";

export interface EnvironmentInfo {
  name: string;
  version: string;
  majorVersion: number;
  minorVersion: number;
  patchVersion: number;
  nodeVersion: string;
  platform: string;
  arch: string;
  hostname: string;
  cpus: number;
  totalMemory: number;
  freeMemory: number;
  uptime: number;
}

export interface AppMeta {
  name: string;
  version: string;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));

function readJsonIfExists(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function resolveAppMeta(): AppMeta {
  const packageCandidates = [
    path.resolve(currentDir, "../../package.json"),
    path.resolve(currentDir, "../../../package.json"),
    path.resolve(currentDir, "../../../../package.json"),
  ];

  for (const candidate of packageCandidates) {
    const packageJson = readJsonIfExists(candidate);

    if (!packageJson) {
      continue;
    }

    const name =
      typeof packageJson.name === "string"
        ? packageJson.name
        : "ui-chat-rag-tester";
    const version =
      typeof packageJson.version === "string" ? packageJson.version : "0.0.0";

    return { name, version };
  }

  return {
    name: "ui-chat-rag-tester",
    version: "0.0.0",
  };
}

function getPackageVersion(): string {
  return resolveAppMeta().version;
}

export function getAppMeta(): AppMeta {
  return resolveAppMeta();
}

function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const parts = version.split(".");
  return {
    major: parseInt(parts[0] || "0", 10),
    minor: parseInt(parts[1] || "0", 10),
    patch: parseInt(parts[2] || "0", 10),
  };
}

export function getEnvironmentInfo(): EnvironmentInfo {
  const { name, version } = getAppMeta();
  const { major, minor, patch } = parseVersion(version);

  return {
    name,
    version,
    majorVersion: major,
    minorVersion: minor,
    patchVersion: patch,
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
  };
}

export function getMajorVersion(): number {
  const version = getPackageVersion();
  return parseVersion(version).major;
}
