import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import {
  getSandboxContractCoverage,
  evaluateSandboxL1WorkspaceRunnerStatus,
  getSandboxL1WorkspaceRunnerStatus,
  getSandboxProfileCoverage,
  runSandboxCommandDirect,
} from "./index.js";

const workspaceRoot = process.cwd();
const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

const buildCommand = (kind: "echo" | "sleep" | "huge" | "unicode" | "exit" | "env") => {
  if (process.platform === "win32") {
    if (kind === "echo") {
      return "Write-Output 'hello'";
    }
    if (kind === "sleep") {
      return "Start-Sleep -Seconds 2";
    }
    if (kind === "unicode") {
      return "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output '中文输出'";
    }
    if (kind === "exit") {
      return "exit 7";
    }
    if (kind === "env") {
      return "if ($env:RAG_DEMO_UNLISTED_SECRET) { Write-Output $env:RAG_DEMO_UNLISTED_SECRET } else { Write-Output 'missing' }";
    }
    return "1..9000 | ForEach-Object { '0123456789' }";
  }

  if (kind === "echo") {
    return "printf 'hello\\n'";
  }
  if (kind === "sleep") {
    return "sleep 2";
  }
  if (kind === "unicode") {
    return "printf '中文输出\\n'";
  }
  if (kind === "exit") {
    return "exit 7";
  }
  if (kind === "env") {
    return "printf '%s\\n' \"${RAG_DEMO_UNLISTED_SECRET:-missing}\"";
  }
  return "yes 0123456789 | head -n 9000";
};

