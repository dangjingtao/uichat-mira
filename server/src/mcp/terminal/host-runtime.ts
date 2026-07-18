import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

import { mcpBadRequest, mcpInternalError } from "../core/errors.js";
import type { McpExecutionEnvironment } from "../core/definitions.js";
import { decodeTerminalOutput } from "./encoding.js";
import type { SandboxOutputEncoding } from "@/harness/sandbox/contract.js";

export type TerminalRuntimeId = "host_spawn" | "sandbox_runtime";
export type TerminalProcessTreeMode =
  | "windows_job_object"
  | "windows_taskkill_tree"
  | "posix_process_group"
  | "child_process";

export type HostWorkspaceRelation = "inside" | "outside" | "unresolved";

export interface HostShellProfile {
  shell: string;
  shellFamily: "powershell" | "cmd" | "posix";
  argsMode: "powershell" | "cmd" | "posix";
  stdoutEncoding: string;
  stderrEncoding: string;
}

export interface HostExecutionInput {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
  outputLimitBytes?: number;
  signal: AbortSignal;
  shellProfile: HostShellProfile;
  workspaceRoot?: string | null;
  pushStdout?: (chunk: string) => void;
  pushStderr?: (chunk: string) => void;
}

export interface HostExecutionResult {
  runtimeId: "host_spawn";
  cwd: string;
  workspaceRelation: HostWorkspaceRelation;
  processTreeMode: TerminalProcessTreeMode;
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  stdoutEncoding: SandboxOutputEncoding;
  stderrEncoding: SandboxOutputEncoding;
  output: string;
  truncated: boolean;
  binaryDetected: boolean;
  violations: string[];
}

const DEFAULT_OUTPUT_LIMIT_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;
const WINDOWS_JOB_MARKER = "__MIRA_WINDOWS_JOB_OBJECT__";
const BINARY_PLACEHOLDER_TEXT = "[binary output omitted]";

const normalizeReportedEncoding = (encoding: string): SandboxOutputEncoding => {
  const normalized = encoding.trim().toLowerCase();
  if (normalized === "utf8" || normalized === "utf-8") return "utf8";
  if (["gbk", "gb2312", "gb18030", "cp936"].includes(normalized)) return "gbk";
  if (normalized === "utf16le" || normalized === "utf-16le") return "utf16le";
  return "unknown";
};

const looksLikeUtf16Le = (chunk: Buffer) => {
  if (chunk.length < 2 || chunk.length % 2 !== 0) return false;
  if (chunk[0] === 0xff && chunk[1] === 0xfe) return true;
  let zeroBytesOnOddPositions = 0;
  for (let index = 1; index < chunk.length; index += 2) {
    if (chunk[index] === 0x00) zeroBytesOnOddPositions += 1;
  }
  return zeroBytesOnOddPositions / Math.ceil(chunk.length / 2) > 0.3;
};

const hasBinarySignature = (chunk: Buffer | string, encoding: string) => {
  if (typeof chunk === "string") return false;
  const reportedEncoding = normalizeReportedEncoding(encoding);
  if (chunk.includes(0)) {
    return !(reportedEncoding === "utf16le" && looksLikeUtf16Le(chunk));
  }
  if (chunk.length < 24) return false;
  let suspiciousBytes = 0;
  for (const byte of chunk) {
    const isAllowedControl = byte === 0x09 || byte === 0x0a || byte === 0x0d;
    const isPrintableAscii = byte >= 0x20 && byte <= 0x7e;
    const isExtendedByte = byte >= 0x80;
    if (!isAllowedControl && !isPrintableAscii && !isExtendedByte) suspiciousBytes += 1;
  }
  return suspiciousBytes / chunk.length > 0.3;
};

const decodeChunk = (
  chunk: Buffer | string,
  encoding: string,
): { text: string; encoding: SandboxOutputEncoding; failed: boolean } => {
  if (typeof chunk === "string") {
    return { text: chunk, encoding: normalizeReportedEncoding(encoding), failed: false };
  }
  const reportedEncoding = normalizeReportedEncoding(encoding);
  try {
    if (reportedEncoding === "utf16le" && !looksLikeUtf16Le(chunk)) {
      return { text: chunk.toString("utf8"), encoding: "utf8", failed: false };
    }
    return {
      text: decodeTerminalOutput({ chunk, encoding }),
      encoding: reportedEncoding,
      failed: false,
    };
  } catch {
    return { text: "", encoding: "unknown", failed: true };
  }
};

