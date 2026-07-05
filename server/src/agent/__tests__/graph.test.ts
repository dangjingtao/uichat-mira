import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import * as harnessInvocations from "@/harness/invocations";
import * as registry from "@/harness/registry";
import { contextBudgetService } from "@/services/context-budget/index";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import * as intentMatcherModule from "../intent/embedding-capability-matcher";
import * as taskSelectorModule from "../intent/task-capability-selector";
import * as runnablesModule from "../runnables";
import { createInvocationInputHash } from "../approval-fingerprint";
import { agentGraph } from "../graph";
import { routeAfterRetrieve, routeAfterTool } from "../graph/routes";

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

const makeRouteState = (overrides: Record<string, unknown> = {}) =>
  ({
    iterationCount: 0,
    maxIterations: 3,
    pendingApproval: undefined,
    errorMessage: undefined,
    ...overrides,
  }) as Parameters<typeof routeAfterTool>[0];

const isToolExecutionNodeId = (nodeId: string) =>
  nodeId === "agent-tool" || /^agent-tool-\d+$/.test(nodeId);

const makeToolDefinition = (input: {
  id: string;
  title?: string;
  description?: string;
  domain: string;
  inputSchema: Record<string, unknown>;
  sideEffect?: "none" | "network" | "process" | "local-write";
  requiresApproval?: boolean;
}) => ({
  id: input.id,
  title: input.title ?? input.id,
  description: input.description ?? input.id,
  domain: input.domain,
  source: "internal" as const,
  mode: "sync" as const,
  inputSchema: input.inputSchema,
  tags: [input.domain],
  capabilities: {
    sideEffect: input.sideEffect ?? "none",
    requiresApproval: input.requiresApproval ?? false,
  },
});

const makeToolIntentResult = (input: {
  query: string;
  topCandidates?: Array<{
    toolId: string;
    title?: string;
    description?: string;
    domain: string;
    score?: number;
  }>;
  exposedDefinitions?: Array<ReturnType<typeof makeToolDefinition>>;
}) => {
  const topCandidates = input.topCandidates ?? [];
  const exposedDefinitions = input.exposedDefinitions ?? [];
  return {
    query: input.query,
    topCandidates: topCandidates.map((candidate) => ({
      toolId: candidate.toolId,
      title: candidate.title ?? candidate.toolId,
      description: candidate.description ?? candidate.toolId,
      domain: candidate.domain,
      source: "internal" as const,
      tags: [candidate.domain],
      score: candidate.score ?? 0.9,
      embeddingScore: candidate.score ?? 0.9,
      ruleScore: 0,
      rerankScore: candidate.score ?? 0.9,
      finalScore: candidate.score ?? 0.9,
    })),
    toolCandidates: topCandidates.map((candidate) => ({
      toolId: candidate.toolId,
      title: candidate.title ?? candidate.toolId,
      description: candidate.description ?? candidate.toolId,
      domain: candidate.domain,
      source: "internal" as const,
      tags: [candidate.domain],
      score: candidate.score ?? 0.9,
      embeddingScore: candidate.score ?? 0.9,
      ruleScore: 0,
      rerankScore: candidate.score ?? 0.9,
      finalScore: candidate.score ?? 0.9,
    })),
    toolExposure: {
      exposedToolIds: exposedDefinitions.map((definition) => definition.id),
      exposedDefinitions,
      reason: [],
      blockedCapabilityIds: [],
    },
    selectedToolIds: [],
    candidateToolIds: [],
    decisionSource: "task-model" as const,
    decisionReason: "test",
  };
};

vi.spyOn(contextBudgetService, "pack").mockImplementation((input) => {
  const messages = [
    ...(input.sections.prefaceMessages ?? []),
    ...(input.sections.instructionMessages ?? []),
    ...((input.sections.payloads ?? []).flatMap((payload) => payload.messages)),
    ...(input.sections.historyMessages ?? []),
    input.sections.latestUserMessage,
  ];

  return {
    messages,
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
  };
});

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

test("agentGraph routes planner answer to generate without entering normalize or tool execution", async () => {
  const webSearch = makeToolDefinition({
    id: "web_search",
    domain: "web_search",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
      additionalProperties: false,
    },
    sideEffect: "network",
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([webSearch]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "latest release notes",
      topCandidates: [{ toolId: "web_search", domain: "web_search" }],
      exposedDefinitions: [webSearch],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["web_search"],
    decisionSource: "task-model",
    decisionReason: "The old selector still sees a tool candidate.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"answer","reason":"The question can be answered directly."}';
    });
  const executeHarnessInvocationSpy = vi.spyOn(
    harnessInvocations,
    "executeHarnessInvocation",
  );
  const ragInvokeSpy = vi
    .spyOn(runnablesModule.agentRagRunnable, "invoke")
    .mockResolvedValue({
      answer: "",
      sources: [],
    });
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("final answer");
  const executionNodes: Array<{
    nodeId: string;
    phase: string;
    details?: Record<string, unknown>;
  }> = [];

  const result = await agentGraph.run({
    runId: "run-answer",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "latest release notes",
    },
    plan: basePlan,
    messages: [makeMessage("latest release notes")],
    onExecutionNode: async (event) => {
      executionNodes.push({
        nodeId: event.nodeId,
        phase: event.phase,
        details:
          event.details && typeof event.details === "object"
            ? (event.details as Record<string, unknown>)
            : undefined,
      });
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(result.answer, "final answer");
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(ragInvokeSpy.mock.calls.length, 0);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 0);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
  assert.equal(
    executionNodes.some((event) => event.nodeId === "agent-tool-call-normalize"),
    false,
  );
  assert.equal(
    executionNodes.some((event) => event.nodeId.startsWith("agent-policy")),
    false,
  );
  const plannerDoneEvent = executionNodes.find(
    (event) =>
      event.nodeId === "agent-next-action-planner" && event.phase === "done",
  );
  assert.equal(plannerDoneEvent?.details?.selectedActionType, "answer");
});

test("agentGraph preserves planner error reason instead of falling back to Unknown agent error", async () => {
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "broken planner output",
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: [],
    decisionSource: "task-model",
    decisionReason: "No direct tool candidate is required.",
  });
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementation(
    async function* () {
      yield "not-json";
    },
  );
  const generateInvokeSpy = vi.spyOn(
    runnablesModule.agentGenerateTextRunnable,
    "invoke",
  );
  const executionNodes: Array<{
    nodeId: string;
    phase: string;
    summary?: string;
    details?: Record<string, unknown>;
  }> = [];

  const result = await agentGraph.run({
    runId: "run-planner-error",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "broken planner output",
    },
    plan: basePlan,
    messages: [makeMessage("broken planner output")],
    onExecutionNode: async (event) => {
      executionNodes.push({
        nodeId: event.nodeId,
        phase: event.phase,
        summary: event.summary,
        details:
          event.details && typeof event.details === "object"
            ? (event.details as Record<string, unknown>)
            : undefined,
      });
    },
  });

  assert.equal(result.status, "failed");
  assert.equal(
    result.errorMessage,
    "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
  );
  assert.equal(result.blockedReason, result.errorMessage);
  assert.equal(result.errorSourceNodeId, "agent-next-action-planner");
  assert.equal(generateInvokeSpy.mock.calls.length, 0);
  const errorEvent = executionNodes.find(
    (event) => event.nodeId === "agent-error" && event.phase === "error",
  );
  assert.equal(errorEvent?.summary, result.errorMessage);
  assert.equal(errorEvent?.details?.sourceNodeId, "agent-next-action-planner");
});

