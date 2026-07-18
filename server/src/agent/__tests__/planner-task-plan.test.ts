import assert from "node:assert/strict";
import { test } from "vitest";
import type { CurrentTaskFrame } from "../types";
import {
  applyPlannerTaskPlan,
  getPlannerTaskPlanDiagnostics,
  parsePlannerTaskPlanUpdate,
  withPlannerTaskPlanContract,
} from "../planner/task-plan";

test("planner task plan parses semantic plan metadata without changing nextAction", () => {
  const update = parsePlannerTaskPlanUpdate({
    type: "use_tool",
    toolId: "read_open",
    args: { path: "server/src/agent/planner/node.ts" },
    reason: "Inspect the planner implementation for the active subgoal.",
    plan: {
      items: [
        {
          id: "P1",
          title: "Locate the planner control path",
          status: "completed",
          completionCriteria: ["Planner entry point is identified"],
        },
        {
          id: "P2",
          title: "Verify how plan state advances after Evidence",
          status: "pending",
          completionCriteria: ["State transition is verified from source"],
        },
      ],
      activeItemId: "P2",
      revisionReason: "P1 is covered by existing evidence.",
    },
  });

  assert.ok(update);
  assert.equal(update.activeItemId, "P2");
  assert.equal(update.items[0]?.status, "completed");
  assert.equal(update.items[1]?.status, "in_progress");
});

test("planner task plan persists semantic progress in currentTaskFrame", () => {
  const frame: CurrentTaskFrame = {
    currentGoal: "Review the Pi-loop planner",
    currentSubtask: "Determine the next action",
    confirmedObjects: [],
    completionCriteria: ["Explain the real planner flow"],
  };

  const updated = applyPlannerTaskPlan(frame, {
    items: [
      {
        id: "P1",
        title: "Locate planner entry",
        status: "completed",
      },
      {
        id: "P2",
        title: "Trace Evidence back into Planner",
        status: "in_progress",
      },
      {
        id: "P3",
        title: "Form the final diagnosis",
        status: "pending",
      },
    ],
    activeItemId: "P2",
  });

  assert.ok(updated);
  assert.equal(updated.currentSubtask, "Trace Evidence back into Planner");
  assert.deepEqual(updated.remainingWork, [
    "Trace Evidence back into Planner",
    "Form the final diagnosis",
  ]);
  assert.match(updated.coveredProgress?.join("\n") ?? "", /Plan completed: Locate planner entry/);

  const diagnostics = getPlannerTaskPlanDiagnostics(updated);
  assert.equal(diagnostics.planItemCount, 3);
  assert.equal(diagnostics.activePlanItemId, "P2");
  assert.equal(diagnostics.completedPlanItemCount, 1);
});

test("planner task plan contract forbids implicit memory-file wandering", () => {
  const messages = withPlannerTaskPlanContract([
    {
      role: "system",
      content: "Return one nextAction JSON and do not output extra fields.",
      parts: [],
    },
    {
      role: "user",
      content: "Inspect the agent runtime.",
      parts: [],
    },
  ]);

  const system = messages[0]?.content ?? "";
  assert.match(system, /persistent semantic task plan/i);
  assert.match(system, /docs\/ENGINEERING_MEMORY\.md/);
  assert.match(system, /Do NOT search for or open/i);
  assert.match(system, /only allowed extra top-level field/i);
});
