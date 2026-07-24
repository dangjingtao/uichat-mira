import { describe, expect, it } from "vitest";
import { estimateMessagesTokens } from "./context-budget/token-estimator.js";
import { ConversationTrimmer } from "./conversation-trimmer.js";

const message = (content: string) => ({
  role: "user" as const,
  content,
});

describe("ConversationTrimmer", () => {
  it("keeps caller-owned head and tail count policies separate", () => {
    const values = [1, 2, 3, 4, 5];

    expect(ConversationTrimmer.take(values, 2, "head")).toEqual([1, 2]);
    expect(ConversationTrimmer.take(values, 2, "tail")).toEqual([4, 5]);
  });

  it("supports character trimming with or without ellipsis", () => {
    expect(ConversationTrimmer.trimText("abcdef", 4)).toBe("abc…");
    expect(
      ConversationTrimmer.trimText("abcdef", 4, { ellipsis: false }),
    ).toBe("abcd");
  });

  it("keeps the newest messages when applying a tail token budget", () => {
    const messages = [
      message("old ".repeat(100)),
      message("middle ".repeat(100)),
      message("newest"),
    ];

    const result = ConversationTrimmer.toTokenBudget(messages, 20, "tail");

    expect(result.at(-1)?.content).toBe("newest");
    expect(estimateMessagesTokens(result)).toBeLessThanOrEqual(20);
  });
});
