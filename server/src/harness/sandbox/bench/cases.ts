import path from "node:path";
import type {
  SandboxBenchCaseResult,
  SandboxBenchCaseStatus,
  SandboxFutureProfile,
  SandboxRunRequest,
  SandboxRunResult,
} from "../contract.js";
import { getSandboxContractCoverage, runSandboxCommandDirect } from "../index.js";

interface SandboxBenchCaseDefinition {
  id: string;
  group: "positive" | "negative" | "coverage";
  description: string;
  request: SandboxRunRequest;
  evaluate: (result: SandboxRunResult) => {
    status: SandboxBenchCaseStatus;
    notes: string[];
  };
}

const benchArtifactPath = ".artifacts/sandbox-bench/sandbox-bench-artifact.txt";

const buildCommandSet = () => {
  if (process.platform === "win32") {
    return {
      echoHello: "Write-Output 'hello'",
      unicode:
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output '中文输出'",
      exitCode: "exit 7",
      timeout: "Start-Sleep -Seconds 2",
      hugeOutput: "1..9000 | ForEach-Object { '0123456789' }",
      artifactWrite: `New-Item -ItemType Directory -Force -Path '.artifacts/sandbox-bench' | Out-Null; Set-Content -Path '${benchArtifactPath}' -Value 'artifact output'`,
    };
  }

  return {
    echoHello: "printf 'hello\\n'",
    unicode: "printf '中文输出\\n'",
    exitCode: "exit 7",
    timeout: "sleep 2",
    hugeOutput: "yes 0123456789 | head -n 9000",
    artifactWrite: `mkdir -p .artifacts/sandbox-bench && printf 'artifact output\\n' > '${benchArtifactPath}'`,
  };
};

const commandSet = buildCommandSet();

const createNotes = (passed: boolean, successNote: string, failureNote: string) =>
  passed ? [successNote] : [failureNote];

const createFutureProfileCase = (
  workspaceRoot: string,
  profile: SandboxFutureProfile,
): SandboxBenchCaseDefinition => ({
  id: `coverage-${profile}-future-profile`,
  group: "coverage",
  description: `${profile} is declared as a future profile and must stay out of the V1.6 gate`,
  request: {
    profile,
    workspaceRoot,
    command: commandSet.echoHello,
    timeoutMs: 1_000,
  },
  evaluate: (result) => {
    const passed = result.violations.some((item) => item.startsWith("future_profile:"));
    return {
      status: passed ? "future_profile" : "failed",
      notes: createNotes(
        passed,
        `${profile} 已明确标记为 future profile，不计入 V1.6 gate`,
        `期望 future_profile，实际 status=${result.status} violations=${JSON.stringify(result.violations)}`,
      ),
    };
  },
});

