import { createThreadContextSummaryPrompt } from "./thread-context-summary.node.js";
import type { RequestContextResolver } from "./thread-request-context.types.js";

/**
 * Summary resolver:
 * Reuses the dedicated summary prompt builder so summary wording stays
 * centralized and does not drift when we tweak summary behavior later.
 */
export const resolveSummaryContext: RequestContextResolver = ({ thread }) => {
  const normalized = thread.contextSummary?.trim();
  if (!normalized) {
    return null;
  }

  return {
    message: {
      role: "system",
      content: createThreadContextSummaryPrompt(normalized),
    },
    executionNode: {
      nodeId: `request-context-summary-${thread.contextSummaryUpdatedAt ?? "unknown"}`,
      nodeType: "context",
      phase: "done",
      label: "上下文摘要",
      summary: "已注入线程上下文摘要",
      details: {
        updatedAt: thread.contextSummaryUpdatedAt,
      },
    },
  };
};
