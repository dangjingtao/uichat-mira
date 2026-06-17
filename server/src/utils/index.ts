import os from "os";
import path from "path";
import fs from "fs";
import { execSync } from "node:child_process";

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

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitVersionInfo {
  version: string;
  commit: GitCommitInfo;
}

export interface GitInfo {
  branch: string;
  versions: GitVersionInfo[];
}

export interface AppMeta {
  name: string;
  version: string;
  displayName: string;
  author: string;
  description: string;
  repositoryUrl: string;
  homepageUrl: string;
  changelog: string[];
  versionHistory: Array<{
    version: string;
    summary: string;
  }>;
  links: Array<{
    label: string;
    value: string;
    href: string;
  }>;
  git?: GitInfo;
}

const currentDir = path.dirname(process.argv[1] || process.cwd());
let cachedAppMeta: AppMeta | null = null;

type PackageJsonLike = Record<string, unknown>;

function readJsonIfExists(filePath: string): PackageJsonLike | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as PackageJsonLike;
  } catch {
    return null;
  }
}

function resolveAppMeta(): AppMeta {
  const appMetaCandidates = [
    path.resolve(currentDir, "app-meta.json"),
    path.resolve(currentDir, "../app-meta.json"),
  ];

  for (const candidate of appMetaCandidates) {
    const appMetaJson = readJsonIfExists(candidate);

    if (!appMetaJson) {
      continue;
    }

    return normalizeAppMeta(appMetaJson);
  }

  const rootPackageCandidates = [
    path.resolve(process.cwd(), "package.json"),
    path.resolve(process.cwd(), "../package.json"),
    path.resolve(currentDir, "../../../package.json"),
    path.resolve(currentDir, "../../../../package.json"),
  ];

  for (const candidate of rootPackageCandidates) {
    const rootPackageJson = readJsonIfExists(candidate);

    if (!rootPackageJson) {
      continue;
    }

    if (!isTopLevelAppPackage(rootPackageJson)) {
      continue;
    }

    return normalizeAppMeta(rootPackageJson);
  }

  return {
    name: "ui-chat-rag-tester",
    version: "0.0.0",
    displayName: "Ui Chat Rag Tester",
    author: "",
    description: "",
    repositoryUrl: "",
    homepageUrl: "",
    changelog: [],
    versionHistory: [],
    links: [],
  };
}

function isTopLevelAppPackage(packageJson: PackageJsonLike) {
  return (
    packageJson.name === "ui-chat-rag-tester" ||
    (!!packageJson.appMeta && typeof packageJson.appMeta === "object")
  );
}

function normalizeAppMeta(packageJson: PackageJsonLike): AppMeta {
  const name =
    typeof packageJson.name === "string"
      ? packageJson.name
      : "ui-chat-rag-tester";
  const version =
    typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
  const author = typeof packageJson.author === "string" ? packageJson.author : "";
  const description =
    typeof packageJson.description === "string" ? packageJson.description : "";
  const repositoryUrl = resolveRepositoryUrl(packageJson.repository);
  const homepageUrl =
    typeof packageJson.homepage === "string" ? packageJson.homepage : "";
  const customMeta = readCustomAppMeta(packageJson.appMeta);

  return {
    name,
    version,
    displayName: formatAppDisplayName(name),
    author,
    description,
    repositoryUrl,
    homepageUrl,
    changelog: customMeta.changelog,
    versionHistory: customMeta.versionHistory,
    links: customMeta.links,
    git: customMeta.git,
  };
}

function isGitCommitInfoLike(value: unknown): value is GitCommitInfo {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Record<string, unknown>;
  return (
    typeof v.hash === "string" &&
    typeof v.shortHash === "string" &&
    typeof v.message === "string" &&
    typeof v.author === "string" &&
    typeof v.date === "string"
  );
}

function isGitVersionInfoLike(value: unknown): value is GitVersionInfo {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Record<string, unknown>;
  return typeof v.version === "string" && isGitCommitInfoLike(v.commit);
}

function isGitInfoLike(value: unknown): value is GitInfo {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Record<string, unknown>;
  return (
    typeof v.branch === "string" &&
    Array.isArray(v.versions) &&
    v.versions.every(isGitVersionInfoLike)
  );
}

