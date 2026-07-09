import { afterEach, describe, expect, it } from "vitest";

import { resolveHarnessToolExposure } from "./exposure.js";
import {
  clearHarnessRegistry,
  listCapabilityDefinitions,
} from "./registry.js";
import { initializeHarnessRuntime, resetHarnessRuntime } from "./runtime.js";

const originalFlag = process.env.UI_CHAT_CODEGRAPH_PLANNER_ENABLED;

describe("initializeHarnessRuntime codebase_explore registration", () => {
  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.UI_CHAT_CODEGRAPH_PLANNER_ENABLED;
    } else {
      process.env.UI_CHAT_CODEGRAPH_PLANNER_ENABLED = originalFlag;
    }
    clearHarnessRegistry();
    resetHarnessRuntime();
  });

  it("keeps codebase_explore hidden when the planner feature flag is off", () => {
    delete process.env.UI_CHAT_CODEGRAPH_PLANNER_ENABLED;

    initializeHarnessRuntime();

    expect(listCapabilityDefinitions().map((definition) => definition.id)).not.toContain(
      "codebase_explore",
    );

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "请梳理 agent planner 和 tool node 的关系",
    });
    expect(decision.exposedToolIds).not.toContain("codebase_explore");
  });

  it("registers only the controlled codebase_explore schema when the flag is on", () => {
    process.env.UI_CHAT_CODEGRAPH_PLANNER_ENABLED = "1";

    initializeHarnessRuntime();

    const definition = listCapabilityDefinitions().find(
      (item) => item.id === "codebase_explore",
    );

    expect(definition).toBeDefined();
    expect(definition?.inputSchema).toEqual({
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
      additionalProperties: false,
    });
    expect(definition?.tags).toContain("codegraph");
    expect(definition?.tags).toContain("verification");

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "梳理 codebase architecture impact flow",
    });
    expect(decision.exposedToolIds).toContain("codebase_explore");
    expect(
      decision.exposedToolIds.filter((toolId) => toolId.includes("codegraph/")),
    ).toEqual([]);
    expect(
      listCapabilityDefinitions()
        .map((item) => item.id)
        .filter((toolId) => toolId.startsWith("codegraph/")),
    ).toEqual([]);
  });
});
