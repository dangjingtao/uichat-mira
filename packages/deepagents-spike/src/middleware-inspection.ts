import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type MiddlewareInspectionRow = {
  capability: string;
  kind: "middleware" | "config" | "runtime";
  canImportDirectly: boolean;
  canUseWithoutCreateDeepAgent: boolean;
  needsSafetyAdapterRisk: "low" | "medium" | "high";
  recommendation: string;
  evidence: string[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const deepAgentsDtsPath = path.join(
  repoRoot,
  "node_modules",
  ".pnpm",
  "deepagents@1.10.5_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.220.0_@_2tfr2wiw35v2vosvpz4ordo77u",
  "node_modules",
  "deepagents",
  "dist",
  "agent-DURA4_mf.d.ts",
);

const hasPattern = (source: string, pattern: string) => source.includes(pattern);

export const inspectDeepAgentsMiddleware =
  async (): Promise<MiddlewareInspectionRow[]> => {
    const dts = await readFile(deepAgentsDtsPath, "utf8");

    return [
      {
        capability: "Filesystem middleware",
        kind: "middleware",
        canImportDirectly: hasPattern(dts, "declare function createFilesystemMiddleware"),
        canUseWithoutCreateDeepAgent: hasPattern(dts, "declare function createFilesystemMiddleware"),
        needsSafetyAdapterRisk: "high",
        recommendation:
          "Only reuse behind deny-by-default adapter rules. Do not expose raw filesystem middleware to the main model.",
        evidence: [
          "deepagents exports `createFilesystemMiddleware` directly.",
          "Filesystem permission defaults are permissive when no rule matches.",
        ],
      },
      {
        capability: "Todo middleware",
        kind: "middleware",
        canImportDirectly: false,
        canUseWithoutCreateDeepAgent: false,
        needsSafetyAdapterRisk: "medium",
        recommendation:
          "Treat todo state as an internal planning channel. Reuse only after mapping to external state ownership rules.",
        evidence: [
          "`write_todos` exists as a built-in DeepAgents tool.",
          "No direct `createTodoMiddleware` export was found in deepagents public exports.",
        ],
      },
      {
        capability: "SubAgent / task middleware",
        kind: "middleware",
        canImportDirectly: hasPattern(dts, "declare function createSubAgentMiddleware"),
        canUseWithoutCreateDeepAgent: hasPattern(dts, "declare function createSubAgentMiddleware"),
        needsSafetyAdapterRisk: "high",
        recommendation:
          "Do not expose `task` directly to the main model. Reuse only after approval, observability, and policy adapters exist.",
        evidence: [
          "deepagents exports `createSubAgentMiddleware` directly.",
          "The built-in `task` tool delegates work into nested subagent context.",
        ],
      },
      {
        capability: "Summarization / context offload",
        kind: "middleware",
        canImportDirectly: hasPattern(dts, "declare function createSummarizationMiddleware"),
        canUseWithoutCreateDeepAgent: hasPattern(dts, "declare function createSummarizationMiddleware"),
        needsSafetyAdapterRisk: "medium",
        recommendation:
          "Can be imported directly, but should not be layered blindly onto createDeepAgent because the default stack already includes summarization.",
        evidence: [
          "deepagents exports `createSummarizationMiddleware` directly.",
          "T-DeepAgents-01 already hit duplicate-definition conflict when adding summarization on top of createDeepAgent defaults.",
        ],
      },
      {
        capability: "PatchToolCalls middleware",
        kind: "middleware",
        canImportDirectly: hasPattern(dts, "declare function createPatchToolCallsMiddleware"),
        canUseWithoutCreateDeepAgent: hasPattern(dts, "declare function createPatchToolCallsMiddleware"),
        needsSafetyAdapterRisk: "low",
        recommendation:
          "Reasonable candidate for isolated reuse. Still requires explicit contract review before entering Harness.",
        evidence: [
          "deepagents exports `createPatchToolCallsMiddleware` directly.",
          "This is the lowest-risk extractable middleware in the current stack because it focuses on tool-call shaping instead of capability expansion.",
        ],
      },
      {
        capability: "permissions",
        kind: "config",
        canImportDirectly: hasPattern(dts, "permissions?: FilesystemPermission[];"),
        canUseWithoutCreateDeepAgent: false,
        needsSafetyAdapterRisk: "high",
        recommendation:
          "Use only as a supporting control, not as the sole safety boundary. It limits filesystem access but does not remove the capability surface.",
        evidence: [
          "`permissions?: FilesystemPermission[]` is a createDeepAgent configuration field.",
          "T-DeepAgents-01 verified restriction works, but no direct top-level disable switch was found for filesystem middleware.",
        ],
      },
      {
        capability: "backend",
        kind: "config",
        canImportDirectly: hasPattern(dts, "backend?:"),
        canUseWithoutCreateDeepAgent: false,
        needsSafetyAdapterRisk: "high",
        recommendation:
          "Backends are reusable building blocks, but backend choice changes filesystem and shell boundaries and must stay behind explicit policy.",
        evidence: [
          "deepagents exposes backend protocol and backend classes in the public surface.",
          "Local shell backend is high risk because it adds unrestricted host-shell execution.",
        ],
      },
      {
        capability: "streamEvents",
        kind: "runtime",
        canImportDirectly: false,
        canUseWithoutCreateDeepAgent: true,
        needsSafetyAdapterRisk: "medium",
        recommendation:
          "Can feed an adapter layer, but do not pipe raw LangGraph events directly into the current trace UI.",
        evidence: [
          "`streamEvents` is available on the returned agent runtime.",
          "T-DeepAgents-01 already proved raw events need a trace adapter instead of direct UI ingestion.",
        ],
      },
    ];
  };
