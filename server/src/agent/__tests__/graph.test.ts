import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import * as harnessInvocations from "@/harness/invocations";
import * as registry from "@/harness/registry";
import { contextBudgetService } from "@/services/context-budget/index";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import * as intentMatcherModule from "../intent/embedding-capability-matcher";
import * as runnablesModule from "../runnables";
import { createInvocationInputHash } from "../approval-fingerprint";
import { agentGraph } from "../graph";
import {
  routeAfterNextAction,
  routeAfterRetrieve,
  routeAfterTool,
} from "../graph/routes";



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

const getDefaultWorkspaceBoundaryArgKeys = (input: {
  id: string;
  domain: string;
  workspaceBound?: boolean;
  workspaceBoundaryArgKeys?: string[];
}) => {
  if (!input.workspaceBound) {
    return undefined;
  }

  if (input.workspaceBoundaryArgKeys) {
    return input.workspaceBoundaryArgKeys;
  }

  if (input.domain === "read") {
    return ["path"];
  }

  if (input.id === "terminal_session") {
    return ["cwd"];
  }

  return undefined;
};

const makeToolDefinition = (input: {
  id: string;
  title?: string;
  description?: string;
  domain: string;
  inputSchema: Record<string, unknown>;
  sideEffect?: "none" | "network" | "process" | "local-write";
  requiresApproval?: boolean;
  workspaceBound?: boolean;
  workspaceBoundaryArgKeys?: string[];
}) => {
  const workspaceBoundaryArgKeys = getDefaultWorkspaceBoundaryArgKeys(input);

  return {
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
      workspaceBound: input.workspaceBound ?? false,
      ...(workspaceBoundaryArgKeys
        ? {
            workspaceBoundary: {
              argKeys: workspaceBoundaryArgKeys,
            },
          }
        : {}),
    },
  };
};

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
  };
};

beforeEach(() => {
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
});

afterEach(() => {
  vi.restoreAllMocks();
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




test("agentGraph stops retrying after two recoverable tool failures and does not re-enter planner or tool again", async () => {

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
      query: "open the missing file and explain what happened",
      topCandidates: [{ toolId: "read_open", domain: "read" }],
      exposedDefinitions: [readOpen],
    }),
  );
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"missing.md"},"reason":"Need the file content."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"docs/missing.md"},"reason":"Retry with a more specific path."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValueOnce({
      id: "invocation-read-open-missing-1",
      toolId: "read_open",
      status: "failed",
      error: {
        message: "File not found",
      },
      startedAt: "2026-07-06T00:00:00.000Z",
      finishedAt: "2026-07-06T00:00:01.000Z",
    } as never)
    .mockResolvedValueOnce({
      id: "invocation-read-open-missing-2",
      toolId: "read_open",
      status: "failed",
      error: {
        message: "File not found under docs/",
      },
      startedAt: "2026-07-06T00:00:02.000Z",
      finishedAt: "2026-07-06T00:00:03.000Z",
    } as never);
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue(
      "The file could not be found after two recovery attempts, so the run stopped with the current evidence.",
    );
  const executionNodes: Array<{
    nodeId: string;
    phase: string;
    details?: Record<string, unknown>;
  }> = [];

  const result = await agentGraph.run({
    runId: "run-recoverable-tool-failure-limit",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "open the missing file and explain what happened",
    },
    plan: basePlan,
    messages: [makeMessage("open the missing file and explain what happened")],
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

  const plannerDoneEvents = executionNodes.filter(
    (event) =>
      event.nodeId === "agent-next-action-planner" && event.phase === "done",
  );
  const toolStartEvents = executionNodes.filter(
    (event) => isToolExecutionNodeId(event.nodeId) && event.phase === "start",
  );

  assert.equal(result.status, "completed");
  assert.equal(result.errorMessage, undefined);
  assert.equal(result.lastToolExecution?.status, "failed");
  assert.equal(result.lastToolExecution?.failureKind, "recoverable");
  assert.equal(result.lastToolExecution?.recoveryAttemptCount, 2);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 2);
  assert.equal(generateInvokeSpy.mock.calls.length, 1);
  assert.equal(plannerDoneEvents.length >= 2, true);
  assert.equal(toolStartEvents.length, 2);
  assert.equal(result.evidence.latestSummary?.status, "failed");
  assert.equal(result.evidence.latestSummary?.answerReadiness, undefined);
  assert.match(result.answer ?? "", /当前还没有足够的已完成证据|current evidence/i);
  assert.equal(result.status, "completed");
  assert.equal(result.terminalReason, "completed");
  assert.equal(plannerSpy.mock.calls.length, 2);
});