function readCustomAppMeta(appMeta: unknown) {
  const metaObject =
    appMeta && typeof appMeta === "object"
      ? (appMeta as Record<string, unknown>)
      : {};

  const changelog = Array.isArray(metaObject.changelog)
    ? metaObject.changelog.filter((item): item is string => typeof item === "string")
    : [];

  const versionHistory = Array.isArray(metaObject.versionHistory)
    ? metaObject.versionHistory
        .filter(
          (
            item,
          ): item is {
            version: string;
            summary: string;
          } =>
            !!item &&
            typeof item === "object" &&
            typeof (item as { version?: unknown }).version === "string" &&
            typeof (item as { summary?: unknown }).summary === "string",
        )
        .map((item) => ({
          version: item.version,
          summary: item.summary,
        }))
    : [];

  const links = Array.isArray(metaObject.links)
    ? metaObject.links
        .filter(
          (
            item,
          ): item is {
            label: string;
            value: string;
            href: string;
          } =>
            !!item &&
            typeof item === "object" &&
            typeof (item as { label?: unknown }).label === "string" &&
            typeof (item as { value?: unknown }).value === "string" &&
            typeof (item as { href?: unknown }).href === "string",
        )
        .map((item) => ({
          label: item.label,
          value: item.value,
          href: item.href,
        }))
    : [];

  const git = isGitInfoLike(metaObject.git) ? metaObject.git : undefined;

  return {
    changelog,
    versionHistory,
    links,
    git,
  };
}

function formatAppDisplayName(name: string) {
  return name
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function resolveRepositoryUrl(repository: unknown) {
  if (typeof repository === "string") {
    return repository;
  }

  if (
    repository &&
    typeof repository === "object" &&
    "url" in repository &&
    typeof (repository as { url?: unknown }).url === "string"
  ) {
    return (repository as { url: string }).url;
  }

  return "";
}

function findGitRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(dir, ".git"))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }

    dir = parent;
  }
}

function runGit(args: string[], cwd: string): string | null {
  try {
    return execSync(`git ${args.join(" ")}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

function readPackageVersionAtCommit(
  commitHash: string,
  gitRoot: string,
): string | null {
  const output = runGit(["show", `${commitHash}:package.json`], gitRoot);
  if (!output) {
    return null;
  }

  try {
    const pkg = JSON.parse(output) as PackageJsonLike;
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}

function collectGitInfo(): GitInfo | null {
  const gitRoot = findGitRoot(currentDir) ?? findGitRoot(process.cwd());
  if (!gitRoot) {
    return null;
  }

  const branch = runGit(["branch", "--show-current"], gitRoot);
  if (!branch) {
    return null;
  }

  const versionCommits = new Map<string, string>();

  const headHash = runGit(["rev-parse", "HEAD"], gitRoot);
  if (headHash) {
    const headVersion = readPackageVersionAtCommit(headHash, gitRoot);
    if (headVersion) {
      versionCommits.set(headVersion, headHash);
    }
  }

  const changeOutput = runGit(
    ["log", "--format=%H", "--", "package.json"],
    gitRoot,
  );
  const changeHashes = changeOutput
    ? changeOutput.split("\n").map((h) => h.trim()).filter(Boolean)
    : [];

  for (const hash of changeHashes) {
    const parentHash = runGit(["rev-parse", `${hash}~1`], gitRoot);
    if (!parentHash) {
      continue;
    }

    const parentVersion = readPackageVersionAtCommit(parentHash, gitRoot);
    if (parentVersion && !versionCommits.has(parentVersion)) {
      versionCommits.set(parentVersion, parentHash);
    }
  }

  const versions: GitVersionInfo[] = [];

  for (const [version, commitHash] of versionCommits) {
    const log = runGit(
      ["log", "-1", "--format=%H%x00%s%x00%an%x00%aI", commitHash],
      gitRoot,
    );

    if (!log) {
      continue;
    }

    const [hash, message, author, date] = log.split("\0");
    if (!hash) {
      continue;
    }

    versions.push({
      version,
      commit: {
        hash,
        shortHash: hash.slice(0, 7),
        message: message ?? "",
        author: author ?? "",
        date: date ?? "",
      },
    });
  }

  versions.sort(
    (a, b) => new Date(b.commit.date).getTime() - new Date(a.commit.date).getTime(),
  );

  return { branch, versions };
}

function getPackageVersion(): string {
  return resolveAppMeta().version;
}

export function getAppMeta(): AppMeta {
  if (cachedAppMeta) {
    return cachedAppMeta;
  }

  const meta = resolveAppMeta();
  if (meta.git) {
    cachedAppMeta = meta;
    return cachedAppMeta;
  }

  const git = collectGitInfo();
  cachedAppMeta = git ? { ...meta, git } : meta;
  return cachedAppMeta;
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
