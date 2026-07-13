import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

const getPlannerPayload = (plannerContext: string) => {
  const messages = JSON.parse(plannerContext) as Array<{ role: string; content: string }>;
  const userMessage = [...messages].reverse().find((message) => message.role === "user");
  assert.ok(userMessage, "planner user payload should exist");
  return JSON.parse(userMessage.content) as {
    currentUserRequest?: string;
    recentConversationHistory?: Array<{ role: string; content: string }>;
    observationContext?: {
      currentTaskFrame?: {
        coveredProgress?: string[];
        remainingWork?: string[];
      };
      latestEvidenceSummary?: {
        status?: string;
        toolId?: string;
        gaps?: string[];
        data?: Record<string, unknown>;
      } | null;
    };
  };
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

const makeAssistantMessage = (content: string) => ({
  role: "assistant" as const,
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
  source?: "internal" | "external";
}) => ({
  id: input.id,
  title: input.id,
  description: input.id,
  domain: input.domain,
  source: input.source ?? ("internal" as const),
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

const readDiscoverTool = () =>
  makeToolDefinition({
    id: "read_discover",
    domain: "read",
    inputSchema: {
      oneOf: [
        {
          type: "object",
          required: ["mode", "path"],
          additionalProperties: false,
          properties: {
            mode: { type: "string", enum: ["list"] },
            path: { type: "string" },
            maxResults: { type: "integer" },
          },
        },
        {
          type: "object",
          required: ["mode", "query"],
          additionalProperties: false,
          properties: {
            mode: { type: "string", enum: ["locate"] },
            query: { type: "string" },
            root: { type: "string" },
            maxResults: { type: "integer" },
          },
        },
      ],
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
  messages?: Array<ReturnType<typeof makeMessage> | ReturnType<typeof makeAssistantMessage>>;
  maxIterations?: number;
  approvedInvocations?: Array<{ toolId: string; input: Record<string, unknown>; inputHash: string }>;
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
    messages: input.messages ?? [makeMessage(input.question)],
    workspaceRoot: "D:\\workspace\\rag-demo",
    maxIterations: input.maxIterations,
    approvedInvocations: input.approvedInvocations,
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
  assert.equal(result.evidence.toolExecutions.length, 3);
  assert.equal(result.evidence.latestSummary?.toolId, "read_list");
  assert.equal(result.evidence.latestSummary?.answerReadiness, undefined);
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

test("read_discover flows through Evidence back to Planner without automatic read_open", async () => {
  setupToolExposure("find workspace settings", [readDiscoverTool(), readOpenTool()]);
  let plannerContext = "";
  vi.spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_discover","args":{"mode":"locate","query":"settings","maxResults":1},"reason":"Find candidate files first."}';
    })
    .mockImplementationOnce(async function* (messages) {
      plannerContext = JSON.stringify(messages);
      yield '{"type":"answer","reason":"The discovery evidence is enough to report candidates."}';
    });
  const executeSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-discover",
      toolId: "read_discover",
      status: "completed",
      result: {
        type: "discover",
        mode: "locate",
        operation: "locate",
        root: "workspace-root",
        scope: ".",
        query: "settings",
        searchMode: "auto",
        matches: [
          { path: "docs/settings-1.md", matchType: "path" },
          { path: "docs/settings-2.md", matchType: "path" },
          { path: "docs/settings-3.md", matchType: "path" },
          { path: "docs/settings-4.md", matchType: "path" },
          { path: "docs/settings-5.md", matchType: "path" },
          { path: "docs/settings-6.md", matchType: "path" },
        ],
        returnedCount: 6,
        hasMore: true,
        truncated: true,
      },
      startedAt: "2026-07-11T00:00:00.000Z",
      finishedAt: "2026-07-11T00:00:01.000Z",
    } as never);
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "settings candidates discovered",
  );

  const result = await runBlackbox({
    runId: "blackbox-read-discover-evidence",
    question: "find workspace settings",
  });

  assert.equal(result.status, "completed");
  assert.equal(result.evidence.latestSummary?.toolId, "read_discover");
  assert.equal(result.evidence.latestSummary?.data?.kind, "read_discover");
  assert.equal(executeSpy.mock.calls.length, 1);
  assert.equal(executeSpy.mock.calls.some((call) => call[0]?.toolId === "read_open"), false);
  const plannerPayload = getPlannerPayload(plannerContext);
  const latestEvidenceSummary = plannerPayload.observationContext?.latestEvidenceSummary;
  assert.equal(latestEvidenceSummary?.toolId, "read_discover");
  assert.deepEqual(latestEvidenceSummary?.data, {
    kind: "read_discover",
    mode: "locate",
    operation: "locate",
    root: "workspace-root",
    query: "settings",
    candidateCount: 6,
    candidatePaths: [
      "docs/settings-1.md",
      "docs/settings-2.md",
      "docs/settings-3.md",
      "docs/settings-4.md",
      "docs/settings-5.md",
    ],
    returnedCount: 6,
    hasMore: true,
    truncated: true,
  });
  assert.match(plannerContext, /read_discover/);
  assert.match(result.evidence.latestSummary?.facts.join("\n") ?? "", /candidatePath=docs\/settings-5\.md/);
  assert.equal(
    (result.evidence.latestSummary?.facts.join("\n") ?? "").includes("docs/settings-6.md"),
    false,
  );
  assert.match(result.evidence.latestSummary?.facts.join("\n") ?? "", /returnedCount=6/);
  assert.match(result.evidence.latestSummary?.facts.join("\n") ?? "", /hasMore=true/);
});

test("read_discover can flow through Evidence back to Planner and then into read_open before answering", async () => {
  setupToolExposure("find the approval resume implementation and open it", [
    readDiscoverTool(),
    readOpenTool(),
  ]);
  const plannerPayloads: string[] = [];
  vi.spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_discover","args":{"mode":"locate","query":"approval resume","maxResults":5},"reason":"Find the likely implementation file first."}';
    })
    .mockImplementationOnce(async function* (messages) {
      plannerPayloads.push(JSON.stringify(messages));
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"server/src/agent/resume.ts"},"reason":"The discover result only found candidates; now open the implementation file."}';
    })
    .mockImplementationOnce(async function* (messages) {
      plannerPayloads.push(JSON.stringify(messages));
      yield '{"type":"answer","reason":"The located file content is now sufficient."}';
    });
  const executeSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValueOnce({
      id: "invocation-discover-open-chain-discover",
      toolId: "read_discover",
      status: "completed",
      result: {
        type: "discover",
        mode: "locate",
        operation: "locate",
        root: ".",
        scope: ".",
        query: "approval resume",
        searchMode: "auto",
        matches: [
          { path: "docs/approval-notes.md", matchType: "content" },
          { path: "server/src/agent/resume.ts", matchType: "content" },
        ],
        returnedCount: 2,
        hasMore: false,
        truncated: false,
      },
      startedAt: "2026-07-11T00:00:00.000Z",
      finishedAt: "2026-07-11T00:00:01.000Z",
    } as never)
    .mockResolvedValueOnce({
      id: "invocation-discover-open-chain-open",
      toolId: "read_open",
      status: "completed",
      result: {
        type: "open",
        path: "server/src/agent/resume.ts",
        source: {
          kind: "text",
          mimeType: "text/plain",
          text: "resumeApprovedAgentRun clears pendingApproval before rerunning agentGraph.",
          metadata: {},
        },
      },
      startedAt: "2026-07-11T00:00:02.000Z",
      finishedAt: "2026-07-11T00:00:03.000Z",
    } as never);
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "The approval resume implementation is in server/src/agent/resume.ts.",
  );

  const result = await runBlackbox({
    runId: "blackbox-read-discover-open-chain",
    question: "find the approval resume implementation and open it",
  });

  assert.equal(result.status, "completed");
  assert.equal(executeSpy.mock.calls.length, 2);
  assert.equal(executeSpy.mock.calls[0]?.[0]?.toolId, "read_discover");
  assert.equal(executeSpy.mock.calls[1]?.[0]?.toolId, "read_open");
  assert.equal(result.evidence.toolExecutions.length, 2);
  assert.equal(result.evidence.latestSummary?.toolId, "read_open");
  const secondPlannerPayload = getPlannerPayload(plannerPayloads[0] ?? "");
  assert.equal(secondPlannerPayload.observationContext?.latestEvidenceSummary?.toolId, "read_discover");
  assert.equal(secondPlannerPayload.observationContext?.latestEvidenceSummary?.data?.kind, "read_discover");
  const thirdPlannerPayload = getPlannerPayload(plannerPayloads[1] ?? "");
  assert.equal(thirdPlannerPayload.observationContext?.latestEvidenceSummary?.toolId, "read_open");
  assert.equal(thirdPlannerPayload.observationContext?.latestEvidenceSummary?.data?.kind, "read_open");
});

