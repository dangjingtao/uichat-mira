import assert from "node:assert/strict";
import { test } from "vitest";
import { createComputerUsePlan, createComputerUseApprovalRequest } from "../core/planning.js";
import {
  ComputerUseRuntimeUnavailableError,
  ComputerUseTaskNotFoundError,
  createComputerUseService,
  createInMemoryComputerUseEvidenceStore,
  createInMemoryComputerUseTaskStore,
} from "../core/service.js";
import type {
  ComputerUseExecutor,
  ComputerUseRuntimeManager,
} from "../core/types.js";

const createRuntimeManager = (
  status: "ready" | "not_installed" | "downloading" | "broken" = "ready",
): ComputerUseRuntimeManager => ({
  async getRuntimeState() {
    return {
      status,
      checkedAt: "2026-07-06T12:00:00.000Z",
      message: status === "ready" ? undefined : "runtime missing",
    };
  },
});

test("computer use service creates plan and keeps plan/evidence/result separate", async () => {
  const executor: ComputerUseExecutor = {
    async createPlan({ goal }) {
      return createComputerUsePlan({
        createdAt: "2026-07-06T12:00:01.000Z",
        summary: `Plan for ${goal}`,
        steps: [
          {
            id: "step-open",
            title: "Open target page",
            description: "Navigate to the requested site.",
            status: "pending",
            requiresApproval: false,
          },
        ],
      });
    },
    async runTask({ task }) {
      return {
        status: "succeeded",
        currentStepId: "step-open",
        evidenceEntries: [
          {
            id: "evidence-1",
            kind: "observation",
            message: "Page loaded.",
            createdAt: "2026-07-06T12:00:02.000Z",
            stepId: "step-open",
          },
        ],
        artifacts: [
          {
            id: "artifact-1",
            kind: "screenshot",
            label: "Landing page",
            createdAt: "2026-07-06T12:00:02.000Z",
            filePath: `.test-artifact/${task.id}.png`,
          },
        ],
        result: {
          status: "succeeded",
          summary: "Captured the requested page.",
          completedAt: "2026-07-06T12:00:03.000Z",
          finalUrl: "https://example.com",
        },
      };
    },
  };

  const service = createComputerUseService({
    runtimeManager: createRuntimeManager("ready"),
    executor,
    evidenceStore: createInMemoryComputerUseEvidenceStore(),
    taskStore: createInMemoryComputerUseTaskStore(),
    createId: (() => {
      const ids = ["task-1", "task-2"];
      let index = 0;
      return () => ids[index++] ?? `id-${index}`;
    })(),
    now: (() => {
      const timestamps = [
        "2026-07-06T12:00:00.000Z",
        "2026-07-06T12:00:01.000Z",
        "2026-07-06T12:00:02.000Z",
        "2026-07-06T12:00:03.000Z",
      ];
      let index = 0;
      return () => timestamps[Math.min(index++, timestamps.length - 1)];
    })(),
  });

  const plannedTask = await service.createPlan({
    goal: "Open example.com and capture the home page.",
    siteScope: ["example.com"],
  });
  const completedTask = await service.startTask(plannedTask.id);

  assert.equal(plannedTask.status, "queued");
  assert.equal(plannedTask.plan?.steps.length, 1);
  assert.equal(plannedTask.evidence.entries.length, 0);
  assert.equal(plannedTask.result, undefined);

  assert.equal(completedTask.status, "succeeded");
  assert.equal(completedTask.evidence.entries.length, 1);
  assert.equal(completedTask.evidence.artifacts.length, 1);
  assert.equal(completedTask.result?.summary, "Captured the requested page.");
});

