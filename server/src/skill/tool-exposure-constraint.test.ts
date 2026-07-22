import { beforeEach, describe, expect, it, vi } from "vitest";
import * as embedding from "@/services/internal-capabilities/local-embedding.js";
import { clearHarnessRegistry, registerCapability } from "@/harness/registry.js";
import { resolveHarnessToolCandidatesForTurn } from "@/harness/tool-candidates.js";

const createEligibleTool = (id: string) => ({
  definition: {
    id,
    title: id,
    description: `${id} test tool`,
    domain: "read" as const,
    source: "internal" as const,
    mode: "sync" as const,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    tags: [] as string[],
    capabilities: {
      sideEffect: "none" as const,
      requiresApproval: false,
    },
  },
  execute() {
    return {};
  },
});

describe("Skill runtime tool exposure constraint", () => {
  beforeEach(() => {
    clearHarnessRegistry();
    vi.restoreAllMocks();
  });

  it("narrows eligible tools before the 20-tool ranking budget", async () => {
    for (let index = 0; index < 25; index += 1) {
      registerCapability(createEligibleTool(`tool_${index}`));
    }

    const embeddingSpy = vi
      .spyOn(embedding, "executeLocalEmbedding")
      .mockRejectedValue(new Error("ranking should not run after runtime narrowing"));

    const result = await resolveHarnessToolCandidatesForTurn({
      query: "anything",
      source: "agent_intent",
      allowedToolIds: ["tool_23", "tool_24"],
    });

    expect(embeddingSpy).not.toHaveBeenCalled();
    expect(result.toolExposure.exposedToolIds).toEqual(["tool_23", "tool_24"]);
    expect(result.toolCandidates.map((item) => item.toolId)).toEqual([
      "tool_23",
      "tool_24",
    ]);
  });

  it("cannot make an ineligible or unregistered tool visible", async () => {
    registerCapability(createEligibleTool("eligible_tool"));

    const result = await resolveHarnessToolCandidatesForTurn({
      query: "anything",
      source: "agent_intent",
      allowedToolIds: ["missing_tool"],
    });

    expect(result.toolExposure.exposedToolIds).toEqual([]);
    expect(result.toolCandidates).toEqual([]);
  });
});
