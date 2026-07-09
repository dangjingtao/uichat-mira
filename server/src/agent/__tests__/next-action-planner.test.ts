import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { subscribeToLogLines } from "@/logger";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import { getTaskCompletionDecision } from "../evidence";
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
  plan: {
    id: "plan-1",
    goalId: "goal-1",
    version: 1,
    steps: [],
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
    plan: createState().plan,
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
    plan: createState().plan,
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

test("nextActionPlannerNode short-circuits to answer when latest evidence summary is answer-ready", async () => {
  const streamSpy = vi.spyOn(providerProxyService, "streamTaskChatText");

  try {
    const patch = await nextActionPlannerNode(
      createState({
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [],
          latestSummary: {
            source: "tool",
            status: "completed",
            toolId: "read_open",
            actionTaken: "Opened file README.md.",
            keyFindings: ["contentLength=120"],
            answerReadiness: {
              canAnswer: true,
              reason: "Opened file content is available for answer generation.",
            },
            data: {
              kind: "read_open",
              path: "README.md",
              contentPreview: "# README",
              contentLength: 120,
              truncated: false,
              canAnswerFileQuestion: true,
            },
            rawRef: {
              evidenceIndex: 0,
              toolCallId: "tool-call-1",
            },
          },
        },
      }),
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "answer",
        reason: "Opened file content is available for answer generation.",
      },
    });
    assert.equal(streamSpy.mock.calls.length, 0);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode does not short-circuit to answer when codebase_explore verified chunks are only planner-review evidence", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"retrieve","query":"planner tool node relationship","reason":"Need more grounded coverage before answering."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "梳理 planner 和 tool node 的关系",
        messages: [
          {
            role: "user",
            content: "梳理 planner 和 tool node 的关系",
            parts: [{ type: "text", text: "梳理 planner 和 tool node 的关系" }],
          },
        ],
        evidence: {
          observations: [],
          retrievals: [
            {
              query: "梳理 planner 和 tool node 的关系",
              chunkCount: 1,
              chunks: [
                {
                  chunkId: "codegraph:server/src/agent/nodes/tool-node.ts:1-10:0",
                  documentName: "server/src/agent/nodes/tool-node.ts",
                  score: 0.91,
                  content: "export const toolNode = async (...) => { ... }",
                },
              ],
              createdAt: "2026-07-09T00:00:00.000Z",
            },
          ],
          toolExecutions: [],
          latestSummary: {
            source: "retrieval",
            status: "completed",
            actionTaken: "Codebase explore verified 1 workspace chunk.",
            keyFindings: ["verifiedChunkCount=1"],
            answerReadiness: {
              canAnswer: false,
              reason: "verified chunks are available for planner review",
              missingInfo: ["planner must decide task completion based on task coverage"],
            },
            data: {
              kind: "retrieval",
              query: "梳理 planner 和 tool node 的关系",
              chunkCount: 1,
              documentsPreview: ["server/src/agent/nodes/tool-node.ts"],
            },
            rawRef: {
              evidenceIndex: 0,
            },
          },
        },
      }),
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "retrieve",
        query: "planner tool node relationship",
        reason: "Need more grounded coverage before answering.",
      },
    });
    assert.equal(streamSpy.mock.calls.length, 1);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode does not short-circuit to answer when mutation task still lacks execution coverage", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"workspace_mutation","args":{"operation":"delete","targetPath":"notes.txt"},"reason":"Need to execute the deletion."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "删除 notes.txt",
        messages: [
          {
            role: "user",
            content: "删除 notes.txt",
            parts: [{ type: "text", text: "删除 notes.txt" }],
          },
        ],
        currentTaskFrame: {
          currentGoal: "删除 notes.txt",
          currentSubtask: "Determine the next action.",
          currentBlocker: undefined,
          confirmedObjects: [],
          completionCriteria: ["删除 notes.txt"],
        },
        toolExposure: {
          exposedTools: ["workspace_mutation"],
          toolMeta: [
            {
              toolId: "workspace_mutation",
              title: "Workspace Mutation",
              description: "Mutate a workspace target",
              inputSchema: {
                type: "object",
                properties: {
                  operation: { type: "string" },
                  targetPath: { type: "string" },
                },
              },
              domain: "edit",
              source: "internal",
              tags: ["edit"],
              capabilities: {
                sideEffect: "local-write",
                requiresApproval: true,
              },
            },
          ],
        },
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [],
          latestSummary: {
            source: "tool",
            status: "completed",
            toolId: "read_locate",
            actionTaken: "Located notes.txt in the workspace.",
            keyFindings: ["matchCount=1", "targetPath=notes.txt"],
            answerReadiness: {
              canAnswer: true,
              reason: "Located target path can support a follow-up answer.",
            },
            data: {
              kind: "read_locate",
              scope: ".",
              query: "notes.txt",
              searchMode: "path",
              matchCount: 1,
              matchedPaths: ["notes.txt"],
              matchesPreview: ["notes.txt"],
              truncated: false,
              canAnswerLocateQuestion: true,
            },
            rawRef: {
              evidenceIndex: 0,
              toolCallId: "tool-call-locate-1",
            },
          },
        },
      }),
    );

    assert.deepEqual(patch.nextAction, {
      type: "use_tool",
      toolId: "workspace_mutation",
      args: {
        operation: "delete",
        targetPath: "notes.txt",
      },
      reason:
        "Coverage transition: execute the required delete mutation on notes.txt before answering.",
    });
    assert.equal(streamSpy.mock.calls.length, 0);
  } finally {
    streamSpy.mockRestore();
  }
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

