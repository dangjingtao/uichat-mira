import { describe, expect, it } from "vitest";
import { contextBudgetService, estimateMessagesTokens } from "./index.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.service/index.js";

const longText = (label: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${label}-${index}`).join(" ");

const makeMessage = (role: NormalizedChatMessage["role"], content: string) => ({
  role,
  content,
});

describe("contextBudgetService", () => {
  it("keeps the latest user message while trimming long history", () => {
    const result = contextBudgetService.pack({
      policy: "rag-chat",
      roleType: "llm",
      model: "qwen2.5:latest",
      sections: {
        prefaceMessages: [
          makeMessage("system", "request context"),
        ],
        instructionMessages: [
          makeMessage("system", "Use context:\n{context}"),
        ],
        payloads: [
          {
            id: "context",
            required: true,
            messages: [
              makeMessage("system", longText("payload", 2000)),
            ],
          },
        ],
        historyMessages: Array.from({ length: 20 }, (_, index) => ({
          role: index % 2 === 0 ? "user" : "assistant",
          content: longText(`history-${index}`, 500),
        })),
        latestUserMessage: {
          role: "user",
          content: "What is the answer?",
        },
      },
    });

    expect(result.messages.at(-1)).toMatchObject({
      role: "user",
      content: "What is the answer?",
    });
    expect(result.audit.sections.find((section) => section.name === "history"))
      .toMatchObject({
        action: "trimmed",
      });
    expect(result.audit.totalEstimatedTokensAfter).toBeLessThanOrEqual(
      result.audit.maxInputTokens,
    );
  });

  it("trims payload sections to the configured context budget", () => {
    const result = contextBudgetService.pack({
      policy: "rag-chat",
      roleType: "llm",
      model: "qwen2.5:latest",
      sections: {
        instructionMessages: [
          makeMessage("system", "Use context:\n{context}"),
        ],
        payloads: [
          {
            id: "payload-1",
            required: true,
            metadata: { source: "first" },
            messages: [
              makeMessage("system", longText("payload-a", 2000)),
            ],
          },
          {
            id: "payload-2",
            messages: [
              makeMessage("system", longText("payload-b", 2000)),
            ],
          },
        ],
        latestUserMessage: {
          role: "user",
          content: "Question",
        },
      },
    });

    expect(result.payloads.length).toBeGreaterThan(0);
    expect(result.payloads[0]?.id).toBe("payload-1");
    expect(result.payloads[0]?.metadata).toMatchObject({ source: "first" });
    expect(result.audit.sections.find((section) => section.name === "payload"))
      .toMatchObject({
        action: "trimmed",
      });
    expect(estimateMessagesTokens(result.messages)).toBeLessThanOrEqual(
      result.audit.maxInputTokens,
    );
  });
});