test("Planner payload keeps a bounded recent history window even when the follow-up uses Chinese continuation", async () => {
  setupToolExposure("那一段展开说说", [readOpenTool()]);
  let plannerContext = "";
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementationOnce(
    async function* (messages) {
      plannerContext = JSON.stringify(messages);
      yield '{"type":"answer","reason":"No tool is needed for this prompt assembly check."}';
    },
  );
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "history payload checked",
  );

  const result = await runBlackbox({
    runId: "blackbox-relevant-history-filter",
    question: "那一段展开说说",
    messages: [
      makeMessage("第一轮无关的旧问题"),
      makeAssistantMessage("第一轮无关的旧回答"),
      makeMessage("先看审批恢复这块"),
      makeAssistantMessage("好的，我先去找相关实现。"),
      makeMessage("我找到 resume.ts 了"),
      makeAssistantMessage("里面有 resumeApprovedAgentRun。"),
      makeMessage("继续"),
      makeAssistantMessage("好，我继续看它怎么清 pending approval。"),
      makeMessage("然后呢？"),
      makeAssistantMessage("我再确认一下调用链。"),
      makeMessage("那一段展开说说"),
    ],
  });

  assert.equal(result.status, "completed");
  const plannerPayload = getPlannerPayload(plannerContext);
  assert.deepEqual(plannerPayload.recentConversationHistory, [
    {
      role: "user",
      content: "我找到 resume.ts 了",
    },
    {
      role: "assistant",
      content: "里面有 resumeApprovedAgentRun。",
    },
    {
      role: "user",
      content: "继续",
    },
    {
      role: "assistant",
      content: "好，我继续看它怎么清 pending approval。",
    },
    {
      role: "user",
      content: "然后呢？",
    },
    {
      role: "assistant",
      content: "我再确认一下调用链。",
    },
  ]);
});

