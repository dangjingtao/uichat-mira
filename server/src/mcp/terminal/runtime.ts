import { spawn } from "node:child_process";
import type {
  McpArtifact,
  McpExecutionEnvironment,
  McpStreamEventInput,
} from "../core/definitions.js";
import { createArtifact } from "../core/artifacts.js";
import { McpApprovalRequiredError, mcpBadRequest, mcpInternalError } from "../core/errors.js";
import { resolveWorkspacePath } from "../workspace.js";
import {
  createTerminalSession,
  getTerminalSession,
  removeTerminalSession,
  writeTerminalSession,
} from "../terminal-sessions.js";

type TerminalExecutionContext = {
  invocationId: string;
  args: Record<string, unknown>;
  environment?: McpExecutionEnvironment;
  signal: AbortSignal;
  pushEvent?: (event: McpStreamEventInput) => void;
};

type TerminalExecutionResult = {
  contents: {
    sessionId: string;
    command: string;
    cwd: string;
    exitCode: number | null;
    output: string;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    reusedSession: boolean;
    sessionMode: "ephemeral" | "persistent";
    streamMode: "split" | "merged";
  };
  artifacts: McpArtifact[];
};

type TerminalCapability = McpExecutionEnvironment["terminal"]["capabilities"][number];

const DEFAULT_TIMEOUT_MS = 2_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 60_000;

const assertTerminalEnvironment = (environment?: McpExecutionEnvironment) => {
  if (!environment || environment.source !== "harness") {
    throw mcpInternalError("Terminal execution requires a harness environment snapshot");
  }

  return environment;
};

const sortCapabilities = (environment: McpExecutionEnvironment) =>
  [...environment.terminal.capabilities]
    .filter((capability) => capability.available)
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));

const normalizeCommand = (value: unknown) => {
  const command = typeof value === "string" ? value.trim() : "";
  if (!command) {
    throw mcpBadRequest("command is required");
  }

  return command;
};

const normalizeEnv = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
};

const normalizeTimeoutMs = (value: unknown) => {
  if (value === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw mcpBadRequest("timeoutMs must be a finite number");
  }

  return Math.min(Math.max(Math.trunc(value), MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
};

const normalizeAttachSessionId = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw mcpBadRequest("attachSessionId must be a string");
  }

  return value;
};

const normalizeSessionMode = (value: unknown): "ephemeral" | "persistent" => {
  if (value === "persistent") {
    return "persistent";
  }

  return "ephemeral";
};

const maybeRequireApproval = (args: Record<string, unknown>) => {
  if (args.approvalMode !== "require") {
    return;
  }

  if (args.approvalGranted === true) {
    return;
  }

  throw new McpApprovalRequiredError("Terminal command requires explicit approval", {
    scope: "command",
  });
};

const resolveCommandCwd = (cwd?: string) => (cwd ? resolveWorkspacePath(cwd) : resolveWorkspacePath("."));

const selectEphemeralCapability = (environment: McpExecutionEnvironment) => {
  const selected = sortCapabilities(environment).find(
    (capability) => capability.id === "child-process-shell-command",
  );
  if (!selected) {
    throw mcpInternalError("No ephemeral terminal capability available in harness environment");
  }

  return selected;
};

const selectPersistentCapability = (environment: McpExecutionEnvironment) => {
  const selected = sortCapabilities(environment).find(
    (capability) => capability.id === "pty-shell-session",
  );
  if (!selected) {
    throw mcpInternalError("No persistent terminal capability available in harness environment");
  }

  return selected;
};

const toCombinedOutput = (stdout: string, stderr: string) => [stdout, stderr].filter(Boolean).join("\n").trimEnd();

const getDefaultShell = () =>
  process.platform === "win32"
    ? process.env.ComSpec || "powershell.exe"
    : process.env.SHELL || "bash";

const buildShellArgs = (shell: string, command: string) => {
  const normalizedShell = shell.toLowerCase();
  if (normalizedShell.includes("powershell")) {
    return ["-NoProfile", "-Command", command];
  }

  if (normalizedShell.endsWith("cmd.exe") || normalizedShell === "cmd") {
    return ["/d", "/s", "/c", command];
  }

  return ["-lc", command];
};

