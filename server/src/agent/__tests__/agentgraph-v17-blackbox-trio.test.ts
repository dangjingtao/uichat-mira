import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import * as harnessInvocations from "@/harness/invocations";
import * as registry from "@/harness/registry";
import { contextBudgetService } from "@/services/context-budget/index";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import * as intentMatcherModule from "../intent/embedding-capability-matcher";

import * as runnablesModule from "../runnables";
import { agentGraph } from "../graph";
import type {
  AgentApprovedInvocation,
  AgentGraphInput,
  AgentGraphOutput,
} from "../types";

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

const readExtractTool = () =>
  makeToolDefinition({
    id: "read_extract",
    domain: "read",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string" },
        startLine: { type: "number" },
        endLine: { type: "number" },
      },
      additionalProperties: false,
    },
    workspaceBound: true,
  });

const readLocateTool = () =>
  makeToolDefinition({
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

const workspaceMutationTool = () =>
  makeToolDefinition({
    id: "workspace_mutation",
    domain: "edit",
    inputSchema: {
      type: "object",
      required: ["operation", "targetPath", "content"],
      properties: {
        operation: {
          type: "string",
          enum: ["write"],
        },
        targetPath: { type: "string" },
        content: { type: "string" },
      },
      additionalProperties: false,
    },
    sideEffect: "local-write",
    requiresApproval: true,
    workspaceBound: true,
    workspaceBoundaryArgKeys: ["targetPath"],
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

const runGraph = async (input: {
  runId: string;
  question: string;
  pendingToolCall?: AgentGraphInput["pendingToolCall"];
  approvedInvocations?: AgentGraphInput["approvedInvocations"];
  selectedToolId?: string;
  onExecutionNode?: AgentGraphInput["onExecutionNode"];
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
    pendingToolCall: input.pendingToolCall,
    approvedInvocations: input.approvedInvocations,
    selectedToolId: input.selectedToolId,
    onExecutionNode: input.onExecutionNode,
  });

const toApprovedInvocation = (
  result: Pick<AgentGraphOutput, "pendingApproval" | "pendingToolCall">,
): AgentApprovedInvocation => {
  assert.notEqual(result.pendingApproval, undefined);
  assert.notEqual(result.pendingToolCall, undefined);

  return {
    toolId: result.pendingToolCall!.toolId,
    input: result.pendingToolCall!.args,
    inputHash: result.pendingToolCall!.inputHash,
    approvedAt: "2026-07-07T00:00:00.000Z",
    approvalId: result.pendingApproval!.id,
  };
};

const completedReadOpenInvocation = (input: {
  invocationId: string;
  path: string;
  text: string;
}) =>
  ({
    id: input.invocationId,
    toolId: "read_open",
    status: "completed" as const,
    result: {
      type: "open",
      path: input.path,
      source: {
        kind: "text",
        mimeType: "text/markdown",
        text: input.text,
        metadata: {},
      },
    },
    startedAt: "2026-07-07T00:00:00.000Z",
    finishedAt: "2026-07-07T00:00:01.000Z",
  }) as const;

const completedReadListInvocation = (input: {
  invocationId: string;
  path: string;
  entries: Array<{ name: string; type: "file" | "directory" }>;
}) =>
  ({
    id: input.invocationId,
    toolId: "read_list",
    status: "completed" as const,
    result: {
      type: "list",
      path: input.path,
      entries: input.entries,
    },
    startedAt: "2026-07-07T00:00:00.000Z",
    finishedAt: "2026-07-07T00:00:01.000Z",
  }) as const;

const completedReadLocateInvocation = (input: {
  invocationId: string;
  query: string;
  matches: Array<{
    path: string;
    matchType: "path" | "content";
    preview?: string;
    line?: number;
    column?: number;
  }>;
}) =>
  ({
    id: input.invocationId,
    toolId: "read_locate",
    status: "completed" as const,
    result: {
      type: "locate",
      scope: ".",
      query: input.query,
      searchMode: "content",
      matches: input.matches,
    },
    startedAt: "2026-07-07T00:00:00.000Z",
    finishedAt: "2026-07-07T00:00:01.000Z",
  }) as const;

const completedReadExtractInvocation = (input: {
  invocationId: string;
  path: string;
  text: string;
  startLine: number;
  endLine: number;
}) =>
  ({
    id: input.invocationId,
    toolId: "read_extract",
    status: "completed" as const,
    result: {
      type: "extract",
      path: input.path,
      startLine: input.startLine,
      endLine: input.endLine,
      source: {
        kind: "text",
        mimeType: "text/plain",
        text: input.text,
        metadata: {},
      },
    },
    startedAt: "2026-07-07T00:00:00.000Z",
    finishedAt: "2026-07-07T00:00:01.000Z",
  }) as const;

const failedInvocation = (input: {
  invocationId: string;
  toolId: string;
  message: string;
}) =>
  ({
    id: input.invocationId,
    toolId: input.toolId,
    status: "failed" as const,
    error: {
      message: input.message,
    },
    startedAt: "2026-07-07T00:00:00.000Z",
    finishedAt: "2026-07-07T00:00:01.000Z",
  }) as const;

const completedTerminalInvocation = (input: {
  invocationId: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr?: string;
}) =>
  ({
    id: input.invocationId,
    toolId: "terminal_session",
    status: "completed" as const,
    result: {
      sessionId: `${input.invocationId}-session`,
      command: input.command,
      cwd: "D:\\workspace\\rag-demo",
      exitCode: input.exitCode,
      output: input.stdout,
      stdout: input.stdout,
      stderr: input.stderr ?? "",
      timedOut: false,
      reusedSession: false,
      sessionMode: "ephemeral",
      streamMode: "split",
      stderrSeparated: true,
      stdoutEncoding: "utf8",
      stderrEncoding: "utf8",
      truncated: false,
      binaryDetected: false,
      violations: [],
    },
    startedAt: "2026-07-07T00:00:00.000Z",
    finishedAt: "2026-07-07T00:00:01.000Z",
  }) as const;

const completedWorkspaceMutationInvocation = (input: {
  invocationId: string;
  targetPath: string;
}) =>
  ({
    id: input.invocationId,
    toolId: "workspace_mutation",
    status: "completed" as const,
    result: {
      operation: "write",
      targetPath: input.targetPath,
      written: true,
    },
    startedAt: "2026-07-07T00:00:00.000Z",
    finishedAt: "2026-07-07T00:00:01.000Z",
  }) as const;

beforeEach(() => {
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
});

test("T028 scenario 1: autonomous source review keeps advancing from locate to read and answers with concrete evidence", async () => {
  const question =
    "帮我评估这个项目 Agent 闭环哪里还不完整，先自己定位相关实现，再读取关键文件后给我结论。";
  setupToolExposure(question, [readLocateTool(), readOpenTool()]);

  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_locate","args":{"query":"legacy browser_action"},"reason":"Start with a broad clue to find the old runtime path first."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_locate","args":{"query":"approval resume trace"},"reason":"The first clue was off-target, so narrow the query to approval resume evidence."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"server/src/agent/resume.ts"},"reason":"Read the located implementation before answering."}';
    });

  const executeSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValueOnce(
      completedReadLocateInvocation({
        invocationId: "invocation-source-review-locate-miss",
        query: "legacy browser_action",
        matches: [],
      }),
    )
    .mockResolvedValueOnce(
      completedReadLocateInvocation({
        invocationId: "invocation-source-review-locate-hit",
        query: "approval resume trace",
        matches: [
          {
            path: "docs/project-control/tasks/agent_node_T014-approval-resume-contract.md",
            matchType: "content",
            preview: "approval resume contract",
          },
          {
            path: "server/src/agent/resume.ts",
            matchType: "content",
            preview: "resumeApprovedAgentRun resumes a pending run and keeps approval state",
          },
        ],
      }),
    )
    .mockResolvedValueOnce(
      completedReadOpenInvocation({
        invocationId: "invocation-source-review-open",
        path: "server/src/agent/resume.ts",
        text: "resumeApprovedAgentRun clears pendingApproval before rerunning agentGraph, then rebuilds assistant state.",
      }),
    );
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "我先定位失败了一次，然后继续定位到 docs/project-control/tasks/agent_node_T014-approval-resume-contract.md 和 server/src/agent/resume.ts，随后读取了 server/src/agent/resume.ts。当前缺口集中在审批恢复后的证据串联与终局说明，需要继续补黑盒回放证据。",
  );

  const executionNodes: Array<{
    nodeId: string;
    phase: string;
    summary?: string;
    details?: Record<string, unknown>;
  }> = [];

  const result = await runGraph({
    runId: "t028-scenario-source-review",
    question,
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

  assert.equal(result.status, "completed");
  assert.equal(result.answer.includes("server/src/agent/resume.ts"), true);
  assert.equal(result.answer.includes("agent_node_T014"), true);
  assert.equal(result.answer.includes("定位失败了一次"), true);
  assert.equal(plannerSpy.mock.calls.length, 3);
  assert.equal(executeSpy.mock.calls.length, 3);
  assert.equal(executeSpy.mock.calls[0]?.[0]?.toolId, "read_locate");
  assert.equal(executeSpy.mock.calls[1]?.[0]?.toolId, "read_locate");
  assert.equal(executeSpy.mock.calls[2]?.[0]?.toolId, "read_open");
  assert.equal(result.evidence.toolExecutions.length, 3);
  assert.equal(result.evidence.latestSummary?.toolId, "read_open");
  assert.equal(
    executionNodes.filter(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    ).length >= 2,
    true,
  );
  assert.equal(
    executionNodes.some(
      (event) =>
        event.nodeId === "agent-next-action-planner" &&
        event.summary?.includes("read_locate"),
    ),
    true,
  );
  assert.equal(
    executionNodes.some(
      (event) =>
        event.nodeId.startsWith("agent-tool") &&
        event.phase === "done" &&
        event.summary?.includes("read_locate"),
    ),
    true,
  );
  assert.equal(
    executionNodes.some(
      (event) =>
        event.nodeId.startsWith("agent-tool") &&
        event.phase === "done" &&
        event.summary?.includes("read_open"),
    ),
    true,
  );
});

test("T028 scenario 2: terminal failure resumes after approval, reads package.json, then re-approves a new command", async () => {
  const question = "帮我跑一下 Agent 相关测试，第一次命令失败后继续推进并告诉我原因。";
  setupToolExposure(question, [terminalTool(), readOpenTool()]);

  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"terminal_session","args":{"command":"pnpm test:agent"},"reason":"Need to run the agent test script first."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"package.json"},"reason":"The first command failed, so open package.json before deciding the next test command."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"terminal_session","args":{"command":"pnpm exec vitest run server/src/agent/__tests__/graph.test.ts"},"reason":"package.json did not provide a usable script entry, so switch to the focused vitest command."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"The recovered command result is now grounded by the collected facts."}';
    });
  const executeSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValueOnce(
      failedInvocation({
        invocationId: "invocation-terminal-failed",
        toolId: "terminal_session",
        message: 'Script "test:agent" not found',
      }),
    )
    .mockResolvedValueOnce(
      completedReadOpenInvocation({
        invocationId: "invocation-open-package-json",
        path: "package.json",
        text: "",
      }),
    )
    .mockResolvedValueOnce(
      completedTerminalInvocation({
        invocationId: "invocation-terminal-recovered",
        command: "pnpm exec vitest run server/src/agent/__tests__/graph.test.ts",
        exitCode: 0,
        stdout: "1 passed",
      }),
    );
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "第一次命令 `pnpm test:agent` 不存在。随后我实际打开了 package.json，但这次读取没有返回可用内容，因此改用 `pnpm exec vitest run server/src/agent/__tests__/graph.test.ts`，重新审批后执行成功。",
  );

  const firstRunTrace: Array<{ nodeId: string; phase: string; summary?: string }> = [];
  const firstRun = await runGraph({
    runId: "t028-scenario-terminal-recovery",
    question,
    onExecutionNode: async (event) => {
      firstRunTrace.push({
        nodeId: event.nodeId,
        phase: event.phase,
        summary: event.summary,
      });
    },
  });

  assert.equal(firstRun.status, "waiting_approval");
  assert.equal(firstRun.pendingApproval?.toolId, "terminal_session");
  assert.equal(firstRun.pendingToolCall?.toolId, "terminal_session");
  assert.equal(executeSpy.mock.calls.length, 0);
  assert.equal(firstRunTrace.some((event) => event.nodeId === "agent-approval"), true);

  const approvedFirstCommand = toApprovedInvocation(firstRun);
  const secondRunTrace: Array<{ nodeId: string; phase: string; summary?: string }> = [];
  const secondRun = await runGraph({
    runId: "t028-scenario-terminal-recovery",
    question,
    selectedToolId: firstRun.pendingToolCall?.toolId,
    pendingToolCall: firstRun.pendingToolCall,
    approvedInvocations: [approvedFirstCommand],
    onExecutionNode: async (event) => {
      secondRunTrace.push({
        nodeId: event.nodeId,
        phase: event.phase,
        summary: event.summary,
      });
    },
  });

  assert.equal(secondRun.status, "waiting_approval");
  assert.equal(secondRun.pendingApproval?.toolId, "terminal_session");
  assert.equal(secondRun.pendingToolCall?.toolId, "terminal_session");
  assert.equal(executeSpy.mock.calls.length, 2);
  assert.equal(secondRun.evidence.toolExecutions.length, 2);
  assert.equal(executeSpy.mock.calls[1]?.[0]?.toolId, "read_open");
  assert.deepEqual(executeSpy.mock.calls[1]?.[0]?.args, { path: "package.json" });
  assert.equal(secondRun.evidence.latestSummary?.toolId, "read_open");
  assert.equal(secondRun.evidence.latestSummary?.answerReadiness, undefined);
  assert.equal(
    secondRunTrace.some(
      (event) =>
        event.phase === "error" &&
        event.summary?.includes("正在重新判断下一步"),
    ),
    true,
  );
  assert.equal(
    secondRunTrace.some(
      (event) =>
        event.nodeId === "agent-next-action-planner" &&
        event.summary?.includes("read_open"),
    ),
    true,
  );
  assert.equal(
    secondRunTrace.some(
      (event) =>
        event.nodeId === "agent-next-action-planner" &&
        event.summary?.includes("terminal_session"),
    ),
    true,
  );
  assert.notEqual(
    secondRun.pendingToolCall?.args.command,
    firstRun.pendingToolCall?.args.command,
  );
  assert.notEqual(secondRun.pendingApproval?.inputHash, firstRun.pendingApproval?.inputHash);

  const approvedSecondCommand = toApprovedInvocation(secondRun);
  const thirdRun = await runGraph({
    runId: "t028-scenario-terminal-recovery",
    question,
    selectedToolId: secondRun.pendingToolCall?.toolId,
    pendingToolCall: secondRun.pendingToolCall,
    approvedInvocations: [approvedFirstCommand, approvedSecondCommand],
  });

  assert.equal(thirdRun.status, "completed");
  assert.equal(thirdRun.evidence.toolExecutions.length, 1);
  assert.equal(thirdRun.evidence.latestSummary?.toolId, "terminal_session");
  assert.equal(plannerSpy.mock.calls.length, 4);
  assert.equal(executeSpy.mock.calls.length, 3);
});

