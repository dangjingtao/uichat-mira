import assert from "node:assert/strict";
import { test } from "vitest";
import { reduceAgentCoverageState } from "../../coverage-state";
import { getCoverageTransitionDecision } from "../coverage-transition";
import type { AgentToolExposureState, PlannerObservationRecoveryContext } from "../../types";

const baseToolExposure = (exposedTools: string[]): AgentToolExposureState => ({
  exposedTools,
  toolMeta: exposedTools.map((toolId) => ({
    toolId,
    title: toolId,
    description: toolId,
  })),
});

const baseRecovery = (
  overrides: Partial<PlannerObservationRecoveryContext> = {},
): PlannerObservationRecoveryContext => ({
  source: "none",
  attemptCount: 0,
  maxAttempts: 1,
  exhausted: false,
  ...overrides,
});

test("coverage transition selects read_open for explicit read_content target", () => {
  const coverageState = reduceAgentCoverageState({
    question: "README.md 的内容是什么？",
  });

  const decision = getCoverageTransitionDecision({
    question: "README.md 的内容是什么？",
    coverageState,
    toolExposure: baseToolExposure(["read_open", "read_locate"]),
    recovery: baseRecovery(),
    iteration: 0,
    maxIterations: 3,
  });

  assert.deepEqual(decision.nextAction, {
    type: "use_tool",
    toolId: "read_open",
    args: { path: "README.md" },
    reason: "Coverage transition: open README.md to satisfy the file-content request.",
  });
});

test("coverage transition selects read_open for the remaining unopened target in a multi-file request", () => {
  const coverageState = reduceAgentCoverageState({
    question: "README.md 和 AGENTS.md 的内容分别是什么？",
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolId: "read_open",
          args: { path: "README.md" },
          status: "completed",
          summary: {
            source: "tool",
            status: "completed",
            toolId: "read_open",
            actionTaken: "Opened README.md.",
            keyFindings: ["path=README.md"],
            answerReadiness: { canAnswer: true, reason: "Opened." },
            data: {
              kind: "read_open",
              path: "README.md",
              contentPreview: "readme",
              contentLength: 6,
              truncated: false,
              keySections: [],
              canAnswerFileQuestion: true,
            },
          },
          startedAt: "2026-07-09T00:00:00.000Z",
          finishedAt: "2026-07-09T00:00:01.000Z",
        },
      ],
    },
  });

  const decision = getCoverageTransitionDecision({
    question: "README.md 和 AGENTS.md 的内容分别是什么？",
    coverageState,
    toolExposure: baseToolExposure(["read_open", "read_locate"]),
    recovery: baseRecovery(),
    iteration: 0,
    maxIterations: 3,
  });

  assert.deepEqual(decision.nextAction, {
    type: "use_tool",
    toolId: "read_open",
    args: { path: "AGENTS.md" },
    reason: "Coverage transition: open AGENTS.md to satisfy the file-content request.",
  });
});

test("coverage transition selects read_locate for locate-only requests", () => {
  const coverageState = reduceAgentCoverageState({
    question: "README.md 在哪里？",
  });

  const decision = getCoverageTransitionDecision({
    question: "README.md 在哪里？",
    coverageState,
    toolExposure: baseToolExposure(["read_locate"]),
    recovery: baseRecovery(),
    iteration: 0,
    maxIterations: 3,
  });

  assert.deepEqual(decision.nextAction, {
    type: "use_tool",
    toolId: "read_locate",
    args: { query: "README.md" },
    reason: "Coverage transition: locate the remaining target before continuing.",
  });
});

test("coverage transition selects workspace_mutation for explicit delete requests", () => {
  const coverageState = reduceAgentCoverageState({
    question: "删除 notes.txt",
  });

  const decision = getCoverageTransitionDecision({
    question: "删除 notes.txt",
    coverageState,
    toolExposure: baseToolExposure(["workspace_mutation", "read_locate"]),
    recovery: baseRecovery(),
    iteration: 0,
    maxIterations: 3,
  });

  assert.deepEqual(decision.nextAction, {
    type: "use_tool",
    toolId: "workspace_mutation",
    args: {
      operation: "delete",
      targetPath: "notes.txt",
    },
    reason: "Coverage transition: execute the required delete mutation on notes.txt before answering.",
  });
});

test("coverage transition selects read_open for mutation verification after mutation completed", () => {
  const coverageState = reduceAgentCoverageState({
    question: "写入 notes.txt 后验证内容是否正确",
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolId: "workspace_mutation",
          args: { operation: "write", targetPath: "notes.txt" },
          status: "completed",
          summary: {
            source: "tool",
            status: "completed",
            toolId: "workspace_mutation",
            actionTaken: "Wrote notes.txt.",
            keyFindings: ["targetPath=notes.txt"],
            answerReadiness: { canAnswer: true, reason: "Mutated." },
            data: {
              kind: "workspace_mutation",
              operation: "write",
              targetPath: "notes.txt",
              dryRun: false,
              changed: true,
              canAnswerMutationQuestion: true,
            },
          },
          startedAt: "2026-07-09T00:00:00.000Z",
          finishedAt: "2026-07-09T00:00:01.000Z",
        },
      ],
    },
  });

  const decision = getCoverageTransitionDecision({
    question: "写入 notes.txt 后验证内容是否正确",
    coverageState,
    toolExposure: baseToolExposure(["read_open"]),
    recovery: baseRecovery(),
    iteration: 0,
    maxIterations: 3,
  });

  assert.deepEqual(decision.nextAction, {
    type: "use_tool",
    toolId: "read_open",
    args: { path: "notes.txt" },
    reason: "Coverage transition: open notes.txt to verify the mutation result before answering.",
  });
});

test("coverage transition does not continue while approval is pending", () => {
  const coverageState = reduceAgentCoverageState({
    question: "README.md 的内容是什么？",
  });

  const decision = getCoverageTransitionDecision({
    question: "README.md 的内容是什么？",
    coverageState,
    toolExposure: baseToolExposure(["read_open"]),
    recovery: baseRecovery(),
    pendingApproval: { id: "approval-1" },
    iteration: 0,
    maxIterations: 3,
  });

  assert.equal(decision.nextAction, undefined);
});

test("coverage transition normalizes polite external search requests into a stable web query", () => {
  const coverageState = reduceAgentCoverageState({
    question: "请联网搜索今天最新的 release notes",
  });

  const decision = getCoverageTransitionDecision({
    question: "请联网搜索今天最新的 release notes",
    coverageState,
    toolExposure: baseToolExposure(["web_search"]),
    recovery: baseRecovery(),
    iteration: 0,
    maxIterations: 3,
  });

  assert.deepEqual(decision.nextAction, {
    type: "use_tool",
    toolId: "web_search",
    args: { query: "latest release notes" },
    reason: "Coverage transition: gather the requested external search evidence before answering.",
  });
});
