import { performance } from "node:perf_hooks";
import { createArtifact } from "@/mcp/core/artifacts.js";
import { runWithWorkspaceRootOverride } from "@/mcp/workspace.js";
import {
  createSandboxShellProfile,
  executeSandboxedCommand,
} from "@/sandbox/executor.js";
import type {
  SandboxProfile,
  SandboxRunRequest,
  SandboxRunResult,
} from "./contract.js";

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_OUTPUT_LIMIT_BYTES = 64 * 1024;

type SandboxProfileCoverageStatus = "implemented" | "not_implemented";

type SandboxL1Requirement =
  | "workspace_cwd_lock"
  | "empty_cwd_defaults_workspace_root"
  | "cwd_escape_blocked"
  | "env_allowlist"
  | "timeout_hard_cap"
  | "output_limit_truncation"
  | "complete_result_contract"
  | "windows_kill_tree_limitation_marked";

type SandboxL1RequirementChecks = Record<SandboxL1Requirement, boolean>;

const PROFILE_COVERAGE_BASE: Record<SandboxProfile, SandboxProfileCoverageStatus> = {
  read_only: "not_implemented",
  workspace_write: "not_implemented",
  command: "not_implemented",
  networked_command: "not_implemented",
};

const SANDBOX_L1_WORKSPACE_RUNNER_CHECKS: SandboxL1RequirementChecks = {
  workspace_cwd_lock: true,
  empty_cwd_defaults_workspace_root: true,
  cwd_escape_blocked: true,
  env_allowlist: true,
  timeout_hard_cap: true,
  output_limit_truncation: true,
  complete_result_contract: true,
  windows_kill_tree_limitation_marked: true,
};

const createDefaultShellProfile = () =>
  createSandboxShellProfile({
    shell: process.platform === "win32" ? "powershell.exe" : "/bin/sh",
    shellFamily: process.platform === "win32" ? "powershell" : "posix",
    argsMode: process.platform === "win32" ? "powershell" : "posix",
    stdoutEncoding: "utf8",
    stderrEncoding: "utf8",
  });

const isBlockedError = (message: string) =>
  message.includes("path must stay inside workspace root") ||
  message.includes("cwd must be a relative workspace directory without parent traversal") ||
  message.includes("cwd must be an existing workspace directory") ||
  message.includes("blocked by sandbox policy");

const isOutputLimitError = (message: string) =>
  message.includes("terminal output exceeded limit");

const toNotImplementedViolation = (profile: SandboxProfile) =>
  `not_implemented: profile ${profile} is declared in the contract but not enforced by SandboxExecutor v0.5`;

export const evaluateSandboxL1WorkspaceRunnerStatus = (
  checks: SandboxL1RequirementChecks = SANDBOX_L1_WORKSPACE_RUNNER_CHECKS,
) => {
  const missingRequirements = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([requirement]) => requirement);

  return {
    available: missingRequirements.length === 0,
    requirements: { ...checks },
    missingRequirements,
  };
};

export const getSandboxL1WorkspaceRunnerStatus = () =>
  evaluateSandboxL1WorkspaceRunnerStatus();

export const getSandboxProfileCoverage = () => {
  const l1Status = getSandboxL1WorkspaceRunnerStatus();
  return {
    ...PROFILE_COVERAGE_BASE,
    command: l1Status.available ? "implemented" : "not_implemented",
  } satisfies Record<SandboxProfile, SandboxProfileCoverageStatus>;
};

export const runSandboxCommandDirect = async (
  request: SandboxRunRequest,
): Promise<SandboxRunResult> => {
  const startedAt = performance.now();
  const coverage = getSandboxProfileCoverage()[request.profile];
  if (coverage === "not_implemented") {
    return {
      status: "blocked",
      exitCode: null,
      stdoutText: "",
      stderrText: "",
      durationMs: Math.round(performance.now() - startedAt),
      truncated: false,
      violations: [toNotImplementedViolation(request.profile)],
      artifacts: [],
    };
  }

  try {
    const execution = await runWithWorkspaceRootOverride(request.workspaceRoot, async () =>
      executeSandboxedCommand({
        command: request.command,
        cwd: request.cwd,
        env: request.env,
        timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        outputLimitBytes: request.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT_BYTES,
        signal: new AbortController().signal,
        shellProfile: createDefaultShellProfile(),
      }),
    );

    const artifacts =
      execution.stdout || execution.stderr
        ? [
            createArtifact({
              kind: "terminal-log",
              title: "sandbox-direct-output",
              mimeType: "text/plain",
              data: execution.output,
              metadata: {
                exitCode: execution.exitCode,
                cwd: execution.cwd,
              },
            }),
          ]
        : [];

    return {
      status: execution.timedOut
        ? "timed_out"
        : execution.exitCode === 0
          ? "completed"
          : "failed",
      exitCode: execution.exitCode,
      stdoutText: execution.stdout,
      stderrText: execution.stderr,
      durationMs: Math.round(performance.now() - startedAt),
      truncated: execution.truncated,
      violations: execution.violations,
      artifacts,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: isBlockedError(message)
        ? "blocked"
        : isOutputLimitError(message)
          ? "failed"
          : "failed",
      exitCode: null,
      stdoutText: "",
      stderrText: message,
      durationMs: Math.round(performance.now() - startedAt),
      truncated: isOutputLimitError(message),
      violations: isBlockedError(message) || isOutputLimitError(message) ? [message] : [],
      artifacts: [],
    };
  }
};