test("T028 scenario 3: minimal fix closes read, proposal, write approval, test approval, and final verification", async () => {
  const question =
    "修一下工具失败后直接终止的问题，做最小改动，并告诉我改了什么和验证结果。";
  setupToolExposure(question, [
    readExtractTool(),
    workspaceMutationTool(),
    terminalTool(),
  ]);

  const plannerSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_extract","args":{"path":"server/src/agent/tool-node.ts","startLine":1,"endLine":80},"reason":"Read the relevant tool-node source slice before proposing a minimal fix."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"workspace_mutation","args":{"operation":"write","targetPath":"server/src/agent/tool-node.ts","content":"// minimal fix patch"},"reason":"Propose the smallest code change that keeps failed tools inside the recovery loop."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"terminal_session","args":{"command":"pnpm exec vitest run server/src/agent/__tests__/graph.test.ts"},"reason":"Need a focused verification command after the write completes."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"The write diff and verification command result are enough to summarize the fix."}';
    });
  const executeSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValueOnce(
      completedReadExtractInvocation({
        invocationId: "invocation-read-before-fix",
        path: "server/src/agent/tool-node.ts",
        startLine: 1,
        endLine: 80,
        text:
          "if (result.status === 'failed') {\n  return { errorMessage: result.error?.message ?? 'failed' };\n}",
      }),
    )
    .mockResolvedValueOnce(
      completedWorkspaceMutationInvocation({
        invocationId: "invocation-write-fix",
        targetPath: "server/src/agent/tool-node.ts",
      }),
    )
    .mockResolvedValueOnce(
      completedTerminalInvocation({
        invocationId: "invocation-test-fix",
        command: "pnpm exec vitest run server/src/agent/__tests__/graph.test.ts",
        exitCode: 0,
        stdout: "graph.test.ts 1 passed",
      }),
    );
  vi.spyOn(runnablesModule.agentGenerateTextRunnable, "invoke").mockResolvedValue(
    "我先读取了 server/src/agent/tool-node.ts 的相关源码片段，然后提交最小写入方案并在审批通过后落地。随后重新审批执行 `pnpm exec vitest run server/src/agent/__tests__/graph.test.ts`，验证通过。",
  );

  const firstRunEvents: Array<{
    nodeId: string;
    phase: string;
    summary?: string;

    details?: Record<string, unknown>;
  }> = [];
  const firstRun = await runGraph({
    runId: "t028-scenario-minimal-fix",
    question,
    onExecutionNode: async (event) => {
      firstRunEvents.push({
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

  assert.equal(firstRun.status, "waiting_approval");
  assert.equal(firstRun.pendingApproval?.toolId, "workspace_mutation");
  assert.equal(firstRun.pendingToolCall?.toolId, "workspace_mutation");
  assert.equal(executeSpy.mock.calls.length, 1);
  assert.equal(executeSpy.mock.calls[0]?.[0]?.toolId, "read_extract");
  assert.deepEqual(executeSpy.mock.calls[0]?.[0]?.args, {
    path: "server/src/agent/tool-node.ts",
    startLine: 1,
    endLine: 80,
  });
  const proposalEvent = firstRunEvents.find(
    (event) =>
      event.nodeId === "agent-next-action-planner" &&
      event.phase === "done" &&
      event.summary?.includes("workspace_mutation"),
  );
  assert.notEqual(proposalEvent, undefined);

  const approvedWrite = toApprovedInvocation(firstRun);
  const secondRun = await runGraph({
    runId: "t028-scenario-minimal-fix",
    question,
    selectedToolId: firstRun.pendingToolCall?.toolId,
    pendingToolCall: firstRun.pendingToolCall,
    approvedInvocations: [approvedWrite],
  });

  assert.equal(secondRun.status, "waiting_approval");
  assert.equal(secondRun.pendingApproval?.toolId, "terminal_session");
  assert.equal(secondRun.pendingToolCall?.toolId, "terminal_session");
  assert.equal(executeSpy.mock.calls.length, 2);
  assert.equal(executeSpy.mock.calls[1]?.[0]?.toolId, "workspace_mutation");
  assert.notEqual(secondRun.pendingApproval?.inputHash, firstRun.pendingApproval?.inputHash);
  assert.equal(secondRun.evidence.toolExecutions.length, 1);

  const approvedTest = toApprovedInvocation(secondRun);
  const thirdRun = await runGraph({
    runId: "t028-scenario-minimal-fix",
    question,
    selectedToolId: secondRun.pendingToolCall?.toolId,
    pendingToolCall: secondRun.pendingToolCall,
    approvedInvocations: [approvedWrite, approvedTest],
  });

  assert.equal(thirdRun.status, "completed");
  assert.equal(thirdRun.answer.includes("server/src/agent/tool-node.ts"), true);
  assert.equal(thirdRun.answer.includes("相关源码片段"), true);
  assert.equal(
    thirdRun.answer.includes(
      "pnpm exec vitest run server/src/agent/__tests__/graph.test.ts",
    ),
    true,
  );
  assert.equal(plannerSpy.mock.calls.length, 4);
  assert.equal(executeSpy.mock.calls.length, 3);
});