test("nextActionPlannerNode does not short-circuit to answer when a multi-target locate question still misses one target", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"I found one of the requested files."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_locate","args":{"query":"AGENTS.md"},"reason":"Need to locate the remaining target."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "README.md 和 AGENTS.md 在哪里？",
        messages: [
          {
            role: "user",
            content: "README.md 和 AGENTS.md 在哪里？",
            parts: [{ type: "text", text: "README.md 和 AGENTS.md 在哪里？" }],
          },
        ],
        currentTaskFrame: {
          currentGoal: "README.md 和 AGENTS.md 在哪里？",
          currentSubtask: "Locate the requested files.",
          currentBlocker: undefined,
          confirmedObjects: [],
          completionCriteria: ["README.md 和 AGENTS.md 在哪里？"],
        },
        toolExposure: {
          exposedTools: ["read_locate"],
          toolMeta: [
            {
              toolId: "read_locate",
              title: "Read Locate",
              description: "Locate workspace matches",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string" },
                },
              },
              domain: "read",
              source: "internal",
              tags: ["read"],
              capabilities: {
                sideEffect: "none",
                requiresApproval: false,
              },
            },
          ],
        },
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [],
          latestSummary: {
            source: "tool",
            status: "completed",
            toolId: "read_locate",
            actionTaken: "Located README.md in the workspace.",
            keyFindings: ["matchCount=1", "targetPath=README.md"],
            answerReadiness: {
              canAnswer: true,
              reason: "Located target path can support a follow-up answer.",
            },
            data: {
              kind: "read_locate",
              scope: ".",
              query: "README.md AGENTS.md",
              searchMode: "path",
              matchCount: 1,
              matchedPaths: ["README.md"],
              matchesPreview: ["README.md"],
              truncated: false,
              canAnswerLocateQuestion: true,
            },
            rawRef: {
              evidenceIndex: 0,
              toolCallId: "tool-call-locate-readme-only",
            },
          },
        },
      }),
    );

    assert.deepEqual(patch.nextAction, {
      type: "use_tool",
      toolId: "read_locate",
      args: {
        query: "AGENTS.md",
      },
      reason:
        "Coverage transition: locate the remaining target before continuing.",
    });
    assert.equal(streamSpy.mock.calls.length, 0);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode still short-circuits to answer for a single-target locate question once the target is covered", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"answer","reason":"Planner should not be called."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "README.md 在哪里？",
        messages: [
          {
            role: "user",
            content: "README.md 在哪里？",
            parts: [{ type: "text", text: "README.md 在哪里？" }],
          },
        ],
        currentTaskFrame: {
          currentGoal: "README.md 在哪里？",
          currentSubtask: "Locate the requested file.",
          currentBlocker: undefined,
          confirmedObjects: [],
          completionCriteria: ["README.md 在哪里？"],
        },
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [],
          latestSummary: {
            source: "tool",
            status: "completed",
            toolId: "read_locate",
            actionTaken: "Located README.md in the workspace.",
            keyFindings: ["matchCount=1", "targetPath=README.md"],
            answerReadiness: {
              canAnswer: true,
              reason: "Located target path can support a direct answer.",
            },
            data: {
              kind: "read_locate",
              scope: ".",
              query: "README.md",
              searchMode: "path",
              matchCount: 1,
              matchedPaths: ["README.md"],
              matchesPreview: ["README.md"],
              truncated: false,
              canAnswerLocateQuestion: true,
            },
            rawRef: {
              evidenceIndex: 0,
              toolCallId: "tool-call-locate-readme",
            },
          },
        },
      }),
    );

    assert.deepEqual(patch.nextAction, {
      type: "answer",
      reason: "Located target path can support a direct answer.",
    });
    assert.equal(streamSpy.mock.calls.length, 0);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode rejects planner answer when mutation task has only locate evidence", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"I found the file to delete."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"workspace_mutation","args":{"operation":"delete","targetPath":"notes.txt"},"reason":"Need to execute the deletion."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "删除 notes.txt",
        messages: [
          {
            role: "user",
            content: "删除 notes.txt",
            parts: [{ type: "text", text: "删除 notes.txt" }],
          },
        ],
        currentTaskFrame: {
          currentGoal: "删除 notes.txt",
          currentSubtask: "Delete the target file.",
          currentBlocker: undefined,
          confirmedObjects: [],
          completionCriteria: ["删除 notes.txt"],
        },
        toolExposure: {
          exposedTools: ["workspace_mutation"],
          toolMeta: [
            {
              toolId: "workspace_mutation",
              title: "Workspace Mutation",
              description: "Mutate a workspace target",
              inputSchema: {
                type: "object",
                properties: {
                  operation: { type: "string" },
                  targetPath: { type: "string" },
                },
              },
              domain: "edit",
              source: "internal",
              tags: ["edit"],
              capabilities: {
                sideEffect: "local-write",
                requiresApproval: true,
              },
            },
          ],
        },
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [],
          latestSummary: {
            source: "tool",
            status: "completed",
            toolId: "read_locate",
            actionTaken: "Located notes.txt in the workspace.",
            keyFindings: ["matchCount=1", "targetPath=notes.txt"],
            answerReadiness: {
              canAnswer: true,
              reason: "Located target path can support a follow-up answer.",
            },
            data: {
              kind: "read_locate",
              scope: ".",
              query: "notes.txt",
              searchMode: "path",
              matchCount: 1,
              matchedPaths: ["notes.txt"],
              matchesPreview: ["notes.txt"],
              truncated: false,
              canAnswerLocateQuestion: true,
            },
            rawRef: {
              evidenceIndex: 0,
              toolCallId: "tool-call-locate-1",
            },
          },
        },
      }),
    );

    assert.deepEqual(patch.nextAction, {
      type: "use_tool",
      toolId: "workspace_mutation",
      args: {
        operation: "delete",
        targetPath: "notes.txt",
      },
      reason:
        "Coverage transition: execute the required delete mutation on notes.txt before answering.",
    });
    assert.equal(streamSpy.mock.calls.length, 0);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode still rejects planner answer when all mutation targets are only located but not executed", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"I located both files already."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"workspace_mutation","args":{"operation":"delete","targetPath":"README.md"},"reason":"Need to enter the deletion execution path before answering."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "删除 README.md 和 AGENTS.md",
        messages: [
          {
            role: "user",
            content: "删除 README.md 和 AGENTS.md",
            parts: [{ type: "text", text: "删除 README.md 和 AGENTS.md" }],
          },
        ],
        currentTaskFrame: {
          currentGoal: "删除 README.md 和 AGENTS.md",
          currentSubtask: "Delete both files.",
          currentBlocker: undefined,
          confirmedObjects: [],
          completionCriteria: ["删除 README.md 和 AGENTS.md"],
        },
        toolExposure: {
          exposedTools: ["workspace_mutation"],
          toolMeta: [
            {
              toolId: "workspace_mutation",
              title: "Workspace Mutation",
              description: "Mutate a workspace target",
              inputSchema: {
                type: "object",
                properties: {
                  operation: { type: "string" },
                  targetPath: { type: "string" },
                },
              },
              domain: "edit",
              source: "internal",
              tags: ["edit"],
              capabilities: {
                sideEffect: "local-write",
                requiresApproval: true,
              },
            },
          ],
        },
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [],
          latestSummary: {
            source: "tool",
            status: "completed",
            toolId: "read_locate",
            actionTaken: "Located README.md and AGENTS.md in the workspace.",
            keyFindings: ["matchCount=2", "targets=README.md,AGENTS.md"],
            answerReadiness: {
              canAnswer: true,
              reason: "Located target paths can support a follow-up answer.",
            },
            data: {
              kind: "read_locate",
              scope: ".",
              query: "README.md AGENTS.md",
              searchMode: "path",
              matchCount: 2,
              matchedPaths: ["README.md", "AGENTS.md"],
              matchesPreview: ["README.md", "AGENTS.md"],
              truncated: false,
              canAnswerLocateQuestion: true,
            },
            rawRef: {
              evidenceIndex: 0,
              toolCallId: "tool-call-locate-both",
            },
          },
        },
      }),
    );

    assert.deepEqual(patch.nextAction, {
      type: "use_tool",
      toolId: "workspace_mutation",
      args: {
        operation: "delete",
        targetPath: "README.md",
      },
      reason:
        "Coverage transition: execute the required delete mutation on README.md before answering.",
    });
    assert.equal(streamSpy.mock.calls.length, 0);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode rejects planner answer for Chinese 删掉 mutation when evidence only located one target", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"answer","reason":"I found one target already."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"workspace_mutation","args":{"operation":"delete","targetPath":"如何被美丽女孩爱上"},"reason":"Need to enter the deletion execution path before answering."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "删掉如何被美丽女孩爱上和如何爱上美丽女孩",
        messages: [
          {
            role: "user",
            content: "删掉如何被美丽女孩爱上和如何爱上美丽女孩",
            parts: [{ type: "text", text: "删掉如何被美丽女孩爱上和如何爱上美丽女孩" }],
          },
        ],
        currentTaskFrame: {
          currentGoal: "删掉如何被美丽女孩爱上和如何爱上美丽女孩",
          currentSubtask: "Delete both files.",
          currentBlocker: undefined,
          confirmedObjects: [],
          completionCriteria: ["删掉如何被美丽女孩爱上和如何爱上美丽女孩"],
        },
        toolExposure: {
          exposedTools: ["workspace_mutation"],
          toolMeta: [
            {
              toolId: "workspace_mutation",
              title: "Workspace Mutation",
              description: "Mutate a workspace target",
              inputSchema: {
                type: "object",
                properties: {
                  operation: { type: "string" },
                  targetPath: { type: "string" },
                },
              },
              domain: "edit",
              source: "internal",
              tags: ["edit"],
              capabilities: {
                sideEffect: "local-write",
                requiresApproval: true,
              },
            },
          ],
        },
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [],
          latestSummary: {
            source: "tool",
            status: "completed",
            toolId: "read_locate",
            actionTaken: "Located 如何被美丽女孩爱上 in the workspace.",
            keyFindings: ["matchCount=1", "targetPath=如何被美丽女孩爱上"],
            answerReadiness: {
              canAnswer: true,
              reason: "Located target path can support a follow-up answer.",
            },
            data: {
              kind: "read_locate",
              scope: ".",
              query: "如何被美丽女孩爱上",
              searchMode: "path",
              matchCount: 1,
              matchedPaths: ["如何被美丽女孩爱上"],
              matchesPreview: ["如何被美丽女孩爱上"],
              truncated: false,
              canAnswerLocateQuestion: true,
            },
            rawRef: {
              evidenceIndex: 0,
              toolCallId: "tool-call-locate-chinese-delete",
            },
          },
        },
      }),
    );

    assert.deepEqual(patch.nextAction, {
      type: "use_tool",
      toolId: "workspace_mutation",
      args: {
        operation: "delete",
        targetPath: "如何被美丽女孩爱上",
      },
      reason:
        "Coverage transition: execute the required delete mutation on 如何被美丽女孩爱上 before answering.",
    });
    assert.equal(streamSpy.mock.calls.length, 0);
  } finally {
    streamSpy.mockRestore();
  }
});

