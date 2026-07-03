import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSandboxedCommand } from "./executor.js";
import { clearWorkspaceSelection } from "@/mcp/workspace.js";

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
        shellProfile: {
          shell: "powershell.exe",
          argsMode: "powershell",
          stdoutEncoding: "utf8",
          stderrEncoding: "utf8",
        },
      }),
    ).rejects.toThrow("path must stay inside workspace root");
  });

  it("limits output size", async () => {
    const child = createMockSpawnProcess();
    sandboxMocks.spawnMock.mockReturnValue(child);

    const promise = executeSandboxedCommand({
      command: "pwd",
      timeoutMs: 500,
      outputLimitBytes: 4,
      signal: new AbortController().signal,
      shellProfile: {
        shell: "powershell.exe",
        argsMode: "powershell",
        stdoutEncoding: "utf8",
        stderrEncoding: "utf8",
      },
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
        shellProfile: {
          shell: "powershell.exe",
          argsMode: "powershell",
          stdoutEncoding: "utf8",
          stderrEncoding: "utf8",
        },
      }),
    ).rejects.toThrow("inline Node execution is blocked by sandbox policy");
  });

  it("blocks git config --global", async () => {
    await expect(
      executeSandboxedCommand({
        command: "git config --global user.name test",
        timeoutMs: 500,
        signal: new AbortController().signal,
        shellProfile: {
          shell: "powershell.exe",
          argsMode: "powershell",
          stdoutEncoding: "utf8",
          stderrEncoding: "utf8",
        },
      }),
    ).rejects.toThrow("git config outside local workspace scope is blocked by sandbox policy");
  });

  it("blocks inline Python execution", async () => {
    await expect(
      executeSandboxedCommand({
        command: "python -c \"print('hi')\"",
        timeoutMs: 500,
        signal: new AbortController().signal,
        shellProfile: {
          shell: "powershell.exe",
          argsMode: "powershell",
          stdoutEncoding: "utf8",
          stderrEncoding: "utf8",
        },
      }),
    ).rejects.toThrow("inline or module Python execution is blocked by sandbox policy");
  });

  it("blocks npm exec", async () => {
    await expect(
      executeSandboxedCommand({
        command: "npm exec prettier --version",
        timeoutMs: 500,
        signal: new AbortController().signal,
        shellProfile: {
          shell: "powershell.exe",
          argsMode: "powershell",
          stdoutEncoding: "utf8",
          stderrEncoding: "utf8",
        },
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
        shellProfile: {
          shell: "powershell.exe",
          argsMode: "powershell",
          stdoutEncoding: "utf8",
          stderrEncoding: "utf8",
        },
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
      shellProfile: {
        shell: "powershell.exe",
        argsMode: "powershell",
        stdoutEncoding: "utf8",
        stderrEncoding: "utf8",
      },
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
      shellProfile: {
        shell: "powershell.exe",
        argsMode: "powershell",
        stdoutEncoding: "utf8",
        stderrEncoding: "utf8",
      },
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
      shellProfile: {
        shell: "powershell.exe",
        argsMode: "powershell",
        stdoutEncoding: "utf8",
        stderrEncoding: "utf8",
      },
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
});
