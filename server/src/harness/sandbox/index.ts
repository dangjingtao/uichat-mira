import { performance } from "node:perf_hooks";
import { createHarnessEnvironmentSnapshot } from "@/harness/environment.js";
import { runWithWorkspaceRootOverride } from "@/mcp/workspace.js";
import {
  executeSandboxedCommand,
} from "@/sandbox/executor.js";
import { getPythonSandboxStatus, runManagedPython } from "@/sandbox/python-executor.js";
import type {
  SandboxFutureProfile,
  SandboxProfile,
  SandboxRunRequest,
  SandboxRunResult,
  SandboxV16Profile,
} from "./contract.js";

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_OUTPUT_LIMIT_BYTES = 64 * 1024;

type SandboxProfileCoverageStatus = "implemented" | "not_implemented";

type SandboxDeclaredContractStatus =
  | SandboxProfileCoverageStatus
  | "future_profile";

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
  // Python is managed separately from the command profile.
  read_only: "not_implemented",
  workspace_write: "not_implemented",
  command: "not_implemented",
  networked_command: "not_implemented",
  python: "blocked",
};

const V16_GATE_PROFILES: SandboxV16Profile[] = ["command"];

const FUTURE_PROFILES: SandboxFutureProfile[] = [
  "read_only",
  "workspace_write",
  "networked_command",
];

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

const createDefaultShellProfile = () => createHarnessEnvironmentSnapshot().terminal.shellProfile;

const isBlockedError = (message: string) =>
  message.includes("path must stay inside workspace root") ||
  message.includes("cwd must be a relative workspace directory without parent traversal") ||
  message.includes("cwd must be an existing workspace directory") ||
  message.includes("blocked by sandbox policy");

const isOutputLimitError = (message: string) =>
  message.includes("terminal output exceeded limit");

const toFutureProfileViolation = (profile: SandboxFutureProfile) =>
  `future_profile: profile ${profile} is declared for future Sandbox coverage and is not part of the UIChat Mira V1.6 gate`;

const toCommandUnavailableViolation = () =>
  "not_implemented: command profile is part of the UIChat Mira V1.6 gate, but the L1 workspace runner requirements are not satisfied";

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
    python: getPythonSandboxStatus(createHarnessEnvironmentSnapshot().toolConfig?.python).available ? "implemented" : "blocked",
  } satisfies Record<SandboxProfile, SandboxProfileCoverageStatus>;
};

export const getSandboxContractCoverage = () => {
  const profileCoverage = getSandboxProfileCoverage();
  const v16GateProfiles = Object.fromEntries(
    V16_GATE_PROFILES.map((profile) => [profile, profileCoverage[profile]]),
  ) as Record<SandboxV16Profile, SandboxProfileCoverageStatus>;
  const futureProfiles = Object.fromEntries(
    FUTURE_PROFILES.map((profile) => [profile, "future_profile"]),
  ) as Record<SandboxFutureProfile, "future_profile">;

  return {
    declaredProfiles: {
      ...futureProfiles,
      python: profileCoverage.python,
      ...v16GateProfiles,
    } satisfies Record<SandboxProfile, SandboxDeclaredContractStatus>,
    v16GateProfiles,
    futureProfiles,
    v16GateSatisfied: Object.values(v16GateProfiles).every((status) => status === "implemented"),
  };
};

export const runSandboxCommandDirect = async (
  request: SandboxRunRequest,
): Promise<SandboxRunResult> => {
  const startedAt = performance.now();
  if (request.profile !== "command") {
    return {
      status: "blocked",
      exitCode: null,
      stdoutText: "",
      stderrText: "",
      stdoutEncoding: "unknown",
      stderrEncoding: "unknown",
      durationMs: Math.round(performance.now() - startedAt),
      truncated: false,
      binaryDetected: false,
      violations: [toFutureProfileViolation(request.profile)],
      artifacts: [],
    };
  }

  const coverage = getSandboxProfileCoverage()[request.profile];
  if (coverage === "not_implemented") {
    return {
      status: "blocked",
      exitCode: null,
      stdoutText: "",
      stderrText: "",
      stdoutEncoding: "unknown",
      stderrEncoding: "unknown",
      durationMs: Math.round(performance.now() - startedAt),
      truncated: false,
      binaryDetected: false,
      violations: [toCommandUnavailableViolation()],
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
        artifactRegistrations: request.artifactRegistrations,
        signal: new AbortController().signal,
        shellProfile: createDefaultShellProfile(),
      }),
    );

    return {
      status: execution.timedOut
        ? "timed_out"
        : execution.exitCode === 0
          ? "completed"
          : "failed",
      exitCode: execution.exitCode,
      stdoutText: execution.stdout,
      stderrText: execution.stderr,
      stdoutEncoding: execution.stdoutEncoding,
      stderrEncoding: execution.stderrEncoding,
      durationMs: Math.round(performance.now() - startedAt),
      truncated: execution.truncated,
      binaryDetected: execution.binaryDetected,
      violations: execution.violations,
      artifacts: execution.artifacts,
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
      stdoutEncoding: "unknown",
      stderrEncoding: "unknown",
      durationMs: Math.round(performance.now() - startedAt),
      truncated: isOutputLimitError(message),
      binaryDetected: false,
      violations: isBlockedError(message) || isOutputLimitError(message) ? [message] : [],
      artifacts: [],
    };
  }
};

export const runSandboxPythonDirect = async (input: Parameters<typeof runManagedPython>[0]) =>
  runManagedPython(input);
