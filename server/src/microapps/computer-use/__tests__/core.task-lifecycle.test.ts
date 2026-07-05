import assert from "node:assert/strict";
import { test } from "vitest";
import {
  canTransitionComputerUseTaskStatus,
  createPlanningComputerUseTask,
  isTerminalComputerUseTaskStatus,
  markComputerUsePlanReady,
  transitionComputerUseTask,
} from "../core/task-lifecycle.js";
import { createComputerUsePlan } from "../core/planning.js";

test("computer use task lifecycle enforces expected transitions", () => {
  assert.equal(canTransitionComputerUseTaskStatus("planning", "queued"), true);
  assert.equal(canTransitionComputerUseTaskStatus("queued", "running"), true);
  assert.equal(canTransitionComputerUseTaskStatus("running", "blocked"), true);
  assert.equal(
    canTransitionComputerUseTaskStatus("awaiting_approval", "queued"),
    false,
  );
  assert.equal(isTerminalComputerUseTaskStatus("blocked"), true);
  assert.equal(isTerminalComputerUseTaskStatus("succeeded"), true);
  assert.equal(isTerminalComputerUseTaskStatus("running"), false);
});

test("computer use task lifecycle creates planning task and marks task queued after planning", () => {
  const task = createPlanningComputerUseTask({
    id: "task-1",
    goal: "Open example.com and capture pricing",
    siteScope: ["example.com"],
    runtime: {
      status: "ready",
      checkedAt: "2026-07-06T12:00:00.000Z",
    },
    createdAt: "2026-07-06T12:00:00.000Z",
  });
  const plan = createComputerUsePlan({
    createdAt: "2026-07-06T12:00:01.000Z",
    summary: "Navigate to site and capture pricing details.",
    steps: [
      {
        id: "step-1",
        title: "Open site",
        description: "Navigate to example.com",
        status: "pending",
        requiresApproval: false,
      },
    ],
  });

  const plannedTask = markComputerUsePlanReady(
    task,
    plan,
    "2026-07-06T12:00:02.000Z",
  );

  assert.equal(plannedTask.status, "queued");
  assert.equal(plannedTask.plan?.summary, "Navigate to site and capture pricing details.");
  assert.equal(plannedTask.evidence.entries.length, 0);
});

test("computer use task lifecycle rejects invalid transitions", () => {
  const task = createPlanningComputerUseTask({
    id: "task-2",
    goal: "Goal",
    runtime: {
      status: "ready",
      checkedAt: "2026-07-06T12:00:00.000Z",
    },
    createdAt: "2026-07-06T12:00:00.000Z",
  });

  assert.throws(() =>
    transitionComputerUseTask(task, "succeeded", {
      at: "2026-07-06T12:00:01.000Z",
    }),
  );
});
