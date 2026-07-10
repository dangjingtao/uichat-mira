import assert from "node:assert/strict";
import fs from "node:fs";
import { afterEach, beforeEach, test, vi } from "vitest";
import { initializeAuthDatabase } from "@/db/auth.db";
import { resetDatabaseClients } from "@/db/index.js";
import { initializeKnowledgeBaseDatabase } from "@/db/knowledge-base.db";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { initializeRoleDatabase } from "@/db/role.db";
import { initializeThreadDatabase } from "@/db/thread.db";
import * as harnessInvocations from "@/harness/invocations";
import * as registry from "@/harness/registry";
import { contextBudgetService } from "@/services/context-budget/index";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import * as intentMatcherModule from "../intent/embedding-capability-matcher";

import * as runnablesModule from "../runnables";
import { agentGraph } from "../graph";

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

const originalDatabaseUrl = process.env.DATABASE_URL;
const testDbPath = createTimestampedTestArtifactPath(
  "db",
  "agentgraph-mainline-blackbox",
  ".sqlite",
);

const makeMessage = (content: string) => ({
  role: "user" as const,
  content,
  parts: [{ type: "text" as const, text: content }],
});

const makeToolDefinition = (input: {
  id: string;
  domain: string;
  inputSchema: Record<string, unknown>;
  sideEffect?: "none" | "network" | "process" | "local-write";
  requiresApproval?: boolean;
  workspaceBound?: boolean;
}) => ({
  id: input.id,
  title: input.id,
  description: input.id,
  domain: input.domain,
  source: "internal" as const,
  mode: "sync" as const,
  inputSchema: input.inputSchema,
  tags: [input.domain],
  capabilities: {
    sideEffect: input.sideEffect ?? "none",
    requiresApproval: input.requiresApproval ?? false,
    workspaceBound: input.workspaceBound ?? false,
    ...(input.workspaceBound
      ? {
          workspaceBoundary: {
            argKeys: ["path"],
          },
        }
      : {}),
  },
});

const readOpenTool = () =>
  makeToolDefinition({
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
    workspaceBound: true,
  });

const readListTool = () =>
  makeToolDefinition({
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
    workspaceBound: true,
  });

