import { EventEmitter } from "node:events";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSandboxedCommand } from "./executor.js";
import { clearWorkspaceSelection } from "@/mcp/workspace.js";

const shellProfile = {
  shell: "powershell.exe",
  argsMode: "powershell" as const,
  stdoutEncoding: "utf8",
  stderrEncoding: "utf8",
};

const sandboxMocks = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: sandboxMocks.spawnMock,
  };
});

const createMockSpawnProcess = () => {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    pid: number;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = stdout;
  child.stderr = stderr;
  child.pid = 1234;
  child.kill = vi.fn(() => {
    child.emit("close", null);
  });
  return child;
};

describe("SandboxExecutor", () => {
  beforeEach(() => {
    process.env.UI_CHAT_WORKSPACE_ROOT = process.cwd();
    clearWorkspaceSelection();
    sandboxMocks.spawnMock.mockReset();
  });

  afterEach(() => {
    delete process.env.UI_CHAT_WORKSPACE_ROOT;
    clearWorkspaceSelection();
    vi.restoreAllMocks();
  });

  it("rejects cwd outside workspace root", async () => {
    await expect(
      executeSandboxedCommand({
        command: "pwd",
        cwd: "..\\..\\outside",
        timeoutMs: 500,
        signal: new AbortController().signal,
        shellProfile,
      }),
    ).rejects.toThrow("cwd must be a relative workspace directory without parent traversal");
  });

  it("limits output size", async () => {
    const child = createMockSpawnProcess();
    sandboxMocks.spawnMock.mockReturnValue(child);

    const promise = executeSandboxedCommand({
      command: "pwd",
      timeoutMs: 500,
      outputLimitBytes: 4,
      signal: new AbortController().signal,
      shellProfile,
    });

    child.stdout.emit("data", "12345");

    await expect(promise).rejects.toThrow("terminal output exceeded limit");
  });

  it("blocks inline node execution", async () => {
    await expect(
      executeSandboxedCommand({
        command: "node -e \"console.log('hi')\"",
        timeoutMs: 500,
        signal: new AbortController().signal,
        shellProfile,
      }),
    ).rejects.toThrow("inline Node execution is blocked by sandbox policy");
  });

  it("blocks git config --global", async () => {
    await expect(
      executeSandboxedCommand({
        command: "git config --global user.name test",
        timeoutMs: 500,
        signal: new AbortController().signal,
        shellProfile,
      }),
    ).rejects.toThrow("git config outside local workspace scope is blocked by sandbox policy");
  });

  it("blocks inline Python execution", async () => {
    await expect(
      executeSandboxedCommand({
        command: "python -c \"print('hi')\"",
        timeoutMs: 500,
        signal: new AbortController().signal,
        shellProfile,
      }),
    ).rejects.toThrow("inline or module Python execution is blocked by sandbox policy");
  });

  it("blocks npm exec", async () => {
    await expect(
      executeSandboxedCommand({
        command: "npm exec prettier --version",
        timeoutMs: 500,
        signal: new AbortController().signal,
        shellProfile,
      }),
    ).rejects.toThrow("npm exec is blocked by sandbox policy");
  });

  it("rejects cwd that is not an existing directory", async () => {
    await expect(
      executeSandboxedCommand({
        command: "pwd",
        cwd: "this-path-should-not-exist",
        timeoutMs: 500,
        signal: new AbortController().signal,
        shellProfile,
      }),
    ).rejects.toThrow("cwd must be an existing workspace directory");
  });

  it("aborts and rejects active executions", async () => {
    const child = createMockSpawnProcess();
    sandboxMocks.spawnMock.mockReturnValue(child);

    const controller = new AbortController();
    const promise = executeSandboxedCommand({
      command: "node script.js",
      timeoutMs: 500,
      signal: controller.signal,
      shellProfile,
    });

    await Promise.resolve();
    controller.abort();

    await expect(promise).rejects.toThrow("Terminal session aborted");
    expect(child.kill).toHaveBeenCalled();
  });

  it("returns timedOut=true when execution exceeds timeout", async () => {
    vi.useFakeTimers();
    const child = createMockSpawnProcess();
    sandboxMocks.spawnMock.mockReturnValue(child);

    const promise = executeSandboxedCommand({
      command: "node script.js",
      timeoutMs: 100,
      signal: new AbortController().signal,
      shellProfile,
    });

    await vi.advanceTimersByTimeAsync(120);
    const result = await promise;

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
    expect(child.kill).toHaveBeenCalled();
  });

  it("allows workspace-scoped node script execution", async () => {
    const child = createMockSpawnProcess();
    sandboxMocks.spawnMock.mockReturnValue(child);

    const promise = executeSandboxedCommand({
      command: "node script.js",
      timeoutMs: 500,
      signal: new AbortController().signal,
      shellProfile,
    });

    child.stdout.emit("data", "ok\n");
    child.emit("close", 0);

    const result = await promise;
    expect(result.stdout).toBe("ok");
    expect(sandboxMocks.spawnMock).toHaveBeenCalledWith(
      expect.stringContaining("powershell.exe"),
      ["-NoProfile", "-Command", "node script.js"],
      expect.objectContaining({
        shell: false,
        windowsHide: true,
      }),
    );
  });

  it("allows dot cwd and defaults empty cwd to workspace root", async () => {
    const child = createMockSpawnProcess();
    sandboxMocks.spawnMock.mockReturnValue(child);

    const promise = executeSandboxedCommand({
      command: "pwd",
      cwd: "",
      timeoutMs: 500,
      signal: new AbortController().signal,
      shellProfile,
    });

    child.emit("close", 0);
    const result = await promise;

    expect(result.cwd).toBe(process.cwd());
    expect(sandboxMocks.spawnMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        cwd: process.cwd(),
      }),
    );
  });

  it("allows child directory cwd inside workspace", async () => {
    const child = createMockSpawnProcess();
    sandboxMocks.spawnMock.mockReturnValue(child);

    const promise = executeSandboxedCommand({
      command: "pwd",
      cwd: "src",
      timeoutMs: 500,
      signal: new AbortController().signal,
      shellProfile,
    });

    child.emit("close", 0);
    const result = await promise;

    expect(result.cwd).toBe(path.join(process.cwd(), "src"));
  });

  it("rejects absolute cwd input before execution", async () => {
    await expect(
      executeSandboxedCommand({
        command: "pwd",
        cwd: process.platform === "win32" ? "C:\\" : "/tmp",
        timeoutMs: 500,
        signal: new AbortController().signal,
        shellProfile,
      }),
    ).rejects.toThrow("cwd must be a relative workspace directory without parent traversal");
    expect(sandboxMocks.spawnMock).not.toHaveBeenCalled();
  });

  it("filters env overrides to the sandbox allowlist", async () => {
    const child = createMockSpawnProcess();
    sandboxMocks.spawnMock.mockReturnValue(child);

    const promise = executeSandboxedCommand({
      command: "pwd",
      env: {
        PATH: "sandbox-path",
        RAG_DEMO_UNLISTED_SECRET: "should-not-pass",
      },
      timeoutMs: 500,
      signal: new AbortController().signal,
      shellProfile,
    });

    child.emit("close", 0);
    await promise;

    const spawnOptions = sandboxMocks.spawnMock.mock.calls[0]?.[2] as {
      env?: Record<string, string>;
    };
    expect(spawnOptions.env?.PATH).toBe("sandbox-path");
    expect(spawnOptions.env).not.toHaveProperty("RAG_DEMO_UNLISTED_SECRET");
  });

  it("caps timeoutMs at the sandbox hard maximum", async () => {
    vi.useFakeTimers();
    const child = createMockSpawnProcess();
    sandboxMocks.spawnMock.mockReturnValue(child);

    const promise = executeSandboxedCommand({
      command: "node script.js",
      timeoutMs: 600_000,
      signal: new AbortController().signal,
      shellProfile,
    });

    await vi.advanceTimersByTimeAsync(60_001);
    const result = await promise;

    expect(result.timedOut).toBe(true);
    expect(result.violations).toContain("terminal execution timed out after 60000ms");
  });
});
