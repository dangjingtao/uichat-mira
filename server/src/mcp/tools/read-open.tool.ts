import type { McpToolImplementation } from "../core/definitions.js";
import { mcpBadRequest } from "../core/errors.js";
import { executeReadOpen } from "../read/runtime.js";
import { emitArtifacts } from "./artifact-utils.js";

export const readOpenTool: McpToolImplementation = {
  definition: {
    id: "read_open",
    title: "Read Open",
    description: "Open an authorized file path and return normalized contents.",
    domain: "read",
    mode: "sync",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
    },
    tags: ["read", "workspace", "document"],
    capabilities: {
      sideEffect: "none",
      requiresApproval: false,
      workspaceBound: true,
    },
  },
  execute: async (context) => {
    const pathValue = context.args.path;
    if (typeof pathValue !== "string" || !pathValue.trim()) {
      throw mcpBadRequest("path is required");
    }

    const result = await executeReadOpen({
      args: {
        path: pathValue,
      },
      environment: context.environment,
      pushEvent: context.pushEvent,
    });

    emitArtifacts(context, result.artifacts);

    return {
      result: result.contents,
    };
  },
};