test("agentGraph routes retrieve evidence back to planner and answer stop rule without a second planner model call", async () => {
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "summarize the knowledge base",
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: [],
    decisionSource: "task-model",
    decisionReason: "No tool is needed for this turn.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"retrieve","query":"release notes","reason":"Need knowledge evidence first."}';
    });
  const ragInvokeSpy = vi
    .spyOn(runnablesModule.agentRagRunnable, "invoke")
    .mockResolvedValue({
      answer: "",
      sources: [
        {
          chunkId: "chunk-1",
          documentName: "Release Notes",
          score: 0.91,
          content: "Version 2.0 shipped.",
        },
      ],
    });
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("summarized answer");
  const executionNodes: Array<{
    nodeId: string;
    details?: Record<string, unknown>;
  }> = [];

  const result = await agentGraph.run({
    runId: "run-retrieve",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "summarize the knowledge base",
    },
    plan: basePlan,
    knowledgeBaseId: "kb-1",
    messages: [makeMessage("summarize the knowledge base")],
    onExecutionNode: async (event) => {
      executionNodes.push({
        nodeId: event.nodeId,
        details:
          event.details && typeof event.details === "object"
            ? (event.details as Record<string, unknown>)
            : undefined,
      });
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(result.answer, "summarized answer");
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(ragInvokeSpy.mock.calls.length, 1);
  assert.equal(ragInvokeSpy.mock.calls[0]?.[0]?.question, "release notes");
  assert.equal(result.evidence.retrievals.length, 1);
  assert.equal(result.evidence.retrievals[0]?.query, "release notes");
  assert.equal(result.evidence.latestSummary?.source, "retrieval");
  assert.equal(result.evidence.latestSummary?.answerReadiness.canAnswer, true);
  assert.equal(
    executionNodes.filter((event) => event.nodeId === "agent-next-action-planner").length >= 2,
    true,
  );
  const evidenceUpdateEvent = executionNodes.find(
    (event) => event.nodeId === "agent-evidence-update-retrieve",
  );
  assert.equal(evidenceUpdateEvent?.details?.sourceNode, "retrieveNode");
  assert.equal(evidenceUpdateEvent?.details?.retrievalChunkCount, 1);
});

test("agentGraph reroutes workspace-local planner web_search into local read evidence when web_search is still exposed", async () => {
  const webSearch = makeToolDefinition({
    id: "web_search",
    domain: "web_search",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
      additionalProperties: false,
    },
    sideEffect: "network",
  });
  const readLocate = makeToolDefinition({
    id: "read_locate",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
      additionalProperties: false,
    },
    sideEffect: "none",
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([
    webSearch,
    readLocate,
  ]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "请检索 workspace 中关于 UIChat Mira 的说明",
      topCandidates: [{ toolId: "web_search", domain: "web_search" }],
      exposedDefinitions: [readLocate, webSearch],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["web_search"],
    decisionSource: "task-model",
    decisionReason: "A web tool candidate exists.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"web_search","args":{"query":"UIChat Mira 说明"},"reason":"Need information."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(
      harnessInvocations,
      "executeHarnessInvocation",
    )
    .mockResolvedValue({
      id: "invocation-read-locate-guard-1",
      toolId: "read_locate",
      status: "completed",
      result: {
        type: "locate",
        scope: ".",
        query: "UIChat Mira",
        searchMode: "content",
        matches: [
          {
            path: "README.md",
            matchType: "content",
            preview: "UIChat Mira is a local-first desktop workspace.",
          },
        ],
      },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    });
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("local grounded answer");
  const result = await agentGraph.run({
    runId: "run-workspace-intent-guard",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "请检索 workspace 中关于 UIChat Mira 的说明",
    },
    plan: basePlan,
    workspaceRoot: "D:\\workspace\\rag-demo",
    knowledgeBaseId: "kb-1",
    messages: [makeMessage("请检索 workspace 中关于 UIChat Mira 的说明")],
  });

  assert.equal(result.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.equal(result.evidence.retrievals.length, 0);
  assert.equal(result.evidence.toolExecutions.length, 1);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
});

