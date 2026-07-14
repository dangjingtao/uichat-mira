import type {
  McpInvocationContext,
  McpToolImplementation,
} from "../core/definitions.js";
import { mcpBadRequest } from "../core/errors.js";
import { BrowserService } from "@/microapps/computer-use/browser/service.js";
import type {
  BrowserActInput,
  BrowserAssertInput,
  BrowserInspectInput,
  BrowserToolResult,
} from "@/microapps/computer-use/browser/types.js";

const browserResultSchema = {
  type: "object",
  required: ["ok", "sessionId", "invocationId", "page", "artifacts"],
  additionalProperties: false,
  properties: {
    ok: { type: "boolean" },
    sessionId: { type: "string" },
    invocationId: { type: "string" },
    page: { type: "object", required: ["url", "title"], additionalProperties: false, properties: { url: { type: "string" }, title: { type: "string" }, snapshotHash: { type: "string" } } },
    observation: { type: "object", additionalProperties: false, properties: { snapshot: { type: "string" }, visibleText: { type: "string" }, truncated: { type: "boolean" } } },
    assertion: { type: "object", required: ["kind", "passed"], additionalProperties: false, properties: { kind: { type: "string", enum: ["title", "url", "text", "visible", "value"] }, passed: { type: "boolean" } } },
    artifacts: { type: "array", items: { type: "object", required: ["id", "kind", "title", "uri"], additionalProperties: false, properties: { id: { type: "string" }, kind: { type: "string", enum: ["screenshot", "json"] }, title: { type: "string" }, uri: { type: "string" } } } },
    error: { type: "object", required: ["code", "message", "retryable"], additionalProperties: false, properties: { code: { type: "string" }, message: { type: "string" }, retryable: { type: "boolean" } } },
  },
} as const;

const sessionId = { type: "string", minLength: 1 } as const;
const actionSchema = {
  oneOf: [
    { type: "object", required: ["kind", "url"], additionalProperties: false, properties: { kind: { enum: ["navigate"] }, url: { type: "string", minLength: 1 } } },
    { type: "object", required: ["kind", "ref"], additionalProperties: false, properties: { kind: { enum: ["click"] }, ref: { type: "string", minLength: 1 } } },
    { type: "object", required: ["kind", "ref", "text"], additionalProperties: false, properties: { kind: { enum: ["type"] }, ref: { type: "string", minLength: 1 }, text: { type: "string" } } },
    { type: "object", required: ["kind", "ref", "value"], additionalProperties: false, properties: { kind: { enum: ["select"] }, ref: { type: "string", minLength: 1 }, value: { type: "string" } } },
    { type: "object", required: ["kind", "ref", "key"], additionalProperties: false, properties: { kind: { enum: ["press"] }, ref: { type: "string", minLength: 1 }, key: { type: "string", minLength: 1 } } },
    { type: "object", required: ["kind"], additionalProperties: false, properties: { kind: { enum: ["scroll"] }, x: { type: "number" }, y: { type: "number" } } },
    { type: "object", required: ["kind"], additionalProperties: false, properties: { kind: { enum: ["wait"] }, ref: { type: "string", minLength: 1 }, text: { type: "string" }, timeoutMs: { type: "integer", minimum: 1 } } },
  ],
} as const;
const assertionSchema = {
  oneOf: [
    { type: "object", required: ["kind", "expected"], additionalProperties: false, properties: { kind: { enum: ["title", "url", "text"] }, expected: { type: "string" } } },
    { type: "object", required: ["kind", "ref"], additionalProperties: false, properties: { kind: { enum: ["visible"] }, ref: { type: "string", minLength: 1 } } },
    { type: "object", required: ["kind", "ref", "expected"], additionalProperties: false, properties: { kind: { enum: ["value"] }, ref: { type: "string", minLength: 1 }, expected: { type: "string" } } },
  ],
} as const;

const emitBrowserArtifacts = (
  context: McpInvocationContext,
  result: BrowserToolResult,
) => {
  for (const artifact of result.artifacts) {
    context.addArtifact({
      kind: artifact.kind === "screenshot" ? "image" : "text",
      title: artifact.title,
      uri: artifact.uri,
      metadata: { browserArtifactId: artifact.id },
    });
  }
};

const requireObject = <T extends object>(value: unknown, name: string): T => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw mcpBadRequest(`${name} must be an object`);
  }
  return value as T;
};

export const createComputerUseBrowserTools = (browser: BrowserService): McpToolImplementation[] => {
  const observe: McpToolImplementation = {
    definition: {
      id: "browser_observe",
      title: "Browser Observe",
      description: "Read the current managed browser page as structured state.",
      domain: "browser_action",
      source: "internal",
      mode: "sync",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["sessionId"],
        properties: {
          sessionId,
          includeScreenshot: { type: "boolean" },
          includeVisibleText: { type: "boolean" },
          maxSnapshotChars: { type: "integer", minimum: 100, maximum: 50000 },
        },
      },
      outputSchema: browserResultSchema,
      tags: ["computer-use", "browser", "observe"],
      capabilities: { sideEffect: "none", requiresApproval: false, networkAccess: true },
    },
    execute: async (context) => {
      const result = await browser.observe(requireObject<BrowserInspectInput>(context.args, "args"));
      emitBrowserArtifacts(context, result);
      return { result };
    },
  };

  const act: McpToolImplementation = {
    definition: {
      id: "browser_act",
      title: "Browser Act",
      description: "Perform one ref-bound action in the managed browser.",
      domain: "browser_action",
      source: "internal",
      mode: "sync",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["sessionId", "pageUrl", "snapshotHash", "action"],
        properties: {
          sessionId,
          pageUrl: { type: "string", minLength: 1 },
          snapshotHash: { type: "string", minLength: 1 },
          action: {
            ...actionSchema,
          },
        },
      },
      outputSchema: browserResultSchema,
      tags: ["computer-use", "browser", "act"],
      capabilities: { sideEffect: "network", requiresApproval: true, networkAccess: true },
    },
    execute: async (context) => {
      const result = await browser.act(requireObject<BrowserActInput>(context.args, "args"));
      emitBrowserArtifacts(context, result);
      return { result };
    },
  };

  const assert: McpToolImplementation = {
    definition: {
      id: "browser_assert",
      title: "Browser Assert",
      description: "Verify structured state in the managed browser.",
      domain: "browser_action",
      source: "internal",
      mode: "sync",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["sessionId", "assertion"],
        properties: {
          sessionId,
          assertion: {
            ...assertionSchema,
          },
        },
      },
      outputSchema: browserResultSchema,
      tags: ["computer-use", "browser", "assert"],
      capabilities: { sideEffect: "none", requiresApproval: false, networkAccess: true },
    },
    execute: async (context) => {
      const result = await browser.assert(requireObject<BrowserAssertInput>(context.args, "args"));
      emitBrowserArtifacts(context, result);
      return { result };
    },
  };

  return [observe, act, assert];
};
