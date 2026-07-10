import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { subscribeToLogLines } from "@/logger";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import {
  buildPlannerObservationContext,
  type AgentNodeState,
} from "../node-runtime";
import { createInvocationInputHash } from "../approval-fingerprint";
import { DEFAULT_AGENT_MAX_RECOVERY_ATTEMPTS } from "../recovery";
import { buildNextActionPlannerMessages } from "../planner/prompt";
import {
  nextActionPlannerNode,
  parseNextActionPlannerOutput,
} from "../nodes/next-action-planner";

const createState = (
  overrides: Partial<AgentNodeState> = {},
): AgentNodeState => ({
  runId: "run-1",
  threadId: "thread-1",
  userId: 1,
  goal: {
    id: "goal-1",
    text: "answer the user",
    successCriteria: ["answer"],
    constraints: ["safe"],
    riskLevel: "low",
  },
  question: "What should we do next?",
  messages: [
    {
      role: "user",
      content: "What should we do next?",
      parts: [{ type: "text", text: "What should we do next?" }],
    },
  ],
  toolExposure: {
    exposedTools: ["read_open", "web_search"],
    toolMeta: [
      {
        toolId: "read_open",
        title: "Read Open",
        description: "Open a workspace file",
        inputSchema: { type: "object", properties: { path: { type: "string" } } },
        domain: "read",
        source: "internal",
        tags: ["read"],
        capabilities: {
          sideEffect: "none",
          requiresApproval: false,
        },
      },
      {
        toolId: "web_search",
        title: "Web Search",
        description: "Search the public web",
        inputSchema: { type: "object", properties: { query: { type: "string" } } },
        domain: "web_search",
        source: "internal",
        tags: ["web"],
        capabilities: {
          sideEffect: "network",
          requiresApproval: false,
        },
      },
    ],
  },
  evidence: {
    observations: [],
    retrievals: [],
    toolExecutions: [],
  },
  iterationCount: 0,
  maxIterations: 3,
  ...overrides,
});

const readmeArgsHash = createInvocationInputHash({
  toolId: "read_open",
  args: { path: "README.md" },
  source: "planner",
});

const readListDotArgsHash = createInvocationInputHash({
  toolId: "read_list",
  args: { path: "." },
  source: "planner",
});

const baseToolExposure = createState().toolExposure!;

const readListToolMeta = {
  toolId: "read_list",
  title: "Read List",
  description: "List a workspace directory",
  inputSchema: { type: "object", properties: { path: { type: "string" } } },
  domain: "read",
  source: "internal",
  tags: ["read"],
  capabilities: {
    sideEffect: "none" as const,
    requiresApproval: false,
  },
};

test("buildPlannerObservationContext handles empty planner state", () => {
  const context = buildPlannerObservationContext(
    createState({
      currentTaskFrame: undefined,
      observations: undefined,
      evidence: undefined,
      lastToolExecution: undefined,
      pendingApproval: undefined,
      schemaReplanDiagnostics: undefined,
    }),
  );

  assert.equal(context.currentTaskFrame, undefined);
  assert.equal(context.latestObservation, undefined);
  assert.deepEqual(context.recentObservations, []);
  assert.equal(context.latestEvidenceSummary, undefined);
  assert.deepEqual(context.taskCoverageView, {
    requiredTargets: [],
    coveredTargets: [],
    pendingTargets: [],
    pendingActions: [],
    blockedReason: undefined,
    taskCompletable: true,
  });
  assert.deepEqual(context.recovery, {
    source: "none",
    attemptCount: 0,
    maxAttempts: 1,
    exhausted: false,
  });
  assert.equal(context.pendingApproval, undefined);
});

test("buildPlannerObservationContext includes lastToolExecution as the latest planner observation", () => {
  const context = buildPlannerObservationContext(
    createState({
      lastToolExecution: {
        toolId: "read_open",
        args: { path: "README.md" },
        status: "completed",
        summary: {
          source: "tool",
          status: "completed",
          toolId: "read_open",
          actionTaken: "Opened README.md.",
          keyFindings: ["contentLength=120"],
          answerReadiness: {
            canAnswer: true,
            reason: "Opened file content is available for answer generation.",
          },
        },
        startedAt: "2026-07-06T10:00:00.000Z",
        finishedAt: "2026-07-06T10:00:01.000Z",
      },
      evidence: undefined,
      observations: undefined,
    }),
  );

  assert.equal(context.latestObservation?.source, "tool_execution");
  assert.equal(context.latestObservation?.actionType, "tool");
  assert.equal(context.latestObservation?.toolId, "read_open");
  assert.equal(context.latestObservation?.status, "completed");
  assert.deepEqual(context.latestObservation?.argsPreview, { path: "README.md" });
  assert.equal(context.latestObservation?.summary?.toolId, "read_open");
});