test("multi-target requests do not answer after only one target is covered", async () => {
  setupToolExposure("compare README.md and package.json", [readOpenTool()]);
  const plannerPayloads: string[] = [];
  vi.spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Open the first target before comparing both files."}';
    })
    .mockImplementationOnce(async function* (messages) {
      plannerPayloads.push(JSON.stringify(messages));
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"package.json"},"reason":"Only README.md is covered so far; open package.json before answering."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"Both files are now covered."}';
    });
  const executeSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValueOnce({
      id: "invocation-multi-target-readme",
      toolId: "read_open",
      status: "completed",
      result: {
        type: "open",
        path: "README.md",
        source: {
          kind: "text",
          mimeType: "text/markdown",
          text: "# README\nUIChat Mira",
          metadata: {},
        },
      },
      startedAt: "2026-07-11T00:00:00.000Z",
      finishedAt: "2026-07-11T00:00:01.000Z",
    } as never)
    .mockResolvedValueOnce({
      id: "invocation-multi-target-package",
      toolId: "read_open",
      status: "completed",
      result: {
        type: "open",
        path: "package.json",
        source: {
          kind: "text",
          mimeType: "application/json",
          text: '{"name":"ui-chat-mira"}',
          metadata: {},
        },
      },
      startedAt: "2026-07-11T00:00:02.000Z",
      finishedAt: "2026-07-11T00:00:03.000Z",
    } as never);
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "Compared README.md and package.json.",
  );

  const result = await runBlackbox({
    runId: "blackbox-multi-target-partial",
    question: "compare README.md and package.json",
  });

  assert.equal(result.status, "completed");
  assert.equal(executeSpy.mock.calls.length, 2);
  assert.equal(executeSpy.mock.calls[0]?.[0]?.args.path, "README.md");
  assert.equal(executeSpy.mock.calls[1]?.[0]?.args.path, "package.json");
  const secondPlannerPayload = getPlannerPayload(plannerPayloads[0] ?? "");
  assert.equal(secondPlannerPayload.observationContext?.latestEvidenceSummary?.toolId, "read_open");
  assert.equal(secondPlannerPayload.observationContext?.latestEvidenceSummary?.data?.path, "README.md");
  assert.equal(
    secondPlannerPayload.observationContext?.currentTaskFrame?.remainingWork,
    undefined,
  );
});

