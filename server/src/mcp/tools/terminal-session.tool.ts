import type { McpToolImplementation } from "../core/definitions.js";
import { mcpBadRequest } from "../core/errors.js";
import { executeTerminalSessionRuntime } from "../terminal/runtime.js";
import { emitArtifacts } from "./artifact-utils.js";

export const terminalSessionTool: McpToolImplementation = {
  definition: {
    id: "terminal_session",
    title: "Terminal Session",
    description: "Start a PTY-backed terminal session and stream output.",
    domain: "terminal",
    mode: "stream",
    inputSchema: {
      type: "object",
      required: ["command"],
      properties: {
        command: { type: "string" },
        cwd: { type: "string" },
        env: { type: "object" },
        timeoutMs: { type: "number" },
        attachSessionId: { type: "string" },
        sessionMode: {
          type: "string",
          enum: ["ephemeral", "persistent"],
        },
        approvalMode: {
          type: "string",
          enum: ["auto", "require"],
        },
        approvalGranted: { type: "boolean" },
      },
    },
    tags: ["terminal", "pty"],
    capabilities: {
      sideEffect: "process",
      requiresApproval: true,
      workspaceBound: true,
      longRunning: true,
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
