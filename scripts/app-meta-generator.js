import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function readPackageJson(packageDir) {
  return JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf-8"));
}

function runGit(args, cwd) {
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

function findGitRoot(startDir) {
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

function readPackageVersionAtCommit(commitHash, gitRoot) {
  const output = runGit(["show", `${commitHash}:package.json`], gitRoot);
  if (!output) {
    return null;
  }

  try {
    const pkg = JSON.parse(output);
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}

function collectGitInfo(projectRoot) {
  const gitRoot = findGitRoot(projectRoot);
  if (!gitRoot) {
    return undefined;
  }

  const branch = runGit(["branch", "--show-current"], gitRoot);
  if (!branch) {
    return undefined;
  }

  const versionCommits = new Map();

  const headHash = runGit(["rev-parse", "HEAD"], gitRoot);
  if (headHash) {
    const headVersion = readPackageVersionAtCommit(headHash, gitRoot);
    if (headVersion) {
      versionCommits.set(headVersion, headHash);
    }
  }

  const changeOutput = runGit(["log", "--format=%H", "--", "package.json"], gitRoot) ?? "";
  const changeHashes = changeOutput
    .split("\n")
    .map((hash) => hash.trim())
    .filter(Boolean);

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

  const versions = [];

  for (const [version, commitHash] of versionCommits) {
    const log = runGit(["log", "-1", "--format=%H%x00%s%x00%an%x00%aI", commitHash], gitRoot);
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

function readCustomAppMeta(appMeta) {
  const metaObject = appMeta && typeof appMeta === "object" ? appMeta : {};

  const links = Array.isArray(metaObject.links)
    ? metaObject.links
        .filter(
          (item) =>
            !!item &&
            typeof item === "object" &&
            typeof item.label === "string" &&
            typeof item.value === "string" &&
            typeof item.href === "string",
        )
        .map((item) => ({
          label: item.label,
          value: item.value,
          href: item.href,
        }))
    : [];

  return {
    displayName:
      typeof metaObject.displayName === "string" ? metaObject.displayName : "",
    links,
  };
}

function resolveRepositoryUrl(repository) {
  if (typeof repository === "string") {
    return repository;
  }

  if (repository && typeof repository === "object" && typeof repository.url === "string") {
    return repository.url;
  }

  return "";
}

function formatAppDisplayName(name) {
  return name
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildAppMeta(projectRoot) {
  const rootPackage = readPackageJson(projectRoot);
  const customMeta = readCustomAppMeta(rootPackage.appMeta);

  return {
    name:
      typeof rootPackage.name === "string"
        ? rootPackage.name
        : "ui-chat-rag-tester",
    version:
      typeof rootPackage.version === "string" ? rootPackage.version : "0.0.0",
    author: typeof rootPackage.author === "string" ? rootPackage.author : "",
    description:
      typeof rootPackage.description === "string" ? rootPackage.description : "",
    repository: rootPackage.repository ?? null,
    homepage: typeof rootPackage.homepage === "string" ? rootPackage.homepage : "",
    appMeta: {
      displayName:
        customMeta.displayName ||
        formatAppDisplayName(typeof rootPackage.name === "string" ? rootPackage.name : "ui-chat-rag-tester"),
      links: customMeta.links,
      git: collectGitInfo(projectRoot),
    },
  };
}

export function writeAppMetaJsons(projectRoot, outputPaths) {
  const appMeta = buildAppMeta(projectRoot);

  for (const outputPath of outputPaths) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(appMeta, null, 2)}\n`);
  }

  return appMeta;
}