test("truncated read evidence does not force an early answer when full content is still needed", async () => {
  setupToolExposure("read the full README and then summarize it", [readOpenTool()]);
  const plannerPayloads: string[] = [];
  vi.spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Start by opening the file."}';
    })
    .mockImplementationOnce(async function* (messages) {
      plannerPayloads.push(JSON.stringify(messages));
      yield '{"type":"ask_user","question":"README.md is truncated in the current evidence. Should I open a more specific section?","reason":"The current file evidence is truncated and not enough for a grounded full-summary answer."}';
    });
  vi.spyOn(harnessInvocations, "executeHarnessInvocation").mockResolvedValueOnce({
    id: "invocation-truncated-read-open",
    toolId: "read_open",
    status: "completed",
    result: {
      type: "open",
      path: "README.md",
      source: {
        kind: "text",
        mimeType: "text/markdown",
        text: `${"A".repeat(600)}\n${"B".repeat(600)}`,
        metadata: {},
      },
    },
    startedAt: "2026-07-11T00:00:00.000Z",
    finishedAt: "2026-07-11T00:00:01.000Z",
  } as never);
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "Need a user decision because the file preview is truncated.",
  );

  const result = await runBlackbox({
    runId: "blackbox-truncated-read-open",
    question: "read the full README and then summarize it",
  });

  assert.equal(result.status, "completed");
  const secondPlannerPayload = getPlannerPayload(plannerPayloads[0] ?? "");
  assert.equal(secondPlannerPayload.observationContext?.latestEvidenceSummary?.status, "truncated");
  assert.match(
    secondPlannerPayload.observationContext?.latestEvidenceSummary?.gaps?.join(" ") ?? "",
    /truncated/i,
  );
  assert.match(result.answer, /truncated/i);
});

test("explicit evidence gaps can drive ask_user instead of an early answer", async () => {
  setupToolExposure("find all workspace settings files and tell me whether the list is complete", [
    readDiscoverTool(),
  ]);
  const plannerPayloads: string[] = [];
  vi.spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_discover","args":{"mode":"locate","query":"settings","maxResults":5},"reason":"Collect candidate settings files first."}';
    })
    .mockImplementationOnce(async function* (messages) {
      plannerPayloads.push(JSON.stringify(messages));
      yield '{"type":"ask_user","question":"The current discover results are truncated and may be incomplete. Do you want me to continue with a narrower query or a specific path?","reason":"The latest evidence explicitly says more candidates may exist, so I should not answer as if the list is complete."}';
    });
  vi.spyOn(harnessInvocations, "executeHarnessInvocation").mockResolvedValueOnce({
    id: "invocation-gap-discover",
    toolId: "read_discover",
    status: "completed",
    result: {
      type: "discover",
      mode: "locate",
      operation: "locate",
      root: ".",
      scope: ".",
      query: "settings",
      searchMode: "auto",
      matches: [
        { path: "docs/settings-1.md", matchType: "path" },
        { path: "docs/settings-2.md", matchType: "path" },
        { path: "docs/settings-3.md", matchType: "path" },
        { path: "docs/settings-4.md", matchType: "path" },
        { path: "docs/settings-5.md", matchType: "path" },
        { path: "docs/settings-6.md", matchType: "path" },
      ],
      returnedCount: 6,
      hasMore: true,
      truncated: true,
    },
    startedAt: "2026-07-11T00:00:00.000Z",
    finishedAt: "2026-07-11T00:00:01.000Z",
  } as never);
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "The candidate list may still be incomplete.",
  );

  const result = await runBlackbox({
    runId: "blackbox-explicit-gap-ask-user",
    question: "find all workspace settings files and tell me whether the list is complete",
  });

  assert.equal(result.status, "completed");
  const secondPlannerPayload = getPlannerPayload(plannerPayloads[0] ?? "");
  assert.equal(secondPlannerPayload.observationContext?.latestEvidenceSummary?.toolId, "read_discover");
  assert.match(
    secondPlannerPayload.observationContext?.latestEvidenceSummary?.gaps?.join(" ") ?? "",
    /more candidates may exist/i,
  );
  assert.match(result.answer, /incomplete|candidate/i);
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
  assert.equal(executeSpy.mock.calls.length >= 2, true);
  assert.equal(result.evidence.toolExecutions.length >= 2, true);
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
  assert.equal(executeSpy.mock.calls.length >= 2, true);
  assert.equal(result.evidence.toolExecutions.length >= 2, true);
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