const normalizeOutputLimitBytes = (value?: number) => {
  const normalized = value ?? DEFAULT_OUTPUT_LIMIT_BYTES;
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw mcpBadRequest("outputLimitBytes must be a positive finite number");
  }
  return Math.min(Math.trunc(normalized), MAX_OUTPUT_LIMIT_BYTES);
};

const normalizeComparablePath = (value: string) => {
  const resolved = path.resolve(value).replace(/[\\/]+$/, "");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

export const resolveHostCwd = (input: {
  cwd?: string;
  workspaceRoot?: string | null;
}) => {
  const workspaceRoot = input.workspaceRoot?.trim()
    ? path.resolve(input.workspaceRoot.trim())
    : null;
  const requested = input.cwd?.trim();
  const resolved = requested
    ? path.isAbsolute(requested) || path.win32.isAbsolute(requested) || path.posix.isAbsolute(requested)
      ? path.resolve(requested)
      : path.resolve(workspaceRoot ?? process.cwd(), requested)
    : workspaceRoot ?? process.cwd();

  let stats;
  try {
    stats = statSync(resolved);
  } catch {
    throw mcpBadRequest(`terminal cwd does not exist: ${resolved}`);
  }
  if (!stats.isDirectory()) {
    throw mcpBadRequest(`terminal cwd is not a directory: ${resolved}`);
  }

  if (!workspaceRoot) {
    return { cwd: resolved, workspaceRelation: "unresolved" as const };
  }

  const relative = path.relative(
    normalizeComparablePath(workspaceRoot),
    normalizeComparablePath(resolved),
  );
  const outside = relative.startsWith("..") || path.isAbsolute(relative);
  return {
    cwd: resolved,
    workspaceRelation: outside ? "outside" as const : "inside" as const,
  };
};

export const resolveHostEnv = (overrides?: Record<string, string>) =>
  Object.fromEntries(
    Object.entries({ ...process.env, ...(overrides ?? {}) }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

const buildNormalShellArgs = (profile: HostShellProfile, command: string) => {
  if (profile.argsMode === "powershell") return ["-NoProfile", "-Command", command];
  if (profile.argsMode === "cmd") return ["/d", "/s", "/c", command];
  return ["-lc", command];
};

const WINDOWS_JOB_BOOTSTRAP = String.raw`
$ErrorActionPreference = 'Stop'
$jobAssigned = $false
try {
  if (-not ('Mira.Terminal.NativeJob' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
namespace Mira.Terminal {
  [StructLayout(LayoutKind.Sequential)]
  public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
    public long PerProcessUserTimeLimit;
    public long PerJobUserTimeLimit;
    public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize;
    public UIntPtr MaximumWorkingSetSize;
    public uint ActiveProcessLimit;
    public UIntPtr Affinity;
    public uint PriorityClass;
    public uint SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct IO_COUNTERS {
    public ulong ReadOperationCount;
    public ulong WriteOperationCount;
    public ulong OtherOperationCount;
    public ulong ReadTransferCount;
    public ulong WriteTransferCount;
    public ulong OtherTransferCount;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
    public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
    public IO_COUNTERS IoInfo;
    public UIntPtr ProcessMemoryLimit;
    public UIntPtr JobMemoryLimit;
    public UIntPtr PeakProcessMemoryUsed;
    public UIntPtr PeakJobMemoryUsed;
  }
  public static class NativeJob {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll")]
    public static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);
    [DllImport("kernel32.dll")]
    public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr handle);
  }
}
'@
  }
  $job = [Mira.Terminal.NativeJob]::CreateJobObject([IntPtr]::Zero, $null)
  if ($job -ne [IntPtr]::Zero) {
    $info = New-Object Mira.Terminal.JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    $info.BasicLimitInformation.LimitFlags = 0x00002000
    $length = [Runtime.InteropServices.Marshal]::SizeOf([type][Mira.Terminal.JOBOBJECT_EXTENDED_LIMIT_INFORMATION])
    $pointer = [Runtime.InteropServices.Marshal]::AllocHGlobal($length)
    try {
      [Runtime.InteropServices.Marshal]::StructureToPtr($info, $pointer, $false)
      $limited = [Mira.Terminal.NativeJob]::SetInformationJobObject($job, 9, $pointer, [uint32]$length)
      $assigned = $limited -and [Mira.Terminal.NativeJob]::AssignProcessToJobObject(
        $job,
        [Diagnostics.Process]::GetCurrentProcess().Handle
      )
      if ($assigned) {
        $global:MiraTerminalJobHandle = $job
        $jobAssigned = $true
      }
    } finally {
      [Runtime.InteropServices.Marshal]::FreeHGlobal($pointer)
    }
    if (-not $jobAssigned) {
      [Mira.Terminal.NativeJob]::CloseHandle($job) | Out-Null
    }
  }
} catch {
  $jobAssigned = $false
}
`;

const encodePowerShellScript = (script: string) =>
  Buffer.from(script, "utf16le").toString("base64");

export const createWindowsJobPtyArgs = () => {
  const script = `${WINDOWS_JOB_BOOTSTRAP}\n[Console]::WriteLine('${WINDOWS_JOB_MARKER}:' + $(if ($jobAssigned) { 'assigned' } else { 'unavailable' }))`;
  return ["-NoLogo", "-NoProfile", "-NoExit", "-EncodedCommand", encodePowerShellScript(script)];
};

const createWindowsJobCommandArgs = (command: string) => {
  const encodedCommand = Buffer.from(command, "utf8").toString("base64");
  const script = `${WINDOWS_JOB_BOOTSTRAP}
[Console]::Error.WriteLine('${WINDOWS_JOB_MARKER}:' + $(if ($jobAssigned) { 'assigned' } else { 'unavailable' }))
$commandText = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedCommand}'))
$exitCode = 0
try {
  Invoke-Expression $commandText
  if ($null -ne $LASTEXITCODE) { $exitCode = [int]$LASTEXITCODE }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  $exitCode = 1
}
exit $exitCode`;
  return ["-NoLogo", "-NoProfile", "-EncodedCommand", encodePowerShellScript(script)];
};

const resolveLaunchSpec = (profile: HostShellProfile, command: string) => {
  const useWindowsJob = process.platform === "win32" && profile.shellFamily === "powershell";
  return {
    command: profile.shell,
    args: useWindowsJob
      ? createWindowsJobCommandArgs(command)
      : buildNormalShellArgs(profile, command),
    processTreeMode: useWindowsJob
      ? "windows_job_object" as const
      : process.platform === "win32"
        ? "windows_taskkill_tree" as const
        : "posix_process_group" as const,
    detached: process.platform !== "win32",
  };
};

const killProcessTree = async (
  child: ChildProcessWithoutNullStreams,
  mode: TerminalProcessTreeMode,
) => {
  if (!child.pid) return;
  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        windowsHide: true,
        stdio: "ignore",
      });
      killer.once("error", () => resolve());
      killer.once("close", () => resolve());
    });
    return;
  }
  try {
    if (mode === "posix_process_group") process.kill(-child.pid, "SIGKILL");
    else child.kill("SIGKILL");
  } catch {
    // Process may already have exited.
  }
};

