import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { contextBudgetService } from "@/services/context-budget/index";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import { generateNode } from "../nodes/index";
import type { AgentNodeState } from "../node-runtime";

const makeState = (): AgentNodeState => ({
  runId: "run-mail-query",
  threadId: "thread-mail-query",
  userId: 1,
  goal: {
    id: "goal-mail-query",
    text: "我最近邮件有啥值得关注的",
    successCriteria: ["summarize noteworthy recent email"],
    constraints: [],
    riskLevel: "low",
  },
  messages: [
    {
      role: "user",
      content: "我最近邮件有啥值得关注的",
      parts: [{ type: "text", text: "我最近邮件有啥值得关注的" }],
    },
  ],
  observations: [],
  evidence: {
    observations: [],
    retrievals: [],
    toolExecutions: [
      {
        toolCallId: "mail-call-1",
        toolId: "mail_query",
        args: { limit: 20 },
        inputHash: "mail-hash-1",
        status: "completed",
        result: {
          messages: [
            { subject: "GitHub Actions failed", unread: true },
            { subject: "信用卡电子账单", unread: true },
          ],
          total: 2,
        },
        summary: {
          source: "tool",
          status: "partial",
          toolId: "mail_query",
          inputHash: "mail-hash-1",
          actionTaken: "mail_query returned structured data.",
          keyFindings: ["2 recent messages returned"],
          data: {
            kind: "generic_structured",
            preview: { total: 2 },
            truncated: false,
            redacted: false,
            unsupported: false,
            total: 2,
          },
        },
        startedAt: "2026-07-19T00:00:00.000Z",
        finishedAt: "2026-07-19T00:00:01.000Z",
      },
    ],
  },
});

vi.spyOn(contextBudgetService, "pack").mockImplementation((input) => ({
  messages: [],
  payloads: [],
  audit: {
    policy: input.policy,
    model: "test-model",
    providerCode: "test-provider",
    modelContextTokens: 8192,
    reservedOutputTokens: 1024,
    maxInputTokens: 7168,
    totalEstimatedTokensBefore: 0,
    totalEstimatedTokensAfter: 0,
    sections: [],
    warnings: [],
  },
}));

vi.spyOn(providerProxyService, "describeChatInvocation").mockImplementation(
  (_provider, messages) => ({
    operation: "chat",
    providerCode: "test-provider",
    requestedProvider: "default",
    resolvedProvider: "default",
    model: "test-model",
    modelConfigId: "test-model-config",
    messageCount: messages.length,
    messagesPreview: [],
  }),
);

afterEach(() => {
  vi.restoreAllMocks();
});

test("Generate does not let a partial Evidence summary override a completed real tool result", async () => {
  let prompt = "";
  vi.spyOn(providerProxyService, "generateTextForRole").mockImplementation(
    async (_role, messages) => {
      prompt = (messages as Array<{ content: string }>).map((message) => message.content).join("\n");
      return "最近值得关注的有两项：GitHub Actions 失败，以及一封信用卡电子账单。";
    },
  );

  const result = await generateNode(makeState());

  assert.match(prompt, /GitHub Actions failed/);
  assert.match(prompt, /信用卡电子账单/);
  assert.equal(
    result.answer,
    "最近值得关注的有两项：GitHub Actions 失败，以及一封信用卡电子账单。",
  );
  assert.doesNotMatch(result.answer ?? "", /没有足够的已完成证据/);
});