test("getTaskCompletionDecision keeps locate-only evidence incomplete when the request still needs file content", () => {
  const decision = getTaskCompletionDecision({
    question: "README.md 和 AGENTS.md 的内容分别是什么？",
    currentTaskFrame: {
      currentGoal: "README.md 和 AGENTS.md 的内容分别是什么？",
      currentSubtask: "Open both files and inspect the content.",
      currentBlocker: undefined,
      confirmedObjects: [],
      completionCriteria: ["README.md 和 AGENTS.md 的内容分别是什么？"],
    },
    latestSummary: {
      source: "tool",
      status: "completed",
      toolId: "read_locate",
      actionTaken: 'Located 2 workspace match(es) for "README.md AGENTS.md".',
      keyFindings: ["matchCount=2", "targets=README.md,AGENTS.md"],
      answerReadiness: {
        canAnswer: true,
        reason: "Located both file paths.",
      },
      data: {
        kind: "read_locate",
        scope: ".",
        query: "README.md AGENTS.md",
        searchMode: "path",
        matchCount: 2,
        matchedPaths: ["README.md", "AGENTS.md"],
        matchesPreview: ["README.md", "AGENTS.md"],
        truncated: false,
        canAnswerLocateQuestion: true,
      },
      rawRef: {
        evidenceIndex: 0,
        toolCallId: "tool-call-locate-both-content",
      },
    },
  });

  assert.deepEqual(decision.requiredTargets, ["readme.md", "agents.md"]);
  assert.deepEqual(decision.coveredTargets, ["readme.md", "agents.md"]);
  assert.deepEqual(decision.missingTargets, []);
  assert.deepEqual(decision.pendingActions, ["read_open"]);
  assert.equal(decision.taskCompleted, false);
});

test("getTaskCompletionDecision extracts Chinese bare mutation targets into requiredTargets", () => {
  const decision = getTaskCompletionDecision({
    question: "删除如何被美丽女孩爱上和如何爱上美丽女孩",
    currentTaskFrame: {
      currentGoal: "删除如何被美丽女孩爱上和如何爱上美丽女孩",
      currentSubtask: "Delete both targets.",
      currentBlocker: undefined,
      confirmedObjects: [],
      completionCriteria: ["删除如何被美丽女孩爱上和如何爱上美丽女孩"],
    },
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolId: "workspace_mutation",
          args: {
            operation: "delete",
            targetPath: "如何被美丽女孩爱上",
          },
          status: "completed",
          summary: {
            source: "tool",
            status: "completed",
            toolId: "workspace_mutation",
            actionTaken: "Deleted the first target.",
            keyFindings: ["targetPath=如何被美丽女孩爱上"],
            answerReadiness: {
              canAnswer: true,
              reason: "This workspace mutation completed and can ground a mutation answer.",
            },
            data: {
              kind: "workspace_mutation",
              operation: "delete",
              targetPath: "如何被美丽女孩爱上",
              changed: true,
              deleted: true,
              dryRun: false,
              canAnswerMutationQuestion: true,
            },
          },
          startedAt: "2026-07-08T00:00:00.000Z",
          finishedAt: "2026-07-08T00:00:01.000Z",
        },
      ],
    },
  });

  assert.deepEqual(decision.requiredTargets, [
    "如何被美丽女孩爱上",
    "如何爱上美丽女孩",
  ]);
  assert.deepEqual(decision.coveredTargets, ["如何被美丽女孩爱上"]);
  assert.deepEqual(decision.missingTargets, ["如何爱上美丽女孩"]);
  assert.deepEqual(decision.pendingActions, ["mutation_execution"]);
  assert.equal(decision.taskCompleted, false);
});

test("getTaskCompletionDecision treats terminal mutation failure as a completed terminal outcome", () => {
  const decision = getTaskCompletionDecision({
    question: "删除 notes.txt",
    currentTaskFrame: {
      currentGoal: "删除 notes.txt",
      currentSubtask: "Delete the target file.",
      currentBlocker: "notes.txt does not exist",
      confirmedObjects: [],
      completionCriteria: ["删除 notes.txt"],
    },
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolId: "workspace_mutation",
          args: {
            operation: "delete",
            targetPath: "notes.txt",
          },
          status: "failed",
          failureKind: "terminal",
          errorMessage: "notes.txt does not exist",
          startedAt: "2026-07-08T00:00:00.000Z",
          finishedAt: "2026-07-08T00:00:01.000Z",
        },
      ],
    },
  });

  assert.deepEqual(decision.requiredTargets, ["notes.txt"]);
  assert.deepEqual(decision.coveredTargets, []);
  assert.deepEqual(decision.missingTargets, []);
  assert.deepEqual(decision.pendingActions, []);
  assert.equal(decision.taskCompleted, true);
});

