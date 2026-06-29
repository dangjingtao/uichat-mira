import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { McpExecutionEnvironment } from "@/mcp/core/definitions.js";
import { mcpBadRequest, mcpInternalError } from "@/mcp/core/errors.js";
import { decodeTerminalOutput } from "@/mcp/terminal/encoding.js";
import { getWorkspaceRoot, resolveWorkspacePath } from "@/mcp/workspace.js";
import { assertSandboxCommandPolicy } from "./policy.js";

export interface SandboxShellProfile {
  shell: string;
  argsMode: "powershell" | "cmd" | "posix";
  stdoutEncoding: string;
  stderrEncoding: string;
}

export interface SandboxExecutionInput {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
  outputLimitBytes?: number;
  signal: AbortSignal;
  shellProfile: SandboxShellProfile;
  pushStdout?: (chunk: string) => void;
  pushStderr?: (chunk: string) => void;
}

export interface SandboxExecutionResult {
  cwd: string;
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  output: string;
}

const DEFAULT_OUTPUT_LIMIT_BYTES = 1024 * 1024;

const SAFE_ENV_ALLOWLIST = [
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "WINDIR",
  "ComSpec",
  "TEMP",
  "TMP",
  "HOME",
  "USERPROFILE",
  "LANG",
  "TERM",
] as const;

const toCombinedOutput = (stdout: string, stderr: string) =>
  [stdout, stderr].filter(Boolean).join("\n").trimEnd();

const buildShellArgs = (profile: SandboxShellProfile, command: string) => {
  if (profile.argsMode === "powershell") {
    return ["-NoProfile", "-Command", command];
  }

  if (profile.argsMode === "cmd") {
    return ["/d", "/s", "/c", command];
  }

  return ["-lc", command];
};

const getWorkspaceRealRoot = () => {
  const workspaceRoot = getWorkspaceRoot();
  try {
    return fs.realpathSync.native(workspaceRoot);
  } catch {
    return path.resolve(workspaceRoot);
  }
};

const assertPathInsideWorkspace = (targetPath: string) => {
  const workspaceRoot = getWorkspaceRealRoot();
  const normalizedTarget = (() => {
    try {
      return fs.realpathSync.native(targetPath);
    } catch {
      return path.resolve(targetPath);
    }
  })();

  const relative = path.relative(workspaceRoot, normalizedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw mcpBadRequest("path must stay inside workspace root");
  }

  return normalizedTarget;
};

const resolveSandboxCwd = (cwd?: string) => {
  const resolved = cwd ? resolveWorkspacePath(cwd) : resolveWorkspacePath(".");
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw mcpBadRequest(`cwd must be an existing workspace directory: ${cwd ?? "."}`);
  }

  return assertPathInsideWorkspace(resolved);
};

const resolveSandboxEnv = (overrides?: Record<string, string>) => {
  const base = Object.fromEntries(
    SAFE_ENV_ALLOWLIST.flatMap((key) =>
      typeof process.env[key] === "string" ? [[key, process.env[key] as string]] : [],
    ),
  );

  return {
    ...base,
    ...(overrides ?? {}),
  };
};

const killProcessTree = async (pid: number | undefined) => {
  if (!pid) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
        windowsHide: true,
        stdio: "ignore",
      });
      killer.once("error", () => resolve());
      killer.once("close", () => resolve());
    });
    return;
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // ignore
  }
};

const bestEffortKillChild = (child: ReturnType<typeof spawn>) => {
  try {
    child.kill();
  } catch {
    // ignore
  }
};

export const executeSandboxedCommand = async (
  input: SandboxExecutionInput,
): Promise<SandboxExecutionResult> => {
  if (input.signal.aborted) {
    throw new Error("Terminal session aborted");
  }

  assertSandboxCommandPolicy(input.command);
  const cwd = resolveSandboxCwd(input.cwd);
  const env = resolveSandboxEnv(input.env);
  const outputLimitBytes = input.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT_BYTES;

  const child = spawn(
    input.shellProfile.shell,
    buildShellArgs(input.shellProfile, input.command),
    {
      cwd,
      env,
      windowsHide: true,
      shell: false,
    },
  );

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let exitCode: number | null = null;
  let timedOut = false;
  let settled = false;
  let failExecution: ((error: Error) => void) | null = null;

  const appendChunk = (target: string[], chunk: string, stream: "stdout" | "stderr") => {
    const nextBytes = Buffer.byteLength(chunk, "utf-8");
    if (stream === "stdout") {
      stdoutBytes += nextBytes;
    } else {
      stderrBytes += nextBytes;
    }

    if (stdoutBytes + stderrBytes > outputLimitBytes) {
      failExecution?.(
        mcpBadRequest(`terminal output exceeded limit of ${outputLimitBytes} bytes`),
      );
      bestEffortKillChild(child);
      void killProcessTree(child.pid);
      return;
    }

    target.push(chunk);
  };

  await new Promise<void>((resolve, reject) => {
    const finishResolve = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    const finishReject = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };
    failExecution = finishReject;

    const timer = setTimeout(() => {
      timedOut = true;
      bestEffortKillChild(child);
      void killProcessTree(child.pid);
      finishResolve();
    }, input.timeoutMs);

    child.stdout?.on("data", (chunk: Buffer | string) => {
      try {
        const text = decodeTerminalOutput({
          chunk,
          encoding: input.shellProfile.stdoutEncoding,
        });
        appendChunk(stdoutChunks, text, "stdout");
        input.pushStdout?.(text);
      } catch (error) {
        clearTimeout(timer);
        finishReject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    child.stderr?.on("data", (chunk: Buffer | string) => {
      try {
        const text = decodeTerminalOutput({
          chunk,
          encoding: input.shellProfile.stderrEncoding,
        });
        appendChunk(stderrChunks, text, "stderr");
        input.pushStderr?.(text);
      } catch (error) {
        clearTimeout(timer);
        finishReject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    child.once("error", (error) => {
      clearTimeout(timer);
      finishReject(error instanceof Error ? error : new Error(String(error)));
    });

    child.once("close", (code) => {
      clearTimeout(timer);
      if (settled) {
        return;
      }
      exitCode = code;
      finishResolve();
    });

    if (input.signal.aborted) {
      clearTimeout(timer);
      finishReject(new Error("Terminal session aborted"));
      bestEffortKillChild(child);
      void killProcessTree(child.pid);
      return;
    }

    input.signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        finishReject(new Error("Terminal session aborted"));
        bestEffortKillChild(child);
        void killProcessTree(child.pid);
      },
      { once: true },
    );
  }).catch((error) => {
    throw error instanceof Error ? error : mcpInternalError(String(error));
  });

  const stdout = stdoutChunks.join("").trimEnd();
  const stderr = stderrChunks.join("").trimEnd();

  return {
    cwd,
    exitCode,
    timedOut,
    stdout,
    stderr,
    output: toCombinedOutput(stdout, stderr),
  };
};

export const createSandboxShellProfile = (
  environment: McpExecutionEnvironment["terminal"]["shellProfile"],
): SandboxShellProfile => ({
  shell: environment.shell,
  argsMode: environment.argsMode,
  stdoutEncoding: environment.stdoutEncoding,
  stderrEncoding: environment.stderrEncoding,
});
