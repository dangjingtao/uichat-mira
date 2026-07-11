import type { McpToolImplementation } from "../core/definitions.js";
import { mcpBadRequest } from "../core/errors.js";
import { executeReadList, executeReadLocateRuntime } from "../read/runtime.js";
import { emitArtifacts } from "./artifact-utils.js";

export const readDiscoverTool: McpToolImplementation = {
  definition: {
    id: "read_discover",
    title: "Read Discover",
    description: "Discover workspace objects or locate a target without opening its contents.",
    domain: "read",
    source: "internal",
    mode: "sync",
    inputSchema: {
      oneOf: [
        {
          type: "object",
          required: ["mode", "path"],
          additionalProperties: false,
          properties: {
            mode: { type: "string", enum: ["list"] },
            path: { type: "string" },
            maxResults: { type: "integer" },
          },
        },
        {
          type: "object",
          required: ["mode", "query"],
          additionalProperties: false,
          properties: {
            mode: { type: "string", enum: ["locate"] },
            query: { type: "string" },
            root: { type: "string" },
            maxResults: { type: "integer" },
          },
        },
      ],
    },
    outputSchema: { type: "object" },
    tags: ["read", "workspace", "discover", "locate", "directory"],
    capabilities: {
      sideEffect: "none",
      requiresApproval: false,
      workspaceBound: true,
      workspaceBoundary: { argKeys: ["path", "root"] },
    },
  },
  execute: async (context) => {
    const mode = context.args.mode;
    const maxResults = context.args.maxResults;
    if (typeof maxResults === "number" && (!Number.isInteger(maxResults) || maxResults < 1)) {
      throw mcpBadRequest("maxResults must be a positive integer");
    }

    if (mode === "list") {
      if (typeof context.args.path !== "string" || !context.args.path.trim()) {
        throw mcpBadRequest("path is required when mode is list");
      }
      const result = await executeReadList({
        args: { path: context.args.path, maxResults },
        environment: context.environment,
        pushEvent: context.pushEvent,
      });
      emitArtifacts(context, result.artifacts);
      return { result: { ...result.contents as object, type: "discover", mode, operation: "list" } };
    }

    if (mode === "locate") {
      if (typeof context.args.query !== "string" || !context.args.query.trim()) {
        throw mcpBadRequest("query is required when mode is locate");
      }
      const result = await executeReadLocateRuntime({
        args: {
          query: context.args.query,
          path: context.args.root,
          limit: maxResults,
        },
        environment: context.environment,
        pushEvent: context.pushEvent,
      });
      emitArtifacts(context, result.artifacts);
      return { result: { ...result.contents as object, type: "discover", mode, operation: "locate" } };
    }

    throw mcpBadRequest("mode must be one of: list, locate");
  },
};
