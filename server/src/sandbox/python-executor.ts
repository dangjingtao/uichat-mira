import { spawn, spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveWorkspaceDirectoryPath, resolveWorkspacePath, runWithWorkspaceRootOverride } from "@/mcp/workspace.js";
import { mcpBadRequest } from "@/mcp/core/errors.js";
import { resolveSandboxEnv } from "./executor.js";
import type { SandboxArtifactRegistration, SandboxRunResult } from "@/harness/sandbox/contract.js";

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_OUTPUT_LIMIT_BYTES = 64 * 1024;
const MAX_OUTPUT_LIMIT_BYTES = 1024 * 1024;

export interface ManagedPythonConfig {
  enabled?: boolean;
  executable?: string;
  packages?: string[];
}

export interface ManagedPythonInput {
  code: string;
  workspaceRoot: string;
  cwd?: string;
  timeoutMs?: number;
  outputLimitBytes?: number;
  artifactRegistrations?: SandboxArtifactRegistration[];
  config?: ManagedPythonConfig;
  signal?: AbortSignal;
}

const normalizeLimits = (input: ManagedPythonInput) => {
  if (!input.code.trim()) throw mcpBadRequest("code is required");
  const timeoutMs = Math.min(Math.trunc(input.timeoutMs ?? DEFAULT_TIMEOUT_MS), MAX_TIMEOUT_MS);
  const outputLimitBytes = Math.min(Math.trunc(input.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT_BYTES), MAX_OUTPUT_LIMIT_BYTES);
  if (timeoutMs <= 0 || outputLimitBytes <= 0) throw mcpBadRequest("timeoutMs and outputLimitBytes must be positive");
  return { timeoutMs, outputLimitBytes };
};

const resolveExecutable = (config?: ManagedPythonConfig) => {
  if (!config?.enabled || !config.executable?.trim()) return undefined;
  return config.executable.trim();
};

const resolvePythonEnv = () => {
  const env = resolveSandboxEnv({});
  delete env.HOME;
  delete env.USERPROFILE;
  return env;
};

