import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  ManagedCodeGraphProcessManager as BaseManagedCodeGraphProcessManager,
  createManagedCodeGraphWorkspaceHash,
} from "./managed-codegraph-process-manager.js";
import { resolveManagedCodeGraphLaunchSpec } from "./managed-jsonrpc-session.js";
import type { ManagedCodeGraphProcessManagerOptions } from "./types.js";

const DEFAULT_REPO_DATA_DIR_NAME = ".codegraph";
const DEFAULT_INDEX_BOOTSTRAP_TIMEOUT_MS = 120_000;
const DECLARED_REPO_LOCAL_REASON =
  /external index|index-root|workspace[\\/].*\.codegraph|serve --mcp/i;
const CODEGRAPH_GIT_EXCLUDE_PATTERN = ".codegraph/";

export const isRealCodeGraphCommand = (command: string) => {
  const normalized = command.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const baseName = path.basename(normalized);
  return (
    baseName === "codegraph" ||
    baseName === "codegraph.cmd" ||
    baseName === "codegraph.exe"
  );
};

/**
 * CodeGraph currently stores its project index in a workspace-local directory.
 * UIChat Mira treats that directory as declared runtime data for the controlled
 * codebase_explore capability. Other providers keep the strict pollution guard.
 */
export const shouldAllowDeclaredRepoLocalCodeGraphData = (
  options: ManagedCodeGraphProcessManagerOptions,
) => {
  const guard = options.repoPollutionGuard;
  const repoDataDirName =
    guard?.repoDataDirName.trim() || DEFAULT_REPO_DATA_DIR_NAME;
  const knownStorageConstraint =
    guard?.status === "ready" ||
    DECLARED_REPO_LOCAL_REASON.test(guard?.blockedReason ?? "");

  return (
    isRealCodeGraphCommand(options.command) &&
    repoDataDirName === DEFAULT_REPO_DATA_DIR_NAME &&
    knownStorageConstraint
  );
};

type ManagedCliResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

const runManagedCodeGraphCli = async (input: {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}): Promise<ManagedCliResult> => {
  const launch = resolveManagedCodeGraphLaunchSpec(input.command, input.args);
  return await new Promise((resolve) => {
    const child = spawn(launch.command, launch.args, {
      cwd: input.cwd,
      env: {
        ...process.env,
        ...(input.env ?? {}),
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch {
        // The process may already have exited.
      }
    }, input.timeoutMs ?? DEFAULT_INDEX_BOOTSTRAP_TIMEOUT_MS);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    const finish = (exitCode: number | null, fallbackError?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        exitCode,
        stdout: stdout.trim(),
        stderr: (stderr || fallbackError || "").trim(),
        timedOut,
      });
    };

    child.on("error", (error) => finish(null, error.message));
    child.on("exit", (code) => finish(code));
  });
};

const resolveGitDirectory = (workspaceRoot: string) => {
  const dotGit = path.join(workspaceRoot, ".git");
  try {
    const stat = fs.statSync(dotGit);
    if (stat.isDirectory()) {
      return dotGit;
    }
    if (!stat.isFile()) {
      return null;
    }

    const pointer = fs.readFileSync(dotGit, "utf8").trim();
    const match = pointer.match(/^gitdir:\s*(.+)$/i);
    if (!match?.[1]) {
      return null;
    }
    return path.resolve(workspaceRoot, match[1].trim());
  } catch {
    return null;
  }
};

const resolveGitCommonDirectory = (workspaceRoot: string) => {
  const gitDir = resolveGitDirectory(workspaceRoot);
  if (!gitDir) {
    return null;
  }

  const commonDirPath = path.join(gitDir, "commondir");
  try {
    if (!fs.existsSync(commonDirPath)) {
      return gitDir;
    }
    const relative = fs.readFileSync(commonDirPath, "utf8").trim();
    return relative ? path.resolve(gitDir, relative) : gitDir;
  } catch {
    return gitDir;
  }
};

export const ensureCodeGraphGitLocalExclude = (workspaceRoot: string) => {
  const gitCommonDir = resolveGitCommonDirectory(workspaceRoot);
  if (!gitCommonDir) {
    return false;
  }

  try {
    const infoDir = path.join(gitCommonDir, "info");
    const excludePath = path.join(infoDir, "exclude");
    fs.mkdirSync(infoDir, { recursive: true });
    const current = fs.existsSync(excludePath)
      ? fs.readFileSync(excludePath, "utf8")
      : "";
    const lines = current.split(/\r?\n/).map((line) => line.trim());
    if (lines.includes(CODEGRAPH_GIT_EXCLUDE_PATTERN)) {
      return true;
    }

    const prefix = current && !current.endsWith("\n") ? "\n" : "";
    fs.appendFileSync(
      excludePath,
      `${prefix}# UIChat Mira managed CodeGraph runtime\n${CODEGRAPH_GIT_EXCLUDE_PATTERN}\n`,
      "utf8",
    );
    return true;
  } catch {
    return false;
  }
};

