import assert from "node:assert/strict";
import { test } from "vitest";
import {
  routeAfterNextAction,
  routeAfterRetrieve,
  routeAfterTool,
  routeAfterToolCallNormalize,
} from "../graph/routes";
import type { AgentGraphState } from "../graph/state";

const baseState = (overrides: Partial<AgentGraphState> = {}) =>
  ({
    nextAction: undefined,
    pendingApproval: undefined,
    pendingToolCall: undefined,
    policyDecision: undefined,
    lastToolExecution: undefined,
    latestRetrieval: undefined,
    errorMessage: undefined,
    iterationCount: 0,
    maxIterations: 3,
    ...overrides,
  }) as AgentGraphState;

test("graph routes Planner answer to generate without normalize or policy", () => {
  assert.equal(
    routeAfterNextAction(
      baseState({ nextAction: { type: "answer", reason: "Evidence is sufficient." } }),
    ),
    "generate",
  );
});

test("graph routes Planner retrieve back through the retrieval node", () => {
  assert.equal(
    routeAfterNextAction(
      baseState({ nextAction: { type: "retrieve", query: "release notes", reason: "Need evidence." } }),
    ),
    "retrieve",
  );
});

test("graph routes Planner use_tool through Normalize before Policy", () => {
  assert.equal(
    routeAfterNextAction(
      baseState({
        nextAction: {
          type: "use_tool",
          toolId: "read_locate",
          args: { query: "README.md" },
          reason: "Locate the requested file.",
        },
      }),
    ),
    "toolCallNormalize",
  );
});

test("graph routes a Normalize rejection to the error path without replacing the action", () => {
  assert.equal(
    routeAfterToolCallNormalize(
      baseState({
        errorMessage: "Planner selected tool is not exposed: read_open",
        schemaReplanDiagnostics: {
          schemaError: "Planner selected tool is not exposed: read_open",
          attemptCount: 1,
        },
      }),
    ),
    "error",
  );
});

test("graph keeps waiting approval and terminal tool failures on mechanical routes", () => {
  assert.equal(
    routeAfterTool(
      baseState({
        pendingApproval: { id: "approval-1", toolId: "terminal_session" } as never,
      }),
    ),
    "approval",
  );
  assert.equal(
    routeAfterTool(
      baseState({
        lastToolExecution: { status: "failed", failureKind: "terminal" } as never,
      }),
    ),
    "error",
  );
});

test("graph returns retrieval and tool results to Planner through their normal loop edges", () => {
  assert.equal(routeAfterRetrieve(baseState()), "nextActionPlanner");
  assert.equal(
    routeAfterTool(
      baseState({
        lastToolExecution: { status: "completed", failureKind: undefined } as never,
      }),
    ),
    "nextActionPlanner",
  );
});