test("computer use service waits for approval and resumes after approval", async () => {
  const calls: string[] = [];
  const executor: ComputerUseExecutor = {
    async createPlan() {
      return createComputerUsePlan({
        createdAt: "2026-07-06T12:00:01.000Z",
        summary: "Need approval before submitting.",
        steps: [
          {
            id: "step-review",
            title: "Review form",
            description: "Check page state.",
            status: "pending",
            requiresApproval: false,
          },
          {
            id: "step-submit",
            title: "Submit form",
            description: "Send the form.",
            status: "pending",
            requiresApproval: true,
            approvalReason: "This action sends data to an external site.",
          },
        ],
      });
    },
    async runTask({ task }) {
      calls.push(`run:${task.id}`);
      return {
        status: "awaiting_approval",
        currentStepId: "step-submit",
        evidenceEntries: [
          {
            id: "evidence-await",
            kind: "approval",
            message: "Waiting for approval to submit the form.",
            createdAt: "2026-07-06T12:00:02.000Z",
            stepId: "step-submit",
          },
        ],
        approvalRequest: createComputerUseApprovalRequest({
          id: "approval-1",
          stepId: "step-submit",
          title: "Approve form submission",
          reason: "This action sends data to an external site.",
          requestedAt: "2026-07-06T12:00:02.000Z",
        }),
      };
    },
    async resumeTask({ approval }) {
      calls.push(`resume:${approval.id}:${approval.status}`);
      return {
        status: "succeeded",
        currentStepId: "step-submit",
        evidenceEntries: [
          {
            id: "evidence-done",
            kind: "action",
            message: "Submitted the form after approval.",
            createdAt: "2026-07-06T12:00:03.000Z",
            stepId: "step-submit",
          },
        ],
        result: {
          status: "succeeded",
          summary: "Form submitted.",
          completedAt: "2026-07-06T12:00:03.000Z",
        },
      };
    },
  };

  const service = createComputerUseService({
    runtimeManager: createRuntimeManager("ready"),
    executor,
    evidenceStore: createInMemoryComputerUseEvidenceStore(),
    taskStore: createInMemoryComputerUseTaskStore(),
    createId: (() => {
      const ids = ["task-approval", "entry-1", "entry-2"];
      let index = 0;
      return () => ids[index++] ?? `id-${index}`;
    })(),
    now: (() => {
      const timestamps = [
        "2026-07-06T12:00:00.000Z",
        "2026-07-06T12:00:01.000Z",
        "2026-07-06T12:00:02.000Z",
        "2026-07-06T12:00:03.000Z",
        "2026-07-06T12:00:04.000Z",
      ];
      let index = 0;
      return () => timestamps[Math.min(index++, timestamps.length - 1)];
    })(),
  });

  const plannedTask = await service.createPlan({
    goal: "Submit a form.",
  });
  const awaitingTask = await service.startTask(plannedTask.id);
  const completedTask = await service.resolveApproval({
    taskId: awaitingTask.id,
    approvalId: "approval-1",
    decision: "approved",
    resolvedBy: "tester",
  });

  assert.deepEqual(calls, [
    "run:task-approval",
    "resume:approval-1:approved",
  ]);
  assert.equal(awaitingTask.status, "awaiting_approval");
  assert.equal(awaitingTask.pendingApproval?.id, "approval-1");
  assert.equal(awaitingTask.approvals.length, 1);
  assert.equal(completedTask.status, "succeeded");
  assert.equal(completedTask.pendingApproval, undefined);
  assert.equal(completedTask.result?.summary, "Form submitted.");
});

test("computer use service cancels task when approval is rejected", async () => {
  const executor: ComputerUseExecutor = {
    async createPlan() {
      return createComputerUsePlan({
        createdAt: "2026-07-06T12:00:01.000Z",
        summary: "Approval flow",
        steps: [
          {
            id: "step-submit",
            title: "Submit",
            description: "Submit action.",
            status: "pending",
            requiresApproval: true,
            approvalReason: "External send",
          },
        ],
      });
    },
    async runTask() {
      return {
        status: "awaiting_approval",
        currentStepId: "step-submit",
        approvalRequest: createComputerUseApprovalRequest({
          id: "approval-2",
          stepId: "step-submit",
          title: "Approve submit",
          reason: "External send",
          requestedAt: "2026-07-06T12:00:02.000Z",
        }),
      };
    },
    async resumeTask() {
      throw new Error("resume should not be called");
    },
  };

  const service = createComputerUseService({
    runtimeManager: createRuntimeManager("ready"),
    executor,
    evidenceStore: createInMemoryComputerUseEvidenceStore(),
    taskStore: createInMemoryComputerUseTaskStore(),
    createId: (() => {
      const ids = ["task-reject", "evidence-reject"];
      let index = 0;
      return () => ids[index++] ?? `id-${index}`;
    })(),
    now: () => "2026-07-06T12:00:00.000Z",
  });

  const plannedTask = await service.createPlan({
    goal: "Do risky action",
  });
  const awaitingTask = await service.startTask(plannedTask.id);
  const cancelledTask = await service.resolveApproval({
    taskId: awaitingTask.id,
    approvalId: "approval-2",
    decision: "rejected",
    resolutionNote: "Do not send data",
  });

  assert.equal(cancelledTask.status, "cancelled");
  assert.equal(cancelledTask.result?.status, "cancelled");
  assert.equal(cancelledTask.approvals[0]?.status, "rejected");
  assert.equal(cancelledTask.evidence.entries.length, 1);
});