test("buildPlannerObservationContext keeps terminal tool failure as failed_terminal", () => {
  const context = buildPlannerObservationContext(
    createState({
      lastToolExecution: {
        toolCallId: "tool-call-terminal-failed",
        toolId: "read_open",
        inputHash: "hash-read-open-terminal",
        args: { path: "README.md" },
        status: "failed",
        failureKind: "terminal",
        errorMessage: "Tool protocol mismatch: result payload is invalid",
        startedAt: "2026-07-06T10:00:00.000Z",
        finishedAt: "2026-07-06T10:00:01.000Z",
      },
      evidence: undefined,
      observations: undefined,
    }),
  );

  assert.equal(context.latestObservation?.source, "tool_execution");
  assert.equal(context.latestObservation?.actionType, "tool");
  assert.equal(context.latestObservation?.status, "failed_terminal");
  assert.equal(context.latestObservation?.recoverable, false);
  assert.deepEqual(context.latestObservation?.suggestedNextActions, [
    "report_terminal_failure",
  ]);
});

test("buildPlannerObservationContext keeps recoverable tool failure as failed_recoverable", () => {
  const context = buildPlannerObservationContext(
    createState({
      lastToolExecution: {
        toolCallId: "tool-call-recoverable-failed",
        toolId: "read_open",
        inputHash: "hash-read-open-recoverable",
        args: { path: "missing.md" },
        status: "failed",
        failureKind: "recoverable",
        recoveryAttemptCount: 1,
        errorMessage: "File not found",
        startedAt: "2026-07-06T10:00:00.000Z",
        finishedAt: "2026-07-06T10:00:01.000Z",
      },
      evidence: undefined,
      observations: undefined,
    }),
  );

  assert.equal(context.latestObservation?.source, "tool_execution");
  assert.equal(context.latestObservation?.actionType, "tool");
  assert.equal(context.latestObservation?.status, "failed_recoverable");
  assert.equal(context.latestObservation?.recoverable, true);
  assert.deepEqual(context.latestObservation?.suggestedNextActions, [
    "inspect_failure_cause",
    "retry_with_adjustment",
    "switch_action",
  ]);
  assert.deepEqual(context.recovery, {
    source: "tool_failure",
    attemptCount: 1,
    maxAttempts: DEFAULT_AGENT_MAX_RECOVERY_ATTEMPTS,
    exhausted: false,
    toolId: "read_open",
    inputHash: "hash-read-open-recoverable",
    errorMessage: "File not found",
    failureKind: "recoverable",
  });
});

test("buildPlannerObservationContext includes pendingApproval in both approval view and recent observations", () => {
  const context = buildPlannerObservationContext(
    createState({
      pendingApproval: {
        id: "approval-1",
        runId: "run-1",
        stepId: "approval",
        toolId: "terminal_session",
        toolCallId: "tool-call-1",
        inputHash: "hash-1",
        reason: "Needs approval before running.",
        createdAt: "2026-07-06T10:00:02.000Z",
      },
      evidence: undefined,
      observations: undefined,
    }),
  );

  assert.deepEqual(context.pendingApproval, {
    toolId: "terminal_session",
    inputHash: "hash-1",
    reason: "Needs approval before running.",
  });
  assert.equal(context.latestObservation?.source, "approval");
  assert.equal(context.latestObservation?.actionType, "approval");
  assert.equal(context.latestObservation?.toolId, "terminal_session");
  assert.equal(context.latestObservation?.status, "waiting_approval");
  assert.deepEqual(context.latestObservation?.suggestedNextActions, [
    "wait_for_approval",
    "resume_after_approval",
  ]);
});

test("buildPlannerObservationContext maps retrieve results into unified execution observations", () => {
  const context = buildPlannerObservationContext(
    createState({
      evidence: {
        observations: [],
        retrievals: [
          {
            knowledgeBaseId: "kb-1",
            query: "inspect docs",
            chunkCount: 1,
            chunks: [
              {
                chunkId: "c1",
                documentName: "README.md",
                content: "doc one",
              },
            ],
            createdAt: "2026-07-06T10:00:00.000Z",
          },
        ],
        toolExecutions: [],
      },
      lastToolExecution: undefined,
      pendingApproval: undefined,
    }),
  );

  assert.equal(context.latestObservation?.source, "retrieval");
  assert.equal(context.latestObservation?.actionType, "retrieve");
  assert.equal(context.latestObservation?.status, "completed");
  assert.deepEqual(context.latestObservation?.resultPreview, {
    query: "inspect docs",
    chunkCount: 1,
    documents: ["README.md"],
  });
});

test("buildPlannerObservationContext carries recovery diagnostics into a unified recovery view", () => {
  const context = buildPlannerObservationContext(
    createState({
      schemaReplanDiagnostics: {
        schemaError: "path is required",
        toolId: "read_open",
        invalidAction: {
          type: "use_tool",
          toolId: "read_open",
          args: {},
          reason: "Need file content.",
        },
        attemptCount: 1,
      },
    }),
  );

  assert.deepEqual(context.recovery, {
    source: "schema_replan",
    attemptCount: 1,
    maxAttempts: 1,
    exhausted: false,
    errorMessage: "path is required",
    schemaError: "path is required",
    toolId: "read_open",
    invalidAction: {
      type: "use_tool",
      toolId: "read_open",
      args: {},
      reason: "Need file content.",
    },
  });
});

