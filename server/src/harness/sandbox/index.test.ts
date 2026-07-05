import { describe, expect, it } from "vitest";
import { getSandboxProfileCoverage, runSandboxCommandDirect } from "./index.js";

const workspaceRoot = process.cwd();

const buildCommand = (kind: "echo" | "sleep" | "huge") => {
  if (process.platform === "win32") {
    if (kind === "echo") {
      return "Write-Output 'hello'";
    }
    if (kind === "sleep") {
      return "Start-Sleep -Seconds 2";
    }
    return "1..9000 | ForEach-Object { '0123456789' }";
  }

  if (kind === "echo") {
    return "printf 'hello\\n'";
  }
  if (kind === "sleep") {
    return "sleep 2";
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
      command: buildCommand("echo"),
      timeoutMs: 5_000,
    });

    expect(result.status).toBe("completed");
    expect(result.stdoutText).toContain("hello");
    expect(result.artifacts).toHaveLength(1);
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
    expect(result.violations.join(" ")).toContain("path must stay inside workspace root");
  });

  it("returns timed_out for short timeout", async () => {
    const result = await runSandboxCommandDirect({
      profile: "command",
      workspaceRoot,
      command: buildCommand("sleep"),
      timeoutMs: 100,
    });

    expect(result.status).toBe("timed_out");
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
