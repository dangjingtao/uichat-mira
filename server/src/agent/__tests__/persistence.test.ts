import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { beforeEach, afterEach, test, vi } from "vitest";
import { initializeAuthDatabase } from "@/db/auth.db";
import { resetDatabaseClients } from "@/db/index";
import { initializeKnowledgeBaseDatabase } from "@/db/knowledge-base.db";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { initializeRoleDatabase } from "@/db/role.db";
import { initializeThreadDatabase } from "@/db/thread.db";
import { getSqlite } from "@/db/index";
import { hasSqliteColumn } from "@/db/sqlite-utils";
import { threadService } from "@/services/thread.service";
import { configureAgentRunPersistence, agentRunStore } from "../run-store";
import { agentRunRepository } from "@/db/repositories/agent-run.repository";
import { createAgentGoal, createAgentPlan } from "../nodes/index";
import { getAgentRunById } from "../run-read";
import { persistAgentAssistantState, resumeApprovedAgentRun } from "../resume";
import { agentGraph } from "../graph";
import { createInvocationInputHash } from "../approval-fingerprint";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";

const originalDatabaseUrl = process.env.DATABASE_URL;
let activeDbPath: string | null = null;

const createTempDbPath = () =>
  createTimestampedTestArtifactPath(
    "db",
    `agent-persistence-${Math.random().toString(16).slice(2)}`,
    ".sqlite",
  );

const setupDb = () => {
  const dbPath = createTempDbPath();
  process.env.DATABASE_URL = `file:${dbPath}`;
  resetDatabaseClients();
  initializeAuthDatabase();
  initializeModelConfigDatabase();
  initializeKnowledgeBaseDatabase();
  initializeRoleDatabase();
  initializeThreadDatabase();
  configureAgentRunPersistence({
    create: (run) => {
      agentRunRepository.createPersistedRun(run);
    },
    get: agentRunRepository.get.bind(agentRunRepository),
    update: agentRunRepository.update.bind(agentRunRepository),
    addObservation: agentRunRepository.addObservation.bind(agentRunRepository),
    complete: agentRunRepository.complete.bind(agentRunRepository),
  });
  activeDbPath = dbPath;
  return dbPath;
};

beforeEach(() => {
  agentRunStore.clear();
});

afterEach(() => {
  configureAgentRunPersistence(undefined);
  agentRunStore.clear();
  resetDatabaseClients();
  if (originalDatabaseUrl) {
    process.env.DATABASE_URL = originalDatabaseUrl;
  } else {
    delete process.env.DATABASE_URL;
  }
  if (activeDbPath) {
    for (const suffix of ["", "-shm", "-wal"]) {
      const candidate = `${activeDbPath}${suffix}`;
      if (fs.existsSync(candidate)) {
        try {
          fs.rmSync(candidate, { force: true });
        } catch {
          // Ignore Windows file lock timing in tests after explicit DB close.
        }
      }
    }
  }
  activeDbPath = null;
});

const createPersistedWaitingApprovalRun = (options?: {
  withRuntimeInput?: boolean;
  pendingToolCall?: Record<string, unknown>;
  pendingApproval?: Record<string, unknown>;
}) => {
  const dbPath = setupDb();
  const thread = threadService.createThread({
    userId: 1,
    title: "agent persistence",
  });
  const goal = createAgentGoal("answer the user");
  const run = agentRunStore.create({
    threadId: thread.id,
    userId: 1,
    goal,
    plan: createAgentPlan(goal),
    assistantMessageId: "assistant-persisted-1",
    assistantParentId: "user-persisted-1",
    ...(options?.withRuntimeInput === false
      ? {}
      : {
          runtimeInput: {
            messages: [
              {
                role: "user",
                content: "hello",
                parts: [{ type: "text", text: "hello" }],
              },
            ],
            params: {},
          },
        }),
  });

  agentRunStore.update(run.id, {
    status: "waiting_approval",
    currentStepId: "approval",
    selectedToolId: "web-search",
    pendingApproval: {
      id: "approval-1",
      runId: run.id,
      stepId: "approval",
      toolId: "web-search",
      toolCallId: "pending-1",
      reason: "needs approval",
      input: { query: "hello" },
      inputHash: createInvocationInputHash({ query: "hello" }),
      createdAt: "2026-06-28T00:00:00.000Z",
      ...(options?.pendingApproval ?? {}),
    },
    pendingToolCall: {
      id: "pending-1",
      toolId: "web-search",
      args: { query: "hello" },
      inputHash: createInvocationInputHash({ query: "hello" }),
      source: "planner",
      status: "frozen",
      createdAt: "2026-06-28T00:00:00.000Z",
      ...(options?.pendingToolCall ?? {}),
    },
  });

  agentRunStore.clear();
  resetDatabaseClients();
  process.env.DATABASE_URL = `file:${dbPath}`;
  activeDbPath = dbPath;

  return run;
};

