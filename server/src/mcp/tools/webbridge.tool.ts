import type { McpInvocationContext, McpToolImplementation } from "../core/definitions.js";
import { mcpBadRequest } from "../core/errors.js";
import { invokeWebBridge } from "@/routes/webbridge.js";

const modes = {
  look: ["page", "snapshot", "element", "screenshot", "tabs"],
  browse: ["open", "new", "switch", "close", "back", "forward", "reload", "scroll", "scrollTo", "paginate", "wait"],
  act: ["click", "hover", "drag", "fill", "select", "press", "dialog"],
  transfer: ["upload", "download"],
} as const;

const createWebBridgeTool = (tool: keyof typeof modes): McpToolImplementation => ({
  definition: {
    id: `webbridge_${tool}`,
    title: `见行 ${tool}`,
    description: `通过当前用户已连接的触界 Chrome 扩展执行浏览器${tool}操作。先使用 webbridge_look 观察页面，再使用稳定 ref 执行操作。`,
    domain: "browser_action",
    source: "internal",
    mode: "sync",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: [],
      properties: {
        mode: { type: "string", enum: modes[tool] },
        ref: { type: "string" },
        tabId: { type: "integer" },
        url: { type: "string" },
        amount: { type: "number" },
        value: {},
        fields: { type: "array" },
        file: { type: "object" },
        key: { type: "string" },
        fromRef: { type: "string" },
        toRef: { type: "string" },
        after: { type: "object" },
      },
    },
    tags: ["webbridge", "browser", tool],
    capabilities: { sideEffect: tool === "look" ? "none" : "network", requiresApproval: tool === "act" || tool === "transfer", networkAccess: true },
  },
  execute: async (context: McpInvocationContext) => {
    if (context.userId === undefined || !Number.isInteger(context.userId)) {
      throw mcpBadRequest("WebBridge requires a trusted authenticated user context");
    }
    const mode = typeof context.args.mode === "string" ? context.args.mode : undefined;
    if (mode && !(modes[tool] as readonly string[]).includes(mode)) {
      throw mcpBadRequest(`${tool}.mode is not supported: ${mode}`);
    }
    const result = await invokeWebBridge({ userId: context.userId, tool, params: context.args, signal: context.signal });
    return {
      result,
      evidence: {
        actionTaken: `Called connected Chrome WebBridge ${tool}.`,
        facts: [`tool=${tool}`, `userId=${context.userId}`],
        status: "completed",
        data: result,
      },
    };
  },
});

export const createWebBridgeTools = () => (["look", "browse", "act", "transfer"] as const).map(createWebBridgeTool);