const toCombinedOutput = (stdout: string, stderr: string) =>
  [stdout, stderr].filter(Boolean).join("\n").trimEnd();

export const executeHostCommand = async (
  input: HostExecutionInput,
): Promise<HostExecutionResult> => {
  if (input.signal.aborted) throw new Error("Terminal session aborted");

  const { cwd, workspaceRelation } = resolveHostCwd({
    cwd: input.cwd,
    workspaceRoot: input.workspaceRoot,
  });
  const env = resolveHostEnv(input.env);
  const outputLimitBytes = normalizeOutputLimitBytes(input.outputLimitBytes);
  const launch = resolveLaunchSpec(input.shellProfile, input.command);
  const child = spawn(launch.command, launch.args, {
    cwd,
    env,
    windowsHide: true,
    shell: false,
    detached: launch.detached,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let capturedBytes = 0;
  let truncated = false;
  let stdoutBinaryDetected = false;
  let stderrBinaryDetected = false;
  let stdoutEncoding = normalizeReportedEncoding(input.shellProfile.stdoutEncoding);
  let stderrEncoding = normalizeReportedEncoding(input.shellProfile.stderrEncoding);
  let jobObjectAssigned = launch.processTreeMode !== "windows_job_object";
  let exitCode: number | null = null;
  let timedOut = false;
  let settled = false;
  const violations: string[] = [];

  if (workspaceRelation === "outside") {
    violations.push("cwd_outside_workspace: execution was approved and continued on the host runtime");
  }

  const appendChunk = (
    target: string[],
    chunk: Buffer | string,
    stream: "stdout" | "stderr",
    encoding: string,
  ) => {
    const decoded = decodeChunk(chunk, encoding);
    if (decoded.failed || hasBinarySignature(chunk, encoding)) {
      if (stream === "stdout") stdoutBinaryDetected = true;
      else stderrBinaryDetected = true;
      if (!target.includes(BINARY_PLACEHOLDER_TEXT)) target.push(BINARY_PLACEHOLDER_TEXT);
      return "";
    }

    let text = decoded.text;
    if (stream === "stderr" && text.includes(WINDOWS_JOB_MARKER)) {
      const assigned = text.includes(`${WINDOWS_JOB_MARKER}:assigned`);
      jobObjectAssigned = assigned;
      text = text
        .split(/\r?\n/)
        .filter((line) => !line.includes(WINDOWS_JOB_MARKER))
        .join("\n");
    }
    if (!text) return "";

    if (stream === "stdout") stdoutEncoding = decoded.encoding;
    else stderrEncoding = decoded.encoding;

    const nextBytes = Buffer.byteLength(text, "utf8");
    const remaining = Math.max(0, outputLimitBytes - capturedBytes);
    if (remaining === 0) {
      truncated = true;
      return "";
    }
    const captured = nextBytes <= remaining
      ? text
      : Buffer.from(text, "utf8").subarray(0, remaining).toString("utf8");
    capturedBytes += Buffer.byteLength(captured, "utf8");
    if (captured.length < text.length) truncated = true;
    target.push(captured);
    return captured;
  };

  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      error ? reject(error) : resolve();
    };

    const timer = setTimeout(() => {
      timedOut = true;
      violations.push(`terminal execution timed out after ${input.timeoutMs}ms`);
      void killProcessTree(child, launch.processTreeMode).finally(() => finish());
    }, input.timeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => {
      const visible = appendChunk(
        stdoutChunks,
        chunk,
        "stdout",
        input.shellProfile.stdoutEncoding,
      );
      if (visible) input.pushStdout?.(visible);
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      const visible = appendChunk(
        stderrChunks,
        chunk,
        "stderr",
        input.shellProfile.stderrEncoding,
      );
      if (visible) input.pushStderr?.(visible);
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      finish(error instanceof Error ? error : new Error(String(error)));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      exitCode = code;
      finish();
    });

    input.signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        void killProcessTree(child, launch.processTreeMode).finally(() =>
          finish(new Error("Terminal session aborted")),
        );
      },
      { once: true },
    );
  }).catch((error) => {
    throw error instanceof Error ? error : mcpInternalError(String(error));
  });

  if (launch.processTreeMode === "windows_job_object" && !jobObjectAssigned) {
    violations.push("windows_job_object_unavailable: taskkill tree fallback remains active");
  }
  if (truncated) {
    violations.push(`terminal output truncated after ${outputLimitBytes} bytes; process execution was not stopped`);
  }

  const stdout = stdoutChunks.join("").trimEnd();
  const stderr = stderrChunks.join("").trimEnd();
  return {
    runtimeId: "host_spawn",
    cwd,
    workspaceRelation,
    processTreeMode:
      launch.processTreeMode === "windows_job_object" && !jobObjectAssigned
        ? "windows_taskkill_tree"
        : launch.processTreeMode,
    exitCode,
    timedOut,
    stdout,
    stderr,
    stdoutEncoding: stdoutBinaryDetected ? "unknown" : stdoutEncoding,
    stderrEncoding: stderrBinaryDetected ? "unknown" : stderrEncoding,
    output: toCombinedOutput(stdout, stderr),
    truncated,
    binaryDetected: stdoutBinaryDetected || stderrBinaryDetected,
    violations,
  };
};

export const toHostShellProfile = (
  profile: McpExecutionEnvironment["terminal"]["shellProfile"],
): HostShellProfile => ({ ...profile });

export const resolveTerminalRuntimeId = (): TerminalRuntimeId =>
  process.env.MIRA_TERMINAL_RUNTIME?.trim().toLowerCase() === "sandbox_runtime"
    ? "sandbox_runtime"
    : "host_spawn";

export const isWindowsJobMarker = (value: string) => value.includes(WINDOWS_JOB_MARKER);
export const getWindowsJobMarker = () => WINDOWS_JOB_MARKER;