const createManagedScript = (code: string, workspaceRoot: string, tempRoot: string, packages: string[] = []) => `
import os as _os
import sys as _sys
import sysconfig as _sysconfig

_workspace = ${JSON.stringify(path.resolve(workspaceRoot))}
_temp_root = ${JSON.stringify(path.resolve(tempRoot))}
_stdlib = ${JSON.stringify(path.resolve(process.execPath, ".."))}
_allowed_imports = ${JSON.stringify(packages)}
_stdlib_roots = tuple(_root for _root in (_sysconfig.get_path("stdlib"), _sysconfig.get_path("platstdlib")) if _root)
_stdlib_imports = {"os", "sys", "json", "math", "time", "pathlib", "re", "csv", "io", "datetime", "decimal", "statistics", "subprocess", "ctypes", "socket", "shutil", "tempfile", "typing", "collections", "itertools", "functools", "urllib", "xml", "sqlite3", "hashlib", "base64", "struct", "enum", "dataclasses", "traceback", "logging", "unittest", "pickle", "copy", "glob", "fnmatch", "linecache", "textwrap", "string", "random", "numbers", "fractions", "secrets", "sysconfig", "platform"}
_blocked = (
    "subprocess", "os.system", "os.exec", "os.posix_spawn", "os.spawn",
    "ctypes.dlopen", "socket", "socket.connect", "socket.getaddrinfo",
    "os.kill", "signal.pthread_kill"
)
_blocked_writes = {
    "os.remove", "os.unlink", "os.rename", "os.replace", "os.mkdir", "os.makedirs",
    "os.rmdir", "os.removedirs", "os.chmod", "os.chown", "os.lchown", "os.symlink",
    "os.link", "os.truncate", "os.utime"
}
_write_modes = set("wax+")

def _inside(path_value, roots):
    try:
        candidate = _os.path.realpath(path_value)
    except (TypeError, ValueError):
        return False
    return any(candidate == root or candidate.startswith(root + _os.sep) for root in roots)

def _audit(event, args):
    if event == "import":
        module = args[0] if args else ""
        filename = args[1] if len(args) > 1 else None
        top_level = module.split(".", 1)[0]
        if top_level not in _stdlib_imports and top_level not in _allowed_imports:
            raise PermissionError("MANAGED_PYTHON_BLOCKED: import is outside the configured package allowlist")
        if filename and isinstance(filename, (str, bytes)):
            roots = _stdlib_roots if top_level in _stdlib_imports else (_sys.prefix,)
            if not _inside(filename, roots):
                raise PermissionError("MANAGED_PYTHON_BLOCKED: import source is outside the configured runtime roots")
    if event == "open" or event == "os.open":
        target = args[0] if args else None
        if isinstance(target, (str, bytes)):
            if event == "open":
                mode = args[1] if len(args) > 1 else "r"
                if isinstance(mode, int):
                    flags = args[2] if len(args) > 2 and isinstance(args[2], int) else mode
                    writing = bool(flags & (_os.O_WRONLY | _os.O_RDWR | _os.O_CREAT | _os.O_TRUNC | _os.O_APPEND))
                else:
                    writing = isinstance(mode, str) and any(_flag in mode for _flag in _write_modes)
            else:
                flags = args[1] if len(args) > 1 and isinstance(args[1], int) else 0
                writing = bool(flags & (_os.O_WRONLY | _os.O_RDWR | _os.O_CREAT | _os.O_TRUNC | _os.O_APPEND))
            roots = (_workspace, _temp_root) if writing else (_workspace, _temp_root, _stdlib, _sys.prefix)
            if not _inside(target, roots):
                reason = "file write outside workspace" if writing else "file access outside workspace"
                raise PermissionError("MANAGED_PYTHON_BLOCKED: " + reason)
    if event in _blocked_writes:
        for target in args[:2]:
            if isinstance(target, (str, bytes)) and not _inside(target, (_workspace, _temp_root)):
                raise PermissionError("MANAGED_PYTHON_BLOCKED: file mutation outside workspace")
    if any(event == item or event.startswith(item + ".") for item in _blocked):
        raise PermissionError("MANAGED_PYTHON_BLOCKED: process, shell, network, or dynamic library access")

_sys.addaudithook(_audit)
try:
    exec(compile(${JSON.stringify(code)}, "<python_session>", "exec"), {"__name__": "__main__", "__file__": "<python_session>"})
except PermissionError as _error:
    if str(_error).startswith("MANAGED_PYTHON_BLOCKED:"):
        print(str(_error), file=_sys.stderr)
        _sys.exit(77)
    raise
`;

export const getPythonSandboxStatus = (config?: ManagedPythonConfig) => {
  const executable = resolveExecutable(config);
  if (!executable) return { available: false, reason: "Python runtime is not configured." };
  const check = spawnSync(executable, ["--version"], { encoding: "utf8", windowsHide: true, timeout: 2_000 });
  if (check.error || check.status !== 0) return { available: false, reason: "Configured Python runtime health check failed." };
  const packages = (config?.packages ?? []).filter((name) => /^[A-Za-z0-9_.]+$/.test(name));
  if (packages.length) {
    const imports = packages.map((name) => `import ${name}`).join(";");
    const packageCheck = spawnSync(executable, ["-I", "-c", imports], { encoding: "utf8", windowsHide: true, timeout: 2_000 });
    if (packageCheck.error || packageCheck.status !== 0) return { available: false, reason: "Configured Python package allowlist health check failed." };
  }
  return { available: true, version: `${check.stdout ?? check.stderr}`.trim() };
};

const appendOutput = (state: { text: string; bytes: number; truncated: boolean }, chunk: Buffer, limit: number) => {
  if (state.bytes >= limit) { state.truncated = true; return; }
  const remaining = limit - state.bytes;
  const accepted = chunk.subarray(0, remaining);
  state.text += accepted.toString("utf8");
  state.bytes += accepted.length;
  if (accepted.length < chunk.length) state.truncated = true;
};