const terminalTool = () =>
  makeToolDefinition({
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

const makeToolIntentResult = (
  query: string,
  definitions: Array<ReturnType<typeof makeToolDefinition>>,
) => ({
  query,
  topCandidates: definitions.map((definition) => ({
    toolId: definition.id,
    title: definition.title,
    description: definition.description,
    domain: definition.domain,
    source: definition.source,
    tags: definition.tags,
    score: 0.9,
    embeddingScore: 0.9,
    ruleScore: 0,
    rerankScore: 0.9,
    finalScore: 0.9,
  })),
  toolCandidates: definitions.map((definition) => ({
    toolId: definition.id,
    title: definition.title,
    description: definition.description,
    domain: definition.domain,
    source: definition.source,
    tags: definition.tags,
    score: 0.9,
    embeddingScore: 0.9,
    ruleScore: 0,
    rerankScore: 0.9,
    finalScore: 0.9,
  })),
  toolExposure: {
    exposedToolIds: definitions.map((definition) => definition.id),
    exposedDefinitions: definitions,
    reason: [],
    blockedCapabilityIds: [],
  },});

const setupToolExposure = (
  query: string,
  definitions: Array<ReturnType<typeof makeToolDefinition>>,
) => {
  vi.spyOn(registry, "listCapabilityDefinitions").mockReturnValue(definitions);
  vi.spyOn(intentMatcherModule, "matchToolCandidatesByEmbedding").mockResolvedValue(
    makeToolIntentResult(query, definitions),
  );
};

const runBlackbox = (input: {
  runId: string;
  question: string;
  maxIterations?: number;
  onExecutionNode?: Parameters<typeof agentGraph.run>[0]["onExecutionNode"];
}) =>
  agentGraph.run({
    runId: input.runId,
    threadId: "thread-1",
    userId: 1,
    goal: {
      ...baseGoal,
      text: input.question,
    },
    plan: basePlan,
    messages: [makeMessage(input.question)],
    workspaceRoot: "D:\\workspace\\rag-demo",
    maxIterations: input.maxIterations,
    onExecutionNode: input.onExecutionNode,
  });

beforeEach(() => {
  process.env.DATABASE_URL = `file:${testDbPath}`;
  resetDatabaseClients();
  initializeAuthDatabase();
  initializeModelConfigDatabase();
  initializeKnowledgeBaseDatabase();
  initializeThreadDatabase();
  initializeRoleDatabase();
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
});

afterEach(() => {
  vi.restoreAllMocks();
  resetDatabaseClients();
  try {
    fs.rmSync(testDbPath, { force: true });
  } catch {
    // ignore cleanup failure on Windows file locking
  }
  if (originalDatabaseUrl) {
    process.env.DATABASE_URL = originalDatabaseUrl;
  } else {
    delete process.env.DATABASE_URL;
  }
});

test("A1 direct answer completes without entering the tool chain", async () => {
  setupToolExposure("answer directly", [readOpenTool()]);
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementation(
    async function* () {
      yield '{"type":"answer","reason":"No tool is needed."}';
    },
  );
  const executeSpy = vi.spyOn(harnessInvocations, "executeHarnessInvocation");
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "direct answer",
  );

  const result = await runBlackbox({
    runId: "blackbox-a1-direct-answer",
    question: "answer directly",
  });

  assert.equal(result.status, "completed");
  assert.equal(result.answer, "direct answer");
  assert.equal(result.pendingToolCall, undefined);
  assert.equal(result.pendingApproval, undefined);
  assert.equal(executeSpy.mock.calls.length, 0);
});

test("A2 use_tool goes through normalize and follows Planner repeat decisions", async () => {
  setupToolExposure("list workspace", [readListTool()]);
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementation(
    async function* () {
      yield '{"type":"use_tool","toolId":"read_list","args":{"path":"/workspace"},"reason":"Need the workspace listing."}';
    },
  );
  const executeSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-a2-read-list",
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
      startedAt: "2026-07-05T00:00:00.000Z",
      finishedAt: "2026-07-05T00:00:01.000Z",
    } as never);
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "workspace listing answer",
  );

  const result = await runBlackbox({
    runId: "blackbox-a2-use-tool",
    question: "list workspace",
  });

  assert.equal(result.status, "completed");
  assert.equal(executeSpy.mock.calls.length, 3);
  assert.equal(executeSpy.mock.calls[0]?.[0]?.toolId, "read_list");
  assert.deepEqual(executeSpy.mock.calls[0]?.[0]?.args, { path: "." });
  assert.equal(executeSpy.mock.calls[0]?.[0]?.userId, 1);
  assert.equal(executeSpy.mock.calls[0]?.[0]?.threadId, "thread-1");
  assert.equal(result.evidence.toolExecutions.length, 1);
  assert.equal(result.evidence.latestSummary?.toolId, "read_list");
  assert.equal(result.evidence.latestSummary?.answerReadiness.canAnswer, true);
});

