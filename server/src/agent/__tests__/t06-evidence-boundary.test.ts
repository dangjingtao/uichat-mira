import { describe, expect, it } from "vitest";
import { evidenceNode } from "../nodes/evidence";
import type { AgentNodeState } from "../node-runtime";

const baseState = (patch: Partial<AgentNodeState> = {}) =>
  ({
    runId: "run-t06",
    threadId: "thread-t06",
    userId: 1,
    goal: { text: "inspect the workspace" },
    messages: [],
    evidence: undefined,
    observations: [],
    ...patch,
  }) as AgentNodeState;

describe("Agent V1.5 T06 evidence boundary", () => {
  it("writes executor facts once and removes readiness decisions from the published summary", async () => {
    const result = await evidenceNode(
      baseState({
        pendingEvidenceObservation: {
          id: "observation-1",
          runId: "run-t06",
          stepId: "tool",
          status: "ok",
          facts: ["read_open completed"],
          createdAt: "2026-07-11T00:00:00.000Z",
        },
        pendingToolExecution: {
          toolCallId: "call-1",
          toolId: "read_open",
          inputHash: "hash-1",
          args: { path: "README.md" },
          status: "completed",
          result: { type: "file", content: "hello" },
          startedAt: "2026-07-11T00:00:00.000Z",
          finishedAt: "2026-07-11T00:00:01.000Z",
        },
      }),
    );

    expect(result.evidence?.toolExecutions).toHaveLength(1);
    expect(result.evidence?.observations).toHaveLength(1);
    expect(result.evidence?.latestSummary).not.toHaveProperty("answerReadiness");
    expect(result.evidence?.latestSummary?.data ?? {}).not.toHaveProperty(
      "canAnswerFileQuestion",
    );
    expect(result.evidence?.toolExecutions[0]?.result).toEqual({
      type: "file",
      content: "hello",
    });
    expect(result.evidence?.toolExecutions[0]?.summary?.rawRef).toBeDefined();
  });

  it("keeps retrieval facts distinct from tool execution facts", async () => {
    const result = await evidenceNode(
      baseState({
        pendingRetrievalEvidence: {
          query: "runtime contract",
          chunkCount: 1,
          chunks: [
            {
              chunkId: "chunk-1",
              documentName: "docs/architecture/README.md",
              content: "backend is the runtime boundary",
            },
          ],
          createdAt: "2026-07-11T00:00:00.000Z",
        },
      }),
    );

    expect(result.evidence?.toolExecutions).toHaveLength(0);
    expect(result.evidence?.retrievals).toHaveLength(1);
    expect(result.evidence?.latestSummary?.source).toBe("retrieval");
    expect(result.evidence?.latestSummary).not.toHaveProperty("answerReadiness");
  });
});
