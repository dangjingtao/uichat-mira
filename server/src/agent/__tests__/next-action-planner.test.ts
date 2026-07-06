import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { subscribeToLogLines } from "@/logger";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import {
  buildPlannerObservationContext,
  type AgentNodeState,
} from "../node-runtime";
import { createInvocationInputHash } from "../approval-fingerprint";
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
  assert.deepEqual(context.recovery, {
    attemptCount: 0,
    maxAttempts: 1,
    exhausted: false,
    schemaError: undefined,
    toolId: undefined,
    invalidAction: undefined,
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
    attemptCount: 1,
    maxAttempts: 1,
    exhausted: true,
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

  assert.ok("observationContext" in payload);
  assert.equal("taskFrame" in payload, false);
  assert.equal("lastToolExecution" in payload, false);
  assert.equal("pendingApproval" in payload, false);
  assert.equal("schemaReplanDiagnostics" in payload, false);
  assert.equal("latestEvidenceSummary" in payload, false);
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
        reason: "Workspace-local intent guard blocked web_search and redirected to a local evidence path.",
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
        reason: "Need the file content.",
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
        reason: "Need the workspace listing.",
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
        reason: "Need current external information.",
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

test("nextActionPlannerNode does not treat awaiting approval tool execution as a completed duplicate", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Retry after approval wait."}';
    });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [
            {
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
                reason: "needs approval",
                input: {
                  path: "README.md",
                },
                inputHash:
                  readmeArgsHash,
                createdAt: "2026-07-04T00:00:00.000Z",
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
          path: "README.md",
        },
        reason: "Retry after approval wait.",
      },
    });
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

test("nextActionPlannerNode treats ask_user output as invalid for the current planner contract", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"ask_user","question":"Which repository should I inspect?","reason":"The target repo is ambiguous."}';
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

test("nextActionPlannerNode prompt no longer allows ask_user output", async () => {
  const streamSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"type":"answer","reason":"Enough evidence."}';
    });

  try {
    await nextActionPlannerNode(createState());
    const plannerMessages = streamSpy.mock.calls[0]?.[0] ?? [];
    assert.match(String(plannerMessages[0]?.content ?? ""), /"type":"error"/);
    assert.doesNotMatch(
      String(plannerMessages[0]?.content ?? ""),
      /"type":"ask_user"/,
    );
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
      ["answer", "retrieve", "use_tool", "error"],
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
        reason: "Need file content.",
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