test("getTaskCompletionDecision does not treat terminal failed read tools as mutation completion", () => {
  const decision = getTaskCompletionDecision({
    question: "删除 notes.txt",
    currentTaskFrame: {
      currentGoal: "删除 notes.txt",
      currentSubtask: "Delete the target file.",
      currentBlocker: "read_open failed before any mutation happened",
      confirmedObjects: [],
      completionCriteria: ["删除 notes.txt"],
    },
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolId: "read_open",
          args: {
            path: "notes.txt",
          },
          status: "failed",
          failureKind: "terminal",
          errorMessage: "read_open protocol mismatch",
          startedAt: "2026-07-08T00:00:00.000Z",
          finishedAt: "2026-07-08T00:00:01.000Z",
        },
      ],
    },
  });

  assert.deepEqual(decision.requiredTargets, ["notes.txt"]);
  assert.deepEqual(decision.coveredTargets, []);
  assert.deepEqual(decision.missingTargets, ["notes.txt"]);
  assert.deepEqual(decision.pendingActions, ["mutation_execution"]);
  assert.equal(decision.taskCompleted, false);
});

test("getTaskCompletionDecision treats terminal failed edit_file as a completed mutation outcome", () => {
  const decision = getTaskCompletionDecision({
    question: "写入 notes.txt",
    currentTaskFrame: {
      currentGoal: "写入 notes.txt",
      currentSubtask: "Write the target file.",
      currentBlocker: "edit_file failed terminally",
      confirmedObjects: [],
      completionCriteria: ["写入 notes.txt"],
    },
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolId: "edit_file",
          args: {
            targetPath: "notes.txt",
            content: "hello",
          },
          status: "failed",
          failureKind: "terminal",
          errorMessage: "edit_file policy rejected final write",
          startedAt: "2026-07-08T00:00:00.000Z",
          finishedAt: "2026-07-08T00:00:01.000Z",
        },
      ],
    },
  });

  assert.deepEqual(decision.requiredTargets, ["notes.txt"]);
  assert.deepEqual(decision.coveredTargets, []);
  assert.deepEqual(decision.missingTargets, []);
  assert.deepEqual(decision.pendingActions, []);
  assert.equal(decision.taskCompleted, true);
});

test("getTaskCompletionDecision does not treat failed read target args as covered evidence", () => {
  const decision = getTaskCompletionDecision({
    question: "README.md 和 AGENTS.md 在哪里",
    currentTaskFrame: {
      currentGoal: "Find README.md and AGENTS.md",
      currentSubtask: "Locate both files.",
      currentBlocker: undefined,
      confirmedObjects: [],
      completionCriteria: ["Locate README.md and AGENTS.md"],
    },
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolId: "read_open",
          args: {
            path: "README.md",
          },
          status: "failed",
          failureKind: "recoverable",
          errorMessage: "README.md not opened yet",
          startedAt: "2026-07-08T00:00:00.000Z",
          finishedAt: "2026-07-08T00:00:01.000Z",
        },
      ],
    },
  });

  assert.deepEqual(decision.requiredTargets, ["readme.md", "agents.md"]);
  assert.deepEqual(decision.coveredTargets, []);
  assert.deepEqual(decision.missingTargets, ["readme.md", "agents.md"]);
  assert.deepEqual(decision.pendingActions, ["recoverable_execution"]);
  assert.equal(decision.taskCompleted, false);
});

test("getTaskCompletionDecision uses read_locate matchedPaths instead of display-formatted matchesPreview", () => {
  const decision = getTaskCompletionDecision({
    question: "README.md 和 AGENTS.md 在哪里？",
    currentTaskFrame: {
      currentGoal: "README.md 和 AGENTS.md 在哪里？",
      currentSubtask: "Locate the requested files.",
      currentBlocker: undefined,
      confirmedObjects: [],
      completionCriteria: ["README.md 和 AGENTS.md 在哪里？"],
    },
    latestSummary: {
      source: "tool",
      status: "completed",
      toolId: "read_locate",
      actionTaken: 'Located 2 workspace match(es) for "README.md AGENTS.md".',
      keyFindings: [
        "matchCount=2",
        "[path] README.md",
        "[content] AGENTS.md: project instructions",
      ],
      answerReadiness: {
        canAnswer: true,
        reason: "Workspace locate results are available for answer generation.",
      },
      data: {
        kind: "read_locate",
        scope: ".",
        query: "README.md AGENTS.md",
        searchMode: "auto",
        matchCount: 2,
        matchedPaths: ["README.md", "AGENTS.md"],
        matchesPreview: [
          "[path] README.md",
          "[content] AGENTS.md: project instructions",
        ],
        truncated: false,
        canAnswerLocateQuestion: true,
      },
      rawRef: {
        evidenceIndex: 0,
        toolCallId: "tool-call-locate-real-format",
      },
    },
  });

  assert.deepEqual(decision.requiredTargets, ["readme.md", "agents.md"]);
  assert.deepEqual(decision.coveredTargets, ["readme.md", "agents.md"]);
  assert.deepEqual(decision.missingTargets, []);
  assert.equal(decision.taskCompleted, true);
});

test("getTaskCompletionDecision keeps read_locate matchedPaths beyond preview truncation", () => {
  const decision = getTaskCompletionDecision({
    question: "README.md、AGENTS.md、docs/README.md、docs/guide.md、notes.txt、extra.md 在哪里？",
    currentTaskFrame: {
      currentGoal:
        "README.md、AGENTS.md、docs/README.md、docs/guide.md、notes.txt、extra.md 在哪里？",
      currentSubtask: "Locate all requested files.",
      currentBlocker: undefined,
      confirmedObjects: [],
      completionCriteria: [
        "README.md、AGENTS.md、docs/README.md、docs/guide.md、notes.txt、extra.md 在哪里？",
      ],
    },
    latestSummary: {
      source: "tool",
      status: "truncated",
      toolId: "read_locate",
      actionTaken:
        'Located 6 workspace match(es) for "README.md AGENTS.md docs/README.md docs/guide.md notes.txt extra.md".',
      keyFindings: [
        "matchCount=6",
        "[path] README.md",
        "[path] AGENTS.md",
        "[path] docs/README.md",
        "[path] docs/guide.md",
        "[path] notes.txt",
      ],
      answerReadiness: {
        canAnswer: true,
        reason: "Workspace locate results are available for answer generation.",
      },
      data: {
        kind: "read_locate",
        scope: ".",
        query: "README.md AGENTS.md docs/README.md docs/guide.md notes.txt extra.md",
        searchMode: "auto",
        matchCount: 6,
        matchedPaths: [
          "README.md",
          "AGENTS.md",
          "docs/README.md",
          "docs/guide.md",
          "notes.txt",
          "extra.md",
        ],
        matchesPreview: [
          "[path] README.md",
          "[path] AGENTS.md",
          "[path] docs/README.md",
          "[path] docs/guide.md",
          "[path] notes.txt",
        ],
        truncated: true,
        canAnswerLocateQuestion: true,
      },
      rawRef: {
        evidenceIndex: 0,
        toolCallId: "tool-call-locate-truncated-preview",
      },
    },
  });

  assert.deepEqual(decision.requiredTargets, [
    "readme.md",
    "agents.md",
    "docs/readme.md",
    "docs/guide.md",
    "notes.txt",
    "extra.md",
  ]);
  assert.deepEqual(decision.coveredTargets, [
    "readme.md",
    "agents.md",
    "docs/readme.md",
    "docs/guide.md",
    "notes.txt",
    "extra.md",
  ]);
  assert.deepEqual(decision.missingTargets, []);
  assert.equal(decision.taskCompleted, true);
});