test("agentGraph keeps terminal tool failure on the global error path", async () => {
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
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need the file content."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"The file evidence is sufficient."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-read-open-terminal",
      toolId: "read_open",
      status: "failed",
      error: {
        message: "Tool protocol mismatch: result payload is invalid",
      },
      startedAt: "2026-07-06T00:00:00.000Z",
      finishedAt: "2026-07-06T00:00:01.000Z",
    } as never);
  const generateInvokeSpy = vi.spyOn(
    runnablesModule.agentGenerateTextRunnable,
    "invoke",
  );

  const result = await agentGraph.run({
    runId: "run-terminal-tool-failure",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "open README.md",
    },
    plan: basePlan,
    messages: [makeMessage("open README.md")],
  });

  assert.equal(result.status, "failed");
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.equal(generateInvokeSpy.mock.calls.length, 0);
  assert.equal(result.lastToolExecution?.status, "failed");
  assert.equal(result.lastToolExecution?.failureKind, "terminal");
  assert.match(result.errorMessage ?? "", /protocol mismatch/i);
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
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"/README.md"},"reason":"Need the file content."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"The file evidence is sufficient."}';
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
  assert.equal(plannerSpy.mock.calls.length, 2);
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
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_list","args":{"path":"."},"reason":"Need the workspace listing."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"The workspace listing is sufficient."}';
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
  const executionNodes: Array<{
    nodeId: string;
    phase: string;
    details?: Record<string, unknown>;
  }> = [];

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
  assert.equal(result.evidence.latestSummary?.toolId, "read_list");
  assert.equal(result.evidence.latestSummary?.data?.kind, "read_list");
  assert.equal(
    executionNodes.some(
      (event) =>
        event.nodeId === "agent-next-action-planner" &&
        event.phase === "done" &&
        event.details?.selectedActionType === "use_tool" &&
        event.details?.selectedToolId === "read_list",
    ),
    true,
  );
  if (result.evidence.latestSummary?.data?.kind === "read_list") {
    assert.equal(result.evidence.latestSummary.data.entryCount, 3);
    assert.equal("canAnswerDirectoryQuestion" in result.evidence.latestSummary.data, false);
    assert.equal(result.evidence.latestSummary.data.entriesPreview.length > 0, true);
  }
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
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"web_search","args":{"query":"latest release notes"},"reason":"Need current external evidence."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"The search evidence is sufficient."}';
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
  const executionNodes: Array<{
    nodeId: string;
    phase: string;
    details?: Record<string, unknown>;
  }> = [];

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
  assert.equal(
    executionNodes.some(
      (event) =>
        event.nodeId === "agent-next-action-planner" &&
        event.phase === "done" &&
        event.details?.selectedActionType === "use_tool" &&
        event.details?.selectedToolId === "web_search",
    ),
    true,
  );
  assert.equal(result.evidence.latestSummary?.toolId, "web_search");
  assert.equal(result.evidence.latestSummary?.data?.kind, "web_search");
  if (result.evidence.latestSummary?.data?.kind === "web_search") {
    assert.equal(result.evidence.latestSummary.data.resultCount, 1);
    assert.equal("canAnswerSearchQuestion" in result.evidence.latestSummary.data, false);
    assert.equal(result.evidence.latestSummary.data.citationsPreview.length, 1);
  }
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
  assert.equal(
    routeAfterTool(
      makeRouteState({
        lastToolExecution: {
          toolId: "read_open",
          args: {
            path: "README.md",
          },
          status: "completed",
          startedAt: "2026-07-06T00:00:00.000Z",
          finishedAt: "2026-07-06T00:00:01.000Z",
        },
      }),
    ),
    "evidenceStage",
  );
  assert.equal(
    routeAfterTool(
      makeRouteState({
        lastToolExecution: {
          toolId: "read_open",
          args: {
            path: "missing.md",
          },
          status: "failed",
          failureKind: "recoverable",
          recoveryAttemptCount: 1,
          startedAt: "2026-07-06T00:00:00.000Z",
          finishedAt: "2026-07-06T00:00:01.000Z",
        },
      }),
    ),
    "evidenceStage",
  );
  assert.equal(
    routeAfterTool(
      makeRouteState({
        lastToolExecution: {
          toolId: "read_open",
          args: {
            path: "missing.md",
          },
          status: "failed",
          failureKind: "recoverable",
          recoveryAttemptCount: 2,
          startedAt: "2026-07-06T00:00:00.000Z",
          finishedAt: "2026-07-06T00:00:01.000Z",
        },
      }),
    ),
    "evidenceStage",
  );
  assert.equal(
    routeAfterTool(
      makeRouteState({
        lastToolExecution: {
          toolId: "read_open",
          args: {
            path: "README.md",
          },
          status: "failed",
          failureKind: "terminal",
          startedAt: "2026-07-06T00:00:00.000Z",
          finishedAt: "2026-07-06T00:00:01.000Z",
        },
        errorMessage: "tool failed",
      }),
    ),
    "evidenceStage",
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
        iterationCount: 3,
      }),
    ),
    "evidenceStage",
  );
});