test("A3 selectedToolIds do not bypass planner or trigger ToolNode when planner answers", async () => {
  setupToolExposure("latest news today", [readOpenTool()]);
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementation(
    async function* () {
      yield '{"type":"answer","reason":"No tool call is necessary."}';
    },
  );
  const executeSpy = vi.spyOn(harnessInvocations, "executeHarnessInvocation");
  const executionNodes: string[] = [];
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "planner answered directly",
  );

  const result = await runBlackbox({
    runId: "blackbox-a3-selected-toolids",
    question: "latest news today",
    onExecutionNode: async (event) => {
      executionNodes.push(event.nodeId);
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(result.answer, "planner answered directly");
  assert.equal(executeSpy.mock.calls.length, 0);
  assert.equal(
    executionNodes.some((nodeId) => nodeId === "agent-tool-call-normalize"),
    false,
  );
});

test("A4 capability-like ids are rejected before Harness execution", async () => {
  setupToolExposure("inspect workspace", [readOpenTool()]);
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementation(
    async function* () {
      yield '{"type":"use_tool","toolId":"workspace_lookup","args":{},"reason":"Wrongly treating capability as tool."}';
    },
  );
  const executeSpy = vi.spyOn(harnessInvocations, "executeHarnessInvocation");
  const executionNodes: string[] = [];

  const result = await runBlackbox({
    runId: "blackbox-a4-capability-id",
    question: "inspect workspace",
    onExecutionNode: async (event) => {
      executionNodes.push(event.nodeId);
    },
  });

  assert.equal(result.status, "failed");
  assert.match(result.errorMessage ?? "", /没有可用的本地读取工具|not exposed|not found/i);
  assert.equal(executeSpy.mock.calls.length, 0);
  assert.equal(
    executionNodes.some((nodeId) => nodeId.startsWith("agent-policy")),
    false,
  );
});

test("A5 repeated same tool call is not rewritten by a runtime guard", async () => {
  setupToolExposure("open README.md", [readOpenTool()]);
  vi.spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need file content."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Try the same file again."}';
    });
  const executeSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-a5-read-open",
      toolId: "read_open",
      status: "completed",
      result: {
        type: "open",
        path: "README.md",
        source: {
          kind: "text",
          mimeType: "text/markdown",
          text: "",
          metadata: {},
        },
      },
      startedAt: "2026-07-05T00:00:00.000Z",
      finishedAt: "2026-07-05T00:00:01.000Z",
    } as never);
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "README answer",
  );

  const result = await runBlackbox({
    runId: "blackbox-a5-repeat-guard",
    question: "open README.md",
  });

  assert.equal(result.status, "completed");
  assert.equal(executeSpy.mock.calls.length, 3);
  assert.equal(result.evidence.toolExecutions.length, 1);
});

test('A6 Planner receives both distinct path arguments without a repeated-call rewrite', async () => {
  setupToolExposure("inspect workspace root twice", [readListTool()]);
  vi.spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_list","args":{"path":"."},"reason":"Need the workspace listing first."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_list","args":{"path":"/workspace"},"reason":"Need the workspace listing again."}';
    });
  const executeSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-a6-read-list",
      toolId: "read_list",
      status: "completed",
      result: {
        type: "list",
        path: ".",
        entries: [],
      },
      startedAt: "2026-07-05T00:00:00.000Z",
      finishedAt: "2026-07-05T00:00:01.000Z",
    } as never);
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "workspace answer",
  );

  const result = await runBlackbox({
    runId: "blackbox-a6-workspace-equivalence",
    question: "inspect workspace root twice",
  });

  assert.equal(result.status, "completed");
  assert.equal(executeSpy.mock.calls.length, 2);
  assert.equal(result.evidence.toolExecutions.length, 1);
});

test("A7 waiting_approval stops the run before ToolNode executes", async () => {
  setupToolExposure("run dir", [terminalTool()]);
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementation(
    async function* () {
      yield '{"type":"use_tool","toolId":"terminal_session","args":{"command":"dir"},"reason":"Need command output."}';
    },
  );
  const executeSpy = vi.spyOn(harnessInvocations, "executeHarnessInvocation");
  const executionNodes: string[] = [];
  const generateSpy = vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke");

  const result = await runBlackbox({

    runId: "blackbox-a7-waiting-approval",
    question: "run dir",
    onExecutionNode: async (event) => {
      executionNodes.push(event.nodeId);
    },
  });

  assert.equal(result.status, "waiting_approval");
  assert.notEqual(result.pendingApproval, undefined);
  assert.equal(executeSpy.mock.calls.length, 0);
  assert.equal(generateSpy.mock.calls.length, 0);
  assert.equal(executionNodes.includes("agent-approval"), true);
});