test("getTaskCompletionDecision keeps write mutation incomplete when the request also requires verification", () => {
  const decision = getTaskCompletionDecision({
    question: "写入 notes.txt 后验证内容是否正确",
    currentTaskFrame: {
      currentGoal: "写入 notes.txt 后验证内容是否正确",
      currentSubtask: "Write then verify the target file.",
      currentBlocker: undefined,
      confirmedObjects: [],
      completionCriteria: ["写入 notes.txt 后验证内容是否正确"],
    },
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolId: "workspace_mutation",
          args: {
            operation: "write",
            targetPath: "notes.txt",
          },
          status: "completed",
          summary: {
            source: "tool",
            status: "completed",
            toolId: "workspace_mutation",
            actionTaken: "Wrote notes.txt.",
            keyFindings: ["targetPath=notes.txt"],
            answerReadiness: {
              canAnswer: true,
              reason: "This workspace mutation completed and can ground a mutation answer.",
            },
            data: {
              kind: "workspace_mutation",
              operation: "write",
              targetPath: "notes.txt",
              changed: true,
              created: true,
              dryRun: false,
              canAnswerMutationQuestion: true,
            },
          },
          startedAt: "2026-07-08T00:00:00.000Z",
          finishedAt: "2026-07-08T00:00:01.000Z",
        },
      ],
    },
  });

  assert.deepEqual(decision.requiredTargets, ["notes.txt"]);
  assert.deepEqual(decision.coveredTargets, ["notes.txt"]);
  assert.deepEqual(decision.missingTargets, []);
  assert.deepEqual(decision.pendingActions, ["mutation_verification"]);
  assert.equal(decision.taskCompleted, false);
});

test("getTaskCompletionDecision allows answer after write mutation verification covers the target", () => {
  const decision = getTaskCompletionDecision({
    question: "写入 notes.txt 后验证内容是否正确",
    currentTaskFrame: {
      currentGoal: "写入 notes.txt 后验证内容是否正确",
      currentSubtask: "Write then verify the target file.",
      currentBlocker: undefined,
      confirmedObjects: [],
      completionCriteria: ["写入 notes.txt 后验证内容是否正确"],
    },
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolId: "workspace_mutation",
          args: {
            operation: "write",
            targetPath: "notes.txt",
          },
          status: "completed",
          summary: {
            source: "tool",
            status: "completed",
            toolId: "workspace_mutation",
            actionTaken: "Wrote notes.txt.",
            keyFindings: ["targetPath=notes.txt"],
            answerReadiness: {
              canAnswer: true,
              reason: "This workspace mutation completed and can ground a mutation answer.",
            },
            data: {
              kind: "workspace_mutation",
              operation: "write",
              targetPath: "notes.txt",
              changed: true,
              created: true,
              dryRun: false,
              canAnswerMutationQuestion: true,
            },
          },
          startedAt: "2026-07-08T00:00:00.000Z",
          finishedAt: "2026-07-08T00:00:01.000Z",
        },
        {
          toolId: "read_open",
          args: {
            path: "notes.txt",
          },
          status: "completed",
          summary: {
            source: "tool",
            status: "completed",
            toolId: "read_open",
            actionTaken: "Opened notes.txt.",
            keyFindings: ["path=notes.txt"],
            answerReadiness: {
              canAnswer: true,
              reason: "Opened file content is available for answer generation.",
            },
            data: {
              kind: "read_open",
              path: "notes.txt",
              contentPreview: "hello",
              contentLength: 5,
              keySections: [],
              canAnswerFileQuestion: true,
            },
          },
          startedAt: "2026-07-08T00:00:02.000Z",
          finishedAt: "2026-07-08T00:00:03.000Z",
        },
      ],
    },
  });

  assert.deepEqual(decision.requiredTargets, ["notes.txt"]);
  assert.deepEqual(decision.coveredTargets, ["notes.txt"]);
  assert.deepEqual(decision.missingTargets, []);
  assert.deepEqual(decision.pendingActions, []);
  assert.equal(decision.taskCompleted, true);
});

test("getTaskCompletionDecision keeps recoverable tool failure from becoming answer-ready completion", () => {
  const decision = getTaskCompletionDecision({
    question: "打开 README.md 看看内容",
    currentTaskFrame: {
      currentGoal: "打开 README.md 看看内容",
      currentSubtask: "Read the requested file.",
      currentBlocker: "read_open timed out once",
      confirmedObjects: [],
      completionCriteria: ["打开 README.md 看看内容"],
    },
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolId: "read_open",
          args: {
            path: "README.md",
          },
          status: "failed",
          failureKind: "recoverable",
          errorMessage: "temporary timeout",
          startedAt: "2026-07-08T00:00:00.000Z",
          finishedAt: "2026-07-08T00:00:01.000Z",
        },
      ],
    },
  });

  assert.deepEqual(decision.requiredTargets, ["readme.md"]);
  assert.deepEqual(decision.coveredTargets, []);
  assert.deepEqual(decision.missingTargets, ["readme.md"]);
  assert.deepEqual(decision.pendingActions, ["recoverable_execution"]);
  assert.equal(decision.taskCompleted, false);
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

