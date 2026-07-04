import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { contextBudgetService } from "@/services/context-budget/index.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import { generateNode } from "./nodes.js";
import type { AgentNodeState } from "./node-runtime.js";

const baseGoal = {
  id: "goal-1",
  text: "answer the user",
  successCriteria: ["return an answer"],
  constraints: ["stay safe"],
  riskLevel: "low" as const,
};

const basePlan = {
  id: "plan-1",
  goalId: "goal-1",
  version: 1,
  steps: [],
};

const makeMessage = (content: string) => ({
  role: "user" as const,
  content,
  parts: [{ type: "text" as const, text: content }],
});

const createBaseState = (message: string): AgentNodeState => ({
  runId: "run-1",
  threadId: "thread-1",
  userId: 1,
  goal: { ...baseGoal, text: message },
  plan: basePlan,
  messages: [makeMessage(message)],
  observations: [],
  evidence: {
    observations: [],
    toolExecutions: [],
    retrievals: [],
  },
});

vi.spyOn(contextBudgetService, "pack").mockImplementation((input) => ({
  messages: [
    ...(input.sections.prefaceMessages ?? []),
    ...(input.sections.instructionMessages ?? []),
    ...((input.sections.payloads ?? []).flatMap((payload) => payload.messages)),
    ...(input.sections.historyMessages ?? []),
    input.sections.latestUserMessage,
  ],
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
  (_requestedProvider, messages) => ({
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
  vi.clearAllMocks();
});

test("generateNode rewrites tool-style output into a natural read_list answer grounded in evidence", async () => {
  const state = createBaseState("看看当前 workspace 有哪些文件");
  state.evidence = {
    observations: [],
    toolExecutions: [
      {
        toolId: "read_list",
        args: { path: "." },
        status: "completed",
        inputHash: "hash-read-list",
        result: {
          type: "list",
          path: ".",
          entries: [],
        },
        summary: {
          source: "tool",
          status: "completed",
          toolId: "read_list",
          inputHash: "hash-read-list",
          actionTaken: "Listed workspace directory .",
          keyFindings: ["entryCount=3", "[F] README.md", "[D] docs"],
          answerReadiness: {
            canAnswer: true,
            reason: "Directory listing is sufficient for the user's workspace overview question.",
          },
          data: {
            kind: "read_list",
            path: ".",
            entryCount: 3,
            fileCount: 2,
            directoryCount: 1,
            entriesPreview: ["[F] README.md", "[D] docs", "[F] package.json"],
            truncated: false,
            canAnswerDirectoryQuestion: true,
          },
        },
        startedAt: "2026-07-04T00:00:00.000Z",
        finishedAt: "2026-07-04T00:00:01.000Z",
      },
    ],
    retrievals: [],
  };
  state.evidence.latestSummary = state.evidence.toolExecutions[0]?.summary;

  const invokeSpy = vi
    .spyOn(providerProxyService, "generateTextForRole")
    .mockResolvedValue('<function_calls>{"toolId":"read_list"}</function_calls>');
  const executionEvents: Array<{
    nodeId: string;
    phase: string;
    details?: Record<string, unknown>;
  }> = [];

  const result = await generateNode(state, async (event) => {
    executionEvents.push({
      nodeId: event.nodeId,
      phase: event.phase,
      details:
        event.details && typeof event.details === "object"
          ? (event.details as Record<string, unknown>)
          : undefined,
    });
  });

  assert.equal(invokeSpy.mock.calls.length, 1);
  assert.match(result.answer ?? "", /README\.md/);
  assert.doesNotMatch(result.answer ?? "", /toolId|function_calls|pendingToolCall/i);
  const generateDoneEvent = executionEvents.find(
    (event) => event.nodeId === "agent-generate" && event.phase === "done",
  );
  assert.equal(generateDoneEvent?.details?.outputGuardTriggered, true);
});

test("generateNode rewrites pseudo-execution wording into a grounded read_open summary", async () => {
  const state = createBaseState("打开 README.md 看看内容");
  state.evidence = {
    observations: [],
    toolExecutions: [
      {
        toolId: "read_open",
        args: { path: "README.md" },
        status: "completed",
        inputHash: "hash-read-open",
        result: {},
        summary: {
          source: "tool",
          status: "completed",
          toolId: "read_open",
          inputHash: "hash-read-open",
          actionTaken: "Opened file README.md.",
          keyFindings: ["contentLength=42", "# UIChat Mira"],
          answerReadiness: {
            canAnswer: true,
            reason: "Opened file content is available for answer generation.",
          },
          data: {
            kind: "read_open",
            path: "README.md",
            contentPreview: "# UIChat Mira UIChat Mira is a local-first desktop workspace.",
            contentLength: 42,
            truncated: false,
            keySections: ["UIChat Mira"],
            canAnswerFileQuestion: true,
          },
        },
        startedAt: "2026-07-04T00:00:00.000Z",
        finishedAt: "2026-07-04T00:00:01.000Z",
      },
    ],
    retrievals: [],
  };
  state.evidence.latestSummary = state.evidence.toolExecutions[0]?.summary;

  vi.spyOn(providerProxyService, "generateTextForRole").mockResolvedValue(
    "我将调用 read_open 来打开 README.md。",
  );

  const result = await generateNode(state);

  assert.match(result.answer ?? "", /README\.md/);
  assert.match(result.answer ?? "", /UIChat Mira/);
  assert.doesNotMatch(result.answer ?? "", /我将调用|read_open/);
});

test("generateNode rewrites retrieval JSON output into a grounded retrieval answer", async () => {
  const state = createBaseState("看看 README.md 的内容");
  state.evidence = {
    observations: [],
    toolExecutions: [],
    retrievals: [
      {
        query: "README.md content",
        chunkCount: 1,
        chunks: [
          {
            chunkId: "chunk-1",
            documentName: "README.md",
            score: 0.9,
            content: "README says UIChat Mira is a local-first desktop workspace.",
          },
        ],
        summary: {
          source: "retrieval",
          status: "completed",
          actionTaken: 'Retrieved 1 knowledge chunk(s) for query "README.md content".',
          keyFindings: ["query=README.md content", "chunkCount=1", "document=README.md"],
          answerReadiness: {
            canAnswer: true,
            reason: "Retrieved knowledge evidence is available for answer generation.",
          },
          data: {
            kind: "retrieval",
            query: "README.md content",
            chunkCount: 1,
            documentsPreview: ["README.md"],
          },
        },
        createdAt: "2026-07-04T00:00:00.000Z",
      },
    ],
  };
  state.evidence.latestSummary = state.evidence.retrievals[0]?.summary;

  vi.spyOn(providerProxyService, "generateTextForRole").mockResolvedValue(
    '{"type":"retrieve","query":"README.md content"}',
  );

  const result = await generateNode(state);

  assert.match(result.answer ?? "", /README\.md/);
  assert.doesNotMatch(result.answer ?? "", /\"type\"|retrieve/i);
});

test("generateNode replaces unverified observation claims when no completed evidence exists", async () => {
  const state = createBaseState("看看当前 workspace 有哪些文件");
  vi.spyOn(providerProxyService, "generateTextForRole").mockResolvedValue(
    "我已经查看了当前 workspace，里面有很多文件。",
  );

  const result = await generateNode(state);

  assert.match(result.answer ?? "", /当前还没有足够的已完成证据/);
  assert.doesNotMatch(result.answer ?? "", /我已经查看了/);
});

test("generateNode explains waiting approval instead of pretending execution already happened", async () => {
  const state = createBaseState("执行 dir 命令看看结果");
  state.pendingApproval = {
    id: "approval-1",
    runId: "run-1",
    stepId: "tool",
    toolId: "terminal_session",
    reason: "needs approval",
    input: { command: "dir" },
    inputHash: "hash-dir",
    createdAt: "2026-07-04T00:00:00.000Z",
  };
  vi.spyOn(providerProxyService, "generateTextForRole").mockResolvedValue(
    "命令已经执行完成，输出如下：...",
  );

  const result = await generateNode(state);

  assert.match(result.answer ?? "", /等待审批|还没有真实执行结果/);
  assert.doesNotMatch(result.answer ?? "", /已经执行完成/);
});