const hasCodeGraphIndexData = (repoDataDirPath: string) => {
  try {
    return fs
      .readdirSync(repoDataDirPath)
      .some((entry) => entry !== ".gitignore");
  } catch {
    return false;
  }
};

export type DeclaredRepoLocalIndexBootstrapResult = {
  status: "skipped" | "ready" | "initialized" | "failed";
  repoDataDirPath: string;
  message: string;
};

export const ensureDeclaredRepoLocalCodeGraphIndex = async (
  options: ManagedCodeGraphProcessManagerOptions,
): Promise<DeclaredRepoLocalIndexBootstrapResult> => {
  const repoDataDirName =
    options.repoPollutionGuard?.repoDataDirName.trim() ||
    DEFAULT_REPO_DATA_DIR_NAME;
  const repoDataDirPath = path.join(options.workspaceRoot, repoDataDirName);

  if (!shouldAllowDeclaredRepoLocalCodeGraphData(options)) {
    return {
      status: "skipped",
      repoDataDirPath,
      message: "Repo-local CodeGraph index bootstrap does not apply to this provider.",
    };
  }

  ensureCodeGraphGitLocalExclude(options.workspaceRoot);

  if (hasCodeGraphIndexData(repoDataDirPath)) {
    return {
      status: "ready",
      repoDataDirPath,
      message: "Existing CodeGraph project index data found.",
    };
  }

  const initialized = await runManagedCodeGraphCli({
    command: options.command,
    args: ["init", "-i"],
    cwd: options.workspaceRoot,
    env: options.env,
    timeoutMs: Math.max(
      options.startTimeoutMs ?? 0,
      DEFAULT_INDEX_BOOTSTRAP_TIMEOUT_MS,
    ),
  });
  const message = `${initialized.stdout}\n${initialized.stderr}`.trim();
  if (
    initialized.exitCode !== 0 ||
    initialized.timedOut ||
    !hasCodeGraphIndexData(repoDataDirPath)
  ) {
    return {
      status: "failed",
      repoDataDirPath,
      message:
        message ||
        (initialized.timedOut
          ? "CodeGraph index bootstrap timed out."
          : "CodeGraph index bootstrap failed."),
    };
  }

  return {
    status: "initialized",
    repoDataDirPath,
    message: message || "CodeGraph project initialized and indexed.",
  };
};

const normalizeRepoLocalOptions = (
  options: ManagedCodeGraphProcessManagerOptions,
): ManagedCodeGraphProcessManagerOptions => {
  if (!shouldAllowDeclaredRepoLocalCodeGraphData(options)) {
    return options;
  }

  return {
    ...options,
    repoPollutionGuard: undefined,
    env: {
      ...options.env,
      UI_CHAT_CODEGRAPH_REPO_LOCAL_DATA: "declared",
    },
  };
};

export class ManagedCodeGraphProcessManager extends BaseManagedCodeGraphProcessManager {
  private readonly originalOptions: ManagedCodeGraphProcessManagerOptions;
  private indexBootstrapPromise: Promise<DeclaredRepoLocalIndexBootstrapResult> | null = null;

  constructor(options: ManagedCodeGraphProcessManagerOptions) {
    super(normalizeRepoLocalOptions(options));
    this.originalOptions = options;
  }

  override async start() {
    const detected = await super.detect();
    if (detected.status === "unavailable" || detected.status === "blocked") {
      return this.getStatus();
    }

    if (shouldAllowDeclaredRepoLocalCodeGraphData(this.originalOptions)) {
      this.indexBootstrapPromise ??=
        ensureDeclaredRepoLocalCodeGraphIndex(this.originalOptions);
      try {
        const bootstrap = await this.indexBootstrapPromise;
        if (bootstrap.status === "failed") {
          throw new Error(`CodeGraph index bootstrap failed: ${bootstrap.message}`);
        }
      } finally {
        this.indexBootstrapPromise = null;
      }
    }
    return await super.start();
  }
}

export { createManagedCodeGraphWorkspaceHash };