test("nextActionPlannerNode guards workspace-local retrieve intent away from web_search", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"web_search","args":{"query":"UIChat Mira 说明"},"reason":"Need current information."}';
    });
  const events: Array<Record<string, unknown>> = [];

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question:
          "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
        messages: [
          {
            role: "user",
            content:
              "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
            parts: [
              {
                type: "text",
                text: "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
              },
            ],
          },
        ],
        workspaceRoot: "D:\\workspace\\rag-demo",
        toolExposure: {
          exposedTools: ["read_open", "read_locate", "web_search"],
          toolMeta: [
            ...baseToolExposure.toolMeta,
            {
              toolId: "read_locate",
              title: "Read Locate",
              description: "Locate files or matching content inside the authorized workspace.",
              inputSchema: { type: "object", properties: { query: { type: "string" } } },
              domain: "read",
              source: "internal",
              tags: ["read"],
              capabilities: {
                sideEffect: "none",
                requiresApproval: false,
              },
            },
          ],
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
        toolId: "read_locate",
        args: {
          query: "UIChat Mira",
        },
        reason: "Workspace-local intent guard blocked web_search and redirected to a local evidence path.",
      },
    });

    const doneEvent = events.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.localIntentGuardTriggered,
      true,
    );
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode turns workspace-local retrieve into read_locate when no knowledge base is bound", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"retrieve","query":"请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。","reason":"Need workspace evidence first."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question:
          "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
        messages: [
          {
            role: "user",
            content:
              "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
            parts: [
              {
                type: "text",
                text: "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
              },
            ],
          },
        ],
        workspaceRoot: "D:\\workspace\\rag-demo",
        knowledgeBaseId: null,
        toolExposure: {
          exposedTools: ["read_open", "read_locate", "web_search"],
          toolMeta: [
            ...baseToolExposure.toolMeta,
            {
              toolId: "read_locate",
              title: "Read Locate",
              description: "Locate files or matching content inside the authorized workspace.",
              inputSchema: { type: "object", properties: { query: { type: "string" } } },
              domain: "read",
              source: "internal",
              tags: ["read"],
              capabilities: {
                sideEffect: "none",
                requiresApproval: false,
              },
            },
          ],
        },
      }),
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "use_tool",
        toolId: "read_locate",
        args: {
          query: "UIChat Mira",
        },
        reason: "Workspace-local intent guard blocked web_search and redirected to a local evidence path.",
      },
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode reuses the planner search query when redirecting workspace-local web_search to read_locate", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"web_search","args":{"query":"UIChat Mira","maxResults":5},"reason":"Need information."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question:
          "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
        messages: [
          {
            role: "user",
            content:
              "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
            parts: [
              {
                type: "text",
                text: "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
              },
            ],
          },
        ],
        workspaceRoot: "D:\\workspace\\rag-demo",
        knowledgeBaseId: null,
        toolExposure: {
          exposedTools: ["read_open", "read_locate", "web_search"],
          toolMeta: [
            ...baseToolExposure.toolMeta,
            {
              toolId: "read_locate",
              title: "Read Locate",
              description: "Locate files or matching content inside the authorized workspace.",
              inputSchema: { type: "object", properties: { query: { type: "string" } } },
              domain: "read",
              source: "internal",
              tags: ["read"],
              capabilities: {
                sideEffect: "none",
                requiresApproval: false,
              },
            },
          ],
        },
      }),
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "use_tool",
        toolId: "read_locate",
        args: {
          query: "UIChat Mira",
        },
        reason: "Workspace-local intent guard blocked web_search and redirected to a local evidence path.",
      },
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode guards workspace file-content intent away from web_search to read_open", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"web_search","args":{"query":"README Runtime"},"reason":"Need search results."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "README.md 的 Runtime 一节具体列了哪些运行组件？请基于文件内容回答。",
        messages: [
          {
            role: "user",
            content: "README.md 的 Runtime 一节具体列了哪些运行组件？请基于文件内容回答。",
            parts: [
              {
                type: "text",
                text: "README.md 的 Runtime 一节具体列了哪些运行组件？请基于文件内容回答。",
              },
            ],
          },
        ],
        workspaceRoot: "D:\\workspace\\rag-demo",
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
          "Coverage transition: open README.md to satisfy the file-content request.",
      },
    });
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode keeps a legal local read_open action unchanged for workspace-local questions", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need the file content."}';
    });
  const events: Array<Record<string, unknown>> = [];

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "帮我打开 README.md",
        messages: [
          {
            role: "user",
            content: "帮我打开 README.md",
            parts: [{ type: "text", text: "帮我打开 README.md" }],
          },
        ],
        workspaceRoot: "D:\\workspace\\rag-demo",
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
        toolId: "read_open",
        args: {
          path: "README.md",
        },
        reason:
          "Coverage transition: open README.md to satisfy the file-content request.",
      },
    });

    const doneEvent = events.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.localIntentGuardTriggered,
      false,
    );
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode keeps a legal local read_list action unchanged for workspace-local questions", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_list","args":{"path":"."},"reason":"Need the workspace listing."}';
    });
  const events: Array<Record<string, unknown>> = [];

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "看看当前 workspace 有哪些文件",
        messages: [
          {
            role: "user",
            content: "看看当前 workspace 有哪些文件",
            parts: [{ type: "text", text: "看看当前 workspace 有哪些文件" }],
          },
        ],
        workspaceRoot: "D:\\workspace\\rag-demo",
        toolExposure: {
          exposedTools: ["read_open", "read_list", "web_search"],
          toolMeta: [...baseToolExposure.toolMeta, readListToolMeta],
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
        toolId: "read_list",
        args: {
          path: ".",
        },
        reason:
          "Coverage transition: list the workspace directory before answering.",
      },
    });

    const doneEvent = events.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.localIntentGuardTriggered,
      false,
    );
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode keeps a legal local read_locate action unchanged for workspace-local questions", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_locate","args":{"query":"UIChat Mira"},"reason":"Need workspace matches first."}';
    });
  const events: Array<Record<string, unknown>> = [];

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
        messages: [
          {
            role: "user",
            content: "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
            parts: [
              {
                type: "text",
                text: "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答。",
              },
            ],
          },
        ],
        workspaceRoot: "D:\\workspace\\rag-demo",
        toolExposure: {
          exposedTools: ["read_open", "read_locate", "web_search"],
          toolMeta: [
            ...baseToolExposure.toolMeta,
            {
              toolId: "read_locate",
              title: "Read Locate",
              description: "Locate files or matching content inside the authorized workspace.",
              inputSchema: { type: "object", properties: { query: { type: "string" } } },
              domain: "read",
              source: "internal",
              tags: ["read"],
              capabilities: {
                sideEffect: "none",
                requiresApproval: false,
              },
            },
          ],
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
        toolId: "read_locate",
        args: {
          query: "UIChat Mira",
        },
        reason: "Need workspace matches first.",
      },
    });

    const doneEvent = events.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.localIntentGuardTriggered,
      false,
    );
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode bridges completed read_locate evidence into read_open when the question still asks for file content", async () => {
  const streamSpy = vi.spyOn(providerProxyService, "streamTaskChatText");

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "看看文件夹下面有无读我文件，有的话，内容是啥",
        messages: [
          {
            role: "user",
            content: "看看文件夹下面有无读我文件，有的话，内容是啥",
            parts: [{ type: "text", text: "看看文件夹下面有无读我文件，有的话，内容是啥" }],
          },
        ],
        workspaceRoot: "D:\\workspace\\rag-demo",
        toolExposure: {
          exposedTools: ["read_open", "read_locate"],
          toolMeta: [
            baseToolExposure.toolMeta[0]!,
            {
              toolId: "read_locate",
              title: "Read Locate",
              description: "Locate files or matching content inside the authorized workspace.",
              inputSchema: { type: "object", properties: { query: { type: "string" } } },
              domain: "read",
              source: "internal",
              tags: ["read"],
              capabilities: {
                sideEffect: "none",
                requiresApproval: false,
              },
            },
          ],
        },
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [
            {
              toolCallId: "tool-call-read-locate-1",
              toolId: "read_locate",
              inputHash: "hash-read-locate-1",
              args: {
                query: "读我文件",
              },
              invocationId: "invocation-read-locate-1",
              status: "completed",
              result: {
                type: "locate",
                scope: ".",
                query: "读我文件",
                searchMode: "content",
                matches: [
                  {
                    path: "README.md",
                    matchType: "content",
                    preview: "UIChat Mira is a local-first desktop workspace.",
                  },
                ],
              },
              summary: {
                source: "tool",
                status: "completed",
                toolId: "read_locate",
                inputHash: "hash-read-locate-1",
                actionTaken: 'Located 1 workspace match(es) for "读我文件".',
                keyFindings: ["matchCount=1", "[content] README.md: UIChat Mira is a local-first desktop workspace."],
                answerReadiness: {
                  canAnswer: false,
                  reason: "Locate results found targets, but the question still needs file content.",
                  missingInfo: ["opened file content for the matched workspace target"],
                },
                data: {
                  kind: "read_locate",
                  scope: ".",
                  query: "读我文件",
                  searchMode: "content",
                  matchCount: 1,
                  matchedPaths: ["README.md"],
                  matchesPreview: ["[content] README.md: UIChat Mira is a local-first desktop workspace."],
                  truncated: false,
                  canAnswerLocateQuestion: false,
                },
                rawRef: {
                  evidenceIndex: 0,
                  toolCallId: "tool-call-read-locate-1",
                  invocationId: "invocation-read-locate-1",
                },
              },
              startedAt: "2026-07-05T00:00:00.000Z",
              finishedAt: "2026-07-05T00:00:01.000Z",
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
        reason:
          "Workspace locate evidence found a likely file target, so the agent will open that file before answering.",
      },
    });
    assert.equal(streamSpy.mock.calls.length, 0);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode bridges completed read_list evidence into read_open when README.md is listed and the question still asks for file content", async () => {
  const streamSpy = vi.spyOn(providerProxyService, "streamTaskChatText");

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "看看文件夹下面有无读我文件，有的话，内容是啥",
        messages: [
          {
            role: "user",
            content: "看看文件夹下面有无读我文件，有的话，内容是啥",
            parts: [{ type: "text", text: "看看文件夹下面有无读我文件，有的话，内容是啥" }],
          },
        ],
        workspaceRoot: "D:\\workspace\\rag-demo",
        toolExposure: {
          exposedTools: ["read_open", "read_list"],
          toolMeta: [baseToolExposure.toolMeta[0]!, readListToolMeta],
        },
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [
            {
              toolCallId: "tool-call-read-list-1",
              toolId: "read_list",
              inputHash: "hash-read-list-1",
              args: {
                path: ".",
              },
              invocationId: "invocation-read-list-1",
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
              summary: {
                source: "tool",
                status: "completed",
                toolId: "read_list",
                inputHash: "hash-read-list-1",
                actionTaken: "Listed workspace directory .",
                keyFindings: ["entryCount=2", "fileCount=1", "directoryCount=1", "[F] README.md"],
                answerReadiness: {
                  canAnswer: false,
                  reason: "Directory listing alone does not satisfy a file-content question.",
                  missingInfo: ["target file content or a narrower path"],
                },
                data: {
                  kind: "read_list",
                  path: ".",
                  entryCount: 2,
                  fileCount: 1,
                  directoryCount: 1,
                  entriesPreview: ["[F] README.md", "[D] docs"],
                  truncated: false,
                  canAnswerDirectoryQuestion: false,
                },
                rawRef: {
                  evidenceIndex: 0,
                  toolCallId: "tool-call-read-list-1",
                  invocationId: "invocation-read-list-1",
                },
              },
              startedAt: "2026-07-05T00:00:00.000Z",
              finishedAt: "2026-07-05T00:00:01.000Z",
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
        reason:
          "Workspace locate evidence found a likely file target, so the agent will open that file before answering.",
      },
    });
    assert.equal(streamSpy.mock.calls.length, 0);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode reroutes workspace-local folder queries from web_search to read_list instead of returning an internal error", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"web_search","args":{"query":"readme files in folder"},"reason":"Need search results."}';
    });
  const events: Array<Record<string, unknown>> = [];

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "看看文件夹下面有无读我文件，有的话，内容是啥",
        messages: [
          {
            role: "user",
            content: "看看文件夹下面有无读我文件，有的话，内容是啥",
            parts: [{ type: "text", text: "看看文件夹下面有无读我文件，有的话，内容是啥" }],
          },
        ],
        workspaceRoot: "D:\\workspace\\rag-demo",
        toolExposure: {
          exposedTools: ["read_open", "read_list", "read_locate", "web_search"],
          toolMeta: [
            ...baseToolExposure.toolMeta,
            readListToolMeta,
            {
              toolId: "read_locate",
              title: "Read Locate",
              description: "Locate files or matching content inside the authorized workspace.",
              inputSchema: { type: "object", properties: { query: { type: "string" } } },
              domain: "read",
              source: "internal",
              tags: ["read"],
              capabilities: {
                sideEffect: "none",
                requiresApproval: false,
              },
            },
          ],
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
        toolId: "read_list",
        args: {
          path: ".",
        },
        reason: "Workspace-local intent guard blocked web_search and redirected to a local evidence path.",
      },
    });

    const doneEvent = events.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.localIntentGuardTriggered,
      true,
    );
    assert.doesNotMatch(
      JSON.stringify(patch),
      /web_search cannot substitute/i,
    );
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode returns a user-facing safe error when no local evidence tool is available", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"web_search","args":{"query":"readme files in folder"},"reason":"Need search results."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "看看文件夹下面有无读我文件，有的话，内容是啥",
        messages: [
          {
            role: "user",
            content: "看看文件夹下面有无读我文件，有的话，内容是啥",
            parts: [{ type: "text", text: "看看文件夹下面有无读我文件，有的话，内容是啥" }],
          },
        ],
        workspaceRoot: "D:\\workspace\\rag-demo",
        toolExposure: {
          exposedTools: ["web_search"],
          toolMeta: baseToolExposure.toolMeta.filter(
            (tool) => tool.toolId === "web_search",
          ),
        },
      }),
    );

    assert.equal(patch.nextAction.type, "error");
    assert.equal(
      patch.nextAction.reason,
      "当前请求需要读取本地 workspace 文件，但本轮没有可用的本地读取工具。请确认 workspace 已绑定后重试。",
    );
    assert.equal(
      patch.errorMessage,
      "当前请求需要读取本地 workspace 文件，但本轮没有可用的本地读取工具。请确认 workspace 已绑定后重试。",
    );
    assert.equal(patch.errorSourceNodeId, "agent-next-action-planner");
    assert.equal(
      patch.blockedReason,
      "当前请求需要读取本地 workspace 文件，但本轮没有可用的本地读取工具。请确认 workspace 已绑定后重试。",
    );
    assert.doesNotMatch(
      patch.nextAction.reason,
      /web_search cannot substitute/i,
    );
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode keeps explicit external web_search requests unchanged", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"web_search","args":{"query":"latest release notes"},"reason":"Need current external information."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        question: "请联网搜索今天最新的 release notes",
        messages: [
          {
            role: "user",
            content: "请联网搜索今天最新的 release notes",
            parts: [{ type: "text", text: "请联网搜索今天最新的 release notes" }],
          },
        ],
        workspaceRoot: "D:\\workspace\\rag-demo",
      }),
    );

    assert.deepEqual(patch, {
      nextAction: {
        type: "use_tool",
        toolId: "web_search",
        args: {
          query: "latest release notes",
        },
        reason:
          "Coverage transition: gather the requested external search evidence before answering.",
      },
    });
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

