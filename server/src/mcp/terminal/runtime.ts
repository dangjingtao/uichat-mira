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

type TerminalExecutionContext = {
  invocationId: string;
  args: Record<string, unknown>;
  environment?: McpExecutionEnvironment;
  signal: AbortSignal;
  pushEvent?: (event: McpStreamEventInput) => void;
  trace?: McpInvocationContext["trace"];
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
    stderrSeparated: boolean;
  };
  artifacts: McpArtifact[];
};

type TerminalCapability = McpExecutionEnvironment["terminal"]["capabilities"][number];
type TerminalShellProfile = McpExecutionEnvironment["terminal"]["shellProfile"];

const DEFAULT_TIMEOUT_MS = 2_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 60_000;

const assertTerminalEnvironment = (environment?: McpExecutionEnvironment) => {
  if (!environment || environment.source !== "harness") {
    throw mcpInternalError("Terminal execution requires a harness environment snapshot");
  }

  return environment;
};

const getTerminalShellProfile = (environment: McpExecutionEnvironment) =>
  environment.terminal.shellProfile;

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

const runEphemeralCommand = async (input: {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
  signal: AbortSignal;
  environment: McpExecutionEnvironment;
  pushEvent?: (event: McpStreamEventInput) => void;
}) => {
  const shellProfile = createSandboxShellProfile(getTerminalShellProfile(input.environment));
  const result = await executeSandboxedCommand({
    command: input.command,
    cwd: input.cwd,
    env: input.env,
    timeoutMs: input.timeoutMs,
    signal: input.signal,
    shellProfile,
    pushStdout: (chunk) => {
      input.pushEvent?.({
        type: "invocation:stdout",
        chunk,
        stream: "stdout",
      });
    },
    pushStderr: (chunk) => {
      input.pushEvent?.({
        type: "invocation:stdout",
        chunk,
        stream: "stderr",
      });
    },
  });

  if (result.timedOut) {
    input.pushEvent?.({
      type: "invocation:progress",
      message: `Terminal session timed out after ${input.timeoutMs}ms`,
    });
  }

  return {
    sessionId: crypto.randomUUID(),
    shell: shellProfile.shell,
    cwd: result.cwd,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    stdout: result.stdout,
    stderr: result.stderr,
    output: result.output,
  };
};

const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildTerminalCompletionMarker = (invocationId: string) =>
  `__CODEX_DONE__:${invocationId}:${crypto.randomUUID().replace(/-/g, "")}`;

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

const acquirePersistentSession = (input: {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  shellProfile: TerminalShellProfile;
  attachSessionId?: string;
}) => {
  const session = input.attachSessionId
    ? getTerminalSession(input.attachSessionId)
    : createTerminalSession({
        command: input.command,
        cwd: input.cwd,
        env: input.env,
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
  if (input.signal.aborted) {
    throw new Error("Terminal session aborted");
  }

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
    if (done) {
      return;
    }

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

    if (input.signal.aborted) {
      clearInterval(interval);
      clearTimeout(timer);
      if (!input.reusedSession) {
        removeTerminalSession(input.session.id);
      }
      reject(new Error("Terminal session aborted"));
      return;
    }

    input.signal.addEventListener(
      "abort",
      () => {
        clearInterval(interval);
        clearTimeout(timer);
        if (!input.reusedSession) {
          removeTerminalSession(input.session.id);
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
    sessionId: input.session.id,
    cwd: input.session.cwd,
    exitCode,
    timedOut,
    reusedSession: input.reusedSession,
    stdout,
    stderr: "",
    output: stdout,
    stderrSeparated: false,
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
  trace,
}: TerminalExecutionContext): Promise<TerminalExecutionResult> => {
  const harnessEnvironment = assertTerminalEnvironment(environment);
  const shellProfile = getTerminalShellProfile(harnessEnvironment);
  const planningSpan = trace?.startSpan({
    name: "Resolve terminal execution plan",
    kind: "strategy_selection",
    metadata: {
      requestedSessionMode:
        args.sessionMode === "persistent" ? "persistent" : "ephemeral",
      attachSessionId:
        typeof args.attachSessionId === "string" ? args.attachSessionId : undefined,
    },
  });
  const command = normalizeCommand(args.command);
  const env = normalizeEnv(args.env);
  const timeoutMs = normalizeTimeoutMs(args.timeoutMs);
  const attachSessionId = normalizeAttachSessionId(args.attachSessionId);
  const sessionMode = attachSessionId ? "persistent" : normalizeSessionMode(args.sessionMode);

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
  planningSpan?.end({
    metadata: {
      capabilityId: capability.id,
      provider: capability.provider,
      sessionMode,
      timeoutMs,
      shell: shellProfile.shell,
      shellFamily: shellProfile.shellFamily,
    },
  });

  if (sessionMode === "persistent") {
    const acquireSpan = trace?.startSpan({
      name: attachSessionId ? "Attach persistent session" : "Create persistent session",
      kind: "session_acquire",
      metadata: {
        attachSessionId,
      },
    });
    const { session, reusedSession } = acquirePersistentSession({
      command,
      cwd: typeof args.cwd === "string" ? args.cwd : undefined,
      env,
      shellProfile,
      attachSessionId,
    });
    acquireSpan?.end({
      metadata: {
        sessionId: session.id,
        reusedSession,
        cwd: session.cwd,
      },
    });

    pushEvent?.({
      type: "invocation:progress",
      message: "PTY stream merges stdout and stderr",
    });
    pushEvent?.({
      type: "invocation:progress",
      message: reusedSession
        ? `Attached terminal session ${session.id}`
        : `Started terminal session ${session.id}`,
    });

    const commandSpan = trace?.startSpan({
      name: "Run persistent terminal command",
      kind: "command_execution",
      metadata: {
        sessionId: session.id,
        reusedSession,
        streamMode: "merged",
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
        sessionId: result.sessionId,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        stderrSeparated: false,
      },
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
        reusedSession: result.reusedSession,
        sessionMode: "persistent",
        streamMode: "merged",
        stderrSeparated: false,
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
            stderrSeparated: false,
            strategyId: capability.id,
            provider: capability.provider,
          },
        }),
      ],
      };
  }

  const spawnSpan = trace?.startSpan({
    name: "Spawn ephemeral shell command",
    kind: "process_spawn",
    metadata: {
      streamMode: "split",
    },
  });
  const result = await runEphemeralCommand({
    command,
    cwd: typeof args.cwd === "string" ? args.cwd : undefined,
    env,
    timeoutMs,
    signal,
    environment: harnessEnvironment,
    pushEvent,
  });
  spawnSpan?.end({
    status: signal.aborted ? "cancelled" : "completed",
    metadata: {
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stderrSeparated: true,
      cwd: result.cwd,
    },
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
      stderrSeparated: true,
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
          stderrSeparated: true,
          strategyId: capability.id,
          provider: capability.provider,
        },
      }),
    ],
  };
};
