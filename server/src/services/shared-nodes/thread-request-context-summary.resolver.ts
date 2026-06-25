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
    role: "system",
    content: createThreadContextSummaryPrompt(normalized),
  };
};