test("agentGraph routes planner use_tool through normalize and answer stop rule without a second planner model call", async () => {
  const readOpen = makeToolDefinition({
    id: "read_open",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([readOpen]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "open README.md",
      topCandidates: [{ toolId: "read_open", domain: "read" }],
      exposedDefinitions: [readOpen],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["read_open"],
    decisionSource: "task-model",
    decisionReason: "A read tool is available for inspection.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need the file content."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-read-open-1",
      toolId: "read_open",
      status: "completed",
      result: {
        type: "open",
        path: "README.md",
        source: {
          kind: "text",
          mimeType: "text/markdown",
          text: "# README\n\nProject overview",
          metadata: {},
        },
      },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    });
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("README content answer");
  const executionNodes: string[] = [];

  const result = await agentGraph.run({
    runId: "run-use-tool",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "open README.md",
    },
    plan: basePlan,
    messages: [makeMessage("open README.md")],
    onExecutionNode: async (event) => {
      executionNodes.push(event.nodeId);
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.deepEqual(executeHarnessInvocationSpy.mock.calls[0]?.[0], {
    toolId: "read_open",
    args: {
      path: "README.md",
    },
    userId: 1,
    threadId: "thread-1",
    approvedInvocations: undefined,
  });
  assert.equal(result.evidence.toolExecutions.length, 1);
  assert.equal(result.evidence.latestSummary?.toolId, "read_open");
  assert.equal(result.evidence.latestSummary?.answerReadiness.canAnswer, true);
  assert.equal(result.evidence.toolExecutions[0]?.toolCallId, result.lastToolExecution?.toolCallId);
  assert.equal(result.evidence.toolExecutions[0]?.inputHash, result.lastToolExecution?.inputHash);
  assert.equal(result.lastToolExecution?.toolId, "read_open");
  assert.equal(typeof result.lastToolExecution?.toolCallId, "string");
  assert.equal(result.pendingToolCall, undefined);
  assert.equal(
    executionNodes.indexOf("agent-tool-call-normalize") <
      executionNodes.findIndex((nodeId) => nodeId.startsWith("agent-policy")),
    true,
  );
  assert.equal(
    executionNodes.findIndex((nodeId) => nodeId.startsWith("agent-policy")) <
      executionNodes.findIndex((nodeId) => isToolExecutionNodeId(nodeId)),
    true,
  );
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
});

test("agentGraph blocks a repeated completed tool call in the same run and does not execute the tool twice", async () => {
  const customReadTool = makeToolDefinition({
    id: "read_note",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([customReadTool]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "inspect NOTE.md",
      topCandidates: [{ toolId: "read_note", domain: "read" }],
      exposedDefinitions: [customReadTool],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["read_note"],
    decisionSource: "task-model",
    decisionReason: "A custom read tool is available.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_note","args":{"path":"NOTE.md"},"reason":"Need the note content."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_note","args":{"path":"NOTE.md"},"reason":"Try the same note again."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-read-note-1",
      toolId: "read_note",
      status: "completed",
      result: {
        note: "plain payload without a dedicated summary contract",
      },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    });
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("best effort answer from existing evidence");
  const executionNodes: Array<{
    nodeId: string;
    phase: string;
    details?: Record<string, unknown>;
  }> = [];

  const result = await agentGraph.run({
    runId: "run-repeated-tool-guard",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "inspect NOTE.md",
    },
    plan: basePlan,
    messages: [makeMessage("inspect NOTE.md")],
    onExecutionNode: async (event) => {
      executionNodes.push({
        nodeId: event.nodeId,
        phase: event.phase,
        details:
          event.details && typeof event.details === "object"
            ? (event.details as Record<string, unknown>)
            : undefined,
      });
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 2);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
  assert.equal(result.evidence.toolExecutions.length, 1);
  const plannerDoneEvents = executionNodes.filter(
    (event) => event.nodeId === "agent-next-action-planner" && event.phase === "done",
  );
  assert.equal(plannerDoneEvents.length >= 2, true);
  const guardedPlannerDoneEvent = plannerDoneEvents.at(-1);
  assert.equal(guardedPlannerDoneEvent?.details?.repeatedToolGuardTriggered, true);
  assert.equal(guardedPlannerDoneEvent?.details?.guardedActionType, "use_tool");
  assert.equal(guardedPlannerDoneEvent?.details?.guardedToolId, "read_note");
});

test("agentGraph blocks a repeated retrieval query in the same run and does not retrieve twice", async () => {
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "search missing knowledge",
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: [],
    decisionSource: "task-model",
    decisionReason: "No tool is required for this turn.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"retrieve","query":"missing topic","reason":"Need knowledge evidence first."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"retrieve","query":"missing topic","reason":"Try the same retrieval again."}';
    });
  const ragInvokeSpy = vi
    .spyOn(runnablesModule.agentRagRunnable, "invoke")
    .mockResolvedValue({
      answer: "",
      sources: [],
    });
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("No matching knowledge was found in this run.");
  const executionNodes: Array<{
    nodeId: string;
    phase: string;
    details?: Record<string, unknown>;
  }> = [];

  const result = await agentGraph.run({
    runId: "run-repeated-retrieve-guard",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "search missing knowledge",
    },
    plan: basePlan,
    knowledgeBaseId: "kb-1",
    messages: [makeMessage("search missing knowledge")],
    onExecutionNode: async (event) => {
      executionNodes.push({
        nodeId: event.nodeId,
        phase: event.phase,
        details:
          event.details && typeof event.details === "object"
            ? (event.details as Record<string, unknown>)
            : undefined,
      });
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 2);
  assert.equal(ragInvokeSpy.mock.calls.length, 1);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
  assert.equal(result.evidence.retrievals.length, 1);
  const plannerDoneEvents = executionNodes.filter(
    (event) => event.nodeId === "agent-next-action-planner" && event.phase === "done",
  );
  const guardedPlannerDoneEvent = plannerDoneEvents.at(-1);
  assert.equal(guardedPlannerDoneEvent?.details?.repeatedToolGuardTriggered, true);
  assert.equal(guardedPlannerDoneEvent?.details?.guardedActionType, "retrieve");
  assert.equal(guardedPlannerDoneEvent?.details?.guardedQuery, "missing topic");
});

test('agentGraph treats read_list "/workspace" and "." as the same repeated call and does not execute twice', async () => {
  const readList = makeToolDefinition({
    id: "read_list",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  readList.capabilities.workspaceBound = true;
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([readList]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "inspect workspace root twice",
      topCandidates: [{ toolId: "read_list", domain: "read" }],
      exposedDefinitions: [readList],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["read_list"],
    decisionSource: "task-model",
    decisionReason: "Directory listing is available.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_list","args":{"path":"."},"reason":"Need the workspace listing first."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_list","args":{"path":"/workspace"},"reason":"Need the workspace listing again."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-read-list-repeat-1",
      toolId: "read_list",
      status: "completed",
      result: {
        type: "opaque-list",
        path: ".",
        entries: [],
      },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    } as never);
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("best effort answer from the first workspace listing");
  const executionNodes: Array<{
    nodeId: string;
    phase: string;
    details?: Record<string, unknown>;
  }> = [];

  const result = await agentGraph.run({
    runId: "run-read-list-workspace-repeat-guard",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "inspect workspace root twice",
    },
    plan: basePlan,
    messages: [makeMessage("inspect workspace root twice")],
    onExecutionNode: async (event) => {
      executionNodes.push({
        nodeId: event.nodeId,
        phase: event.phase,
        details:
          event.details && typeof event.details === "object"
            ? (event.details as Record<string, unknown>)
            : undefined,
      });
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 2);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
  assert.equal(result.evidence.toolExecutions.length, 1);
  const plannerDoneEvents = executionNodes.filter(
    (event) => event.nodeId === "agent-next-action-planner" && event.phase === "done",
  );
  const guardedPlannerDoneEvent = plannerDoneEvents.at(-1);
  assert.equal(guardedPlannerDoneEvent?.details?.repeatedToolGuardTriggered, true);
  assert.equal(guardedPlannerDoneEvent?.details?.guardedActionType, "use_tool");
  assert.equal(guardedPlannerDoneEvent?.details?.guardedToolId, "read_list");
  assert.equal(
    guardedPlannerDoneEvent?.details?.guardedArgsHash,
    createInvocationInputHash({
      toolId: "read_list",
      args: { path: "." },
      source: "planner",
    }),
  );
});

test("agentGraph preserves /README.md for downstream workspace checks and executes read_open", async () => {
  const readOpen = makeToolDefinition({
    id: "read_open",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  readOpen.capabilities.workspaceBound = true;
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([readOpen]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "打开 README.md 看看内容",
      topCandidates: [{ toolId: "read_open", domain: "read" }],
      exposedDefinitions: [readOpen],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["read_open"],
    decisionSource: "task-model",
    decisionReason: "A read tool is available for inspection.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"/README.md"},"reason":"Need the file content."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-read-open-root-relative-1",
      toolId: "read_open",
      status: "completed",
      result: {
        type: "open",
        path: "README.md",
        source: {
          kind: "text",
          mimeType: "text/markdown",
          text: "# README\n\nProject overview",
          metadata: {},
        },
      },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    });
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("README content answer");

  const result = await agentGraph.run({
    runId: "run-use-tool-root-relative-open",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "打开 README.md 看看内容",
    },
    plan: basePlan,
    messages: [makeMessage("打开 README.md 看看内容")],
  });

  assert.equal(result.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.deepEqual(executeHarnessInvocationSpy.mock.calls[0]?.[0], {
    toolId: "read_open",
    args: {
      path: "/README.md",
    },
    userId: 1,
    threadId: "thread-1",
    approvedInvocations: undefined,
  });
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
});

test("agentGraph answers after a single read_list execution when the user asked for a workspace listing", async () => {
  const readList = makeToolDefinition({
    id: "read_list",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([readList]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "看看当前 workspace 有哪些文件",
      topCandidates: [{ toolId: "read_list", domain: "read" }],
      exposedDefinitions: [readList],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["read_list"],
    decisionSource: "task-model",
    decisionReason: "Directory listing is available.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_list","args":{"path":"."},"reason":"Need the workspace listing."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-read-list-1",
      toolId: "read_list",
      status: "completed",
      result: {
        type: "list",
        path: ".",
        entries: [
          { name: "README.md", type: "file" },
          { name: "server", type: "directory" },
          { name: "desktop", type: "directory" },
        ],
      },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    } as never);
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("workspace listing answer");

  const result = await agentGraph.run({
    runId: "run-read-list-answer",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "看看当前 workspace 有哪些文件",
    },
    plan: basePlan,
    messages: [makeMessage("看看当前 workspace 有哪些文件")],
  });

  assert.equal(result.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
  assert.equal(result.evidence.latestSummary?.toolId, "read_list");
  assert.equal(result.evidence.latestSummary?.data?.kind, "read_list");
  if (result.evidence.latestSummary?.data?.kind === "read_list") {
    assert.equal(result.evidence.latestSummary.data.entryCount, 3);
    assert.equal(result.evidence.latestSummary.data.canAnswerDirectoryQuestion, true);
    assert.equal(result.evidence.latestSummary.data.entriesPreview.length > 0, true);
  }
});

test("agentGraph normalizes /workspace before policy and executes read_list", async () => {
  const readList = makeToolDefinition({
    id: "read_list",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  readList.capabilities.workspaceBound = true;
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([readList]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "看看当前 workspace 有哪些文件",
      topCandidates: [{ toolId: "read_list", domain: "read" }],
      exposedDefinitions: [readList],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["read_list"],
    decisionSource: "task-model",
    decisionReason: "Directory listing is available.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_list","args":{"path":"/workspace"},"reason":"Need the workspace listing."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-read-list-root-relative-1",
      toolId: "read_list",
      status: "completed",
      result: {
        type: "list",
        path: ".",
        entries: [
          { name: "README.md", type: "file" },
          { name: "server", type: "directory" },
        ],
      },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    } as never);
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("workspace listing answer");

  const result = await agentGraph.run({
    runId: "run-read-list-root-relative",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "看看当前 workspace 有哪些文件",
    },
    plan: basePlan,
    messages: [makeMessage("看看当前 workspace 有哪些文件")],
  });

  assert.equal(result.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.deepEqual(executeHarnessInvocationSpy.mock.calls[0]?.[0], {
    toolId: "read_list",
    args: {
      path: ".",
    },
    userId: 1,
    threadId: "thread-1",
    approvedInvocations: undefined,
  });
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
});

test("agentGraph answers after a single web_search execution when search evidence is sufficient", async () => {
  const webSearch = makeToolDefinition({
    id: "web_search",
    domain: "web_search",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
      additionalProperties: false,
    },
    sideEffect: "network",
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([webSearch]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "search latest release notes",
      topCandidates: [{ toolId: "web_search", domain: "web_search" }],
      exposedDefinitions: [webSearch],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["web_search"],
    decisionSource: "task-model",
    decisionReason: "Web search is available.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"web_search","args":{"query":"latest release notes"},"reason":"Need current external evidence."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-web-search-1",
      toolId: "web_search",
      status: "completed",
      result: {
        query: "latest release notes",
        provider: "tavily",
        capabilityId: "web-search-tavily",
        results: [
          {
            title: "Release 2.0",
            link: "https://example.com/release-2",
            snippet: "Release 2.0 shipped with new agent runtime updates.",
          },
        ],
      },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    } as never);
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("web search answer");

  const result = await agentGraph.run({
    runId: "run-web-search-answer",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "search latest release notes",
    },
    plan: basePlan,
    messages: [makeMessage("search latest release notes")],
  });

  assert.equal(result.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
  assert.equal(result.evidence.latestSummary?.toolId, "web_search");
  assert.equal(result.evidence.latestSummary?.data?.kind, "web_search");
  if (result.evidence.latestSummary?.data?.kind === "web_search") {
    assert.equal(result.evidence.latestSummary.data.resultCount, 1);
    assert.equal(result.evidence.latestSummary.data.canAnswerSearchQuestion, true);
    assert.equal(result.evidence.latestSummary.data.citationsPreview.length, 1);
  }
});

test("agentGraph answers after a single terminal_session execution when command output is sufficient", async () => {
  const terminalSession = makeToolDefinition({
    id: "terminal_session",
    domain: "terminal",
    inputSchema: {
      type: "object",
      required: ["command"],
      properties: {
        command: { type: "string" },
      },
      additionalProperties: false,
    },
    sideEffect: "process",
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([terminalSession]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "执行 dir 命令并查看结果",
      topCandidates: [{ toolId: "terminal_session", domain: "terminal" }],
      exposedDefinitions: [terminalSession],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["terminal_session"],
    decisionSource: "task-model",
    decisionReason: "Terminal execution is available.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"terminal_session","args":{"command":"dir"},"reason":"Need the command output."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-terminal-1",
      toolId: "terminal_session",
      status: "completed",
      result: {
        sessionId: "terminal-session-1",
        command: "dir",
        cwd: "D:\\workspace\\rag-demo",
        exitCode: 0,
        output: "README.md\nserver\n",
        stdout: "README.md\nserver\n",
        stderr: "",
        timedOut: false,
        reusedSession: false,
        sessionMode: "ephemeral",
        streamMode: "split",
        stderrSeparated: true,
      },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    } as never);
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("terminal answer");

  const result = await agentGraph.run({
    runId: "run-terminal-answer",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "执行 dir 命令并查看结果",
    },
    plan: basePlan,
    messages: [makeMessage("执行 dir 命令并查看结果")],
    approvedInvocations: [
      {
        toolId: "terminal_session",
        input: { command: "dir" },
        inputHash: createInvocationInputHash({
          toolId: "terminal_session",
          args: { command: "dir" },
          source: "planner",
        }),
        approvedAt: "2026-07-04T00:00:00.000Z",
        approvalId: "approval-terminal-1",
      },
    ],
  });

  assert.equal(result.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
  assert.equal(result.evidence.latestSummary?.toolId, "terminal_session");
  assert.equal(result.evidence.latestSummary?.data?.kind, "terminal_session");
  if (result.evidence.latestSummary?.data?.kind === "terminal_session") {
    assert.equal(result.evidence.latestSummary.data.exitCode, 0);
    assert.equal(result.evidence.latestSummary.data.timedOut, false);
    assert.equal(result.evidence.latestSummary.data.canAnswerCommandQuestion, true);
  }
});

test("agentGraph replans once after normalize schema failure and then executes the corrected tool", async () => {
  const readOpen = makeToolDefinition({
    id: "read_open",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([readOpen]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "open README.md",
      topCandidates: [{ toolId: "read_open", domain: "read" }],
      exposedDefinitions: [readOpen],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["read_open"],
    decisionSource: "task-model",
    decisionReason: "A read tool is available for inspection.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{},"reason":"Need the file content."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need the file content."}';
    });
  const executeHarnessInvocationSpy = vi.spyOn(
    harnessInvocations,
    "executeHarnessInvocation",
  );
  executeHarnessInvocationSpy.mockResolvedValue({
    id: "invocation-read-open-replan",
    toolId: "read_open",
    status: "completed",
    result: {
      type: "open",
      path: "README.md",
      source: {
        kind: "text",
        mimeType: "text/markdown",
        text: "# UIChat Mira",
        metadata: {},
      },
    },
    startedAt: "2026-07-04T00:00:00.000Z",
    finishedAt: "2026-07-04T00:00:01.000Z",
  });
  const generateInvokeSpy = vi.spyOn(
    runnablesModule.agentGenerateTextRunnable,
    "invoke",
  ).mockResolvedValue("README answer after bounded replan");
  const executionNodes: Array<{
    nodeId: string;
    phase: string;
    details?: Record<string, unknown>;
  }> = [];

  const result = await agentGraph.run({
    runId: "run-normalize-fail",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "open README.md",
    },
    plan: basePlan,
    messages: [makeMessage("open README.md")],
    onExecutionNode: async (event) => {
      executionNodes.push({
        nodeId: event.nodeId,
        phase: event.phase,
        details:
          event.details && typeof event.details === "object"
            ? (event.details as Record<string, unknown>)
            : undefined,
      });
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(result.answer, "README answer after bounded replan");
  assert.equal(plannerSpy.mock.calls.length, 2);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
  assert.equal(
    executeHarnessInvocationSpy.mock.calls[0]?.[0]?.toolId,
    "read_open",
  );
  const normalizeErrorEvent = executionNodes.find(
    (event) =>
      event.nodeId === "agent-tool-call-normalize" && event.phase === "error",
  );
  assert.equal(normalizeErrorEvent?.details?.schemaReplanEligible, true);
  assert.equal(normalizeErrorEvent?.details?.schemaReplanAttemptCount, 1);
});

test("agentGraph returns a safe answer when bounded schema replan is exhausted", async () => {
  const readOpen = makeToolDefinition({
    id: "read_open",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([readOpen]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "open README.md",
      topCandidates: [{ toolId: "read_open", domain: "read" }],
      exposedDefinitions: [readOpen],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["read_open"],
    decisionSource: "task-model",
    decisionReason: "A read tool is available for inspection.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{},"reason":"Need the file content."}';
    });
  const executeHarnessInvocationSpy = vi.spyOn(
    harnessInvocations,
    "executeHarnessInvocation",
  );
  const generateInvokeSpy = vi.spyOn(
    runnablesModule.agentGenerateTextRunnable,
    "invoke",
  );

  const result = await agentGraph.run({
    runId: "run-normalize-safe-error",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "open README.md",
    },
    plan: basePlan,
    messages: [makeMessage("open README.md")],
  });

  assert.equal(result.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 2);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 0);
  assert.equal(generateInvokeSpy.mock.calls.length, 0);
  assert.match(result.answer, /没有执行任何工具|工具参数不符合要求/);
  assert.equal(result.errorMessage, undefined);
});

test("agentGraph stops when planner selects a tool that is not exposed for this turn", async () => {
  const readOpen = makeToolDefinition({
    id: "read_open",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([readOpen]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "open README.md",
      topCandidates: [{ toolId: "read_open", domain: "read" }],
      exposedDefinitions: [readOpen],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["read_open"],
    decisionSource: "task-model",
    decisionReason: "A read tool is available for inspection.",
  });
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementation(
    async function* () {
      yield '{"type":"use_tool","toolId":"terminal_session","args":{"command":"dir"},"reason":"Need a tool."}';
    },
  );
  const executeHarnessInvocationSpy = vi.spyOn(
    harnessInvocations,
    "executeHarnessInvocation",
  );
  const executionNodes: string[] = [];

  const result = await agentGraph.run({
    runId: "run-unexposed-tool-fail",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "open README.md",
    },
    plan: basePlan,
    messages: [makeMessage("open README.md")],
    onExecutionNode: async (event) => {
      executionNodes.push(event.nodeId);
    },
  });

  assert.equal(result.status, "failed");
  assert.match(result.errorMessage ?? "", /not exposed/i);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 0);
  assert.equal(
    executionNodes.some((nodeId) => nodeId.startsWith("agent-policy")),
    false,
  );
  assert.equal(
    executionNodes.some((nodeId) => isToolExecutionNodeId(nodeId)),
    false,
  );
});

test("agentGraph does not let selectedToolIds bypass planner and normalize", async () => {
  const webSearch = makeToolDefinition({
    id: "web_search",
    domain: "web_search",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
      additionalProperties: false,
    },
    sideEffect: "network",
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([webSearch]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "latest news today",
      topCandidates: [{ toolId: "web_search", domain: "web_search" }],
      exposedDefinitions: [webSearch],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["web_search"],
    decisionSource: "task-model",
    decisionReason: "A tool candidate exists.",
  });
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementation(
    async function* () {
      yield '{"type":"answer","reason":"No tool call is necessary."}';
    },
  );
  const executeHarnessInvocationSpy = vi.spyOn(
    harnessInvocations,
    "executeHarnessInvocation",
  );
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("planner answered directly");
  const executionNodes: string[] = [];

  const result = await agentGraph.run({
    runId: "run-old-path-disabled",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "latest news today",
    },
    plan: basePlan,
    messages: [makeMessage("latest news today")],
    onExecutionNode: async (event) => {
      executionNodes.push(event.nodeId);
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(result.answer, "planner answered directly");
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 0);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
  assert.equal(
    executionNodes.some((nodeId) => nodeId === "agent-tool-call-normalize"),
    false,
  );
  assert.equal(
    executionNodes.some((nodeId) => nodeId.startsWith("agent-policy")),
    false,
  );
});

test("agentGraph stops on normalize rejection for capability-like ids and never enters policy or tool", async () => {
  const readOpen = makeToolDefinition({
    id: "read_open",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  const listCapabilityDefinitionsSpy = vi
    .spyOn(registry, "listCapabilityDefinitions")
    .mockReturnValue([readOpen]);
  const matchToolCandidatesSpy = vi
    .spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding")
    .mockResolvedValue(
      makeToolIntentResult({
        query: "inspect workspace",
        topCandidates: [{ toolId: "read_open", domain: "read" }],
        exposedDefinitions: [readOpen],
      }),
    );
  const selectToolSpy = vi
    .spyOn(taskSelectorModule, "selectToolWithTaskModel")
    .mockResolvedValue({
      selectedToolIds: ["read_open"],
      decisionSource: "task-model",
      decisionReason: "A read tool is available.",
    });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"workspace_lookup","args":{},"reason":"Wrongly treating capability as tool."}';
    });
  const executeHarnessInvocationSpy = vi.spyOn(
    harnessInvocations,
    "executeHarnessInvocation",
  );
  const executionNodes: Array<{
    nodeId: string;
    phase: string;
    details?: Record<string, unknown>;
  }> = [];

  try {
    const result = await agentGraph.run({
      runId: "run-capability-id-reject",
      threadId: "thread-1",
      userId: 1,
      goal: {
        ...baseGoal,
        text: "inspect workspace",
      },
      plan: basePlan,
      messages: [makeMessage("inspect workspace")],
      onExecutionNode: async (event) => {
        executionNodes.push({
          nodeId: event.nodeId,
          phase: event.phase,
          details:
            event.details && typeof event.details === "object"
              ? (event.details as Record<string, unknown>)
              : undefined,
        });
      },
    });

    assert.equal(result.status, "failed");
    assert.equal(result.pendingToolCall, undefined);
    assert.equal(plannerSpy.mock.calls.length, 1);
    assert.equal(executeHarnessInvocationSpy.mock.calls.length, 0);
    assert.equal(
      executionNodes.some((event) => event.nodeId.startsWith("agent-policy")),
      false,
    );
    assert.equal(
      executionNodes.some((event) => isToolExecutionNodeId(event.nodeId)),
      false,
    );
    const plannerDoneEvent = executionNodes.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.equal(plannerDoneEvent?.details?.selectedActionType, "error");
    assert.match(String(plannerDoneEvent?.details?.reason ?? ""), /not exposed/i);
  } finally {
    listCapabilityDefinitionsSpy.mockRestore();
    matchToolCandidatesSpy.mockRestore();
    selectToolSpy.mockRestore();
    plannerSpy.mockRestore();
    executeHarnessInvocationSpy.mockRestore();
  }
});

test("agentGraph stops re-planning after maxIterations and does not issue a second retrieve", async () => {
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "summarize the knowledge base",
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: [],
    decisionSource: "task-model",
    decisionReason: "No tool is needed for this turn.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"retrieve","query":"release notes","reason":"Need knowledge evidence first."}';
    });
  const ragInvokeSpy = vi
    .spyOn(runnablesModule.agentRagRunnable, "invoke")
    .mockResolvedValue({
      answer: "",
      sources: [
        {
          chunkId: "chunk-1",
          documentName: "Release Notes",
          score: 0.91,
          content: "Version 2.0 shipped.",
        },
      ],
    });
  const generateInvokeSpy = vi.spyOn(
    runnablesModule.agentGenerateTextRunnable,
    "invoke",
  ).mockResolvedValue("best effort answer at iteration limit");
  const executionNodes: string[] = [];

  const result = await agentGraph.run({
    runId: "run-max-iterations",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "summarize the knowledge base",
    },
    plan: basePlan,
    knowledgeBaseId: "kb-1",
    maxIterations: 1,
    messages: [makeMessage("summarize the knowledge base")],
    onExecutionNode: async (event) => {
      executionNodes.push(event.nodeId);
    },
  });

  assert.equal(ragInvokeSpy.mock.calls.length, 1);
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
  assert.equal(result.status, "completed");
  assert.equal(result.answer, "best effort answer at iteration limit");
  assert.equal(result.evidence.retrievals.length, 1);
  assert.equal(
    executionNodes.filter((nodeId) => nodeId === "agent-retrieve").length,
    2,
  );
  assert.equal(
    executionNodes.some((nodeId) => nodeId === "agent-tool-call-normalize"),
    false,
  );
  assert.equal(
    executionNodes.some((nodeId) => nodeId.startsWith("agent-policy")),
    false,
  );
  assert.equal(
    executionNodes.some((nodeId) => nodeId === "agent-tool"),
    false,
  );
});

test("routeAfterTool returns the declared tool graph branches", () => {
  assert.equal(routeAfterTool(makeRouteState()), "toolSelectStep");
  assert.equal(
    routeAfterTool(
      makeRouteState({
        iterationCount: 3,
      }),
    ),
    "generate",
  );
  assert.equal(
    routeAfterTool(
      makeRouteState({
        pendingApproval: {
          toolId: "terminal_session",
        },
      }),
    ),
    "approval",
  );
  assert.equal(
    routeAfterTool(
      makeRouteState({
        errorMessage: "tool failed",
      }),
    ),
    "error",
  );
});

test("routeAfterRetrieve returns the declared retrieve graph branches", () => {
  assert.equal(routeAfterRetrieve(makeRouteState()), "toolSelectStep");
  assert.equal(
    routeAfterRetrieve(
      makeRouteState({
        iterationCount: 3,
      }),
    ),
    "generate",
  );
  assert.equal(
    routeAfterRetrieve(
      makeRouteState({
        errorMessage: "retrieve failed",
      }),
    ),
    "error",
  );
});

test("agentGraph counts skipped retrieve iterations without a knowledge base and stops at the iteration limit", async () => {
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "请检索 workspace 中关于 UIChat Mira 的说明",
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: [],
    decisionSource: "task-model",
    decisionReason: "No tool is needed for this turn.",
  });

  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"retrieve","query":"UIChat Mira 说明","reason":"Need workspace evidence first."}';
    });
  const generateInvokeSpy = vi.spyOn(
    runnablesModule.agentGenerateTextRunnable,
    "invoke",
  ).mockResolvedValue("best effort answer after skipped retrieval limit");
  const ragInvokeSpy = vi.spyOn(runnablesModule.agentRagRunnable, "invoke");
  const executionNodes: string[] = [];

  const result = await agentGraph.run({
    runId: "run-no-kb-retrieve-limit",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "请检索 workspace 中关于 UIChat Mira 的说明",
    },
    plan: basePlan,
    knowledgeBaseId: null,
    maxIterations: 1,
    messages: [makeMessage("请检索 workspace 中关于 UIChat Mira 的说明")],
    onExecutionNode: async (event) => {
      executionNodes.push(event.nodeId);
    },
  });

  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(ragInvokeSpy.mock.calls.length, 0);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
  assert.equal(result.status, "completed");
  assert.equal(result.answer, "best effort answer after skipped retrieval limit");
  assert.equal(result.evidence.retrievals.length, 0);
  assert.equal(
    executionNodes.filter((nodeId) => nodeId === "agent-retrieve").length,
    2,
  );
  assert.equal(
    executionNodes.filter((nodeId) => nodeId === "agent-next-action-planner").length,
    2,
  );
});

test("agentGraph reroutes workspace retrieve intent without a knowledge base into read_locate and answers from local evidence", async () => {
  const readLocate = makeToolDefinition({
    id: "read_locate",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([readLocate]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
      topCandidates: [{ toolId: "read_locate", domain: "read" }],
      exposedDefinitions: [readLocate],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["read_locate"],
    decisionSource: "task-model",
    decisionReason: "Workspace search should use a local read tool.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"retrieve","query":"请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。","reason":"Need workspace evidence first."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-read-locate-1",
      toolId: "read_locate",
      status: "completed",
      result: {
        type: "locate",
        scope: ".",
        query: "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
        searchMode: "content",
        matches: [
          {
            path: "README.md",
            matchType: "content",
            preview: "UIChat Mira is a local-first desktop workspace for chat, knowledge, tools, and docs.",
          },
        ],
      },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    });
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("UIChat Mira is a local-first desktop workspace for chat, knowledge, tools, and docs.");

  const result = await agentGraph.run({
    runId: "run-no-kb-read-locate",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
    },
    plan: basePlan,
    workspaceRoot: "D:\\workspace\\rag-demo",
    knowledgeBaseId: null,
    messages: [makeMessage("请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。")],
  });

  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.equal(executeHarnessInvocationSpy.mock.calls[0]?.[0]?.toolId, "read_locate");
  assert.equal(result.status, "completed");
  assert.equal(
    result.evidence.latestSummary?.data?.kind,
    "read_locate",
  );
  assert.equal(result.evidence.latestSummary?.answerReadiness.canAnswer, true);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
});

test("agentGraph opens README.md after read_list when the workspace question still asks for file content", async () => {
  const readOpen = makeToolDefinition({
    id: "read_open",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  const readList = makeToolDefinition({
    id: "read_list",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  const readLocate = makeToolDefinition({
    id: "read_locate",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
      additionalProperties: false,
    },
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([readOpen, readList, readLocate]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "看看文件夹下面有无读我文件，有的话，内容是啥",
      topCandidates: [{ toolId: "read_list", domain: "read" }],
      exposedDefinitions: [readOpen, readList, readLocate],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["read_list"],
    decisionSource: "task-model",
    decisionReason: "Workspace inspection should start from a directory listing.",
  });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_list","args":{"path":"."},"reason":"Need to inspect the directory first."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValueOnce({
      id: "invocation-read-list-bridge-1",
      toolId: "read_list",
      status: "completed",
      result: {
        type: "list",
        path: ".",
        entries: [
          {
            name: "README.md",
            type: "file",
          },
          {
            name: "docs",
            type: "directory",
          },
        ],
      },
      startedAt: "2026-07-05T00:00:00.000Z",
      finishedAt: "2026-07-05T00:00:01.000Z",
    })
    .mockResolvedValueOnce({
      id: "invocation-read-open-bridge-1",
      toolId: "read_open",
      status: "completed",
      result: {
        type: "open",
        path: "README.md",
        source: {
          kind: "text",
          mimeType: "text/markdown",
          text: "# README\n\nProject overview",
          metadata: {},
        },
      },
      startedAt: "2026-07-05T00:00:02.000Z",
      finishedAt: "2026-07-05T00:00:03.000Z",
    });
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("README.md exists and its content starts with Project overview.");

  const result = await agentGraph.run({
    runId: "run-read-locate-to-open",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "看看文件夹下面有无读我文件，有的话，内容是啥",
    },
    plan: basePlan,
    workspaceRoot: "D:\\workspace\\rag-demo",
    knowledgeBaseId: null,
    messages: [makeMessage("看看文件夹下面有无读我文件，有的话，内容是啥")],
  });

  assert.equal(result.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 2);
  assert.equal(executeHarnessInvocationSpy.mock.calls[0]?.[0]?.toolId, "read_list");
  assert.equal(executeHarnessInvocationSpy.mock.calls[1]?.[0]?.toolId, "read_open");
  assert.deepEqual(executeHarnessInvocationSpy.mock.calls[1]?.[0]?.args, {
    path: "README.md",
  });
  assert.equal(result.evidence.toolExecutions.length, 2);
  assert.equal(result.evidence.latestSummary?.toolId, "read_open");
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
});

test("agentGraph stops the current loop when policy requires approval and never enters tool execution", async () => {
  const terminalSession = makeToolDefinition({
    id: "terminal_session",
    domain: "terminal",
    inputSchema: {
      type: "object",
      required: ["command"],
      properties: {
        command: { type: "string" },
      },
      additionalProperties: false,
    },
    sideEffect: "process",
    requiresApproval: true,
  });
  const listCapabilityDefinitionsSpy = vi
    .spyOn(registry, "listCapabilityDefinitions")
    .mockReturnValue([terminalSession]);
  const matchToolCandidatesSpy = vi
    .spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding")
    .mockResolvedValue(
      makeToolIntentResult({
        query: "run dir",
        topCandidates: [{ toolId: "terminal_session", domain: "terminal" }],
        exposedDefinitions: [terminalSession],
      }),
    );
  const selectToolSpy = vi
    .spyOn(taskSelectorModule, "selectToolWithTaskModel")
    .mockResolvedValue({
      selectedToolIds: ["terminal_session"],
      decisionSource: "task-model",
      decisionReason: "Terminal is available.",
    });
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"terminal_session","args":{"command":"dir"},"reason":"Need to inspect the workspace."}';
    });
  const executeHarnessInvocationSpy = vi.spyOn(
    harnessInvocations,
    "executeHarnessInvocation",
  );
  const generateInvokeSpy = vi.spyOn(
    runnablesModule.agentGenerateTextRunnable,
    "invoke",
  );
  const executionNodes: string[] = [];

  try {
    const result = await agentGraph.run({
      runId: "run-policy-approval-stop",
      threadId: "thread-1",
      userId: 1,
      goal: {
        ...baseGoal,
        text: "run dir",
      },
      plan: basePlan,
      messages: [makeMessage("run dir")],
      onExecutionNode: async (event) => {
        executionNodes.push(event.nodeId);
      },
    });

    assert.equal(result.status, "waiting_approval");
    assert.equal(result.pendingApproval?.toolId, "terminal_session");
    assert.equal(result.pendingToolCall?.toolId, "terminal_session");
    assert.equal(result.policyDecision?.type, "require_approval");
    assert.equal(plannerSpy.mock.calls.length, 1);
    assert.equal(executeHarnessInvocationSpy.mock.calls.length, 0);
    assert.equal(generateInvokeSpy.mock.calls.length, 0);
    assert.equal(
      executionNodes.some((nodeId) => isToolExecutionNodeId(nodeId)),
      false,
    );
    assert.equal(
      executionNodes.filter((nodeId) => nodeId === "agent-next-action-planner").length,
      2,
    );
    assert.equal(executionNodes.includes("agent-approval"), true);
  } finally {
    listCapabilityDefinitionsSpy.mockRestore();
    matchToolCandidatesSpy.mockRestore();
    selectToolSpy.mockRestore();
    plannerSpy.mockRestore();
    executeHarnessInvocationSpy.mockRestore();
    generateInvokeSpy.mockRestore();
  }
});

