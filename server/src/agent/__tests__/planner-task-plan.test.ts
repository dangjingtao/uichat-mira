import assert from "node:assert/strict";
import { test } from "vitest";
import type { CurrentTaskFrame } from "../types";
import {
  applyPlannerTaskPlan,
  getPlannerTaskPlanDiagnostics,
  parsePlannerTaskPlanUpdate,
  withPlannerTaskPlanContract,
} from "../planner/task-plan";

test("planner task plan parses a minimal todo patch without changing nextAction", () => {
  const patch = parsePlannerTaskPlanUpdate({
    type: "use_tool",
    toolId: "read_open",
    args: { path: "server/src/agent/planner/node.ts" },
    reason: "Inspect the planner implementation for the current todo item.",
    planPatch: {
      addItems: [
        { id: "P1", text: "Locate the planner control path" },
        { id: "P2", text: "Verify how results return to the model context" },
      ],
      completeIds: ["P1"],
    },
  });

  assert.ok(patch);
  assert.equal(patch.addItems?.length, 2);
  assert.deepEqual(patch.completeIds, ["P1"]);
});

test("runtime-owned planList keeps item identity and only tracks text plus done", () => {
  const frame: CurrentTaskFrame = {
    currentGoal: "Review the Pi-loop planner",
    currentSubtask: "Determine the next action",
    confirmedObjects: [],
    completionCriteria: ["Explain the real planner flow"],
  };

  const initialized = applyPlannerTaskPlan(frame, {
    addItems: [
      { id: "P1", text: "Locate planner entry" },
      { id: "P2", text: "Trace tool results back into model context" },
      { id: "P3", text: "Form the final diagnosis" },
    ],
  });
  assert.ok(initialized);

  const updated = applyPlannerTaskPlan(initialized, {
    // Duplicate ids cannot rewrite runtime-owned todo text.
    addItems: [{ id: "P1", text: "REWRITTEN TITLE" }],
    completeIds: ["P1"],
  });

  assert.ok(updated);
  assert.equal(updated.currentSubtask, "Trace tool results back into model context");
  assert.deepEqual(updated.remainingWork, [
    "Trace tool results back into model context",
    "Form the final diagnosis",
  ]);

  const runtimeFrame = updated as CurrentTaskFrame & {
    planList?: Array<{ id: string; text: string; done: boolean }>;
  };
  assert.deepEqual(runtimeFrame.planList, [
    { id: "P1", text: "Locate planner entry", done: true },
    { id: "P2", text: "Trace tool results back into model context", done: false },
    { id: "P3", text: "Form the final diagnosis", done: false },
  ]);

  const diagnostics = getPlannerTaskPlanDiagnostics(updated);
  assert.equal(diagnostics.planItemCount, 3);
  assert.equal(diagnostics.activePlanItemId, "P2");
  assert.equal(diagnostics.completedPlanItemCount, 1);
});

test("planner contract keeps plan light and injects continuous action/result context", () => {
  const payload = {
    currentUserRequest: "Inspect the agent runtime.",
    observationContext: {
      currentTaskFrame: {
        currentGoal: "Inspect the agent runtime",
        confirmedObjects: [],
        completionCriteria: ["Explain the runtime"],
        planList: [{ id: "P1", text: "Locate planner", done: false }],
      },
      executionHistory: [
        {
          actionType: "tool",
          toolId: "read_open",
          status: "completed",
          argsPreview: { path: "server/src/agent/planner/node.ts" },
          summary: {
            status: "completed",
            actionTaken: "Opened planner node",
            keyFindings: ["Planner loops after Evidence"],
          },
        },
      ],
      latestEvidenceContent: {
        source: "continuous",
        content: "REAL_TOOL_BODY_MARKER",
      },
      accumulatedActionLedger: {
        totalExecutionObservations: 1,
        entries: [{ toolId: "read_open", target: "server/src/agent/planner/node.ts" }],
      },
    },
  };

  const messages = withPlannerTaskPlanContract([
    {
      role: "system",
      content: "Return one nextAction JSON and do not output extra fields.",
      parts: [],
    },
    {
      role: "user",
      content: JSON.stringify(payload),
      parts: [],
    },
  ]);

  const joined = messages.map((message) => message.content).join("\n");
  assert.match(joined, /lightweight runtime-owned todo list/i);
  assert.match(joined, /Each item is only \{id, text, done\}/i);
  assert.match(joined, /planPatch schema/i);
  assert.match(joined, /CONTINUOUS AGENT LOOP CONTEXT/);
  assert.match(joined, /REAL_TOOL_BODY_MARKER/);
  assert.match(joined, /ENGINEERING_MEMORY\.md/);

  const rewrittenPayload = JSON.parse(messages.at(-1)?.content ?? "{}") as {
    observationContext?: Record<string, unknown>;
    continuousAgentContextInjected?: boolean;
  };
  assert.equal(rewrittenPayload.continuousAgentContextInjected, true);
  assert.equal("executionHistory" in (rewrittenPayload.observationContext ?? {}), false);
  assert.equal("latestEvidenceContent" in (rewrittenPayload.observationContext ?? {}), false);
});
