import os from "os";
import path from "path";
import fs from "fs";

export * from "./response.js";

export interface EnvironmentInfo {
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

function getPackageVersion(): string {
  try {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    return packageJson.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
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
  const version = getPackageVersion();
  const { major, minor, patch } = parseVersion(version);

  return {
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
