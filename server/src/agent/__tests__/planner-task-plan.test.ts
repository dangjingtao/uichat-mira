import assert from "node:assert/strict";
import { test } from "vitest";
import type { CurrentTaskFrame } from "../types";
import {
  applyPlannerTaskPlan,
  getPlannerTaskPlanDiagnostics,
  parsePlannerTaskPlanUpdate,
  withPlannerTaskPlanContract,
} from "../planner/task-plan";

test("planner task plan parses patch metadata without changing nextAction", () => {
  const patch = parsePlannerTaskPlanUpdate({
    type: "use_tool",
    toolId: "read_open",
    args: { path: "server/src/agent/planner/node.ts" },
    reason: "Inspect the planner implementation for the active subgoal.",
    planPatch: {
      addItems: [
        {
          id: "P1",
          title: "Locate the planner control path",
          status: "pending",
          completionCriteria: ["Planner entry point is identified"],
        },
        {
          id: "P2",
          title: "Verify how plan state advances after Evidence",
          status: "pending",
          completionCriteria: ["State transition is verified from source"],
        },
      ],
      updates: [{ id: "P1", status: "completed" }],
      activeItemId: "P2",
      revisionReason: "P1 is covered by existing evidence.",
    },
  });

  assert.ok(patch);
  assert.equal(patch.activeItemId, "P2");
  assert.equal(patch.addItems?.length, 2);
  assert.deepEqual(patch.updates, [{ id: "P1", status: "completed" }]);
});

test("runtime-owned planList preserves old item identity and applies patches", () => {
  const frame: CurrentTaskFrame = {
    currentGoal: "Review the Pi-loop planner",
    currentSubtask: "Determine the next action",
    confirmedObjects: [],
    completionCriteria: ["Explain the real planner flow"],
  };

  const initialized = applyPlannerTaskPlan(frame, {
    addItems: [
      { id: "P1", title: "Locate planner entry", status: "pending" },
      {
        id: "P2",
        title: "Trace Evidence back into Planner",
        status: "pending",
      },
      { id: "P3", title: "Form the final diagnosis", status: "pending" },
    ],
    activeItemId: "P1",
  });
  assert.ok(initialized);

  const updated = applyPlannerTaskPlan(initialized, {
    // A duplicate add cannot rewrite the runtime-owned item title.
    addItems: [{ id: "P1", title: "REWRITTEN TITLE", status: "pending" }],
    updates: [{ id: "P1", status: "completed" }],
    activeItemId: "P2",
  });

  assert.ok(updated);
  assert.equal(updated.currentSubtask, "Trace Evidence back into Planner");
  assert.deepEqual(updated.remainingWork, [
    "Trace Evidence back into Planner",
    "Form the final diagnosis",
  ]);
  assert.match(
    updated.coveredProgress?.join("\n") ?? "",
    /Plan completed: Locate planner entry/,
  );

  const runtimeFrame = updated as CurrentTaskFrame & {
    planList?: Array<{ id: string; title: string; status: string }>;
  };
  assert.equal(runtimeFrame.planList?.[0]?.title, "Locate planner entry");

  const diagnostics = getPlannerTaskPlanDiagnostics(updated);
  assert.equal(diagnostics.planItemCount, 3);
  assert.equal(diagnostics.activePlanItemId, "P2");
  assert.equal(diagnostics.completedPlanItemCount, 1);
});

test("planner contract injects continuous action/result context and forbids implicit memory-file wandering", () => {
  const payload = {
    currentUserRequest: "Inspect the agent runtime.",
    observationContext: {
      currentTaskFrame: {
        currentGoal: "Inspect the agent runtime",
        confirmedObjects: [],
        completionCriteria: ["Explain the runtime"],
        planList: [
          { id: "P1", title: "Locate planner", status: "in_progress" },
        ],
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
        source: "tool",
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
  assert.match(joined, /runtime-owned planList/i);
  assert.match(joined, /planPatch schema/i);
  assert.match(joined, /CONTINUOUS AGENT LOOP CONTEXT/);
  assert.match(joined, /REAL_TOOL_BODY_MARKER/);
  assert.match(joined, /docs\/ENGINEERING_MEMORY\.md/);
  assert.match(joined, /Do NOT search for or open/i);

  const rewrittenPayload = JSON.parse(messages.at(-1)?.content ?? "{}") as {
    observationContext?: Record<string, unknown>;
    continuousAgentContextInjected?: boolean;
  };
  assert.equal(rewrittenPayload.continuousAgentContextInjected, true);
  assert.equal("executionHistory" in (rewrittenPayload.observationContext ?? {}), false);
  assert.equal("latestEvidenceContent" in (rewrittenPayload.observationContext ?? {}), false);
});
