import type { McpToolImplementation } from "../core/definitions.js";
import { mcpBadRequest } from "../core/errors.js";
import { executeTerminalSessionRuntime } from "../terminal/runtime-host.js";
import { emitArtifacts } from "./artifact-utils.js";

const cwdDescription =
  "Execution directory. Defaults to the selected workspace. Relative paths resolve from the workspace; absolute paths and parent traversal are allowed after the normal approval review.";

const terminalSessionLlmInputSchema = {
  type: "object",
  required: ["command"],
  properties: {
    command: { type: "string" },
    cwd: {
      type: "string",
      description: cwdDescription,
    },
    timeoutMs: {
      type: "number",
      description:
        "Command observation timeout in milliseconds. Persistent PTY sessions remain available when a command is still running.",
    },
  },
  additionalProperties: false,
} as const;

export const terminalSessionTool: McpToolImplementation = {
  definition: {
    id: "terminal_session",
    title: "Terminal Session",
    description:
      "Run full host shell commands or PTY-backed persistent sessions with process-tree ownership and streamed output.",
    domain: "terminal",
    source: "internal",
    mode: "stream",
    inputSchema: {
      type: "object",
      required: ["command"],
      properties: {
        command: { type: "string" },
        cwd: {
          type: "string",
          description: cwdDescription,
        },
        env: {
          type: "object",
          description:
            "Environment overrides merged onto the inherited host environment.",
        },
        timeoutMs: { type: "number" },
        attachSessionId: { type: "string" },
        sessionMode: {
          type: "string",
          enum: ["ephemeral", "persistent"],
        },
      },
    },
    inputSchemaByExposure: {
      agent_intent: terminalSessionLlmInputSchema,
      chat_surface: terminalSessionLlmInputSchema,
    },
    tags: ["terminal", "pty", "host-runtime", "process-tree"],
    capabilities: {
      sideEffect: "process",
      requiresApproval: true,
      workspaceBound: true,
      workspaceBoundary: {
        argKeys: ["cwd"],
        argTypes: {
          cwd: "directory",
        },
      },
      longRunning: true,
      sandboxRequired: false,
    },
  },
  execute: async (context) => {
    const command =
      typeof context.args.command === "string" ? context.args.command.trim() : "";
    if (!command) {
      throw mcpBadRequest("command is required");
    }

    const result = await executeTerminalSessionRuntime({
      invocationId: context.invocationId,
      args: context.args,
      environment: context.environment,
      signal: context.signal,
      pushEvent: context.pushEvent,
      trace: context.trace,
    });

    emitArtifacts(context, result.artifacts);

    return {
      result: result.contents,
    };
  },
};
