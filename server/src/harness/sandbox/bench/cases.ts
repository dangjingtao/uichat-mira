import path from "node:path";
import type {
  SandboxBenchCaseResult,
  SandboxBenchCaseStatus,
  SandboxRunRequest,
  SandboxRunResult,
} from "../contract.js";
import { getSandboxProfileCoverage, runSandboxCommandDirect } from "../index.js";

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

const buildCommandSet = () => {
  if (process.platform === "win32") {
    return {
      echoHello: "Write-Output 'hello'",
      unicode:
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output '中文输出'",
      exitCode: "exit 7",
      timeout: "Start-Sleep -Seconds 2",
      hugeOutput: "1..9000 | ForEach-Object { '0123456789' }",
    };
  }

  return {
    echoHello: "printf 'hello\\n'",
    unicode: "printf '中文输出\\n'",
    exitCode: "exit 7",
    timeout: "sleep 2",
    hugeOutput: "yes 0123456789 | head -n 9000",
  };
};

const commandSet = buildCommandSet();

const createNotes = (passed: boolean, successNote: string, failureNote: string) =>
  passed ? [successNote] : [failureNote];

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
  {
    id: "coverage-read-only-profile",
    group: "coverage",
    description: "unsupported profile should be reported as not_implemented",
    request: {
      profile: "read_only",
      workspaceRoot,
      command: commandSet.echoHello,
      timeoutMs: 1_000,
    },
    evaluate: (result) => {
      const passed = result.violations.some((item) => item.startsWith("not_implemented:"));
      return {
        status: passed ? "not_implemented" : "failed",
        notes: createNotes(
          passed,
          "read_only profile 当前未落地，bench 已明确标成 not_implemented",
          `期望 not_implemented，实际 status=${result.status} violations=${JSON.stringify(result.violations)}`,
        ),
      };
    },
  },
];

export const runSandboxDirectBenchCases = async (
  workspaceRoot: string,
): Promise<{
  contractCoverage: ReturnType<typeof getSandboxProfileCoverage>;
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
    contractCoverage: getSandboxProfileCoverage(),
    cases: results,
  };
};
