import { describe, expect, it, vi } from "vitest";
import { prepareContextWithDelegationNode } from "./prepare-context-with-delegation.js";

const baseExposure = {
  exposedTools: ["read_open"],
  toolMeta: [],
};

vi.mock("./prepare-context-with-forked-skill.js", () => ({
  prepareContextWithForkedSkillAgentNode: vi.fn(),
}));

import { prepareContextWithForkedSkillAgentNode } from "./prepare-context-with-forked-skill.js";

describe("prepareContextWithDelegationNode", () => {
  it("does not re-expose delegate_task after a forked Skill takes ownership", async () => {
    vi.mocked(prepareContextWithForkedSkillAgentNode).mockResolvedValue({
      toolExposure: baseExposure,
      currentTaskFrame: {
        globalGoal: "Inspect a repository",
        currentGoal: "Inspect a repository",
        confirmedObjects: [],
        completionCriteria: [],
        skillContext: {
          primary: { execution: { context: "fork" } },
        },
      } as never,
    });

    const result = await prepareContextWithDelegationNode({
      toolExposure: baseExposure,
      currentTaskFrame: undefined,
    } as never);

    expect(result.toolExposure?.exposedTools).not.toContain("delegate_task");
  });

  it("keeps delegate_task available for ordinary tasks", async () => {
    vi.mocked(prepareContextWithForkedSkillAgentNode).mockResolvedValue({
      toolExposure: baseExposure,
      currentTaskFrame: undefined,
    });

    const result = await prepareContextWithDelegationNode({
      toolExposure: baseExposure,
      currentTaskFrame: undefined,
    } as never);

    expect(result.toolExposure?.exposedTools).toContain("delegate_task");
  });
});
