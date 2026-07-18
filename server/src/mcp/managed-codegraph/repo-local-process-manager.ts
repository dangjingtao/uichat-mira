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
const NOT_INITIALIZED_PATTERN =
  /not initialized|isn't indexed|no \.codegraph[\\/] index exists|run [`']?codegraph init/i;

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

  if (fs.existsSync(repoDataDirPath)) {
    const statusProbe = await runManagedCodeGraphCli({
      command: options.command,
      args: ["status"],
      cwd: options.workspaceRoot,
      env: options.env,
      timeoutMs: Math.max(options.healthTimeoutMs ?? 0, 10_000),
    });
    const statusText = `${statusProbe.stdout}\n${statusProbe.stderr}`.trim();
    if (
      statusProbe.exitCode === 0 &&
      !NOT_INITIALIZED_PATTERN.test(statusText)
    ) {
      return {
        status: "ready",
        repoDataDirPath,
        message: statusText || "Existing CodeGraph index is ready.",
      };
    }
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
    !fs.existsSync(repoDataDirPath)
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
      const bootstrap = await this.indexBootstrapPromise;
      if (bootstrap.status === "failed") {
        this.indexBootstrapPromise = null;
        throw new Error(`CodeGraph index bootstrap failed: ${bootstrap.message}`);
      }
    }
    return await super.start();
  }
}

export { createManagedCodeGraphWorkspaceHash };
