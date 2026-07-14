import type { McpInvocationContext, McpToolImplementation } from "../core/definitions.js";
import { McpApprovalRequiredError, mcpBadRequest } from "../core/errors.js";
import {
  createMailCenterService,
  type MailQueryInput,
  type MailQueryResult,
} from "@/microapps/mail-center/index.js";

const MAX_LIMIT = 100;

const normalizeInput = (args: Record<string, unknown>): Omit<MailQueryInput, "userId"> => {
  const input = { ...args } as Omit<MailQueryInput, "userId">;
  if (input.limit !== undefined && (!Number.isFinite(input.limit) || input.limit < 1)) {
    throw mcpBadRequest("limit must be a positive number");
  }
  if (input.includeBody !== undefined && typeof input.includeBody !== "boolean") {
    throw mcpBadRequest("includeBody must be a boolean");
  }
  if (input.sync !== undefined && !["none", "if-stale", "force"].includes(input.sync)) {
    throw mcpBadRequest("sync must be one of none, if-stale, or force");
  }
  return {
    ...input,
    ...(input.limit !== undefined ? { limit: Math.min(Math.floor(input.limit), MAX_LIMIT) } : {}),
  };
};

const safeResult = (result: MailQueryResult): MailQueryResult => ({
  sync: result.sync,
  items: result.items.map((item) => ({
    ...item,
    previewText: item.previewText.slice(0, 4000),
    ...(item.textContent !== undefined ? { textContent: item.textContent.slice(0, 20_000) } : {}),
  })),
  total: result.total,
  nextCursor: result.nextCursor,
});

const getUserId = (context: McpInvocationContext) => {
  if (context.userId === undefined || !Number.isInteger(context.userId)) {
    throw mcpBadRequest("mail_query requires a trusted authenticated user context");
  }
  return context.userId;
};

export const mailQueryTool: McpToolImplementation = {
  definition: {
    id: "mail_query",
    title: "Mail Query",
    description: "Search and inspect the current user's locally cached email.",
    domain: "mail",
    source: "internal",
    mode: "sync",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        accountId: { type: "string" },
        messageIds: { type: "array", items: { type: "string" }, maxItems: 100 },
        query: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        subject: { type: "string" },
        since: { type: "string" },
        until: { type: "string" },
        unreadOnly: { type: "boolean" },
        flaggedOnly: { type: "boolean" },
        hasAttachments: { type: "boolean" },
        includeBody: { type: "boolean" },
        sync: { type: "string", enum: ["none", "if-stale", "force"] },
        limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT },
        cursor: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      required: ["sync", "items", "total", "nextCursor"],
      properties: {
        sync: { type: "object" },
        items: { type: "array", items: { type: "object" } },
        total: { type: "integer" },
        nextCursor: { type: ["string", "null"] },
      },
    },
    tags: ["mail", "email", "private", "inbox", "search"],
    capabilities: {
      sideEffect: "network",
      requiresApproval: false,
      networkAccess: true,
      longRunning: true,
    },
  },
  execute: async (context) => {
    const userId = getUserId(context);
    const input = normalizeInput(context.args);
    if (input.sync === "force" && !context.approval?.granted) {
      throw new McpApprovalRequiredError(
        "mail_query force sync requires explicit approval for network access and local persistence.",
        { scope: "mail_sync" },
      );
    }
    const ownershipSpan = context.trace.startSpan({
      name: "Validate mail account ownership",
      kind: "permission_check",
      metadata: { accountRequested: typeof input.accountId === "string" },
    });
    try {
      const result = await createMailCenterService().queryMail({ ...input, userId });
      ownershipSpan.end({
        metadata: {
          syncRequested: result.sync.requested,
          syncPerformed: result.sync.performed,
          syncStatus: result.sync.status,
        },
      });
      const normalized = safeResult(result);
      context.trace.startSpan({
        name: "Normalize mail query result",
        kind: "result_normalization",
        metadata: {
          itemCount: normalized.items.length,
          syncStatus: normalized.sync.status,
          bodyIncluded: input.includeBody === true,
        },
      }).end();
      context.addArtifact({
        kind: "table",
        title: "Mail query results",
        data: normalized.items,
        metadata: { resultCount: normalized.items.length, sensitiveFieldsExcluded: true },
      });
      return { result: normalized };
    } catch (error) {
      ownershipSpan.end({ status: "failed" });
      throw error;
    }
  },
};
