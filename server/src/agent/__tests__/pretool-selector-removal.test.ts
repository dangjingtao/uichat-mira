import assert from "node:assert/strict";
import { test } from "vitest";
import { toolCallNormalizeNode } from "../nodes/tool-call-normalize";
import { routeAfterPlanStep, routeAfterRetrieve } from "../graph/routes";

const makeState = (toolId: string, exposedTools: string[]) =>
  ({
    runId: "run-pretool-removal",
    nextAction: {
      type: "use_tool",
      toolId,
      args: { query: "test" },
      reason: "planner decision",
    },
    toolExposure: {
      exposedTools,
      toolMeta: exposedTools.map((id) => ({
        toolId: id,
        title: id,
        description: id,
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          additionalProperties: false,
        },
        domain: "test",
        source: "internal",
        tags: [],
      })),
    },
    schemaReplanDiagnostics: undefined,
    errorMessage: undefined,
    errorSourceNodeId: undefined,
  }) as never;

test("planStep and post-retrieval route directly to Planner", () => {
  assert.equal(routeAfterPlanStep({} as never), "nextActionPlanner");
  assert.equal(routeAfterRetrieve({ iterationCount: 0, maxIterations: 3 } as never), "nextActionPlanner");
});

test("Normalize accepts any exposed Planner tool without top1 replacement", async () => {
  const result = await toolCallNormalizeNode(
    makeState("second-tool", ["first-tool", "second-tool"]),
  );

  assert.equal(result.pendingToolCall?.toolId, "second-tool");
  assert.equal(result.errorMessage, undefined);
});

test("Normalize rejects a Planner tool outside exposure instead of replacing it", async () => {
  const result = await toolCallNormalizeNode(
    makeState("outside-tool", ["first-tool", "second-tool"]),
  );

  assert.equal(result.pendingToolCall, undefined);
  assert.match(result.errorMessage ?? "", /not exposed/i);
});
