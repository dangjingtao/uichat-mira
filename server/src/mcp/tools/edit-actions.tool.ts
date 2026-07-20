import type { McpToolImplementation } from "../core/definitions.js";
import { editFileTool } from "./edit-file.tool.js";
import { workspaceMutationTool } from "./workspace-mutation.tool.js";

const delegateEditFile = (
  context: Parameters<McpToolImplementation["execute"]>[0],
  operation: "write_file" | "replace_block",
) =>
  editFileTool.execute({
    ...context,
    args: {
      ...context.args,
      operation,
    },
  });

const delegateWorkspaceMutation = (
  context: Parameters<McpToolImplementation["execute"]>[0],
  operation: "delete" | "move",
) =>
  workspaceMutationTool.execute({
    ...context,
    args: {
      operation,
      targetPath: context.args.path,
      destinationPath: context.args.destinationPath,
      recursive: context.args.recursive,
      overwrite: context.args.overwrite,
      dryRun: context.args.dryRun,
    },
  });

export const writeFileTool: McpToolImplementation = {
  definition: {
    id: "write_file",
    title: "Write File",
    description: "Create or replace the full contents of a workspace file.",
    domain: "edit",
    source: "internal",
    mode: "sync",
    inputSchema: {
      type: "object",
      required: ["path", "content"],
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        dryRun: { type: "boolean" },
      },
    },
    tags: ["edit", "write", "create", "file", "workspace"],
    capabilities: {
      sideEffect: "local-write",
      requiresApproval: true,
      workspaceBound: true,
      workspaceBoundary: {
        argKeys: ["path"],
      },
    },
  },
  execute: async (context) => delegateEditFile(context, "write_file"),
};

export const replaceBlockTool: McpToolImplementation = {
  definition: {
    id: "replace_block",
    title: "Replace Block",
    description: "Replace one exact text block inside a workspace file.",
    domain: "edit",
    source: "internal",
    mode: "sync",
    inputSchema: {
      type: "object",
      required: ["path", "expectedOldText", "newText"],
      properties: {
        path: { type: "string" },
        expectedOldText: { type: "string" },
        newText: { type: "string" },
        dryRun: { type: "boolean" },
      },
    },
    tags: ["edit", "replace", "patch", "file", "workspace"],
    capabilities: {
      sideEffect: "local-write",
      requiresApproval: true,
      workspaceBound: true,
      workspaceBoundary: {
        argKeys: ["path"],
      },
    },
  },
  execute: async (context) => delegateEditFile(context, "replace_block"),
};

export const deletePathTool: McpToolImplementation = {
  definition: {
    id: "delete_path",
    title: "Delete Path",
    description: "Delete a workspace file or directory.",
    domain: "edit",
    source: "internal",
    mode: "sync",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
        recursive: { type: "boolean" },
        dryRun: { type: "boolean" },
      },
    },
    tags: ["edit", "delete", "remove", "file", "directory", "workspace"],
    capabilities: {
      sideEffect: "local-write",
      requiresApproval: true,
      workspaceBound: true,
      workspaceBoundary: {
        argKeys: ["path"],
      },
    },
  },
  execute: async (context) => delegateWorkspaceMutation(context, "delete"),
};

export const movePathTool: McpToolImplementation = {
  definition: {
    id: "move_path",
    title: "Move Path",
    description: "Move or rename a workspace file or directory.",
    domain: "edit",
    source: "internal",
    mode: "sync",
    inputSchema: {
      type: "object",
      required: ["path", "destinationPath"],
      properties: {
        path: { type: "string" },
        destinationPath: { type: "string" },
        overwrite: { type: "boolean" },
        dryRun: { type: "boolean" },
      },
    },
    tags: ["edit", "move", "rename", "file", "directory", "workspace"],
    capabilities: {
      sideEffect: "local-write",
      requiresApproval: true,
      workspaceBound: true,
      workspaceBoundary: {
        argKeys: ["path", "destinationPath"],
      },
    },
  },
  execute: async (context) => delegateWorkspaceMutation(context, "move"),
};

export const directEditTools = [
  writeFileTool,
  replaceBlockTool,
  deletePathTool,
  movePathTool,
] as const;
