import type {
  McpArtifact,
  McpExecutionEnvironment,
  McpInvocationContext,
  McpStreamEventInput,
} from "../core/definitions.js";
import { createArtifact } from "../core/artifacts.js";
import { mcpBadRequest, mcpInternalError } from "../core/errors.js";
import {
  createTerminalSession,
  getTerminalSession,
  removeTerminalSession,
  type TerminalSessionRecord,
  writeTerminalSession,
} from "../terminal-sessions.js";
import {
  createSandboxShellProfile,
  executeSandboxedCommand,
} from "@/sandbox/executor.js";
import {
  executeHostCommand,
  resolveTerminalRuntimeId,
  toHostShellProfile,
  type TerminalRuntimeId,
} from "./host-runtime.js";

export type TerminalExecutionContext = {
  invocationId: string;
  args: Record<string, unknown>;
  environment?: McpExecutionEnvironment;
  signal: AbortSignal;
  pushEvent?: (event: McpStreamEventInput) => void;
  trace?: McpInvocationContext["trace"];
};

type TerminalExecutionResult = {
  contents: {
    runtimeId: TerminalRuntimeId;
    sessionId: string;
    command: string;
    cwd: string;
    workspaceRelation: "inside" | "outside" | "unresolved";
    processTreeMode:
      | "windows_job_object"
      | "windows_taskkill_tree"
      | "posix_process_group"
      | "child_process";
    exitCode: number | null;
    output: string;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    reusedSession: boolean;
    sessionMode: "ephemeral" | "persistent";
    streamMode: "split" | "merged";
    stderrSeparated: boolean;
    stdoutEncoding?: "utf8" | "gbk" | "utf16le" | "unknown";
    stderrEncoding?: "utf8" | "gbk" | "utf16le" | "unknown";
    truncated?: boolean;
    binaryDetected?: boolean;
    violations?: string[];
  };
  artifacts: McpArtifact[];
};

type TerminalShellProfile = McpExecutionEnvironment["terminal"]["shellProfile"];

const DEFAULT_TIMEOUT_MS = 120_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 24 * 60 * 60 * 1_000;

const assertTerminalEnvironment = (environment?: McpExecutionEnvironment) => {
  if (!environment || environment.source !== "harness") {
    throw mcpInternalError("Terminal execution requires a harness environment snapshot");
  }
  return environment;
};

const normalizeCommand = (value: unknown) => {
  const command = typeof value === "string" ? value.trim() : "";
  if (!command) throw mcpBadRequest("command is required");
  return command;
};

const normalizeEnv = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
};

const normalizeTimeoutMs = (value: unknown) => {
  if (value === undefined) return DEFAULT_TIMEOUT_MS;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw mcpBadRequest("timeoutMs must be a finite number");
  }
  return Math.min(Math.max(Math.trunc(value), MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
};

const normalizeAttachSessionId = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw mcpBadRequest("attachSessionId must be a string");
  return value;
};

const normalizeSessionMode = (value: unknown): "ephemeral" | "persistent" =>
  value === "persistent" ? "persistent" : "ephemeral";

const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildTerminalCompletionMarker = (invocationId: string) =>
  `__MIRA_TERMINAL_DONE__:${invocationId}:${crypto.randomUUID().replace(/-/g, "")}`;

const buildWrappedCommand = (
  profile: TerminalShellProfile,
  command: string,
  marker: string,
) => {
  if (profile.argsMode === "powershell") {
    return `& { ${command}; $code = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }; Write-Output "${marker}:$code" }`;
  }
  if (profile.argsMode === "cmd") {
    return `(${command}) & echo ${marker}:%errorlevel%`;
  }
  return `{ ${command}; code=$?; printf '\\n${marker}:%s\\n' "$code"; }`;
};

const acquirePersistentSession = async (input: {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  workspaceRoot?: string | null;
  runtimeId: TerminalRuntimeId;
  shellProfile: TerminalShellProfile;
  attachSessionId?: string;
}) => {
  const session = input.attachSessionId
    ? getTerminalSession(input.attachSessionId)
    : await createTerminalSession({
        command: input.command,
        cwd: input.cwd,
        env: input.env,
        workspaceRoot: input.workspaceRoot,
        runtimeId: input.runtimeId,
        shellProfile: input.shellProfile,
      });

  if (!session) {
    throw mcpBadRequest(`terminal session not found: ${input.attachSessionId}`);
  }

  return {
    session,
    reusedSession: Boolean(input.attachSessionId),
  };
};