test("nextActionPlannerNode turns a repeated completed tool call into answer and writes guard diagnostics", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need the file content."}';
    });
  const events: Array<Record<string, unknown>> = [];

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
                source: {
                  kind: "text",
                  text: "# README",
                },
              },
              startedAt: "2026-07-04T00:00:00.000Z",
              finishedAt: "2026-07-04T00:00:01.000Z",
            },
          ],
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
        type: "answer",
        reason:
          "Repeated tool guard: identical read_open call already completed in this run; answer from existing evidence.",
      },
    });
    assert.equal(streamSpy.mock.calls.length, 1);

    const doneEvent = events.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.repeatedToolGuardTriggered,
      true,
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.guardedActionType,
      "use_tool",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.guardedToolId,
      "read_open",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.guardedArgsHash,
      readmeArgsHash,
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.matchedEvidenceIndex,
      0,
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.matchedToolCallId,
      "tool-call-readme",
    );
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode does not let repeated read_open evidence close a multi-file content task early", async () => {
  const readmeAndAgentsState = createState({
    question: "README.md 和 AGENTS.md 的内容分别是什么？",
    messages: [
      {
        role: "user",
        content: "README.md 和 AGENTS.md 的内容分别是什么？",
        parts: [{ type: "text", text: "README.md 和 AGENTS.md 的内容分别是什么？" }],
      },
    ],
    currentTaskFrame: {
      currentGoal: "README.md 和 AGENTS.md 的内容分别是什么？",
      currentSubtask: "Open both files and inspect the content.",
      currentBlocker: undefined,
      confirmedObjects: [],
      completionCriteria: ["README.md 和 AGENTS.md 的内容分别是什么？"],
    },
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
          summary: {
            source: "tool",
            status: "completed",
            toolId: "read_open",
            inputHash: readmeArgsHash,
            actionTaken: "Opened README.md.",
            keyFindings: ["path=README.md"],
            answerReadiness: {
              canAnswer: true,
              reason: "Opened file content is available for answer generation.",
            },
            data: {
              kind: "read_open",
              path: "README.md",
              contentPreview: "# README",
              contentLength: 120,
              truncated: false,
              keySections: [],
              canAnswerFileQuestion: true,
            },
            rawRef: {
              evidenceIndex: 0,
              toolCallId: "tool-call-readme",
            },
          },
          startedAt: "2026-07-04T00:00:00.000Z",
          finishedAt: "2026-07-04T00:00:01.000Z",
        },
      ],
    },
  });
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Need the first file content again."}';
    })
    .mockImplementationOnce(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"AGENTS.md"},"reason":"Need the remaining file content."}';
    });

  try {
    const patch = await nextActionPlannerNode(readmeAndAgentsState);

    assert.deepEqual(patch, {
      nextAction: {
        type: "use_tool",
        toolId: "read_open",
        args: {
          path: "AGENTS.md",
        },
        reason:
          "Coverage transition: open AGENTS.md to satisfy the file-content request.",
      },
      currentTaskFrame: {
        ...readmeAndAgentsState.currentTaskFrame,
        currentGoal: "README.md 和 AGENTS.md 的内容分别是什么？",
        currentSubtask: "Run read_open with reviewed parameters.",
        completionCriteria: ["README.md 和 AGENTS.md 的内容分别是什么？"],
      },
    });
    assert.equal(streamSpy.mock.calls.length, 0);
  } finally {
    streamSpy.mockRestore();
  }
});

