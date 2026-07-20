import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { McpToolImplementation } from "../../mcp/core/definitions.js";
import {
  clearHarnessRegistry,
  registerCapability,
} from "../registry.js";
import { resolveHarnessToolCandidatesForTurn } from "./resolver.js";

const createTool = (input: {
  id: string;
  domain: "browser_action" | "edit" | "terminal";
  tags: string[];
  sideEffect: "none" | "local-write" | "process" | "network";
  requiresApproval: boolean;
  networkAccess?: boolean;
  longRunning?: boolean;
}): McpToolImplementation => ({
  definition: {
    id: input.id,
    title: input.id,
    description: `${input.id} test tool`,
    domain: input.domain,
    source: "internal",
    mode: "sync",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    tags: input.tags,
    capabilities: {
      sideEffect: input.sideEffect,
      requiresApproval: input.requiresApproval,
      ...(input.networkAccess === undefined
        ? {}
        : { networkAccess: input.networkAccess }),
      ...(input.longRunning === undefined
        ? {}
        : { longRunning: input.longRunning }),
    },
  },
  execute: async () => ({ result: { ok: true } }),
});

describe("browser-intent Harness candidate exposure", () => {
  beforeEach(() => {
    clearHarnessRegistry();

    registerCapability(
      createTool({
        id: "browser_observe",
        domain: "browser_action",
        tags: ["browser", "computer-use"],
        sideEffect: "network",
        requiresApproval: false,
        networkAccess: true,
      }),
    );
    registerCapability(
      createTool({
        id: "browser_act",
        domain: "browser_action",
        tags: ["browser", "computer-use"],
        sideEffect: "network",
        requiresApproval: false,
        networkAccess: true,
      }),
    );
    registerCapability(
      createTool({
        id: "browser_assert",
        domain: "browser_action",
        tags: ["browser", "computer-use"],
        sideEffect: "network",
        requiresApproval: false,
        networkAccess: true,
      }),
    );
    registerCapability(
      createTool({
        id: "write_file",
        domain: "edit",
        tags: ["edit", "write"],
        sideEffect: "local-write",
        requiresApproval: true,
      }),
    );
    registerCapability(
      createTool({
        id: "terminal_session",
        domain: "terminal",
        tags: ["terminal", "shell"],
        sideEffect: "process",
        requiresApproval: true,
        longRunning: true,
      }),
    );
  });

  afterEach(() => {
    clearHarnessRegistry();
  });

  it("does not isolate Browser tools when a multi-step browser task also needs Edit or Terminal", async () => {
    const result = await resolveHarnessToolCandidatesForTurn({
      source: "agent_intent",
      query: "打开公众号网页，整理成 HTML，然后保存到当前工作区；必要时用终端处理。",
    });

    expect(result.toolExposure.exposedToolIds).toEqual(
      expect.arrayContaining([
        "browser_observe",
        "browser_act",
        "browser_assert",
        "write_file",
        "terminal_session",
      ]),
    );
    expect(result.toolExposure.reason).not.toContain(
      "Browser intent is isolated to the Computer Use browser tool set.",
    );
  });
});