const runPersistentCommand = async (input: {
  invocationId: string;
  command: string;
  session: TerminalSessionRecord;
  shellProfile: TerminalShellProfile;
  reusedSession: boolean;
  timeoutMs: number;
  signal: AbortSignal;
  pushEvent?: (event: McpStreamEventInput) => void;
}) => {
  if (input.signal.aborted) throw new Error("Terminal session aborted");

  const marker = buildTerminalCompletionMarker(input.invocationId);
  const markerPattern = new RegExp(`${escapeRegex(marker)}:(-?\\d+)`);
  const wrappedCommand = buildWrappedCommand(input.shellProfile, input.command, marker);
  let rawBuffer = "";
  let streamedOffset = 0;
  let exitCode: number | null = null;
  let timedOut = false;
  let done = false;

  const flushVisibleOutput = () => {
    const markerMatch = markerPattern.exec(rawBuffer);
    const visibleText = markerMatch ? rawBuffer.slice(0, markerMatch.index) : rawBuffer;
    if (visibleText.length <= streamedOffset) return;
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

  const dataDisposable = input.session.process.onData((chunk) => {
    rawBuffer += chunk;
    flushVisibleOutput();
    const markerMatch = markerPattern.exec(rawBuffer);
    if (markerMatch) {
      exitCode = Number(markerMatch[1]);
      done = true;
    }
  });
  const exitDisposable = input.session.process.onExit(({ exitCode: nextExitCode }) => {
    if (done) return;
    flushVisibleOutput();
    exitCode = nextExitCode;
    done = true;
  });

  writeTerminalSession(input.session.id, wrappedCommand);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      done = true;
      input.pushEvent?.({
        type: "invocation:progress",
        message: `Terminal command is still running after ${input.timeoutMs}ms; persistent session ${input.session.id} remains attached to the host process.`,
      });
      resolve();
    }, input.timeoutMs);

    const interval = setInterval(() => {
      if (!done) return;
      clearInterval(interval);
      clearTimeout(timer);
      resolve();
    }, 10);

    input.signal.addEventListener(
      "abort",
      () => {
        clearInterval(interval);
        clearTimeout(timer);
        if (!input.reusedSession) removeTerminalSession(input.session.id);
        reject(new Error("Terminal session aborted"));
      },
      { once: true },
    );
  });

  dataDisposable.dispose();
  exitDisposable.dispose();
  const stdout = rawBuffer.replace(markerPattern, "").trimEnd();
  const violations = [
    ...(input.session.workspaceRelation === "outside"
      ? ["cwd_outside_workspace: execution was approved and continued on the host runtime"]
      : []),
    ...(input.session.processTreeMode === "windows_taskkill_tree" &&
    input.session.runtimeId === "host_spawn" &&
    process.platform === "win32"
      ? ["windows_job_object_unavailable: taskkill tree fallback remains active"]
      : []),
  ];

  return {
    sessionId: input.session.id,
    runtimeId: input.session.runtimeId,
    cwd: input.session.cwd,
    workspaceRelation: input.session.workspaceRelation,
    processTreeMode: input.session.processTreeMode,
    exitCode,
    timedOut,
    reusedSession: input.reusedSession,
    stdout,
    stderr: "",
    output: stdout,
    violations,
  };
};