test("T003 external MCP follows selection, approval, Harness, and Evidence boundaries", async () => {
  const externalTool = makeToolDefinition({
    id: "mcp:docs-server:tool:search_docs",
    domain: "external_mcp",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
        token: { type: "string" },
      },
      additionalProperties: false,
    },
    sideEffect: "network",
    requiresApproval: true,
    source: "external",
  });
  setupToolExposure("search project docs", [externalTool]);
  const args = { query: "project docs", token: "should-not-be-recorded" };
  const inputHash = createHash("sha256")
    .update(JSON.stringify({ args, source: "planner", toolId: externalTool.id }))
    .digest("hex");
  const executeSpy = vi.spyOn(harnessInvocations, "executeHarnessInvocation");
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementation(
    async function* () {
      yield `{"type":"use_tool","toolId":"${externalTool.id}","args":${JSON.stringify(args)},"reason":"Search the project docs."}`;
    },
  );

  const waiting = await runBlackbox({
    runId: "t003-external-waiting-approval",
    question: "search project docs",
  });
  assert.equal(waiting.status, "waiting_approval");
  assert.equal(waiting.pendingApproval?.toolId, externalTool.id);
  assert.equal(executeSpy.mock.calls.length, 0);

  vi.mocked(providerProxyService.streamTaskChatText).mockReset();
  let approvedPlannerCall = 0;
  vi.mocked(providerProxyService.streamTaskChatText).mockImplementation(
    async function* () {
      approvedPlannerCall += 1;
      yield approvedPlannerCall === 1
        ? `{"type":"use_tool","toolId":"${externalTool.id}","args":${JSON.stringify(args)},"reason":"Search the project docs."}`
        : '{"type":"answer","reason":"The approved search returned grounded evidence."}';
    },
  );
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "grounded external answer",
  );
  executeSpy.mockResolvedValue({
    id: "t003-external-invocation",
    toolId: externalTool.id,
    status: "completed",
    result: {
      type: "external_mcp",
      serverId: "docs-server",
      remoteToolName: "search_docs",
      invocationStatus: "completed",
      recoveryOccurred: false,
      result: { matches: ["docs/README.md"] },
    },
    startedAt: "2026-07-14T00:00:00.000Z",
    finishedAt: "2026-07-14T00:00:01.000Z",
  } as never);

  const approved = await runBlackbox({
    runId: "t003-external-approved",
    question: "search project docs",
    approvedInvocations: [{ toolId: externalTool.id, input: args, inputHash }],
  });
  assert.equal(approved.status, "completed");
  assert.equal(executeSpy.mock.calls.length, 1);
  assert.equal(approved.evidence.latestSummary?.data?.kind, "external_mcp");
  assert.equal(approved.evidence.latestSummary?.data?.serverId, "docs-server");
  assert.equal(JSON.stringify(approved.evidence).includes("should-not-be-recorded"), false);
});

test("T003 external runtime failure stays recoverable and ends with a guarded answer", async () => {
  const externalTool = makeToolDefinition({
    id: "mcp:docs-server:tool:search_docs_failure",
    domain: "external_mcp",
    inputSchema: { type: "object", additionalProperties: false },
    sideEffect: "network",
    requiresApproval: false,
    source: "external",
  });
  setupToolExposure("search external docs", [externalTool]);
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementation(
    async function* () {
      yield `{"type":"use_tool","toolId":"${externalTool.id}","args":{},"reason":"Search external docs."}`;
    },
  );
  const executeSpy = vi.spyOn(harnessInvocations, "executeHarnessInvocation").mockResolvedValue({
    id: "t003-external-failure",
    toolId: externalTool.id,
    status: "failed",
    error: { message: "External MCP recovery exhausted after one recovery attempt: timeout", failureCode: "timeout" },
    startedAt: "2026-07-14T00:00:00.000Z",
    finishedAt: "2026-07-14T00:00:01.000Z",
  } as never);
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "当前还没有足够的已完成证据，无法给出可靠的外部 MCP 结果。",
  );

  const result = await runBlackbox({
    runId: "t003-external-recoverable-failure",
    question: "search external docs",
    maxIterations: 1,
    approvedInvocations: [{
      toolId: externalTool.id,
      input: {},
      inputHash: createHash("sha256")
        .update(JSON.stringify({ args: {}, source: "planner", toolId: externalTool.id }))
        .digest("hex"),
    }],
  });
  assert.equal(result.status, "completed");
  assert.equal(executeSpy.mock.calls.length, 2);
  assert.equal(result.lastToolExecution?.failureKind, "recoverable");
  assert.equal(result.evidence.latestSummary?.status, "failed");
  assert.match(result.answer, /没有足够的已完成证据/);
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
  assert.equal(failedResult.evidence.latestSummary?.answerReadiness, undefined);
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
  assert.equal(failedResult.evidence.latestSummary?.answerReadiness, undefined);
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