test("nextActionPlannerNode also guards a repeated completed read_list call", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_list","args":{"path":"."},"reason":"Need the workspace listing."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        toolExposure: {
          exposedTools: ["read_open", "web_search", "read_list"],
          toolMeta: [...baseToolExposure.toolMeta, readListToolMeta],
        },
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [
            {
              toolCallId: "tool-call-list",
              toolId: "read_list",
              inputHash: readListDotArgsHash,
              args: {
                path: ".",
              },
              status: "completed",
              result: {
                type: "list",
                path: ".",
                entries: [],
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
        type: "answer",
        reason:
          "Repeated tool guard: identical read_list call already completed in this run; answer from existing evidence.",
      },
    });
    assert.equal(streamSpy.mock.calls.length, 1);
  } finally {
    streamSpy.mockRestore();
  }
});

test('nextActionPlannerNode treats read_list "/workspace" and "." as the same repeated call', async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_list","args":{"path":"/workspace"},"reason":"Need the workspace listing again."}';
    });
  const events: Array<{
    nodeId: string;
    phase: string;
    details?: unknown;
  }> = [];

  try {
    const patch = await nextActionPlannerNode(
      createState({
        toolExposure: {
          exposedTools: ["read_open", "web_search", "read_list"],
          toolMeta: [...baseToolExposure.toolMeta, readListToolMeta],
        },
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [
            {
              toolCallId: "tool-call-list-root",
              toolId: "read_list",
              inputHash: readListDotArgsHash,
              args: {
                path: ".",
              },
              status: "completed",
              result: {
                type: "list",
                path: ".",
                entries: [],
              },
              startedAt: "2026-07-04T00:00:00.000Z",
              finishedAt: "2026-07-04T00:00:01.000Z",
            },
          ],
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
        type: "answer",
        reason:
          "Repeated tool guard: identical read_list call already completed in this run; answer from existing evidence.",
      },
    });
    assert.equal(streamSpy.mock.calls.length, 1);

    const doneEvent = events.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.repeatedToolGuardTriggered,
      true,
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.guardedActionType,
      "use_tool",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.guardedToolId,
      "read_list",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.guardedArgsHash,
      readListDotArgsHash,
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.matchedEvidenceIndex,
      0,
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.matchedToolCallId,
      "tool-call-list-root",
    );
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

test("nextActionPlannerNode turns a repeated retrieval query into answer and writes guard diagnostics", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"retrieve","query":"README.md 内容","reason":"Need retrieval evidence."}';
    });
  const events: Array<Record<string, unknown>> = [];

  try {
    const patch = await nextActionPlannerNode(
      createState({
        evidence: {
          observations: [],
          toolExecutions: [],
          retrievals: [
            {
              query: " README.md   内容 ",
              chunkCount: 1,
              chunks: [
                {
                  chunkId: "chunk-1",
                  documentName: "README",
                  content: "README content",
                },
              ],
              createdAt: "2026-07-04T00:00:00.000Z",
            },
          ],
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
        type: "answer",
        reason:
          "Repeated retrieval guard: identical retrieval query already completed in this run; answer from existing evidence.",
      },
    });

    const doneEvent = events.find(
      (event) =>
        event.nodeId === "agent-next-action-planner" && event.phase === "done",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.repeatedToolGuardTriggered,
      true,
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.guardedActionType,
      "retrieve",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.guardedQuery,
      "readme.md 内容",
    );
    assert.equal(
      (doneEvent?.details as Record<string, unknown>)?.matchedEvidenceIndex,
      0,
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
        plan: {
          id: "plan-1",
          goalId: "goal-1",
          version: 1,
          steps: [
            {
              id: "retrieve",
              kind: "retrieve",
              title: "collect evidence",
              status: "pending",
              riskLevel: "low",
              requiresApproval: false,
            },
          ],
        },
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
    assert.match(String(plannerMessages[1]?.content ?? ""), /"plan"/);

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
          selectedToolIds: [],
          candidateToolIds: [],
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
          "Coverage transition: open README.md to satisfy the file-content request.",
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