test("buildPlannerObservationContext marks recovery as exhausted only after the replan budget is exceeded", () => {
  const context = buildPlannerObservationContext(
    createState({
      schemaReplanDiagnostics: {
        schemaError: "path is still required",
        toolId: "read_open",
        invalidAction: {
          type: "use_tool",
          toolId: "read_open",
          args: {},
          reason: "Need file content.",
        },
        attemptCount: 2,
      },
    }),
  );

  assert.deepEqual(context.recovery, {
    source: "schema_replan",
    attemptCount: 2,
    maxAttempts: 1,
    exhausted: true,
    errorMessage: "path is still required",
    schemaError: "path is still required",
    toolId: "read_open",
    invalidAction: {
      type: "use_tool",
      toolId: "read_open",
      args: {},
      reason: "Need file content.",
    },
  });
});

test("buildNextActionPlannerMessages reads planner observation context instead of scattered top-level planner state fields", () => {
  const observationContext = buildPlannerObservationContext(
    createState({
      currentTaskFrame: {
        currentGoal: "Inspect README.md",
        confirmedObjects: [],
        completionCriteria: ["Inspect README.md"],
      },
      lastToolExecution: {
        toolId: "read_open",
        args: { path: "README.md" },
        status: "completed",
        summary: {
          source: "tool",
          status: "completed",
          toolId: "read_open",
          actionTaken: "Opened README.md.",
          keyFindings: ["contentLength=120"],
          answerReadiness: {
            canAnswer: true,
            reason: "Opened file content is available for answer generation.",
          },
        },
        startedAt: "2026-07-06T10:00:00.000Z",
        finishedAt: "2026-07-06T10:00:01.000Z",
      },
      pendingApproval: {
        id: "approval-1",
        runId: "run-1",
        stepId: "approval",
        toolId: "terminal_session",
        toolCallId: "tool-call-1",
        inputHash: "hash-1",
        reason: "Needs approval before running.",
        createdAt: "2026-07-06T10:00:02.000Z",
      },
      schemaReplanDiagnostics: {
        schemaError: "path is required",
        toolId: "read_open",
        attemptCount: 1,
      },
    }),
  );

  const messages = buildNextActionPlannerMessages({
    question: "Open README.md",
    observationContext,
    toolExposure: createState().toolExposure!,
    iteration: 0,
    maxIterations: 3,
  });
  const payload = JSON.parse(String(messages[1]?.content ?? "{}")) as Record<string, unknown>;
  const promptObservationContext = payload.observationContext as Record<string, unknown>;

  assert.ok("observationContext" in payload);
  assert.equal("taskFrame" in payload, false);
  assert.equal("lastToolExecution" in payload, false);
  assert.equal("pendingApproval" in payload, false);
  assert.equal("schemaReplanDiagnostics" in payload, false);
  assert.equal("latestEvidenceSummary" in payload, false);
  assert.ok("taskCoverageView" in promptObservationContext);
});

test("buildNextActionPlannerMessages uses tool failure recovery budget in the main planner prompt", () => {
  const observationContext = buildPlannerObservationContext(
    createState({
      lastToolExecution: {
        toolCallId: "tool-call-recoverable-failed",
        toolId: "read_open",
        inputHash: "hash-read-open-recoverable",
        args: { path: "missing.md" },
        status: "failed",
        failureKind: "recoverable",
        recoveryAttemptCount: 1,
        errorMessage: "File not found",
        startedAt: "2026-07-06T10:00:00.000Z",
        finishedAt: "2026-07-06T10:00:01.000Z",
      },
      evidence: undefined,
      observations: undefined,
    }),
  );

  const messages = buildNextActionPlannerMessages({
    question: "Open missing.md",
    observationContext,
    toolExposure: createState().toolExposure!,
    iteration: 0,
    maxIterations: 3,
  });
  const payload = JSON.parse(String(messages[1]?.content ?? "{}")) as Record<string, unknown>;
  const progression = payload.progression as Record<string, unknown>;

  assert.equal(observationContext.recovery.source, "tool_failure");
  assert.equal(observationContext.recovery.attemptCount, 1);
  assert.equal(
    observationContext.recovery.maxAttempts,
    DEFAULT_AGENT_MAX_RECOVERY_ATTEMPTS,
  );
  assert.equal(progression.remainingRecoveryAttempts, 1);
  assert.match(
    String(messages[0]?.content ?? ""),
    /当前恢复预算还剩 1 次；如果继续恢复，必须说明这次为什么与上次不同。/,
  );
});

test("nextActionPlannerNode returns answer action from task model JSON", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"answer","reason":"Evidence is already sufficient."}';

    });

  try {
    const patch = await nextActionPlannerNode(createState());
    assert.deepEqual(patch, {
      nextAction: {
        type: "answer",
        reason: "Evidence is already sufficient.",
      },
    });
    assert.equal(streamSpy.mock.calls.length, 1);
  } finally {
    streamSpy.mockRestore();
  }
});

test("parseNextActionPlannerOutput accepts fenced JSON output", () => {
  assert.deepEqual(
    parseNextActionPlannerOutput(
      '```json\n{"type":"answer","reason":"Evidence is already sufficient."}\n```',
    ),
    {
      type: "answer",
      reason: "Evidence is already sufficient.",
    },
  );
});

test("parseNextActionPlannerOutput accepts prefixed JSON output", () => {
  assert.deepEqual(
    parseNextActionPlannerOutput(
      '好的，下面是 JSON：\n{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need the file content."}',
    ),
    {
      type: "use_tool",
      toolId: "read_open",
      args: {
        path: "README.md",
      },
      reason: "Need the file content.",
    },
  );
});

