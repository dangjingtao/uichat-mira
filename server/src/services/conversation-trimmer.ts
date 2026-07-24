import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import {
  estimateMessageTokens,
  estimateTextTokens,
} from "@/services/context-budget/token-estimator.js";

const TEXT_PART_OVERHEAD_TOKENS = 6;

export type ConversationTrimDirection = "head" | "tail";

/**
 * Shared trimming mechanics for conversation-like data.
 *
 * This class intentionally does not own policy. Callers still decide their own
 * message counts, character caps, token budgets, role filters and exclusions.
 */
export class ConversationTrimmer {
  static take<T>(
    items: readonly T[],
    limit: number,
    direction: ConversationTrimDirection = "tail",
  ): T[] {
    const normalizedLimit = Math.max(0, Math.floor(limit));
    if (normalizedLimit === 0 || items.length === 0) return [];
    if (items.length <= normalizedLimit) return [...items];
    return direction === "head"
      ? items.slice(0, normalizedLimit)
      : items.slice(-normalizedLimit);
  }

  static trimText(
    value: string,
    maxChars: number,
    options: { ellipsis?: boolean } = {},
  ): string {
    const normalizedLimit = Math.max(0, Math.floor(maxChars));
    if (value.length <= normalizedLimit) return value;
    if (normalizedLimit === 0) return "";
    if (options.ellipsis === false) return value.slice(0, normalizedLimit);
    if (normalizedLimit === 1) return "…";
    return `${value.slice(0, normalizedLimit - 1)}…`;
  }

  static toTokenBudget(
    messages: readonly NormalizedChatMessage[],
    tokenBudget: number,
    direction: ConversationTrimDirection,
  ): NormalizedChatMessage[] {
    if (tokenBudget <= 0 || messages.length === 0) return [];

    const ordered = direction === "tail" ? [...messages].reverse() : [...messages];
    const kept: NormalizedChatMessage[] = [];
    let usedTokens = 0;

    for (const message of ordered) {
      const tokens = estimateMessageTokens(message);
      const remaining = tokenBudget - usedTokens;
      if (tokens <= remaining) {
        kept.push(message);
        usedTokens += tokens;
        continue;
      }

      const trimmed = this.trimMessageToTokenBudget(message, remaining);
      if (trimmed) kept.push(trimmed);
      break;
    }

    return direction === "tail" ? kept.reverse() : kept;
  }

  private static trimMessageToTokenBudget(
    message: NormalizedChatMessage,
    tokenBudget: number,
  ): NormalizedChatMessage | null {
    const contentBudget = Math.max(tokenBudget - TEXT_PART_OVERHEAD_TOKENS, 0);
    const content = this.trimTextToTokenBudget(message.content, contentBudget);
    if (!content.trim()) return null;

    return {
      role: message.role,
      content,
    };
  }

  private static trimTextToTokenBudget(text: string, tokenBudget: number) {
    if (tokenBudget <= 0) return "";
    if (estimateTextTokens(text) <= tokenBudget) return text;

    const chars = Array.from(text);
    let low = 0;
    let high = chars.length;
    let best = "";

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = chars.slice(0, mid).join("");
      if (estimateTextTokens(candidate) <= tokenBudget) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return best.trimEnd();
  }
}