export const describeTerminalPlan = (
  environment: McpExecutionEnvironment | undefined,
  args: Record<string, unknown> = {},
) => {
  const harnessEnvironment = assertTerminalEnvironment(environment);
  const attachSessionId = normalizeAttachSessionId(args.attachSessionId);
  const sessionMode = attachSessionId ? "persistent" : normalizeSessionMode(args.sessionMode);
  const runtimeId = resolveTerminalRuntimeId();
  const preferredCapabilityId =
    sessionMode === "persistent" ? "pty-shell-session" : "child-process-shell-command";
  const chain = [...harnessEnvironment.terminal.capabilities]
    .filter((capability) => capability.available && capability.id === preferredCapabilityId)
    .sort((left, right) => right.priority - left.priority)
    .map((capability) => ({
      id: capability.id,
      provider: capability.provider,
      priority: capability.priority,
    }));

  return {
    runtimeId,
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
  trace,
}: TerminalExecutionContext): Promise<TerminalExecutionResult> => {
  const harnessEnvironment = assertTerminalEnvironment(environment);
  const shellProfile = harnessEnvironment.terminal.shellProfile;
  const command = normalizeCommand(args.command);
  const env = normalizeEnv(args.env);
  const timeoutMs = normalizeTimeoutMs(args.timeoutMs);
  const attachSessionId = normalizeAttachSessionId(args.attachSessionId);
  const sessionMode = attachSessionId ? "persistent" : normalizeSessionMode(args.sessionMode);
  const runtimeId = resolveTerminalRuntimeId();

  if (attachSessionId && (args.cwd !== undefined || env !== undefined)) {
    throw mcpBadRequest("attachSessionId cannot be combined with cwd or env overrides");
  }

  const planningSpan = trace?.startSpan({
    name: "Resolve terminal runtime",
    kind: "strategy_selection",
    metadata: {
      runtimeId,
      sessionMode,
      attachSessionId,
      timeoutMs,
      shell: shellProfile.shell,
    },
  });
  planningSpan?.end();

  pushEvent?.({
    type: "invocation:progress",
    message: `Terminal runtime: ${runtimeId} (${sessionMode})`,
  });

  if (sessionMode === "persistent") {
    const acquireSpan = trace?.startSpan({
      name: attachSessionId ? "Attach host PTY session" : "Create host PTY session",
      kind: "session_acquire",
      metadata: { runtimeId, attachSessionId },
    });
    const { session, reusedSession } = await acquirePersistentSession({
      command,
      cwd: typeof args.cwd === "string" ? args.cwd : undefined,
      env,
      workspaceRoot: harnessEnvironment.workspace.rootPath,
      runtimeId,
      shellProfile,
      attachSessionId,
    });
    acquireSpan?.end({
      metadata: {
        sessionId: session.id,
        cwd: session.cwd,
        workspaceRelation: session.workspaceRelation,
        processTreeMode: session.processTreeMode,
      },
    });

    const commandSpan = trace?.startSpan({
      name: "Run host PTY command",
      kind: "command_execution",
      metadata: {
        runtimeId: session.runtimeId,
        sessionId: session.id,
        reusedSession,
        processTreeMode: session.processTreeMode,
      },
    });
    const result = await runPersistentCommand({
      invocationId,
      command,
      session,
      shellProfile,
      reusedSession,
      timeoutMs,
      signal,
      pushEvent,
    });
    commandSpan?.end({
      status: signal.aborted ? "cancelled" : "completed",
      metadata: {
        exitCode: result.exitCode,
        timedOut: result.timedOut,
      },
    });

    const contents: TerminalExecutionResult["contents"] = {
      runtimeId: result.runtimeId,
      sessionId: result.sessionId,
      command,
      cwd: result.cwd,
      workspaceRelation: result.workspaceRelation,
      processTreeMode: result.processTreeMode,
      exitCode: result.exitCode,
      output: result.output,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      reusedSession: result.reusedSession,
      sessionMode: "persistent",
      streamMode: "merged",
      stderrSeparated: false,
      violations: result.violations,
    };
    return {
      contents,
      artifacts: [
        createArtifact({
          kind: "terminal-log",
          title: `Terminal output for ${command}`,
          mimeType: "text/plain",
          data: result.output,
          metadata: {
            runtimeId: result.runtimeId,
            sessionId: result.sessionId,
            cwd: result.cwd,
            workspaceRelation: result.workspaceRelation,
            processTreeMode: result.processTreeMode,
            exitCode: result.exitCode,
            timedOut: result.timedOut,
            reusedSession: result.reusedSession,
            sessionMode: "persistent",
          },
        }),
      ],
    };
  }

  const spawnSpan = trace?.startSpan({
    name: runtimeId === "host_spawn" ? "Spawn host shell command" : "Run sandbox compatibility command",
    kind: "process_spawn",
    metadata: { runtimeId },
  });
  const result =
    runtimeId === "host_spawn"
      ? await executeHostCommand({
          command,
          cwd: typeof args.cwd === "string" ? args.cwd : undefined,
          env,
          timeoutMs,
          signal,
          shellProfile: toHostShellProfile(shellProfile),
          workspaceRoot: harnessEnvironment.workspace.rootPath,
          pushStdout: (chunk) =>
            pushEvent?.({ type: "invocation:stdout", chunk, stream: "stdout" }),
          pushStderr: (chunk) =>
            pushEvent?.({ type: "invocation:stdout", chunk, stream: "stderr" }),
        })
      : await executeSandboxedCommand({
          command,
          cwd: typeof args.cwd === "string" ? args.cwd : undefined,
          env,
          timeoutMs,
          signal,
          shellProfile: createSandboxShellProfile(shellProfile),
          pushStdout: (chunk) =>
            pushEvent?.({ type: "invocation:stdout", chunk, stream: "stdout" }),
          pushStderr: (chunk) =>
            pushEvent?.({ type: "invocation:stdout", chunk, stream: "stderr" }),
        });

  const hostResult = runtimeId === "host_spawn" ? result : null;
  const cwd = hostResult?.cwd ?? result.cwd;
  const workspaceRelation = hostResult?.workspaceRelation ?? "inside";
  const processTreeMode = hostResult?.processTreeMode ?? "child_process";
  spawnSpan?.end({
    status: signal.aborted ? "cancelled" : "completed",
    metadata: {
      runtimeId,
      cwd,
      workspaceRelation,
      processTreeMode,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
    },
  });

  const contents: TerminalExecutionResult["contents"] = {
    runtimeId,
    sessionId: crypto.randomUUID(),
    command,
    cwd,
    workspaceRelation,
    processTreeMode,
    exitCode: result.exitCode,
    output: result.output,
    stdout: result.stdout,
    stderr: result.stderr,
    timedOut: result.timedOut,
    reusedSession: false,
    sessionMode: "ephemeral",
    streamMode: "split",
    stderrSeparated: true,
    stdoutEncoding: result.stdoutEncoding,
    stderrEncoding: result.stderrEncoding,
    truncated: result.truncated,
    binaryDetected: result.binaryDetected,
    violations: result.violations,
  };

  return {
    contents,
    artifacts: [
      createArtifact({
        kind: "terminal-log",
        title: `Terminal output for ${command}`,
        mimeType: "text/plain",
        data: result.output,
        metadata: {
          runtimeId,
          cwd,
          workspaceRelation,
          processTreeMode,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          sessionMode: "ephemeral",
          truncated: result.truncated,
        },
      }),
    ],
  };
};
