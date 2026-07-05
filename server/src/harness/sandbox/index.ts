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

const PROFILE_COVERAGE: Record<SandboxProfile, "implemented" | "not_implemented"> = {
  read_only: "not_implemented",
  workspace_write: "not_implemented",
  command: "implemented",
  networked_command: "not_implemented",
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

export const getSandboxProfileCoverage = () => ({ ...PROFILE_COVERAGE });

export const runSandboxCommandDirect = async (
  request: SandboxRunRequest,
): Promise<SandboxRunResult> => {
  const startedAt = performance.now();
  const coverage = PROFILE_COVERAGE[request.profile];
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
