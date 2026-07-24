import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentNodeState } from "../node-runtime";
import type { AgentFinalizationPacket } from "../types";

const mocks = vi.hoisted(() => ({
  basePlanner: vi.fn(),
  parsePlannerOutput: vi.fn(),
}));

vi.mock("../planner/index", () => ({
  nextActionPlannerNode: mocks.basePlanner,
  parseNextActionPlannerOutput: mocks.parsePlannerOutput,
}));

import { nextActionPlannerNode } from "./next-action-planner";

describe("nextActionPlannerNode forked Skill parent decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves a frozen Parent finalization without invoking Main Planner", async () => {
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
    const state = {
      nextAction: finalizationPacket,
      finalizationPacket,
    } as AgentNodeState;

    const result = await nextActionPlannerNode(state);

    expect(mocks.basePlanner).not.toHaveBeenCalled();
    expect(result.nextAction).toBe(finalizationPacket);
    expect(result.finalizationPacket).toBe(finalizationPacket);
  });

  it("preserves a forked Skill needs_input boundary without invoking Main Planner", async () => {
    const nextAction = {
      type: "ask_user" as const,
      question: "Please provide the report title.",
      reason: "Forked Skill Agent requires one missing input.",
    };
    const state = { nextAction } as AgentNodeState;

    const result = await nextActionPlannerNode(state);

    expect(mocks.basePlanner).not.toHaveBeenCalled();
    expect(result.nextAction).toBe(nextAction);
  });
});
