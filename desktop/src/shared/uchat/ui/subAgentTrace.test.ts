import { describe, expect, it } from "vitest";
import type { RagNodeLike } from "./ragTypes";
import {
  getDisplayExecutionSteps,
  isSubAgentTraceStep,
} from "./subAgentTrace";

const step = (overrides: Partial<RagNodeLike>): RagNodeLike => ({
  nodeId: "agent-step",
  nodeType: "reason",
  phase: "start",
  label: "执行步骤",
  ...overrides,
});

describe("subAgent trace classification", () => {
  it("normalizes the parent delegation row into a completed hand-off", () => {
    const delegation = step({
      nodeId: "agent-subagent-dispatch",
      label: "subAgent 委派",
      summary: "正在把 xlsx Skill 委派给独立 subAgent",
    });

    expect(isSubAgentTraceStep(delegation)).toBe(true);
    expect(getDisplayExecutionSteps([delegation])[0]?.phase).toBe("done");
  });

  it("keeps ordinary running Agent rows active", () => {
    const policy = step({
      nodeId: "agent-policy",
      label: "审批策略",
      summary: "正在检查调用策略",
    });

    expect(isSubAgentTraceStep(policy)).toBe(false);
    expect(getDisplayExecutionSteps([policy])[0]?.phase).toBe("start");
  });
});