test("agentGraph preserves the frozen pendingToolCall resume entry and goes straight to policy/tool", async () => {
  const webSearch = makeToolDefinition({
    id: "web_search",
    domain: "web_search",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
      additionalProperties: false,
    },
    sideEffect: "network",
    requiresApproval: true,
  });
  const approvedInput = { query: "approved query" };
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([webSearch]);
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"The approved tool result is enough now."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-approved-1",
      toolId: "web_search",
      status: "completed",
      result: {
        hits: ["approved result"],
      },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    });
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("approved answer");
  const executionNodes: string[] = [];

  const result = await agentGraph.run({
    runId: "run-approved-resume",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "approved query",
    },
    plan: basePlan,
    messages: [makeMessage("approved query")],
    selectedToolId: "web_search",
    pendingToolCall: {
      id: "pending-1",
      toolId: "web_search",
      args: approvedInput,
      reason: "Already approved frozen call.",
      inputHash: createInvocationInputHash({
        toolId: "web_search",
        args: approvedInput,
        source: "planner",
      }),
      source: "planner",
      status: "frozen",
      toolMeta: {
        toolId: "web_search",
        title: "web_search",
        description: "web_search",
        inputSchema: webSearch.inputSchema,
        domain: "web_search",
        source: "internal",
        tags: ["web_search"],
      },
      createdAt: "2026-07-04T00:00:00.000Z",
    },
    approvedInvocations: [
      {
        toolId: "web_search",
        input: approvedInput,
        inputHash: createInvocationInputHash({
          toolId: "web_search",
          args: approvedInput,
          source: "planner",
        }),
        approvedAt: "2026-07-04T00:00:00.000Z",
        approvalId: "approval-1",
      },
    ],
    onExecutionNode: async (event) => {
      executionNodes.push(event.nodeId);
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.deepEqual(executeHarnessInvocationSpy.mock.calls[0]?.[0], {
    toolId: "web_search",
    args: approvedInput,
    userId: 1,
    threadId: "thread-1",
    approvedInvocations: [
      {
        toolId: "web_search",
        inputHash: createInvocationInputHash(approvedInput),
      },
    ],
  });
  assert.equal(
    executionNodes.some((nodeId) => nodeId === "agent-next-action-planner"),
    true,
  );
  assert.equal(
    executionNodes.some((nodeId) => nodeId === "agent-tool-call-normalize"),
    false,
  );
  assert.equal(
    executionNodes.findIndex((nodeId) => isToolExecutionNodeId(nodeId)) <
      executionNodes.indexOf("agent-next-action-planner"),
    true,
  );
});