test("computer use service rejects missing runtime and missing task lookups", async () => {
  const executor: ComputerUseExecutor = {
    async createPlan() {
      return createComputerUsePlan({
        createdAt: "2026-07-06T12:00:01.000Z",
        summary: "No-op",
        steps: [],
      });
    },
    async runTask() {
      return {
        status: "succeeded",
        result: {
          status: "succeeded",
          summary: "done",
          completedAt: "2026-07-06T12:00:02.000Z",
        },
      };
    },
  };

  const service = createComputerUseService({
    runtimeManager: createRuntimeManager("not_installed"),
    executor,
    evidenceStore: createInMemoryComputerUseEvidenceStore(),
    taskStore: createInMemoryComputerUseTaskStore(),
  });

  await assert.rejects(
    () =>
      service.createPlan({
        goal: "Open site",
      }),
    ComputerUseRuntimeUnavailableError,
  );

  const readyService = createComputerUseService({
    runtimeManager: createRuntimeManager("ready"),
    executor,
    evidenceStore: createInMemoryComputerUseEvidenceStore(),
    taskStore: createInMemoryComputerUseTaskStore(),
  });

  await assert.rejects(() => readyService.startTask("missing"), ComputerUseTaskNotFoundError);
});

test("computer use service preserves blocked as a first-class terminal status", async () => {
  const executor: ComputerUseExecutor = {
    async createPlan() {
      return createComputerUsePlan({
        createdAt: "2026-07-06T12:00:01.000Z",
        summary: "Blocked flow",
        steps: [
          {
            id: "step-runtime",
            title: "Prepare runtime",
            description: "Wait for an external prerequisite.",
            status: "pending",
            requiresApproval: false,
          },
        ],
      });
    },
    async runTask() {
      return {
        status: "blocked",
        currentStepId: "step-runtime",
        evidenceEntries: [
          {
            id: "evidence-blocked",
            kind: "error",
            message: "Execution is blocked by a missing prerequisite.",
            createdAt: "2026-07-06T12:00:02.000Z",
            stepId: "step-runtime",
          },
        ],
        result: {
          status: "blocked",
          summary: "Task is blocked until the missing prerequisite is resolved.",
          completedAt: "2026-07-06T12:00:02.000Z",
          error: {
            code: "COMPUTER_USE_BLOCKED",
            message: "Missing prerequisite.",
          },
        },
      };
    },
  };

  const service = createComputerUseService({
    runtimeManager: createRuntimeManager("ready"),
    executor,
    evidenceStore: createInMemoryComputerUseEvidenceStore(),
    taskStore: createInMemoryComputerUseTaskStore(),
    createId: () => "task-blocked",
    now: (() => {
      const timestamps = [
        "2026-07-06T12:00:00.000Z",
        "2026-07-06T12:00:01.000Z",
        "2026-07-06T12:00:02.000Z",
      ];
      let index = 0;
      return () => timestamps[Math.min(index++, timestamps.length - 1)];
    })(),
  });

  const plannedTask = await service.createPlan({
    goal: "Do a blocked action",
  });
  const blockedTask = await service.startTask(plannedTask.id);

  assert.equal(plannedTask.status, "queued");
  assert.equal(blockedTask.status, "blocked");
  assert.equal(blockedTask.result?.status, "blocked");
  assert.equal(blockedTask.completedAt, "2026-07-06T12:00:02.000Z");
  assert.equal(blockedTask.evidence.entries.length, 1);
});