const runEphemeralCommand = async (input: {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
  signal: AbortSignal;
  pushEvent?: (event: McpStreamEventInput) => void;
}) => {
  const shell = getDefaultShell();
  const cwd = resolveCommandCwd(input.cwd);
  const child = spawn(shell, buildShellArgs(shell, input.command), {
    cwd,
    env: {
      ...process.env,
      ...(input.env ?? {}),
    } as Record<string, string>,
    windowsHide: true,
  });

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let exitCode: number | null = null;
  let timedOut = false;

  child.stdout?.on("data", (chunk: Buffer | string) => {
    const text = chunk.toString();
    stdoutChunks.push(text);
    input.pushEvent?.({
      type: "invocation:stdout",
      chunk: text,
      stream: "stdout",
    });
  });

  child.stderr?.on("data", (chunk: Buffer | string) => {
    const text = chunk.toString();
    stderrChunks.push(text);
    input.pushEvent?.({
      type: "invocation:stdout",
      chunk: text,
      stream: "stderr",
    });
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      input.pushEvent?.({
        type: "invocation:progress",
        message: `Terminal session timed out after ${input.timeoutMs}ms`,
      });
      resolve();
    }, input.timeoutMs);

    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.once("close", (code) => {
      clearTimeout(timer);
      exitCode = code;
      resolve();
    });

    input.signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        child.kill();
        reject(new Error("Terminal session aborted"));
      },
      { once: true },
    );
  });

  const stdout = stdoutChunks.join("").trimEnd();
  const stderr = stderrChunks.join("").trimEnd();

  return {
    sessionId: input.signal.aborted ? crypto.randomUUID() : crypto.randomUUID(),
    shell,
    cwd,
    exitCode,
    timedOut,
    stdout,
    stderr,
    output: toCombinedOutput(stdout, stderr),
  };
};

const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildTerminalCompletionMarker = (invocationId: string) =>
  `__CODEX_DONE__:${invocationId}:${crypto.randomUUID().replace(/-/g, "")}`;

const buildWrappedCommand = (shell: string, command: string, marker: string) => {
  const normalizedShell = shell.toLowerCase();

  if (normalizedShell.includes("powershell")) {
    return `& { ${command}; $code = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }; Write-Output "${marker}:$code" }`;
  }

  if (normalizedShell.endsWith("cmd.exe") || normalizedShell === "cmd") {
    return `(${command}) & echo ${marker}:%errorlevel%`;
  }

  return `{ ${command}; code=$?; printf '\\n${marker}:%s\\n' "$code"; }`;
};

const runPersistentCommand = async (input: {
  invocationId: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
  attachSessionId?: string;
  signal: AbortSignal;
  pushEvent?: (event: McpStreamEventInput) => void;
}) => {
  const session = input.attachSessionId
    ? getTerminalSession(input.attachSessionId)
    : createTerminalSession({
        command: input.command,
        cwd: input.cwd,
        env: input.env,
      });

  if (!session) {
    throw mcpBadRequest(`terminal session not found: ${input.attachSessionId}`);
  }

  const reusedSession = Boolean(input.attachSessionId);
  const marker = buildTerminalCompletionMarker(input.invocationId);
  const markerPattern = new RegExp(`${escapeRegex(marker)}:(-?\\d+)`);
  const wrappedCommand = buildWrappedCommand(session.shell, input.command, marker);

  let rawBuffer = "";
  let streamedOffset = 0;
  let exitCode: number | null = null;
  let timedOut = false;
  let done = false;

  const flushVisibleOutput = () => {
    const markerMatch = markerPattern.exec(rawBuffer);
    const visibleText = markerMatch ? rawBuffer.slice(0, markerMatch.index) : rawBuffer;
    if (visibleText.length <= streamedOffset) {
      return;
    }

    const nextChunk = visibleText.slice(streamedOffset);
    if (nextChunk) {
      input.pushEvent?.({
        type: "invocation:stdout",
        chunk: nextChunk,
        stream: "stdout",
      });
      streamedOffset = visibleText.length;
    }
  };

  const dataDisposable = session.process.onData((chunk) => {
    rawBuffer += chunk;
    flushVisibleOutput();

    const markerMatch = markerPattern.exec(rawBuffer);
    if (markerMatch) {
      exitCode = Number(markerMatch[1]);
      done = true;
    }
  });

  const exitDisposable = session.process.onExit(({ exitCode: nextExitCode }) => {
    if (done) {
      return;
    }

    flushVisibleOutput();
    exitCode = nextExitCode;
    done = true;
  });

  writeTerminalSession(session.id, wrappedCommand);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      done = true;
      input.pushEvent?.({
        type: "invocation:progress",
        message: `Terminal session timed out after ${input.timeoutMs}ms`,
      });
      resolve();
    }, input.timeoutMs);

    const interval = setInterval(() => {
      if (!done) {
        return;
      }

      clearInterval(interval);
      clearTimeout(timer);
      resolve();
    }, 10);

    input.signal.addEventListener(
      "abort",
      () => {
        clearInterval(interval);
        clearTimeout(timer);
        if (!reusedSession) {
          removeTerminalSession(session.id);
        }
        reject(new Error("Terminal session aborted"));
      },
      { once: true },
    );
  });

  dataDisposable?.dispose?.();
  exitDisposable?.dispose?.();

  const stdout = rawBuffer.replace(markerPattern, "").trimEnd();

  return {
    sessionId: session.id,
    cwd: session.cwd,
    exitCode,
    timedOut,
    reusedSession,
    stdout,
    stderr: "",
    output: stdout,
  };
};

