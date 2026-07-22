import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import { createInvocationInputHash } from "../approval-fingerprint";
import type { AgentNodeState } from "../node-runtime";
import { nextActionPlannerNode } from "../nodes/next-action-planner";
import { validateNextAction } from "../planner/validate";

const toolMeta = (toolId: string, domain = "read") => ({
  toolId,
  title: toolId,
  description: toolId,
  inputSchema: { type: "object", properties: { path: { type: "string" } } },
  domain,
  source: "internal" as const,
  tags: [domain],
  capabilities: { sideEffect: "none" as const, requiresApproval: false },
});

const createState = (overrides: Partial<AgentNodeState> = {}): AgentNodeState => ({
  runId: "t05-run",
  threadId: "t05-thread",
  userId: 1,
  goal: {
    id: "goal-1",
    text: "inspect the workspace",
    successCriteria: ["answer"],
    constraints: [],
    riskLevel: "low",
  },
  question: "Inspect the workspace.",
  messages: [
    {
      role: "user",
      content: "Inspect the workspace.",
      parts: [{ type: "text", text: "Inspect the workspace." }],
    },
  ],
  toolExposure: {
    exposedTools: ["read_list", "read_locate", "read_open"],
    toolMeta: [toolMeta("read_list"), toolMeta("read_locate"), toolMeta("read_open")],
  },
  evidence: { observations: [], retrievals: [], toolExecutions: [] },
  iterationCount: 0,
  maxIterations: 3,
  ...overrides,
});

const mockPlanner = (output: string) =>
  vi.spyOn(providerProxyService, "streamTaskChatText").mockImplementation(
    async function* () {
      yield output;
    },
  );

test("Planner returns a legal action with its toolId and args unchanged", async () => {
  const stream = mockPlanner(
    '{"type":"use_tool","toolId":"read_locate","args":{"path":"docs"},"reason":"Locate the requested file."}',
  );

  try {
    const patch = await nextActionPlannerNode(createState());
    assert.deepEqual(patch.nextAction, {
      type: "use_tool",
      toolId: "read_locate",
      args: { path: "docs" },
      reason: "Locate the requested file.",
    });
  } finally {
    stream.mockRestore();
  }
});

test("list and locate evidence do not cause an automatic read_open action", async () => {
  const stream = mockPlanner(
    '{"type":"answer","reason":"Use the evidence provided.","completionProof":[{"criterion":"answer","evidenceRefs":["tool:0","tool:1"]}],"unresolvedGaps":[]}',
  );
  const evidence = {
    observations: [],
    retrievals: [],
    toolExecutions: [
      {
        toolId: "read_list",
        args: { path: "." },
        status: "completed" as const,
        result: { type: "list", path: ".", entries: [{ name: "README.md", type: "file" }] },
        startedAt: "2026-07-11T00:00:00.000Z",
        finishedAt: "2026-07-11T00:00:01.000Z",
      },
      {
        toolId: "read_locate",
        args: { query: "README.md" },
        status: "completed" as const,
        result: { type: "locate", matches: [{ path: "README.md" }] },
        startedAt: "2026-07-11T00:00:02.000Z",
        finishedAt: "2026-07-11T00:00:03.000Z",
      },
    ],
  };

  try {
    const patch = await nextActionPlannerNode(
      createState({ question: "What files were found?", evidence }),
    );
    assert.deepEqual(patch.nextAction, {
      type: "answer",
      reason: "Use the evidence provided.",
      completionProof: [
        {
          criterion: "answer",
          evidenceRefs: ["tool:0", "tool:1"],
        },
      ],
      unresolvedGaps: [],
    });
    assert.deepEqual(patch.finalizationPacket, patch.nextAction);
  } finally {
    stream.mockRestore();
  }
});

test("a repeated fingerprint does not rewrite the Planner action", async () => {
  const args = { path: "README.md" };
  const stream = mockPlanner(
    '{"type":"use_tool","toolId":"read_open","args":{"path":"README.md"},"reason":"Retry with the same request."}',
  );
  const inputHash = createInvocationInputHash({
    toolId: "read_open",
    args,
    source: "planner",
  });

  try {
    const patch = await nextActionPlannerNode(
      createState({
        toolExposure: {
          exposedTools: ["read_open"],
          toolMeta: [toolMeta("read_open")],
        },
        evidence: {
          observations: [],
          retrievals: [],
          toolExecutions: [
            {
              toolId: "read_open",
              args,
              inputHash,
              status: "completed",
            },
          ],
        },
      }),
    );
    assert.deepEqual(patch.nextAction, {
      type: "use_tool",
      toolId: "read_open",
      args,
      reason: "Retry with the same request.",
    });
  } finally {
    stream.mockRestore();
  }
});

test("Planner validation accepts an exposed tool and rejects an unexposed tool without replacement", () => {
  const exposed = validateNextAction(
    {
      action: {
        type: "use_tool",
        toolId: "read_locate",
        args: { path: "docs" },
        reason: "Locate it.",
      },
      sanitizedOutput: "{}",
    },
    ["read_locate"],
  );
  assert.deepEqual(exposed.action, {
    type: "use_tool",
    toolId: "read_locate",
    args: { path: "docs" },
    reason: "Locate it.",
  });

  const rejected = validateNextAction(
    {
      action: {
        type: "use_tool",
        toolId: "read_open",
        args: { path: "README.md" },
        reason: "Open it.",
      },
      sanitizedOutput: "{}",
    },
    ["read_locate"],
  );
  assert.equal(rejected.action.type, "error");
  assert.match(rejected.action.reason, /not exposed/i);
});
