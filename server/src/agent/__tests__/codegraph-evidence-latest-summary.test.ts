import assert from "node:assert/strict";
import { test } from "vitest";

import { evidenceNode } from "../nodes/evidence";
import type { AgentNodeState } from "../node-runtime";

const createBaseState = (): AgentNodeState => ({
  runId: "run-codegraph-evidence",
  threadId: "thread-codegraph-evidence",
  userId: 1,
  goal: {
    id: "goal-codegraph-evidence",
    text: "Explain the Agent loop from source.",
    successCriteria: ["Use verified source evidence."],
    constraints: [],
    riskLevel: "low",
  },
  messages: [],
  evidence: {
    observations: [],
    toolExecutions: [],
    retrievals: [],
  },
  pendingRetrievalEvidence: {
    query: "Planner Normalize Policy Tool Evidence",
    chunkCount: 1,
    chunks: [
      {
        chunkId: "codegraph:server/src/agent/planner/node.ts:218-240:0",
        documentName: "server/src/agent/planner/node.ts",
        score: 0.95,
        content: "export const nextActionPlannerNode = async (...) => { ... }",
      },
    ],
    summary: {
      source: "retrieval",
      status: "completed",
      actionTaken: "CodeGraph verified one source chunk.",
      keyFindings: [
        "verifiedSource[1] | path=server/src/agent/planner/node.ts | lines=L218-L240 | excerpt=export const nextActionPlannerNode = async (...) => { ... }",
      ],
      data: {
        kind: "retrieval",
        query: "Planner Normalize Policy Tool Evidence",
        chunkCount: 1,
        documentsPreview: ["server/src/agent/planner/node.ts"],
      },
    },
    createdAt: "2026-07-19T00:00:00.000Z",
  },
  pendingToolExecution: {
    toolCallId: "tool-call-codegraph",
    toolId: "codebase_explore",
    inputHash: "hash-codegraph",
    args: { query: "Planner Normalize Policy Tool Evidence" },
    status: "completed",
    result: { capabilityId: "codebase_explore" },
    evidence: {
      actionTaken:
        "Codebase explore verified one workspace chunk. Verified excerpts below are already source-body evidence re-read from the workspace.",
      facts: [
        "verifiedSource[1] | path=server/src/agent/planner/node.ts | lines=L218-L240 | summary=Planner decides the next action | excerpt=export const nextActionPlannerNode = async (...) => { ... }",
        "verifiedChunkCount=1",
      ],
      status: "completed",
      data: {
        kind: "codebase_explore",
        verifiedChunkCount: 1,
      },
    },
    startedAt: "2026-07-19T00:00:00.000Z",
    finishedAt: "2026-07-19T00:00:01.000Z",
  },
});

test("CodeGraph writes retrieval chunks but keeps verified source tool summary as latest evidence", async () => {
  const result = await evidenceNode(createBaseState());

  assert.equal(result.evidence?.retrievals.length, 1);
  assert.equal(result.evidence?.toolExecutions.length, 1);
  assert.equal(result.evidence?.latestSummary?.toolId, "codebase_explore");
  assert.match(
    result.evidence?.latestSummary?.keyFindings[0] ?? "",
    /verifiedSource\[1\].*planner\/node\.ts/,
  );
});