describe("sandbox direct contract", () => {
  it("declares command profile available only when all L1 workspace runner checks pass", () => {
    expect(getSandboxL1WorkspaceRunnerStatus()).toMatchObject({
      available: true,
      missingRequirements: [],
      requirements: {
        workspace_cwd_lock: true,
        empty_cwd_defaults_workspace_root: true,
        cwd_escape_blocked: true,
        env_allowlist: true,
        timeout_hard_cap: true,
        output_limit_truncation: true,
        complete_result_contract: true,
        windows_kill_tree_limitation_marked: true,
      },
    });

    expect(
      evaluateSandboxL1WorkspaceRunnerStatus({
        workspace_cwd_lock: true,
        empty_cwd_defaults_workspace_root: true,
        cwd_escape_blocked: true,
        env_allowlist: true,
        timeout_hard_cap: true,
        output_limit_truncation: false,
        complete_result_contract: true,
        windows_kill_tree_limitation_marked: true,
      }),
    ).toMatchObject({
      available: false,
      missingRequirements: ["output_limit_truncation"],
    });
  });

  it("reports unsupported profiles as not implemented coverage", () => {
    expect(getSandboxProfileCoverage()).toEqual({
      read_only: "not_implemented",
      workspace_write: "not_implemented",
      command: "implemented",
      networked_command: "not_implemented",
    });
  });

  it("separates V1.6 gate coverage from future profile declarations", () => {
    expect(getSandboxContractCoverage()).toEqual({
      declaredProfiles: {
        read_only: "future_profile",
        workspace_write: "future_profile",
        command: "implemented",
        networked_command: "future_profile",
      },
      v16GateProfiles: {
        command: "implemented",
      },
      futureProfiles: {
        read_only: "future_profile",
        workspace_write: "future_profile",
        networked_command: "future_profile",
      },
      v16GateSatisfied: true,
    });
  });

  it("runs a direct command successfully", async () => {
    const result = await runSandboxCommandDirect({
      profile: "command",
      workspaceRoot,
      cwd: ".",
      command: buildCommand("echo"),
      timeoutMs: 5_000,
    });

    expect(result.status).toBe("completed");
    expect(result.stdoutText).toContain("hello");
    expect(result.artifacts).toHaveLength(0);
    expect(Object.keys(result).sort()).toEqual(
      [
        "artifacts",
        "binaryDetected",
        "durationMs",
        "exitCode",
        "stderrEncoding",
        "stderrText",
        "status",
        "stdoutEncoding",
        "stdoutText",
        "truncated",
        "violations",
      ].sort(),
    );
  });

  it("runs a direct command in a child workspace directory", async () => {
    const result = await runSandboxCommandDirect({
      profile: "command",
      workspaceRoot,
      cwd: "src",
      command: buildCommand("echo"),
      timeoutMs: 5_000,
    });

    expect(result.status).toBe("completed");
    expect(result.stdoutText).toContain("hello");
  });

  it("defaults empty cwd to workspace root", async () => {
    const result = await runSandboxCommandDirect({
      profile: "command",
      workspaceRoot,
      cwd: "",
      command: buildCommand("echo"),
      timeoutMs: 5_000,
    });

    expect(result.status).toBe("completed");
    expect(result.artifacts).toHaveLength(0);
  });

  it("blocks cwd escape attempts", async () => {
    const result = await runSandboxCommandDirect({
      profile: "command",
      workspaceRoot,
      cwd: "..",
      command: buildCommand("echo"),
      timeoutMs: 1_000,
    });

    expect(result.status).toBe("blocked");
    expect(result.violations.join(" ")).toContain(
      "cwd must be a relative workspace directory without parent traversal",
    );
  });

  it("blocks absolute cwd attempts", async () => {
    const result = await runSandboxCommandDirect({
      profile: "command",
      workspaceRoot,
      cwd: "C:\\",
      command: buildCommand("echo"),
      timeoutMs: 1_000,
    });

    expect(result.status).toBe("blocked");
    expect(result.violations.join(" ")).toContain(
      "cwd must be a relative workspace directory without parent traversal",
    );
  });

  it("does not pass env values outside the allowlist", async () => {
    const result = await runSandboxCommandDirect({
      profile: "command",
      workspaceRoot,
      command: buildCommand("env"),
      env: {
        RAG_DEMO_UNLISTED_SECRET: "leaked",
      },
      timeoutMs: 5_000,
    });

    expect(result.status).toBe("completed");
    expect(result.stdoutText).toContain("missing");
    expect(result.stdoutText).not.toContain("leaked");
  });

  it("returns timed_out for short timeout", async () => {
    const result = await runSandboxCommandDirect({
      profile: "command",
      workspaceRoot,
      command: buildCommand("sleep"),
      timeoutMs: 100,
    });

    expect(result.status).toBe("timed_out");
    expect(result.violations.join(" ")).toContain("terminal execution timed out");
    if (process.platform === "win32") {
      expect(result.violations.join(" ")).toContain("windows_kill_tree_best_effort");
    }
    expect(result.status).not.toBe("completed");
  });

  it("preserves unicode output", async () => {
    const result = await runSandboxCommandDirect({
      profile: "command",
      workspaceRoot,
      command: buildCommand("unicode"),
      timeoutMs: 5_000,
    });

    expect(result.status).toBe("completed");
    expect(result.stdoutText).toContain("中文输出");
    if (process.platform === "win32") {
      expect(["utf8", "utf16le"]).toContain(result.stdoutEncoding);
    } else {
      expect(result.stdoutEncoding).toBe("utf8");
    }
  });

  it("does not report non-zero exit code as success", async () => {
    const result = await runSandboxCommandDirect({
      profile: "command",
      workspaceRoot,
      command: buildCommand("exit"),
      timeoutMs: 5_000,
    });

    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(7);
  });

  it("marks future profiles without pretending they are part of the V1.6 gate", async () => {
    const result = await runSandboxCommandDirect({
      profile: "read_only",
      workspaceRoot,
      command: buildCommand("echo"),
      timeoutMs: 1_000,
    });

    expect(result.status).toBe("blocked");
    expect(result.violations[0]).toContain("future_profile");
  });

  it("reports output limit failures as truncated", async () => {
    const result = await runSandboxCommandDirect({
      profile: "command",
      workspaceRoot,
      command: buildCommand("huge"),
      timeoutMs: 2_000,
      outputLimitBytes: 256,
    });

    expect(result.status).toBe("failed");
    expect(result.truncated).toBe(true);
    expect(result.violations.join(" ")).toContain("terminal output exceeded limit");
  });

  it("registers workspace artifacts generated by the command", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mira-sandbox-artifact-"));
    tempDirs.push(tempRoot);
    const artifactRoot = path.join(tempRoot, "workspace");
    await mkdir(artifactRoot, { recursive: true });
    const artifactRelativePath = "sandbox-output.txt";
    const command =
      process.platform === "win32"
        ? `Set-Content -Path '${artifactRelativePath}' -Value 'artifact output'`
        : `printf 'artifact output\\n' > '${artifactRelativePath}'`;

    const result = await runSandboxCommandDirect({
      profile: "command",
      workspaceRoot: artifactRoot,
      command,
      timeoutMs: 5_000,
      artifactRegistrations: [{ path: artifactRelativePath }],
    });

    expect(result.status).toBe("completed");
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]).toMatchObject({
      kind: "file",
      path: path.join(artifactRoot, artifactRelativePath),
      mime: "text/plain",
    });
  });
});
