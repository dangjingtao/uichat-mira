import { describe, expect, it, vi } from "vitest";
import { createPiAgentLoop, type PiAgentLoopSemantics } from "./index";
import type { AgentFinalizationPacket, AgentGraphInput } from "../types";

const noop = async () => ({});

describe("Pi agent loop forked Skill finalization", () => {
  it("goes from prepareContext directly to Generate without invoking Main Planner", async () => {
    const finalizationPacket: AgentFinalizationPacket = {
      type: "answer",
      reason: "Forked Skill Agent completed task-local execution.",
      completionProof: [
        {
          criterion: "Deliver the completed Skill artifact.",
          evidenceRefs: ["observation:0"],
        },
      ],
      unresolvedGaps: [],
    };
    const planner = vi.fn(noop);
    const semantics: PiAgentLoopSemantics = {
      prepareContext: async () => ({
        nextAction: finalizationPacket,
        finalizationPacket,
        evidence: {
          observations: [
            {
              id: "obs-1",
              runId: "run-1",
              stepId: "skill_agent:docx",
              status: "ok",
              facts: ["Artifact records: [{\"path\":\"smoke.docx\"}]"],
              createdAt: "2026-07-24T00:00:00.000Z",
            },
          ],
          toolExecutions: [],
          retrievals: [],
        },
      }),
      planner,
      normalizeAndFreeze: noop,
      evaluatePolicy: noop,
      pauseForApproval: noop,
      retrieve: noop,
      executeTool: noop,
      appendEvidence: noop,
      generate: async (state) => {
        expect(state.finalizationPacket).toBe(finalizationPacket);
        return { answer: "smoke.docx" };
      },
      finalize: async () => ({ terminalReason: "completed" }),
      finishWithError: async () => ({ terminalReason: "failed_error" }),
    };
    const input: AgentGraphInput = {
      runId: "run-1",
      threadId: "thread-1",
      userId: 1,
      goal: {
        id: "goal-1",
        text: "Create a Word report",
        successCriteria: [],
        constraints: [],
        riskLevel: "low",
      },
      messages: [
        {
          role: "user",
          content: "Create a Word report",
          parts: [{ type: "text", text: "Create a Word report" }],
        },
      ],
    };

    const output = await createPiAgentLoop(semantics).run(input);

    expect(planner).not.toHaveBeenCalled();
    expect(output.status).toBe("completed");
    expect(output.answer).toBe("smoke.docx");
    expect(output.finalizationPacket).toBe(finalizationPacket);
  });
});