test("routeAfterNextAction returns approval when pendingApproval is still present", () => {
  assert.equal(
    routeAfterNextAction(
      makeRouteState({
        pendingApproval: {
          toolId: "terminal_session",
        },
        nextAction: undefined,
      }),
    ),
    "approval",
  );
});

test("routeAfterRetrieve returns the declared retrieve graph branches", () => {
  assert.equal(routeAfterRetrieve(makeRouteState()), "evidenceStage");
  assert.equal(
    routeAfterRetrieve(
      makeRouteState({
        iterationCount: 3,
      }),
    ),
    "evidenceStage",
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

test("agentGraph does not answer after locating all mutation targets and instead enters the approval chain before executing deletion", async () => {
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
  const workspaceMutation = makeToolDefinition({
    id: "workspace_mutation",
    domain: "edit",
    inputSchema: {
      type: "object",
      required: ["operation", "targetPath"],
      properties: {
        operation: {
          type: "string",
          enum: ["delete", "move", "write"],
        },
        targetPath: { type: "string" },
        destinationPath: { type: "string" },
        content: { type: "string" },
      },
      additionalProperties: false,
    },
    sideEffect: "local-write",
    requiresApproval: true,
    workspaceBound: true,
    workspaceBoundaryArgKeys: ["targetPath", "destinationPath"],
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([
    readLocate,
    workspaceMutation,
  ]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "先找出 README.md 和 AGENTS.md，再删除它们",
      topCandidates: [{ toolId: "read_locate", domain: "read" }],
      exposedDefinitions: [readLocate, workspaceMutation],
    }),
  );
  const plannerSpy = vi

    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_locate","args":{"query":"README.md AGENTS.md"},"reason":"Need to locate both targets first."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"workspace_mutation","args":{"operation":"delete","targetPath":"README.md"},"reason":"Need approval and execution before reporting completion."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValueOnce({
      id: "invocation-locate-both-1",
      toolId: "read_locate",
      status: "completed",
      result: {
        type: "locate",
        scope: ".",
        query: "README.md AGENTS.md",
        searchMode: "path",
        matches: [
          {
            path: "README.md",
            matchType: "path",
            preview: "README.md",
          },
          {
            path: "AGENTS.md",
            matchType: "path",
            preview: "AGENTS.md",
          },
        ],
      },
      startedAt: "2026-07-08T00:00:00.000Z",
      finishedAt: "2026-07-08T00:00:01.000Z",
    } as never);
  const generateInvokeSpy = vi.spyOn(
    runnablesModule.agentGenerateTextRunnable,
    "invoke",
  );
  const executionNodes: Array<{
    nodeId: string;
    phase: string;
    details?: Record<string, unknown>;
  }> = [];

  try {
    const result = await agentGraph.run({
      runId: "run-mutation-locate-then-approval",
      threadId: "thread-1",
      userId: 1,
      goal: {
        ...baseGoal,
        text: "先找出 README.md 和 AGENTS.md，再删除它们",
      },
      plan: basePlan,
      workspaceRoot: "D:\\workspace\\rag-demo",
      messages: [makeMessage("先找出 README.md 和 AGENTS.md，再删除它们")],
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

    assert.equal(result.status, "waiting_approval");
    assert.equal(plannerSpy.mock.calls.length, 2);
    assert.equal(executeHarnessInvocationSpy.mock.calls.length <= 1, true);
    if (executeHarnessInvocationSpy.mock.calls.length === 1) {
      assert.equal(executeHarnessInvocationSpy.mock.calls[0]?.[0]?.toolId, "read_locate");
    }
    assert.equal(result.pendingApproval?.toolId, "workspace_mutation");
    assert.equal(result.pendingToolCall?.toolId, "workspace_mutation");
    assert.equal(result.policyDecision?.type, "require_approval");
    assert.equal(generateInvokeSpy.mock.calls.length, 0);
    assert.equal(
      executionNodes.some(
        (event) =>
          event.nodeId === "agent-next-action-planner" &&
          event.phase === "done" &&
          event.details?.selectedActionType === "use_tool" &&
          event.details?.selectedToolId === "workspace_mutation",
      ),
      true,
    );
  } finally {
    plannerSpy.mockRestore();
    executeHarnessInvocationSpy.mockRestore();
    generateInvokeSpy.mockRestore();
  }
});

test("agentGraph treats terminal mutation failure as a terminal outcome without pretending the deletion succeeded", async () => {
  const workspaceMutation = makeToolDefinition({
    id: "workspace_mutation",
    domain: "edit",
    inputSchema: {
      type: "object",
      required: ["operation", "targetPath"],
      properties: {
        operation: {
          type: "string",
          enum: ["delete", "move", "write"],
        },
        targetPath: { type: "string" },
      },
      additionalProperties: false,
    },
    sideEffect: "local-write",
    workspaceBound: true,
    workspaceBoundaryArgKeys: ["targetPath"],
  });
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue([workspaceMutation]);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult({
      query: "删除 notes.txt",
      topCandidates: [{ toolId: "workspace_mutation", domain: "edit" }],
      exposedDefinitions: [workspaceMutation],
    }),
  );
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"workspace_mutation","args":{"operation":"delete","targetPath":"notes.txt"},"reason":"Need to execute the deletion before reporting the outcome."}';
    });
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-terminal-mutation-1",
      toolId: "workspace_mutation",
      status: "failed",
      error: {
        message: "Refused to delete notes.txt because it resolves outside workspace.",
        failureCode: "workspace_escape",
      },
      startedAt: "2026-07-09T00:00:00.000Z",
      finishedAt: "2026-07-09T00:00:01.000Z",
    } as never);
  const generateInvokeSpy = vi
    .spyOn(runnablesModule.agentGenerateTextRunnable, "invoke")
    .mockResolvedValue("notes.txt 不存在，删除没有执行成功。");

  const result = await agentGraph.run({
    runId: "run-terminal-mutation-outcome",
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: "删除 notes.txt",
    },
    plan: basePlan,
    workspaceRoot: "D:\\workspace\\rag-demo",
    maxIterations: 1,
    messages: [makeMessage("删除 notes.txt")],
    approvedInvocations: [
      {
        toolId: "workspace_mutation",
        input: {
          operation: "delete",
          targetPath: "notes.txt",
        },
        inputHash: createInvocationInputHash({
          toolId: "workspace_mutation",
          args: {
            operation: "delete",
            targetPath: "notes.txt",
          },
          source: "planner",
        }),
        approvedAt: "2026-07-09T00:00:00.000Z",
        approvalId: "approval-terminal-mutation-1",
      },
    ],
  });

  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
  assert.equal(result.status, "failed");
  assert.equal(result.lastToolExecution?.status, "failed");
  assert.equal(result.lastToolExecution?.failureKind, "terminal");
  assert.equal(generateInvokeSpy.mock.calls.length, 0);
  assert.match(result.errorMessage ?? "", /outside workspace/i);
  assert.doesNotMatch(result.answer ?? "", /删除成功|delete succeeded/i);
});

test("agentGraph reports a Harness approval request as an owner-contract failure", async () => {
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
  assert.equal(result.status, "failed");
  assert.equal(result.pendingApproval, undefined);
  assert.equal(result.pendingToolCall?.toolId, "web_search");
  assert.equal(result.policyDecision?.type, "allow");
  assert.match(result.errorMessage ?? "", /Policy must create pendingApproval/i);
  assert.equal(result.selectedToolId, "web_search");
});