test("A8 failed tool does not continue with extra tool execution or fake success", async () => {
  setupToolExposure("open README.md", [readOpenTool()]);
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementation(
    async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need file content."}';
    },
  );
  const executeSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-a8-read-open-failed",
      toolId: "read_open",
      status: "failed",
      error: {
        message: "File not found",
      },
      startedAt: "2026-07-05T00:00:00.000Z",
      finishedAt: "2026-07-05T00:00:01.000Z",
    } as never);
  const generateSpy = vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke");

  const failedResult = await runBlackbox({
    runId: "blackbox-a8-failed-tool",
    question: "open README.md",
  });

  assert.equal(failedResult.status, "completed");
  assert.equal(executeSpy.mock.calls.length, 2);
  assert.equal(generateSpy.mock.calls.length, 1);
  assert.equal(failedResult.lastToolExecution?.status, "failed");
  assert.equal(failedResult.lastToolExecution?.failureKind, "recoverable");
  assert.equal(failedResult.evidence.latestSummary?.status, "failed");
  assert.equal(failedResult.evidence.latestSummary?.answerReadiness.canAnswer, false);
  assert.match(failedResult.answer ?? "", /当前还没有足够的已完成证据/);
});

test("A8 terminal failed tool still stops the graph instead of producing a guarded answer", async () => {
  setupToolExposure("open README.md", [readOpenTool()]);
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementation(
    async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need file content."}';
    },
  );
  const executeSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-a8-read-open-terminal-failed",
      toolId: "read_open",
      status: "failed",
      error: {
        message: "Tool protocol mismatch: result payload is invalid",
      },
      startedAt: "2026-07-05T00:00:00.000Z",
      finishedAt: "2026-07-05T00:00:01.000Z",
    } as never);
  const generateSpy = vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke");

  const failedResult = await runBlackbox({
    runId: "blackbox-a8-terminal-failed-tool",
    question: "open README.md",
  });

  assert.equal(failedResult.status, "failed");
  assert.equal(executeSpy.mock.calls.length, 1);
  assert.equal(generateSpy.mock.calls.length, 0);
  assert.equal(failedResult.lastToolExecution?.status, "failed");
  assert.equal(failedResult.lastToolExecution?.failureKind, "terminal");
  assert.equal(failedResult.evidence.latestSummary?.status, "failed");
  assert.equal(failedResult.evidence.latestSummary?.answerReadiness.canAnswer, false);
  assert.match(failedResult.errorMessage ?? "", /protocol mismatch/i);
  assert.match(failedResult.terminalReason ?? "", /protocol mismatch/i);
  assert.equal(failedResult.answer, "");
});

test("A8 maxIterations does not issue a second tool execution", async () => {
  setupToolExposure("open README.md once", [readOpenTool()]);
  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need file content."}';
    });
  const limitedExecuteSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-a8-limited",
      toolId: "read_open",
      status: "completed",
      result: {
        type: "open",
        path: "README.md",
        source: {
          kind: "text",
          mimeType: "text/markdown",
          text: "# README\n\nUIChat Mira runtime docs.",
          metadata: {},
        },
      },
      startedAt: "2026-07-05T00:00:00.000Z",
      finishedAt: "2026-07-05T00:00:01.000Z",
    } as never);
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "best effort answer at iteration limit",
  );

  const limitedResult = await runBlackbox({
    runId: "blackbox-a8-max-iterations",
    question: "open README.md once",
    maxIterations: 1,
  });

  assert.equal(limitedResult.status, "completed");
  assert.equal(plannerSpy.mock.calls.length, 1);
  assert.equal(limitedExecuteSpy.mock.calls.length, 1);
  assert.equal(limitedResult.evidence.toolExecutions.length, 1);
});
