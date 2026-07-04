import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { subscribeToLogLines } from "@/logger";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import type { AgentNodeState } from "./nodes.js";
import { createInvocationInputHash } from "./approval-fingerprint.js";
import {
  nextActionPlannerNode,
  parseNextActionPlannerOutput,
} from "./next-action-planner.js";

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
