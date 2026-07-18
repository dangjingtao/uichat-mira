import assert from "node:assert/strict";
import { test } from "vitest";
import type { AgentNodeState } from "../node-runtime";
import type { AgentToolExecutionResult } from "../types";
import {
  buildExternalMcpGenerateContextText,
  createExternalMcpAwareGenerateNode,
} from "../nodes/external-mcp-generate-context";

const createExternalMcpExecution = (input: {
  toolId: string;
  remoteToolName: string;
  result: unknown;
}): AgentToolExecutionResult => ({
  toolCallId: `${input.toolId}-call`,
  toolId: input.toolId,
  inputHash: `${input.toolId}-hash`,
  args: {},
  status: "completed",
  result: {
    type: "external_mcp",
    serverId: "personal-mcp",
    remoteToolName: input.remoteToolName,
    recoveryOccurred: false,
    result: input.result,
  },
  summary: {
    source: "tool",
    status: "completed",
    toolId: input.toolId,
    actionTaken: `Called ${input.remoteToolName}.`,
    keyFindings: ["External MCP invocation completed."],
    data: {
      kind: "external_mcp",
      serverId: "personal-mcp",
      remoteToolName: input.remoteToolName,
      invocationStatus: "completed",
      recoveryOccurred: false,
      resultPreview: "short preview",
    },
  },
  startedAt: "2026-07-18T00:00:00.000Z",
  finishedAt: "2026-07-18T00:00:01.000Z",
});

test("mail_query keeps all twenty returned mail records for Generate", () => {
  const mails = Array.from({ length: 20 }, (_, index) => ({
    sender: `sender-${index + 1}@example.com`,
    subject: `Mail subject ${index + 1}`,
    receivedAt: `2026-07-${String(index + 1).padStart(2, "0")}T12:00:00Z`,
    preview: `This is the content preview for mail ${index + 1}.`,
    hasAttachments: index % 3 === 0,
  }));
  const text = buildExternalMcpGenerateContextText([
    createExternalMcpExecution({
      toolId: "mail_query",
      remoteToolName: "mail_query",
      result: { total: 111, items: mails },
    }),
  ]);

  assert.ok(text);
  assert.equal(text.includes("Mail subject 1"), true);
  assert.equal(text.includes("Mail subject 20"), true);
  assert.equal(text.includes("sender-20@example.com"), true);
  assert.equal(text.includes('"total": 111'), true);
  assert.equal(text.length > 280, true);
  assert.equal(text.includes("resultTruncated: false"), true);
});

test("discover_themes keeps later theme records instead of only the first preview", () => {
  const text = buildExternalMcpGenerateContextText([
    createExternalMcpExecution({
      toolId: "slideshow_discover_themes",
      remoteToolName: "discover_themes",
      result: {
        themes: [
          {
            id: "generic",
            name: "Clean Minimal",
            icon: "clipboard",
            style: "Inter font, white cards, flexible layout",
            colors: ["#FFF", "#1a1a1a", "#888"],
            tier: "primary",
          },
          {
            id: "branded",
            name: "Ketan Slides",
            icon: "sparkles",
            style: "Branded editorial presentation",
            colors: ["#121212", "#F4B942"],
            tier: "secondary",
          },
        ],
      },
    }),
  ]);

  assert.ok(text);
  assert.equal(text.includes("Clean Minimal"), true);
  assert.equal(text.includes("Ketan Slides"), true);
  assert.equal(text.includes("Branded editorial presentation"), true);
  assert.equal(text.includes("#F4B942"), true);
});

test("external MCP context is bounded and explicitly marks truncation", () => {
  const text = buildExternalMcpGenerateContextText(
    [
      createExternalMcpExecution({
        toolId: "large_query",
        remoteToolName: "large_query",
        result: {
          records: Array.from({ length: 100 }, (_, index) => ({
            id: index,
            content: `record-${index}-${"x".repeat(500)}`,
          })),
        },
      }),
    ],
    1_500,
  );

  assert.ok(text);
  assert.equal(text.length <= 1_500, true);
  assert.equal(text.includes("external MCP result truncated"), true);
  assert.equal(text.includes("resultTruncated: true"), true);
});

test("Generate receives bounded external MCP evidence before the latest user message", async () => {
  let capturedState: AgentNodeState | undefined;
  const generate = createExternalMcpAwareGenerateNode(async (state) => {
    capturedState = state;
    return { answer: "generated from external MCP evidence" };
  });
  const execution = createExternalMcpExecution({
    toolId: "mail_query",
    remoteToolName: "mail_query",
    result: {
      total: 2,
      items: [
        { subject: "First real mail", sender: "first@example.com" },
        { subject: "Second real mail", sender: "second@example.com" },
      ],
    },
  });
  const state = {
    runId: "run-external-mcp-generate",
    threadId: "thread-external-mcp-generate",
    userId: 1,
    goal: {
      id: "goal-external-mcp-generate",
      text: "Show my latest mail.",
      successCriteria: ["Show the returned mail records."],
      constraints: [],
      riskLevel: "low",
    },
    messages: [
      {
        role: "user" as const,
        content: "Show my latest mail.",
        parts: [{ type: "text" as const, text: "Show my latest mail." }],
      },
    ],
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [execution],
      latestSummary: execution.summary,
    },
    observations: [],
  } as AgentNodeState;

  const result = await generate(state);

  assert.equal(result.answer, "generated from external MCP evidence");
  assert.ok(capturedState);
  assert.equal(capturedState.messages.length, 2);
  assert.equal(capturedState.messages[0]?.role, "system");
  assert.equal(capturedState.messages[1]?.role, "user");
  assert.equal(capturedState.messages[0]?.content.includes("First real mail"), true);
  assert.equal(capturedState.messages[0]?.content.includes("Second real mail"), true);
  assert.equal(state.messages.length, 1);
});