const collectArtifacts = async (registrations: SandboxArtifactRegistration[] | undefined, violations: string[]) => {
  const artifacts: SandboxRunResult["artifacts"] = [];
  for (const registration of registrations ?? []) {
    try {
      const target = resolveWorkspacePath(registration.path);
      const stat = await import("node:fs/promises").then((fs) => fs.stat(target));
      artifacts.push({ id: crypto.randomUUID(), kind: registration.kind ?? (stat.isDirectory() ? "directory" : "file"), path: target, size: stat.size, createdAt: stat.birthtime.toISOString() });
    } catch (error) {
      violations.push(`artifact registration skipped: ${registration.path} (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  return artifacts;
};

export const runManagedPython = async (input: ManagedPythonInput): Promise<SandboxRunResult> => {
  const startedAt = performance.now();
  const config = input.config;
  const executable = resolveExecutable(config);
  if (!executable) return { status: "blocked", exitCode: null, stdoutText: "", stderrText: "", stdoutEncoding: "unknown", stderrEncoding: "unknown", durationMs: 0, truncated: false, binaryDetected: false, violations: ["python runtime is unavailable"], artifacts: [] };
  const { timeoutMs, outputLimitBytes } = normalizeLimits(input);
  const violations: string[] = [];
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mira-python-"));
  const scriptPath = path.join(tempRoot, "script.py");
  try {
    const cwd = await runWithWorkspaceRootOverride(input.workspaceRoot, async () =>
      resolveWorkspaceDirectoryPath(input.cwd?.trim() || "."),
    );
    await writeFile(scriptPath, createManagedScript(input.code, input.workspaceRoot, tempRoot, config?.packages), "utf8");
    const stdout = { text: "", bytes: 0, truncated: false };
    const stderr = { text: "", bytes: 0, truncated: false };
    const child = spawn(executable, ["-I", "-B", scriptPath], { cwd, env: resolvePythonEnv(), windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] }) as any;
    let timedOut = false;
    let outputLimitReached = false;
    let terminated = false;
    const terminateProcessTree = async () => {
      if (terminated) return;
      terminated = true;
      if (!child.pid) return;
      if (process.platform === "win32") {
        await new Promise<void>((resolve) => {
          const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
          killer.once("close", () => resolve());
          killer.once("error", () => resolve());
        });
      } else {
        try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
      }
    };
    const kill = () => { void terminateProcessTree(); };
    const timer = setTimeout(() => { timedOut = true; violations.push("python execution timed out"); kill(); }, timeoutMs);
    input.signal?.addEventListener("abort", kill, { once: true });
    const onOutput = (state: { text: string; bytes: number; truncated: boolean }, chunk: Buffer) => {
      appendOutput(state, chunk, outputLimitBytes);
      if (state.truncated && !outputLimitReached) {
        outputLimitReached = true;
        violations.push("python output exceeded limit; process terminated");
        kill();
      }
    };
    child.stdout.on("data", (chunk: Buffer) => onOutput(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => onOutput(stderr, chunk));
    const exitCode = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    clearTimeout(timer);
    const truncated = stdout.truncated || stderr.truncated;
    const artifacts = await runWithWorkspaceRootOverride(input.workspaceRoot, () => collectArtifacts(input.artifactRegistrations, violations));
    const blocked = stderr.text.includes("MANAGED_PYTHON_BLOCKED:");
    return { status: timedOut ? "timed_out" : blocked ? "blocked" : exitCode === 0 && !truncated ? "completed" : "failed", exitCode, stdoutText: stdout.text, stderrText: stderr.text, stdoutEncoding: "utf8", stderrEncoding: "utf8", durationMs: Math.round(performance.now() - startedAt), truncated, binaryDetected: false, violations: blocked ? [...violations, stderr.text.trim()] : violations, artifacts };
  } catch (error) {
    return { status: "failed", exitCode: null, stdoutText: "", stderrText: error instanceof Error ? error.message : String(error), stdoutEncoding: "unknown", stderrEncoding: "unknown", durationMs: Math.round(performance.now() - startedAt), truncated: false, binaryDetected: false, violations, artifacts: [] };
  } finally { await rm(tempRoot, { recursive: true, force: true }); }
};
