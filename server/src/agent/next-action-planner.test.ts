import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import type { AgentNodeState } from "./nodes.js";
import { nextActionPlannerNode } from "./next-action-planner.js";

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