test("getAgentRunById reads from repository when in-memory run is missing", () => {
  const run = createPersistedWaitingApprovalRun();

  const restored = getAgentRunById(run.id);

  assert.ok(restored);
  assert.equal(restored?.id, run.id);
  assert.equal(restored?.status, "waiting_approval");
  assert.equal(restored?.pendingApproval?.toolId, "web-search");
});

test("resumeApprovedAgentRun can continue from repository after in-memory state is lost", async () => {
  const run = createPersistedWaitingApprovalRun();
  threadService.createMessage(run.threadId, 1, {
    id: "user-persisted-1",
    role: "user",
    content: "hello",
    parts: [{ type: "text", text: "hello" }],
  });
  threadService.createMessage(run.threadId, 1, {
    id: "assistant-persisted-1",
    parentId: "user-persisted-1",
    role: "assistant",
    content: "等待审批",
    parts: [{ type: "text", text: "等待审批" }],
    metadata: {
      agent: {
        status: "waiting_approval",
        runId: run.id,
      },
    },
  });

  const runSpy = vi.spyOn(agentGraph, "run").mockResolvedValue({
    answer: "done",
    observations: [],
    evidence: {
      observations: [],
      toolExecutions: [],
      retrievals: [],
    },
    retrievedChunks: [],
    status: "completed",
    contextBudget: {
      policy: "task-chat",
      model: "test-model",
      providerCode: "test-provider",
      modelContextTokens: 8192,
      reservedOutputTokens: 1024,
      maxInputTokens: 7168,
      totalEstimatedTokensBefore: 120,
      totalEstimatedTokensAfter: 90,
      sections: [],
      warnings: [],
    },
  } as never);

  try {
    const result = await resumeApprovedAgentRun(run.id);

    assert.equal(runSpy.mock.calls.length, 1);
    assert.equal(runSpy.mock.calls[0]?.[0].selectedToolId, "web-search");
    assert.equal(result.run?.status, "completed");
    assert.equal(result.run?.pendingApproval, undefined);
    assert.equal(result.run?.pendingToolCall, undefined);
    assert.equal(result.run?.currentStepId, undefined);
    assert.equal(result.run?.selectedToolId, "web-search");
    agentRunStore.clear();
    const restored = getAgentRunById(run.id);
    assert.equal(restored?.status, "completed");
    assert.equal(restored?.pendingApproval, undefined);
    assert.equal(restored?.pendingToolCall, undefined);
    assert.equal(restored?.currentStepId, undefined);
    const persistedThread = threadService.getThreadById(run.threadId, 1);
    const assistantMessage = persistedThread?.messages.find(
      (message) => message.id === "assistant-persisted-1",
    );
    assert.ok(assistantMessage);
    assert.equal(assistantMessage?.content, "done");
    assert.equal(
      (assistantMessage?.metadata.agent as { status?: string } | undefined)
        ?.status,
      "completed",
    );
  } finally {
    runSpy.mockRestore();
  }
});

test("resumeApprovedAgentRun fails hard when persisted run misses runtime input", async () => {
  const run = createPersistedWaitingApprovalRun({
    withRuntimeInput: false,
  });

  await assert.rejects(
    () => resumeApprovedAgentRun(run.id),
    /AgentRun missing runtime input/,
  );
});

