import { describe, expect, it } from "vitest";
import type { RagNodeLike } from "./ragTypes";
import { isSubAgentTraceStep } from "./subAgentTrace";

const step = (overrides: Partial<RagNodeLike>): RagNodeLike => ({
  nodeId: "agent-step",
  nodeType: "reason",
  phase: "start",
  label: "执行步骤",
  ...overrides,
});

describe("subAgent trace classification", () => {
  it("treats the parent delegation row as a completed hand-off event", () => {
    expect(
      isSubAgentTraceStep(
        step({
          nodeId: "agent-subagent-dispatch",
          label: "subAgent 委派",
          summary: "正在把 xlsx Skill 委派给独立 subAgent",
        }),
      ),
    ).toBe(true);
  });

  it("keeps ordinary running Agent rows active", () => {
    expect(
      isSubAgentTraceStep(
        step({
          nodeId: "agent-policy",
          label: "审批策略",
          summary: "正在检查调用策略",
        }),
      ),
    ).toBe(false);
  });
});