export const describeTerminalPlan = (
  environment: McpExecutionEnvironment | undefined,
  args: Record<string, unknown> = {},
) => {
  const harnessEnvironment = assertTerminalEnvironment(environment);
  const attachSessionId = normalizeAttachSessionId(args.attachSessionId);
  const sessionMode = attachSessionId ? "persistent" : normalizeSessionMode(args.sessionMode);

  const preferredCapabilityId =
    sessionMode === "persistent" ? "pty-shell-session" : "child-process-shell-command";

  const chain = sortCapabilities(harnessEnvironment)
    .filter((capability) =>
      sessionMode === "persistent"
        ? capability.id === "pty-shell-session"
        : capability.id === "child-process-shell-command",
    )
    .map((capability) => ({
      id: capability.id,
      priority: capability.priority,
    }));

  return {
    attachSessionId,
    sessionMode,
    preferredCapabilityId,
    chain,
  };
};

export const executeTerminalSessionRuntime = async ({
  invocationId,
  args,
  environment,
  signal,
  pushEvent,
}: TerminalExecutionContext): Promise<TerminalExecutionResult> => {
  const harnessEnvironment = assertTerminalEnvironment(environment);
  const command = normalizeCommand(args.command);
  const env = normalizeEnv(args.env);
  const timeoutMs = normalizeTimeoutMs(args.timeoutMs);
  const attachSessionId = normalizeAttachSessionId(args.attachSessionId);
  const sessionMode = attachSessionId ? "persistent" : normalizeSessionMode(args.sessionMode);

  maybeRequireApproval(args);

  if (attachSessionId && (args.cwd !== undefined || env !== undefined)) {
    throw mcpBadRequest("attachSessionId cannot be combined with cwd or env overrides");
  }

  const capability =
    sessionMode === "persistent"
      ? selectPersistentCapability(harnessEnvironment)
      : selectEphemeralCapability(harnessEnvironment);

  pushEvent?.({
    type: "invocation:progress",
    message: `Terminal plan: ${capability.id}`,
  });

  if (sessionMode === "persistent") {
    pushEvent?.({
      type: "invocation:progress",
      message: "PTY stream merges stdout and stderr",
    });

    const result = await runPersistentCommand({
      invocationId,
      command,
      cwd: typeof args.cwd === "string" ? args.cwd : undefined,
      env,
      timeoutMs,
      attachSessionId,
      signal,
      pushEvent,
    });

    pushEvent?.({
      type: "invocation:progress",
      message: result.reusedSession
        ? `Attached terminal session ${result.sessionId}`
        : `Started terminal session ${result.sessionId}`,
    });

    if (!result.reusedSession && !signal.aborted) {
      removeTerminalSession(result.sessionId);
    }

    if (result.exitCode !== null) {
      pushEvent?.({
        type: "invocation:progress",
        message: `Terminal session exited with code ${result.exitCode}`,
      });
    }

    return {
      contents: {
        sessionId: result.sessionId,
        command,
        cwd: result.cwd,
        exitCode: result.exitCode,
        output: result.output,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut,
        reusedSession: result.reusedSession,
        sessionMode: "persistent",
        streamMode: "merged",
      },
      artifacts: [
        createArtifact({
          kind: "terminal-log",
          title: `Terminal output for ${command}`,
          mimeType: "text/plain",
          data: result.output,
          metadata: {
            sessionId: result.sessionId,
            exitCode: result.exitCode,
            timedOut: result.timedOut,
            reusedSession: result.reusedSession,
            sessionMode: "persistent",
            streamMode: "merged",
            strategyId: capability.id,
            provider: capability.provider,
          },
        }),
      ],
    };
  }

  const result = await runEphemeralCommand({
    command,
    cwd: typeof args.cwd === "string" ? args.cwd : undefined,
    env,
    timeoutMs,
    signal,
    pushEvent,
  });

  if (result.exitCode !== null) {
    pushEvent?.({
      type: "invocation:progress",
      message: `Terminal session exited with code ${result.exitCode}`,
    });
  }

  return {
    contents: {
      sessionId: result.sessionId,
      command,
      cwd: result.cwd,
      exitCode: result.exitCode,
      output: result.output,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      reusedSession: false,
      sessionMode: "ephemeral",
      streamMode: "split",
    },
    artifacts: [
      createArtifact({
        kind: "terminal-log",
        title: `Terminal output for ${command}`,
        mimeType: "text/plain",
        data: result.output,
        metadata: {
          sessionId: result.sessionId,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          reusedSession: false,
          sessionMode: "ephemeral",
          streamMode: "split",
          strategyId: capability.id,
          provider: capability.provider,
        },
      }),
    ],
  };
};
