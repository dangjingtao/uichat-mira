import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import * as harnessInvocations from "@/mcp/harness/invocations.js";
import * as registry from "@/mcp/harness/registry.js";
import { contextBudgetService } from "@/services/context-budget/index.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import * as intentMatcherModule from "./intent/embedding-capability-matcher.js";
import * as taskSelectorModule from "./intent/task-capability-selector.js";
import * as runnablesModule from "./runnables.js";
import { createInvocationInputHash } from "./approval-fingerprint.js";
import { agentGraph } from "./graph.js";

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

test("agentGraph routes retrieve evidence back to planner before final generation", async () => {
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
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"The retrieval evidence is enough now."}';
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
  assert.equal(plannerSpy.mock.calls.length, 2);
  assert.equal(ragInvokeSpy.mock.calls.length, 1);
  assert.equal(ragInvokeSpy.mock.calls[0]?.[0]?.question, "release notes");
  assert.equal(result.evidence.retrievals.length, 1);
  assert.equal(result.evidence.retrievals[0]?.query, "release notes");
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

test("agentGraph routes planner use_tool through normalize before policy and tool execution", async () => {
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
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"The file content is now available."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-read-open-1",
      toolId: "read_open",
      status: "completed",
      result: {
        content: "# README",
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
  assert.equal(plannerSpy.mock.calls.length, 2);
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

test("agentGraph stops on normalize failure and does not enter policy or tool", async () => {
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
      yield '{"type":"use_tool","toolId":"read_open","args":{},"reason":"Need the file content."}';
    },
  );
  const executeHarnessInvocationSpy = vi.spyOn(
    harnessInvocations,
    "executeHarnessInvocation",
  );
  const generateInvokeSpy = vi.spyOn(
    runnablesModule.agentGenerateTextRunnable,
    "invoke",
  );
  const executionNodes: string[] = [];

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
      executionNodes.push(event.nodeId);
    },
  });

  assert.equal(result.status, "failed");
  assert.match(result.errorMessage ?? "", /required|path/i);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 0);
  assert.equal(generateInvokeSpy.mock.calls.length, 0);
  assert.equal(
    executionNodes.some((nodeId) => nodeId.startsWith("agent-policy")),
    false,
  );
  assert.equal(
    executionNodes.some((nodeId) => nodeId === "agent-tool"),
    false,
  );
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