test("resumeApprovedAgentRun fails hard when run does not exist in memory or repository", async () => {
  setupDb();

  await assert.rejects(
    () => resumeApprovedAgentRun("missing-run"),
    /AgentRun not found/,
  );
});

test("persisted reject clears approval state across repository reload", () => {
  const run = createPersistedWaitingApprovalRun();

  const next = agentRunStore.complete(run.id, {
    status: "blocked",
    currentStepId: undefined,
    pendingApproval: undefined,
    pendingToolCall: undefined,
    selectedToolId: undefined,
    blockedReason: "User rejected the pending approval request.",
    terminalReason: "approval_rejected",
  });

  persistAgentAssistantState({
    run: next,
    status: "blocked",
    content: "你已拒绝这次需要审批的工具调用，工具没有执行。",
    blockedReason: "User rejected the pending approval request.",
    terminalReason: "approval_rejected",
  });

  agentRunStore.clear();
  const restored = getAgentRunById(run.id);

  assert.equal(restored?.status, "blocked");
  assert.equal(restored?.pendingApproval, undefined);
  assert.equal(restored?.pendingToolCall, undefined);
  assert.equal(restored?.currentStepId, undefined);
  assert.equal(restored?.selectedToolId, undefined);
  assert.equal(restored?.terminalReason, "approval_rejected");
});

test("mismatch approval clears persisted approval state across repository reload", async () => {
  const run = createPersistedWaitingApprovalRun({
    pendingApproval: {
      toolCallId: "pending-other",
    },
    pendingToolCall: {
      id: "pending-actual",
    },
  });

  const runSpy = vi.spyOn(agentGraph, "run");

  try {
    await assert.rejects(
      () => resumeApprovedAgentRun(run.id),
      /approved toolCallId pending-other does not match frozen pendingToolCall\.id pending-actual/i,
    );
    assert.equal(runSpy.mock.calls.length, 0);

    agentRunStore.clear();
    const restored = getAgentRunById(run.id);
    assert.equal(restored?.status, "blocked");
    assert.equal(restored?.pendingApproval, undefined);
    assert.equal(restored?.pendingToolCall, undefined);
    assert.equal(restored?.currentStepId, undefined);
    assert.equal(restored?.selectedToolId, undefined);
    assert.equal(restored?.terminalReason, "approval_resume_mismatch");
  } finally {
    runSpy.mockRestore();
  }
});

test("initializeThreadDatabase upgrades legacy agent_runs columns for execution state", () => {
  const dbPath = createTempDbPath();
  process.env.DATABASE_URL = `file:${dbPath}`;
  resetDatabaseClients();
  initializeAuthDatabase();
  initializeModelConfigDatabase();
  initializeKnowledgeBaseDatabase();
  initializeRoleDatabase();

  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE agent_runs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      thread_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      goal_json TEXT NOT NULL,
      plan_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      observations_json TEXT NOT NULL DEFAULT '[]',
      trace_id TEXT NOT NULL,
      current_step_id TEXT,
      blocked_reason TEXT,
      terminal_reason TEXT,
      pending_approval_json TEXT,
      approved_tool_ids_json TEXT NOT NULL DEFAULT '[]',
      context_budget_json TEXT,
      selected_capability_id TEXT,
      assistant_message_id TEXT,
      assistant_parent_id TEXT,
      runtime_input_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  initializeThreadDatabase();

  assert.equal(hasSqliteColumn(sqlite, "agent_runs", "pending_tool_call_json"), true);
  assert.equal(hasSqliteColumn(sqlite, "agent_runs", "last_tool_execution_json"), true);
  assert.equal(hasSqliteColumn(sqlite, "agent_runs", "selected_tool_id"), true);
  assert.equal(hasSqliteColumn(sqlite, "agent_runs", "blocked_reason"), true);
  assert.equal(hasSqliteColumn(sqlite, "agent_runs", "terminal_reason"), true);
  activeDbPath = dbPath;
});
