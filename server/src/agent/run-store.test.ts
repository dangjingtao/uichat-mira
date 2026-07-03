import assert from "node:assert/strict";
import { test } from "vitest";
import { InMemoryAgentRunStore } from "./run-store.js";

test("InMemoryAgentRunStore creates and updates agent runs", () => {
  const store = new InMemoryAgentRunStore();
  const run = store.create({
    threadId: "thread-1",
    userId: 1,
    goal: {
      id: "goal-1",
      text: "answer the user",
      successCriteria: ["return an answer"],
      constraints: ["stay safe"],
      riskLevel: "low",
    },
    plan: {
      id: "plan-1",
      goalId: "goal-1",
      version: 1,
      steps: [],
    },
  });

  assert.equal(run.status, "queued");
  assert.ok(run.id);
  assert.ok(run.traceId);

  const updated = store.update(run.id, {
    status: "running",
    currentStepId: "retrieve",
  });

  assert.equal(updated.status, "running");
  assert.equal(updated.currentStepId, "retrieve");
  assert.equal(store.get(run.id)?.status, "running");
});

test("InMemoryAgentRunStore preserves approval and context budget state", () => {
  const store = new InMemoryAgentRunStore();
  const run = store.create({
    threadId: "thread-1",
    userId: 1,
    goal: {
      id: "goal-1",
      text: "answer the user",
      successCriteria: ["return an answer"],
      constraints: ["stay safe"],
      riskLevel: "low",
    },
    plan: {
      id: "plan-1",
      goalId: "goal-1",
      version: 1,
      steps: [],
    },
  });

  const updated = store.update(run.id, {
    status: "waiting_approval",
    selectedCapabilityId: "web-search",
    pendingApproval: {
      id: "approval-1",
      runId: run.id,
      stepId: "tool-1",
      toolId: "web-search",
      reason: "needs approval",
      createdAt: "2026-06-28T00:00:00.000Z",
      input: { query: "agent design" },
    },
    approvedToolIds: ["web-search"],
    contextBudget: {
      policy: "task-chat",
      model: "test-model",
      providerCode: "test-provider",
      modelContextTokens: 8192,
      reservedOutputTokens: 1024,
      maxInputTokens: 7168,
      totalEstimatedTokensBefore: 3000,
      totalEstimatedTokensAfter: 2800,
      sections: [],
      warnings: ["trimmed history"],
    },
  });

  assert.equal(updated.status, "waiting_approval");
  assert.equal(updated.selectedCapabilityId, "web-search");
  assert.deepEqual(updated.approvedToolIds, ["web-search"]);
  assert.deepEqual(updated.pendingApproval?.toolId, "web-search");
  assert.deepEqual(updated.contextBudget?.policy, "task-chat");
  assert.equal(store.get(run.id)?.pendingApproval?.reason, "needs approval");
});

test("InMemoryAgentRunStore appends observations", () => {
  const store = new InMemoryAgentRunStore();
  const run = store.create({
    threadId: "thread-1",
    userId: 1,
    goal: {
      id: "goal-1",
      text: "answer the user",
      successCriteria: ["return an answer"],
      constraints: ["stay safe"],
      riskLevel: "low",
    },
    plan: {
      id: "plan-1",
      goalId: "goal-1",
      version: 1,
      steps: [],
    },
  });

  const next = store.addObservation(run.id, {
    id: "obs-1",
    runId: run.id,
    stepId: "retrieve",
    status: "ok",
    facts: ["retrieved 3 chunks"],
    createdAt: new Date().toISOString(),
  });

  assert.equal(next.observations.length, 1);
  assert.deepEqual(next.observations[0]?.facts, ["retrieved 3 chunks"]);
});

test("InMemoryAgentRunStore completes runs with final status", () => {
  const store = new InMemoryAgentRunStore();
  const run = store.create({
    threadId: "thread-1",
    userId: 1,
    goal: {
      id: "goal-1",
      text: "answer the user",
      successCriteria: ["return an answer"],
      constraints: ["stay safe"],
      riskLevel: "low",
    },
    plan: {
      id: "plan-1",
      goalId: "goal-1",
      version: 1,
      steps: [],
    },
  });

  const next = store.complete(run.id, {
    status: "blocked",
    currentStepId: undefined,
    pendingApproval: undefined,
  });

  assert.equal(next.status, "blocked");
  assert.equal(store.get(run.id)?.status, "blocked");
});

test("InMemoryAgentRunStore sweeps completed runs beyond retention limit", () => {
  const store = new InMemoryAgentRunStore();
  store.configureRetention?.({
    maxEntries: 1,
    ttlMs: 1000 * 60 * 30,
  });

  const first = store.create({
    threadId: "thread-1",
    userId: 1,
    goal: {
      id: "goal-1",
      text: "answer the user",
      successCriteria: ["return an answer"],
      constraints: ["stay safe"],
      riskLevel: "low",
    },
    plan: {
      id: "plan-1",
      goalId: "goal-1",
      version: 1,
      steps: [],
    },
  });
  store.complete(first.id, {
    status: "completed",
    pendingApproval: undefined,
  });

  const second = store.create({
    threadId: "thread-2",
    userId: 2,
    goal: {
      id: "goal-2",
      text: "answer the user",
      successCriteria: ["return an answer"],
      constraints: ["stay safe"],
      riskLevel: "low",
    },
    plan: {
      id: "plan-2",
      goalId: "goal-2",
      version: 1,
      steps: [],
    },
  });
  store.complete(second.id, {
    status: "completed",
    pendingApproval: undefined,
  });

  store.sweep?.();

  assert.equal(store.get(first.id), undefined);
  assert.ok(store.get(second.id));
});