test("parseNextActionPlannerOutput accepts think-prefixed JSON output", () => {
  assert.deepEqual(
    parseNextActionPlannerOutput(
      '<think>Need to inspect the file first.</think>\n{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need file content."}',
    ),
    {
      type: "use_tool",
      toolId: "read_open",
      args: {
        path: "README.md",
      },
      reason: "Need file content.",
    },
  );
});

test("parseNextActionPlannerOutput accepts think-prefixed answer JSON output", () => {
  assert.deepEqual(
    parseNextActionPlannerOutput(
      '<think>Evidence is enough.</think>\n{"type":"answer","reason":"Evidence is already sufficient."}',
    ),
    {
      type: "answer",
      reason: "Evidence is already sufficient.",
    },
  );
});

test("parseNextActionPlannerOutput defaults reason for use_tool read_list output", () => {
  assert.deepEqual(
    parseNextActionPlannerOutput(
      '{"type":"use_tool","toolId":"read_list","args":{"path":"/workspace"}}',
    ),
    {
      type: "use_tool",
      toolId: "read_list",
      args: {
        path: "/workspace",
      },
      reason: "Planner selected tool read_list.",
    },
  );
});

test("parseNextActionPlannerOutput defaults reason for use_tool read_open output", () => {
  assert.deepEqual(
    parseNextActionPlannerOutput(
      '{"type":"use_tool","toolId":"read_open","args":{"path":"/README.md"}}',
    ),
    {
      type: "use_tool",
      toolId: "read_open",
      args: {
        path: "/README.md",
      },
      reason: "Planner selected tool read_open.",
    },
  );
});

test("parseNextActionPlannerOutput defaults reason for retrieve output", () => {
  assert.deepEqual(
    parseNextActionPlannerOutput(
      '{"type":"retrieve","query":"查看 README.md 的内容"}',
    ),
    {
      type: "retrieve",
      query: "查看 README.md 的内容",
      reason: "Planner requested retrieval for query: 查看 README.md 的内容.",
    },
  );
});

test("parseNextActionPlannerOutput defaults reason for answer output", () => {
  assert.deepEqual(
    parseNextActionPlannerOutput('{"type":"answer"}'),
    {
      type: "answer",
      reason: "Planner selected final answer.",
    },
  );
});

test("parseNextActionPlannerOutput accepts ask_user output and defaults the reason", () => {
  assert.deepEqual(
    parseNextActionPlannerOutput(
      '{"type":"ask_user","question":"请确认要检查哪个仓库？"}',
    ),
    {
      type: "ask_user",
      question: "请确认要检查哪个仓库？",
      reason: "Planner needs the user to clarify the missing information.",
    },
  );
});

test("parseNextActionPlannerOutput rejects multiple JSON objects instead of guessing", () => {
  assert.equal(
    parseNextActionPlannerOutput(
      '{"type":"answer","reason":"First."}\n{"type":"error","reason":"Second."}',
    ),
    null,
  );
});

