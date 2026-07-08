import * as deepagents from "deepagents";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type MiddlewareInspectionRow = {
  capability: string;
  kind: "middleware" | "config" | "runtime" | "backend";
  exportedAtRuntime: boolean;
  canInstantiateOrSmokeTest: boolean;
  canUseWithoutCreateDeepAgent: boolean | "unknown";
  evidence: string[];
  safetyRisk: "low" | "medium" | "high";
  recommendation: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const deepAgentsDtsPath = path.join(
  packageRoot,
  "node_modules",
  "deepagents",
  "dist",
  "agent-DURA4_mf.d.ts",
);

const runtimeExports = Object.keys(deepagents).sort();

const hasDtsPattern = async (pattern: string) => {
  const dts = await readFile(deepAgentsDtsPath, "utf8");
  return dts.includes(pattern);
};

const asMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const smokeTest = async (
  run: () => unknown | Promise<unknown>,
): Promise<{ ok: boolean; evidence: string }> => {
  try {
    const result = await run();
    if (result && typeof result === "object") {
      const keys = Object.keys(result).slice(0, 6).join(", ");
      return { ok: true, evidence: `Smoke test returned object keys: ${keys}` };
    }
    return {
      ok: true,
      evidence: `Smoke test returned ${typeof result}`,
    };
  } catch (error) {
    return {
      ok: false,
      evidence: `Smoke test failed: ${asMessage(error)}`,
    };
  }
};

const createDeepAgentSmoke = async () => {
  const agent = deepagents.createDeepAgent({
    model: "openai:gpt-4o-mini",
    tools: [],
  });
  return {
    hasStreamEvents: typeof agent.streamEvents === "function",
    hasInvoke: typeof agent.invoke === "function",
  };
};

export const inspectDeepAgentsMiddleware =
  async (): Promise<MiddlewareInspectionRow[]> => {
    const createFilesystemMiddlewareSmoke = await smokeTest(() =>
      deepagents.createFilesystemMiddleware(),
    );
    const createSubAgentMiddlewareSmoke = await smokeTest(() =>
      deepagents.createSubAgentMiddleware({
        defaultModel: "openai:gpt-4o-mini",
        defaultTools: [],
        generalPurposeAgent: false,
      }),
    );
    const createSummarizationMiddlewareSmoke = await smokeTest(() =>
      deepagents.createSummarizationMiddleware({
        backend: new deepagents.FilesystemBackend({
          rootDir: process.cwd(),
          virtualMode: true,
        }),
      }),
    );
    const createPatchToolCallsMiddlewareSmoke = await smokeTest(() =>
      deepagents.createPatchToolCallsMiddleware(),
    );
    const filesystemBackendSmoke = await smokeTest(
      () =>
        new deepagents.FilesystemBackend({
          rootDir: process.cwd(),
          virtualMode: true,
        }),
    );
    const createDeepAgentResult = await smokeTest(createDeepAgentSmoke);
    const permissionsVisibleInTypes = await hasDtsPattern(
      "permissions?: FilesystemPermission[];",
    );
    const writeTodosVisibleInTypes = await hasDtsPattern("write_todos");

    return [
      {
        capability: "createFilesystemMiddleware",
        kind: "middleware",
        exportedAtRuntime: runtimeExports.includes("createFilesystemMiddleware"),
        canInstantiateOrSmokeTest: createFilesystemMiddlewareSmoke.ok,
        canUseWithoutCreateDeepAgent: true,
        evidence: [
          `Runtime export present: ${runtimeExports.includes("createFilesystemMiddleware")}`,
          createFilesystemMiddlewareSmoke.evidence,
          "This proves the middleware is directly importable and instantiable without createDeepAgent.",
        ],
        safetyRisk: "high",
        recommendation:
          "Only reuse behind deny-by-default adapter rules. Do not expose raw filesystem middleware to the main model.",
      },
      {
        capability: "Todo / write_todos",
        kind: "middleware",
        exportedAtRuntime: runtimeExports.includes("createTodoMiddleware"),
        canInstantiateOrSmokeTest: false,
        canUseWithoutCreateDeepAgent: false,
        evidence: [
          `Runtime export present: ${runtimeExports.includes("createTodoMiddleware")}`,
          `Type-level mention found: ${writeTodosVisibleInTypes}`,
          "README mentions write_todos as a built-in planning surface, but no standalone runtime export was found for a todo middleware factory.",
          "Type-level only / runtime not proven as a reusable standalone middleware.",
        ],
        safetyRisk: "medium",
        recommendation:
          "Treat todo state as an internal planning channel. Do not claim standalone extractability until a runtime export or direct factory exists.",
      },
      {
        capability: "createSubAgentMiddleware",
        kind: "middleware",
        exportedAtRuntime: runtimeExports.includes("createSubAgentMiddleware"),
        canInstantiateOrSmokeTest: createSubAgentMiddlewareSmoke.ok,
        canUseWithoutCreateDeepAgent: true,
        evidence: [
          `Runtime export present: ${runtimeExports.includes("createSubAgentMiddleware")}`,
          createSubAgentMiddlewareSmoke.evidence,
          "This proves the task/subagent middleware can be instantiated directly, but not that it is safe to expose.",
        ],
        safetyRisk: "high",
        recommendation:
          "Do not expose task/subagent directly to the main model. Reuse only after approval, observability, and policy adapters exist.",
      },
      {
        capability: "createSummarizationMiddleware",
        kind: "middleware",
        exportedAtRuntime: runtimeExports.includes("createSummarizationMiddleware"),
        canInstantiateOrSmokeTest: createSummarizationMiddlewareSmoke.ok,
        canUseWithoutCreateDeepAgent: true,
        evidence: [
          `Runtime export present: ${runtimeExports.includes("createSummarizationMiddleware")}`,
          createSummarizationMiddlewareSmoke.evidence,
          "Instantiation requires a backend, so extractability is real but not zero-cost.",
        ],
        safetyRisk: "medium",
        recommendation:
          "Can be imported directly, but should not be layered blindly onto createDeepAgent because the default stack already includes summarization behavior.",
      },
      {
        capability: "createPatchToolCallsMiddleware",
        kind: "middleware",
        exportedAtRuntime: runtimeExports.includes("createPatchToolCallsMiddleware"),
        canInstantiateOrSmokeTest: createPatchToolCallsMiddlewareSmoke.ok,
        canUseWithoutCreateDeepAgent: true,
        evidence: [
          `Runtime export present: ${runtimeExports.includes("createPatchToolCallsMiddleware")}`,
          createPatchToolCallsMiddlewareSmoke.evidence,
          "This is the lowest-risk extractable middleware in the current stack because it patches message parity instead of widening capabilities.",
        ],
        safetyRisk: "low",
        recommendation:
          "Reasonable candidate for isolated reuse. Still requires explicit contract review before entering Harness.",
      },
      {
        capability: "FilesystemBackend",
        kind: "backend",
        exportedAtRuntime: runtimeExports.includes("FilesystemBackend"),
        canInstantiateOrSmokeTest: filesystemBackendSmoke.ok,
        canUseWithoutCreateDeepAgent: true,
        evidence: [
          `Runtime export present: ${runtimeExports.includes("FilesystemBackend")}`,
          filesystemBackendSmoke.evidence,
          "This proves the backend class itself is reusable, but backend reuse changes file boundary semantics.",
        ],
        safetyRisk: "high",
        recommendation:
          "Treat as a reusable low-level building block, not as permission proof. Backend choice must stay behind explicit policy.",
      },
      {
        capability: "permissions",
        kind: "config",
        exportedAtRuntime: false,
        canInstantiateOrSmokeTest: false,
        canUseWithoutCreateDeepAgent: false,
        evidence: [
          `Runtime export present: ${runtimeExports.includes("permissions")}`,
          `Type-level mention found: ${permissionsVisibleInTypes}`,
          "permissions is visible as a createDeepAgent config field, not as a standalone runtime export.",
          "Type-level only / runtime not proven as a separately reusable control surface.",
        ],
        safetyRisk: "high",
        recommendation:
          "Use only as a supporting control, not as the sole safety boundary. It limits file access but does not remove the capability surface.",
      },
      {
        capability: "streamEvents",
        kind: "runtime",
        exportedAtRuntime: runtimeExports.includes("streamEvents"),
        canInstantiateOrSmokeTest: createDeepAgentResult.ok,
        canUseWithoutCreateDeepAgent: false,
        evidence: [
          `Runtime export present: ${runtimeExports.includes("streamEvents")}`,
          createDeepAgentResult.evidence,
          "streamEvents is available on the created agent runtime, not as a top-level module export.",
        ],
        safetyRisk: "medium",
        recommendation:
          "Can feed an adapter layer, but do not pipe raw LangGraph events directly into the current trace UI.",
      },
    ];
  };
