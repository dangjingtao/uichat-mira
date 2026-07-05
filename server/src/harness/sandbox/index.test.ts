import { describe, expect, it } from "vitest";
import { getSandboxProfileCoverage, runSandboxCommandDirect } from "./index.js";

const workspaceRoot = process.cwd();

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
  it("reports unsupported profiles as not implemented coverage", () => {
    expect(getSandboxProfileCoverage()).toEqual({
      read_only: "not_implemented",
      workspace_write: "not_implemented",
      command: "implemented",
      networked_command: "not_implemented",
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
    expect(result.artifacts).toHaveLength(1);
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
    expect(result.artifacts[0]?.metadata).toMatchObject({
      cwd: workspaceRoot,
    });
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

  it("marks unsupported profiles without pretending success", async () => {
    const result = await runSandboxCommandDirect({
      profile: "read_only",
      workspaceRoot,
      command: buildCommand("echo"),
      timeoutMs: 1_000,
    });

    expect(result.status).toBe("blocked");
    expect(result.violations[0]).toContain("not_implemented");
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
});