test("nextActionPlannerNode returns retrieve action from task model JSON", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"retrieve","query":"deployment process","reason":"Need knowledge-base evidence."}';
    });

  try {
    const patch = await nextActionPlannerNode(createState());
    assert.deepEqual(patch, {
      nextAction: {
        type: "retrieve",
        query: "deployment process",
        reason: "Need knowledge-base evidence.",
      },
    });
    assert.equal(streamSpy.mock.calls.length, 1);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode returns use_tool action when toolId is exposed", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need the file content."}';
    });

  try {
    const patch = await nextActionPlannerNode(createState());
    assert.deepEqual(patch, {
      nextAction: {
        type: "use_tool",
        toolId: "read_open",
        args: {
          path: "README.md",

        },
        reason: "Need the file content.",
      },
    });
    assert.equal("pendingToolCall" in patch, false);
    assert.equal("selectedToolId" in patch, false);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode uses bounded replan prompt when schema diagnostics exist", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need the file content."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        workspaceRoot: "D:\\workspace\\rag-demo",
        schemaReplanDiagnostics: {
          schemaError: "args.limit is not allowed",
          toolId: "read_open",
          invalidAction: {
            type: "use_tool",
            toolId: "read_open",
            args: {
              path: "README.md",
              limit: 3,
            },
            reason: "Need file content.",
          },
          attemptCount: 1,
        },
      }),
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "use_tool",
        toolId: "read_open",
        args: {
          path: "README.md",
        },
        reason: "Need the file content.",
      },
    });

    const plannerMessages = streamSpy.mock.calls[0]?.[0] ?? [];
    assert.match(String(plannerMessages[0]?.content ?? ""), /bounded replan/i);
    assert.match(String(plannerMessages[1]?.content ?? ""), /args\.limit is not allowed/);
    assert.match(String(plannerMessages[1]?.content ?? ""), /allowedTools/);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode allows the same tool when args differ", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"docs/README.md"},"reason":"Need the nested file content."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [
            {
              toolCallId: "tool-call-readme",
              toolId: "read_open",
              inputHash: readmeArgsHash,
              args: {
                path: "README.md",
              },
              status: "completed",
              result: {
                type: "open",
                path: "README.md",
              },
              startedAt: "2026-07-04T00:00:00.000Z",
              finishedAt: "2026-07-04T00:00:01.000Z",
            },
          ],
        },
      }),
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "use_tool",
        toolId: "read_open",
        args: {
          path: "docs/README.md",
        },
        reason: "Need the nested file content.",
      },
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode does not treat failed tool execution as a completed duplicate", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Retry the file content."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [
            {
              toolCallId: "tool-call-readme-failed",
              toolId: "read_open",
              inputHash: readmeArgsHash,
              args: {
                path: "README.md",
              },
              status: "failed",
              errorMessage: "file not found",
              startedAt: "2026-07-04T00:00:00.000Z",
              finishedAt: "2026-07-04T00:00:01.000Z",
            },
          ],
        },
      }),
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "use_tool",
        toolId: "read_open",
        args: {
          path: "README.md",
        },
        reason: "Retry the file content.",
      },
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode stops on pendingApproval without producing a final answer", async () => {
  const streamSpy = vi.spyOn(providerProxyService, "streamTaskChatText");
  const events: Array<Record<string, unknown>> = [];

  try {
    const patch = await nextActionPlannerNode(
      createState({
        pendingApproval: {
          id: "approval-1",
          runId: "run-1",
          stepId: "tool",
          toolId: "read_open",
          toolCallId: "tool-call-readme-awaiting",
          reason: "Needs approval before reading README.md.",
          input: {
            path: "README.md",
          },
          inputHash: readmeArgsHash,
          createdAt: "2026-07-04T00:00:00.000Z",
        },
        lastToolExecution: {
          toolCallId: "tool-call-readme-awaiting",
          toolId: "read_open",
          inputHash: readmeArgsHash,
          args: {
            path: "README.md",
          },
          status: "awaiting_approval",
          approval: {
            id: "approval-1",
            runId: "run-1",
            stepId: "tool",
            toolId: "read_open",
            reason: "Needs approval before reading README.md.",
            input: {
              path: "README.md",
            },
            inputHash: readmeArgsHash,
            createdAt: "2026-07-04T00:00:00.000Z",
          },
          startedAt: "2026-07-04T00:00:00.000Z",
          finishedAt: "2026-07-04T00:00:01.000Z",
        },
      }),
      async (event) => {
        events.push({
          nodeId: event.nodeId,
          phase: event.phase,
          details: event.details,
        });
      },
    );

    assert.deepEqual(patch, {});
    assert.equal(streamSpy.mock.calls.length, 0);

    const doneEvent = events.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.pendingApprovalActive,
      true,
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.selectedActionType,
      null,
    );
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode keeps missing-reason use_tool output as a valid action", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"}}';
    });
  const events: Array<Record<string, unknown>> = [];

  try {
    const patch = await nextActionPlannerNode(
      createState(),
      async (event) => {
        events.push({
          nodeId: event.nodeId,
          phase: event.phase,
          details: event.details,
        });
      },
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "use_tool",
        toolId: "read_open",
        args: {
          path: "README.md",
        },
        reason: "Planner selected tool read_open.",
      },
    });

    const doneEvent = events.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.ok(doneEvent);
    assert.deepEqual(
      (doneEvent?.details as Record<string, unknown>)?.parseWarnings,
      ["missing_reason_defaulted"],
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.parseErrorReason,
      undefined,
    );
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode accepts ask_user output for missing information", async () => {

  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"ask_user","question":"Which repository should I inspect?","reason":"The target repo is ambiguous."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        currentTaskFrame: {
          currentGoal: "Inspect the repository",
          currentSubtask: "Determine the next action.",
          currentBlocker: undefined,
          confirmedObjects: [],
          completionCriteria: ["Identify the right repository"],
        },
      }),
    );
    assert.deepEqual(patch, {
      nextAction: {
        type: "ask_user",
        question: "Which repository should I inspect?",
        reason: "The target repo is ambiguous.",
      },
      currentTaskFrame: {
        currentGoal: "What should we do next?",
        currentSubtask: "Ask the user for the missing information needed to continue.",
        currentBlocker: undefined,
        confirmedObjects: [],
        completionCriteria: ["Identify the right repository"],
      },
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode prompt allows ask_user output and includes progression rules", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"answer","reason":"Enough evidence."}';
    });

  try {
    await nextActionPlannerNode(
      createState({
        currentTaskFrame: {
          currentGoal: "Inspect the repository",
          currentSubtask: "Review the latest failed action.",
          currentBlocker: "Last path was wrong",
          confirmedObjects: [],
          completionCriteria: ["Find the right repository"],
        },
        lastToolExecution: {
          toolId: "read_open",
          args: {
            path: "missing.md",
          },
          status: "failed",
          errorMessage: "file not found",
          startedAt: "2026-07-06T10:00:00.000Z",
          finishedAt: "2026-07-06T10:00:01.000Z",
        },
      }),
    );
    const plannerMessages = streamSpy.mock.calls[0]?.[0] ?? [];
    assert.match(String(plannerMessages[0]?.content ?? ""), /"type":"ask_user"/);
    assert.match(
      String(plannerMessages[0]?.content ?? ""),
      /如果上一次工具或检索失败但仍可恢复，不要默认输出 error/,
    );
    assert.match(
      String(plannerMessages[0]?.content ?? ""),
      /不要无理由重复同一个失败调用/,
    );
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode bounded replan prompt includes ask_user and recovery exhaustion guidance", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"ask_user","question":"Please confirm the exact file path.","reason":"The previous tool args were invalid and the correct path is still unclear."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        workspaceRoot: "D:\\workspace\\rag-demo",
        schemaReplanDiagnostics: {
          schemaError: "args.limit is not allowed",
          toolId: "read_open",
          invalidAction: {
            type: "use_tool",
            toolId: "read_open",
            args: {
              path: "README.md",
              limit: 3,
            },
            reason: "Need file content.",
          },
          attemptCount: 1,
        },
      }),
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "ask_user",
        question: "Please confirm the exact file path.",
        reason:
          "The previous tool args were invalid and the correct path is still unclear.",
      },
    });

    const plannerMessages = streamSpy.mock.calls[0]?.[0] ?? [];
    assert.match(String(plannerMessages[0]?.content ?? ""), /ask_user/);
    assert.match(
      String(plannerMessages[0]?.content ?? ""),
      /改参数、换工具、ask_user，或在确实无法继续时输出明确终局/,
    );
    assert.match(String(plannerMessages[1]?.content ?? ""), /remainingRecoveryAttempts/);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode stops with a terminal conclusion when recovery budget is exhausted", async () => {
  const streamSpy = vi.spyOn(providerProxyService, "streamTaskChatText");
  const events: Array<Record<string, unknown>> = [];

  try {
    const patch = await nextActionPlannerNode(
      createState({
        lastToolExecution: {
          toolCallId: "tool-call-readme-failed",
          toolId: "read_open",
          inputHash: readmeArgsHash,
          args: {
            path: "README.md",
          },
          status: "failed",
          errorMessage: "file not found",
          summary: {
            source: "tool",
            status: "failed",
            toolId: "read_open",
            actionTaken: "Tried to open README.md.",
            keyFindings: ["The file path could not be resolved."],
            answerReadiness: {
              canAnswer: false,
              reason: "The file open attempt failed, so there is no grounded file evidence.",
              missingInfo: ["A valid file path or a different recovery action."],
            },
          },
          startedAt: "2026-07-04T00:00:00.000Z",
          finishedAt: "2026-07-04T00:00:01.000Z",
        },
        schemaReplanDiagnostics: {
          schemaError: "path is required",
          toolId: "read_open",
          invalidAction: {
            type: "use_tool",
            toolId: "read_open",
            args: {},
            reason: "Need file content.",
          },
          attemptCount: 2,
        },
      }),
      async (event) => {
        events.push({
          nodeId: event.nodeId,
          phase: event.phase,
          details: event.details,
        });
      },
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "error",
        reason: "Recovery budget exhausted after read_open failed: path is required",
      },
      schemaReplanDiagnostics: {
        schemaError: "path is required",
        toolId: "read_open",
        invalidAction: {
          type: "use_tool",
          toolId: "read_open",
          args: {},
          reason: "Need file content.",
        },
        attemptCount: 2,
      },
      errorMessage: "Recovery budget exhausted after read_open failed: path is required",
      blockedReason: "Recovery budget exhausted after read_open failed: path is required",
      errorSourceNodeId: "agent-next-action-planner",
    });
    assert.equal(streamSpy.mock.calls.length, 0);

    const doneEvent = events.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.recoveryExhausted,
      true,
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.selectedActionType,
      "error",
    );
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode stops when schema replan budget is exhausted even without a failed observation", async () => {
  const streamSpy = vi.spyOn(providerProxyService, "streamTaskChatText");

  try {
    const patch = await nextActionPlannerNode(
      createState({
        schemaReplanDiagnostics: {
          schemaError: "args.limit is not allowed",
          toolId: "read_open",
          invalidAction: {
            type: "use_tool",
            toolId: "read_open",
            args: {
              path: "README.md",
              limit: 3,
            },
            reason: "Need file content.",
          },
          attemptCount: 2,
        },
      }),
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "error",
        reason:
          "Recovery budget exhausted after read_open failed: args.limit is not allowed",
      },
      schemaReplanDiagnostics: {
        schemaError: "args.limit is not allowed",
        toolId: "read_open",
        invalidAction: {
          type: "use_tool",
          toolId: "read_open",
          args: {
            path: "README.md",
            limit: 3,
          },
          reason: "Need file content.",
        },
        attemptCount: 2,
      },
      errorMessage:
        "Recovery budget exhausted after read_open failed: args.limit is not allowed",
      blockedReason:
        "Recovery budget exhausted after read_open failed: args.limit is not allowed",
      errorSourceNodeId: "agent-next-action-planner",
    });
    assert.equal(streamSpy.mock.calls.length, 0);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode falls back when task model output is invalid JSON", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield "not-json";
    });

  try {
    const patch = await nextActionPlannerNode(createState());
    assert.deepEqual(patch, {
      nextAction: {
        type: "error",
        reason:
          "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
      },
      errorMessage:
        "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
      blockedReason:
        "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
      errorSourceNodeId: "agent-next-action-planner",
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode writes invalid planner output diagnostics into trace", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"answer","reason":"First."}\n{"type":"error","reason":"Second."}';
    });
  const events: Array<Record<string, unknown>> = [];

  try {
    const patch = await nextActionPlannerNode(
      createState(),
      async (event) => {
        events.push({
          nodeId: event.nodeId,
          phase: event.phase,
          details: event.details,
        });
      },
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "error",
        reason:
          "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
      },
      errorMessage:
        "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
      blockedReason:
        "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
      errorSourceNodeId: "agent-next-action-planner",
    });

    const doneEvent = events.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.ok(doneEvent);
    assert.match(
      String((doneEvent?.details as Record<string, unknown>)?.rawOutputPreview ?? ""),
      /"type":"answer"/,
    );
    assert.match(
      String(
        (doneEvent?.details as Record<string, unknown>)?.sanitizedOutputPreview ?? "",
      ),
      /"type":"error"/,
    );
    assert.match(
      String((doneEvent?.details as Record<string, unknown>)?.parseErrorReason ?? ""),
      /multiple JSON objects/i,
    );
    assert.deepEqual(
      (doneEvent?.details as Record<string, unknown>)?.allowedActionTypes,
      ["answer", "retrieve", "use_tool", "ask_user", "error"],
    );
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode writes invalid planner output diagnostics into structured logs", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"answer","reason":"First."}\n{"type":"error","reason":"Second."}';
    });
  const seen: string[] = [];
  const unsubscribe = subscribeToLogLines((line) => {
    seen.push(line);
  });

  try {
    await nextActionPlannerNode(
      createState({
        runId: "run-log-invalid-json",
        threadId: "thread-log-invalid-json",
      }),
    );
  } finally {
    unsubscribe();
    streamSpy.mockRestore();
  }

  const debugLine = seen
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .find(
      (entry) =>
        entry?.event === "agent-next-action-planner-debug" &&
        entry.runId === "run-log-invalid-json",
    );

  assert.ok(debugLine);
  assert.equal(debugLine?.threadId, "thread-log-invalid-json");
  assert.equal(debugLine?.selectedActionType, "error");
  assert.match(String(debugLine?.rawOutputPreview ?? ""), /"type":"answer"/);
  assert.match(String(debugLine?.sanitizedOutputPreview ?? ""), /"type":"error"/);
  assert.match(String(debugLine?.parseErrorReason ?? ""), /multiple JSON objects/i);
});