test("agentGraph keeps pendingApproval and frozen pendingToolCall when Harness pauses for approval", async () => {
  const webSearch = makeToolDefinition({
    id: "web_search",
    domain: "web_search",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
      additionalProperties: false,
    },
    sideEffect: "network",
    requiresApproval: false,
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([webSearch]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "search docs",
      topCandidates: [{ toolId: "web_search", domain: "web_search" }],
      exposedDefinitions: [webSearch],
    }),
  );
  vi.spyOn(taskSelectorModule, "selectToolWithTaskModel").mockResolvedValue({
    selectedToolIds: ["web_search"],
    decisionSource: "task-model",
    decisionReason: "Web search is required.",
  });
  vi.spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"web_search","args":{"query":"search docs"},"reason":"Need web results."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-awaiting-approval-1",
      toolId: "web_search",
      status: "awaiting_approval",
      approval: {
        reason: "web_search requires provider approval.",
      },
      startedAt: "2026-07-04T00:00:00.000Z",
    } as never);

  const result = await agentGraph.run({
    runId: "run-awaiting-approval",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "search docs",
    },
    plan: basePlan,
    messages: [makeMessage("search docs")],
  });

  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.equal(result.status, "waiting_approval");
  assert.equal(result.pendingApproval?.toolId, "web_search");
  assert.equal(result.pendingToolCall?.toolId, "web_search");
  assert.equal(result.pendingApproval?.inputHash, result.pendingToolCall?.inputHash);
  assert.equal(result.policyDecision?.type, "require_approval");
  assert.equal(result.selectedToolId, "web_search");
});
