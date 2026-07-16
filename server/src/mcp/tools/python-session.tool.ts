import type { McpToolImplementation } from "../core/definitions.js";
import { mcpBadRequest } from "../core/errors.js";
import { createHarnessEnvironmentSnapshot } from "@/harness/environment.js";
import { getPythonSandboxStatus, runManagedPython } from "@/sandbox/python-executor.js";
import { emitArtifacts } from "./artifact-utils.js";

const pythonInputSchema = {
  type: "object",
  required: ["code"],
  properties: {
    code: { type: "string" },
    cwd: { type: "string", description: "Workspace-relative directory only." },
    timeoutMs: { type: "number" },
    artifactRegistrations: {
      type: "array",
      items: { type: "object", required: ["path"], properties: { path: { type: "string" }, kind: { type: "string", enum: ["file", "directory", "log", "report"] } }, additionalProperties: false },
    },
  },
  additionalProperties: false,
} as const;

export const pythonSessionTool: McpToolImplementation = {
  definition: {
    id: "python_session",
    title: "Python Session",
    description: "Run one short Python program in the managed workspace runtime.",
    domain: "terminal",
    source: "internal",
    mode: "sync",
    inputSchema: pythonInputSchema,
    inputSchemaByExposure: { agent_intent: pythonInputSchema, chat_surface: pythonInputSchema },
    tags: ["python", "sandbox", "workspace"],
    capabilities: {
      sideEffect: "process",
      requiresApproval: true,
      workspaceBound: true,
      workspaceBoundary: { argKeys: ["cwd", "artifactRegistrations"], argTypes: { cwd: "directory" } },
      networkAccess: false,
      longRunning: true,
      sandboxRequired: true,
      sandboxProfile: "python",
    },
  },
  execute: async (context) => {
    const code = typeof context.args.code === "string" ? context.args.code : "";
    if (!code.trim()) throw mcpBadRequest("code is required");
    const environment = context.environment ?? createHarnessEnvironmentSnapshot();
    if (!environment.workspace.rootPath) {
      return { evidence: { actionTaken: "Python runtime workspace check", facts: [], status: "blocked", error: "A selected workspace is required for Python execution." } };
    }
    const config = environment.toolConfig?.python;
    const health = getPythonSandboxStatus(config);
    if (!health.available) {
      return { evidence: { actionTaken: "Python runtime health check", facts: [], status: "blocked", error: health.reason } };
    }
    const result = await runManagedPython({
      code,
      cwd: typeof context.args.cwd === "string" ? context.args.cwd : undefined,
      timeoutMs: typeof context.args.timeoutMs === "number" ? context.args.timeoutMs : undefined,
      artifactRegistrations: Array.isArray(context.args.artifactRegistrations) ? context.args.artifactRegistrations as never : undefined,
      workspaceRoot: environment.workspace.rootPath,
      config,
      signal: context.signal,
    });
    emitArtifacts(context, result.artifacts.map((artifact) => ({ kind: "terminal-log", title: artifact.path, uri: artifact.path, metadata: { sandboxKind: artifact.kind, size: artifact.size } })));
    return {
      result,
      evidence: {
        actionTaken: "Run managed Python code",
        facts: [`Python execution status: ${result.status}`, `exitCode: ${result.exitCode ?? "null"}`],
        ...(result.violations.length ? { gaps: result.violations } : {}),
        ...(result.status === "completed" ? {} : { error: result.stderrText || result.status }),
        status: result.status === "timed_out" ? "timed_out" : result.status === "blocked" ? "blocked" : result.status === "completed" ? "completed" : result.truncated ? "truncated" : "failed",
        data: result,
      },
    };
  },
};