test("nextActionPlannerNode writes missing_reason_defaulted warning into structured logs", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"retrieve","query":"README"}';
    });
  const seen: string[] = [];
  const unsubscribe = subscribeToLogLines((line) => {
    seen.push(line);
  });

  try {
    await nextActionPlannerNode(
      createState({
        runId: "run-log-missing-reason",
        threadId: "thread-log-missing-reason",
      }),
    );
  } finally {
    unsubscribe();
    streamSpy.mockRestore();
  }

  const debugLine = seen
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .find(
      (entry) =>
        entry?.event === "agent-next-action-planner-debug" &&
        entry.runId === "run-log-missing-reason",
    );

  assert.ok(debugLine);
  assert.equal(debugLine?.selectedActionType, "retrieve");
  assert.deepEqual(debugLine?.parseWarnings, ["missing_reason_defaulted"]);
  assert.equal(debugLine?.parseErrorReason, undefined);
  assert.equal(
    debugLine?.reason,
    "Planner requested retrieval for query: README.",
  );
});

test("nextActionPlannerNode stops when task model returns an unknown action type", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"do_something","reason":"invalid type"}';
    });

  try {
    const patch = await nextActionPlannerNode(createState());
    assert.deepEqual(patch, {
      nextAction: {
        type: "error",
        reason:
          "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
      },
      errorMessage:
        "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
      blockedReason:
        "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
      errorSourceNodeId: "agent-next-action-planner",
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode falls back when task model selects an unexposed tool", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"terminal_session","args":{"command":"dir"},"reason":"Need terminal."}';
    });

  try {
    const patch = await nextActionPlannerNode(createState());
    assert.deepEqual(patch, {
      nextAction: {
        type: "error",

        reason:
          "Planner selected a tool that was not exposed for this turn; planner must stop.",
      },
      errorMessage:
        "Planner selected a tool that was not exposed for this turn; planner must stop.",
      blockedReason:
        "Planner selected a tool that was not exposed for this turn; planner must stop.",

      errorSourceNodeId: "agent-next-action-planner",
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode falls back when task model returns schema-invalid use_tool args", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":[],"reason":"Need file content."}';
    });

  try {
    const patch = await nextActionPlannerNode(createState());
    assert.deepEqual(patch, {
      nextAction: {
        type: "error",
        reason:
          "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
      },
      errorMessage:
        "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
      blockedReason:
        "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
      errorSourceNodeId: "agent-next-action-planner",
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode falls back without calling task model when iteration budget is exhausted", async () => {
  const streamSpy = vi.spyOn(providerProxyService, "streamTaskChatText");

  try {
    const patch = await nextActionPlannerNode(
      createState({
        iterationCount: 3,
        maxIterations: 3,
      }),
    );
    assert.deepEqual(patch, {
      nextAction: {
        type: "error",
        reason: "Planner reached the iteration limit and must stop.",
      },
      errorMessage: "Planner reached the iteration limit and must stop.",
      blockedReason: "Planner reached the iteration limit and must stop.",
      errorSourceNodeId: "agent-next-action-planner",
    });
    assert.equal(streamSpy.mock.calls.length, 0);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode stops when task model call throws", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      throw new Error("provider unavailable");
    });

  try {
    const patch = await nextActionPlannerNode(createState());
    assert.deepEqual(patch, {
      nextAction: {
        type: "error",
        reason: "Planner task model call failed: provider unavailable",
      },
      errorMessage: "Planner task model call failed: provider unavailable",
      blockedReason: "Planner task model call failed: provider unavailable",
      errorSourceNodeId: "agent-next-action-planner",
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode writes decision trace and includes prompt context for task model", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"web_search","args":{"query":"latest release notes"},"reason":"Need current external information."}';
    });
  const events: Array<Record<string, unknown>> = [];

  try {
    const patch = await nextActionPlannerNode(
      createState({
        evidence: {
          observations: [
            {
              id: "obs-1",
              runId: "run-1",
              stepId: "retrieve",
              status: "ok",
              facts: ["Need current release notes."],
              createdAt: "2026-07-03T00:00:00.000Z",
            },
          ],
          retrievals: [],
          toolExecutions: [],
        },
      }),
      async (event) => {
        events.push({
          nodeId: event.nodeId,
          phase: event.phase,
          details: event.details,
        });
      },
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "use_tool",
        toolId: "web_search",
        args: {
          query: "latest release notes",
        },
        reason: "Need current external information.",
      },
    });

    assert.equal(streamSpy.mock.calls.length, 1);
    const plannerMessages = streamSpy.mock.calls[0]?.[0] ?? [];
    assert.equal(plannerMessages.length, 2);
    assert.match(String(plannerMessages[1]?.content ?? ""), /"toolExposure"/);
    assert.match(String(plannerMessages[1]?.content ?? ""), /"exposedTools"/);
    assert.doesNotMatch(String(plannerMessages[1]?.content ?? ""), /"plan"/);

    const doneEvent = events.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.ok(doneEvent);
    assert.deepEqual((doneEvent?.details as Record<string, unknown>)?.selectedActionType, "use_tool");
    assert.deepEqual((doneEvent?.details as Record<string, unknown>)?.selectedToolId, "web_search");
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode can derive tool exposure from toolIntent when explicit toolExposure is absent", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need file content."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        toolExposure: undefined,
        toolIntent: {
          query: "open README.md",
          topCandidates: [],
          toolCandidates: [],
          toolExposure: {
            exposedToolIds: ["read_open"],
            exposedDefinitions: [
              {
                id: "read_open",
                title: "Read Open",
                description: "Open a workspace file",
                domain: "read",
                source: "internal",
                mode: "sync",
                inputSchema: {},
                tags: ["read"],
                capabilities: {
                  sideEffect: "none",
                  requiresApproval: false,
                },
              },
            ],
            reason: [],
            blockedCapabilityIds: [],
          },
        },
      }),
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "use_tool",
        toolId: "read_open",
        args: {
          path: "README.md",
        },
        reason: "Need file content.",
      },
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode only writes nextAction in its state patch", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"answer","reason":"Enough evidence."}';
    });

  try {
    const patch = await nextActionPlannerNode(createState());
    assert.deepEqual(Object.keys(patch), ["nextAction"]);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode ignores an injected legacy plan field", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"ask_user","question":"Which file should I inspect?","reason":"The target is ambiguous."}';
    });

  try {
    const patch = await nextActionPlannerNode({
      ...createState(),
      plan: {
        steps: [
          {
            id: "legacy-step",
            kind: "retrieve",
            status: "pending",
          },
        ],
      },
    } as AgentNodeState);

    assert.deepEqual(patch, {
      nextAction: {
        type: "ask_user",
        question: "Which file should I inspect?",
        reason: "The target is ambiguous.",
      },
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode is the primary writer for runtime currentTaskFrame updates", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need file content."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        currentTaskFrame: {
          currentGoal: "stale goal",
          currentSubtask: "Old subtask",
          currentBlocker: "Existing blocker",
          confirmedObjects: [
            {
              type: "knowledge",
              id: "kb-1",
              label: "kb-1",
              confidence: 1,
            },
          ],
          completionCriteria: ["Inspect README.md"],
        },
        question: "Open README.md",
      }),
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "use_tool",
        toolId: "read_open",
        args: {
          path: "README.md",
        },
        reason:
          "Need file content.",
      },
      currentTaskFrame: {
        currentGoal: "Open README.md",
        currentSubtask: "Run read_open with reviewed parameters.",
        currentBlocker: "Existing blocker",
        confirmedObjects: [
          {
            type: "knowledge",
            id: "kb-1",
            label: "kb-1",
            confidence: 1,
          },
        ],
        completionCriteria: ["Inspect README.md"],
      },
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode writes planner error fields only for error actions", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"error","reason":"Planner cannot continue safely."}';
    });

  try {
    const patch = await nextActionPlannerNode(createState());
    assert.deepEqual(patch, {
      nextAction: {
        type: "error",
        reason: "Planner cannot continue safely.",
      },
      errorMessage: "Planner cannot continue safely.",
      blockedReason: "Planner cannot continue safely.",
      errorSourceNodeId: "agent-next-action-planner",
    });
  } finally {
    streamSpy.mockRestore();
  }
});