export const createSandboxDirectBenchCases = (
  workspaceRoot: string,
): SandboxBenchCaseDefinition[] => [
  {
    id: "positive-echo-hello",
    group: "positive",
    description: "echo hello should complete successfully",
    request: {
      profile: "command",
      workspaceRoot,
      command: commandSet.echoHello,
      timeoutMs: 5_000,
    },
    evaluate: (result) => {
      const passed = result.status === "completed" && result.stdoutText.includes("hello");
      return {
        status: passed ? "passed" : "failed",
        notes: createNotes(
          passed,
          "stdout 包含 hello，合同 completed 正常返回",
          `期望 completed + hello，实际 status=${result.status} stdout=${JSON.stringify(result.stdoutText)}`,
        ),
      };
    },
  },
  {
    id: "positive-unicode-output",
    group: "positive",
    description: "unicode output should be preserved",
    request: {
      profile: "command",
      workspaceRoot,
      command: commandSet.unicode,
      timeoutMs: 5_000,
    },
    evaluate: (result) => {
      const passed = result.status === "completed" && result.stdoutText.includes("中文输出");
      return {
        status: passed ? "passed" : "failed",
        notes: createNotes(
          passed,
          "stdout 保留中文输出，没有被乱码破坏",
          `期望中文输出，实际 status=${result.status} stdout=${JSON.stringify(result.stdoutText)}`,
        ),
      };
    },
  },
  {
    id: "positive-exit-code",
    group: "positive",
    description: "non-zero exit code should be returned",
    request: {
      profile: "command",
      workspaceRoot,
      command: commandSet.exitCode,
      timeoutMs: 5_000,
    },
    evaluate: (result) => {
      const passed = result.status === "failed" && result.exitCode === 7;
      return {
        status: passed ? "passed" : "failed",
        notes: createNotes(
          passed,
          "exitCode=7 已回传，非零退出不会被吞掉",
          `期望 failed + exitCode=7，实际 status=${result.status} exitCode=${String(result.exitCode)}`,
        ),
      };
    },
  },
  {
    id: "positive-artifact-registration",
    group: "positive",
    description: "registered workspace artifact should be returned",
    request: {
      profile: "command",
      workspaceRoot,
      command: commandSet.artifactWrite,
      timeoutMs: 5_000,
      artifactRegistrations: [{ path: benchArtifactPath, kind: "report" }],
    },
    evaluate: (result) => {
      const passed =
        result.status === "completed" &&
        result.artifacts.some((artifact) => artifact.kind === "report");
      return {
        status: passed ? "passed" : "failed",
        notes: createNotes(
          passed,
          "命令生成的本地文件已按 artifact 合同回传",
          `期望 artifacts 中存在 report，实际 status=${result.status} artifacts=${JSON.stringify(result.artifacts)}`,
        ),
      };
    },
  },
  {
    id: "negative-cwd-escape",
    group: "negative",
    description: "cwd escape should be blocked",
    request: {
      profile: "command",
      workspaceRoot,
      cwd: path.join("..", ".."),
      command: commandSet.echoHello,
      timeoutMs: 1_000,
    },
    evaluate: (result) => {
      const passed =
        result.status === "blocked" &&
        result.violations.some((item) =>
          item.includes("cwd must be a relative workspace directory without parent traversal"),
        );
      return {
        status: passed ? "passed" : "failed",
        notes: createNotes(
          passed,
          "cwd 越界被阻断，没有进入真实执行",
          `期望 blocked + workspace root violation，实际 status=${result.status} violations=${JSON.stringify(result.violations)}`,
        ),
      };
    },
  },
  {
    id: "negative-short-timeout",
    group: "negative",
    description: "short timeout should return timed_out",
    request: {
      profile: "command",
      workspaceRoot,
      command: commandSet.timeout,
      timeoutMs: 100,
    },
    evaluate: (result) => {
      const passed = result.status === "timed_out";
      return {
        status: passed ? "passed" : "failed",
        notes: createNotes(
          passed,
          "超短 timeout 已命中 timed_out",
          `期望 timed_out，实际 status=${result.status} stderr=${JSON.stringify(result.stderrText)}`,
        ),
      };
    },
  },
  {
    id: "negative-huge-output",
    group: "negative",
    description: "huge output should hit output limit",
    request: {
      profile: "command",
      workspaceRoot,
      command: commandSet.hugeOutput,
      timeoutMs: 2_000,
      outputLimitBytes: 256,
    },
    evaluate: (result) => {
      const passed =
        result.status === "failed" &&
        result.truncated &&
        result.violations.some((item) => item.includes("terminal output exceeded limit"));
      return {
        status: passed ? "passed" : "failed",
        notes: createNotes(
          passed,
          "输出超限被识别为失败，并明确标记 truncated",
          `期望 failed + truncated，实际 status=${result.status} truncated=${String(result.truncated)} violations=${JSON.stringify(result.violations)}`,
        ),
      };
    },
  },
  createFutureProfileCase(workspaceRoot, "read_only"),
  createFutureProfileCase(workspaceRoot, "workspace_write"),
  createFutureProfileCase(workspaceRoot, "networked_command"),
];

export const runSandboxDirectBenchCases = async (
  workspaceRoot: string,
): Promise<{
  contractCoverage: ReturnType<typeof getSandboxContractCoverage>;
  cases: SandboxBenchCaseResult[];
}> => {
  const definitions = createSandboxDirectBenchCases(workspaceRoot);
  const results: SandboxBenchCaseResult[] = [];

  for (const definition of definitions) {
    const runResult = await runSandboxCommandDirect(definition.request);
    const evaluation = definition.evaluate(runResult);
    results.push({
      id: definition.id,
      group: definition.group,
      description: definition.description,
      status: evaluation.status,
      request: definition.request,
      runResult,
      notes: evaluation.notes,
    });
  }

  return {
    contractCoverage: getSandboxContractCoverage(),
    cases: results,
  };
};
