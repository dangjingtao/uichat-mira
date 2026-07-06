import assert from "node:assert/strict";
import { test } from "vitest";
import {
  buildExecutionObservationView,
  toExecutionObservationFromObservation,
  toExecutionObservationFromPendingApproval,
  toExecutionObservationFromRetrievalResult,
  toExecutionObservationFromToolExecution,
} from "../node-runtime";

test("maps retrieve result into a completed execution observation with preview fields", () => {
  const observation = toExecutionObservationFromRetrievalResult({
    knowledgeBaseId: "kb-1",
    query: "inspect docs",
    chunkCount: 2,
    chunks: [
      {
        chunkId: "c1",
        documentName: "README.md",
        content: "doc one",
      },
      {
        chunkId: "c2",
        documentName: "docs/README.md",
        content: "doc two",
      },
    ],
    createdAt: "2026-07-06T10:00:00.000Z",
  });

  assert.equal(observation.source, "retrieval");
  assert.equal(observation.actionType, "retrieve");
  assert.equal(observation.status, "completed");
  assert.deepEqual(observation.argsPreview, {
    query: "inspect docs",
    knowledgeBaseId: "kb-1",
  });
  assert.deepEqual(observation.resultPreview, {
    query: "inspect docs",
    chunkCount: 2,
    documents: ["README.md", "docs/README.md"],
  });
});

test("maps empty retrieve result into a failed_recoverable execution observation", () => {
  const observation = toExecutionObservationFromRetrievalResult({
    knowledgeBaseId: "kb-1",
    query: "missing target",
    chunkCount: 0,
    chunks: [],
    createdAt: "2026-07-06T10:00:00.000Z",
  });

  assert.equal(observation.actionType, "retrieve");
  assert.equal(observation.status, "failed_recoverable");
  assert.equal(observation.recoverable, true);
  assert.deepEqual(observation.suggestedNextActions, [
    "refine_retrieval_query",
    "switch_to_local_evidence_or_tool",
  ]);
});

test("maps generate observation into a failed_terminal execution observation", () => {
  const observation = toExecutionObservationFromObservation({
    id: "obs-1",
    runId: "run-1",
    stepId: "generate",
    status: "failed",
    facts: ["Agent final answer generation failed."],
    errorMessage: "provider unavailable",
    createdAt: "2026-07-06T10:00:00.000Z",
  });

  assert.equal(observation.source, "observation");
  assert.equal(observation.actionType, "generate");
  assert.equal(observation.status, "failed_terminal");
  assert.equal(observation.errorMessage, "provider unavailable");
  assert.equal(observation.recoverable, false);
});

test("maps completed tool execution into a completed execution observation", () => {
  const observation = toExecutionObservationFromToolExecution({
    toolCallId: "tool-call-1",
    toolId: "read_open",
    inputHash: "hash-read-open",
    args: { path: "README.md" },
    status: "completed",
    summary: {
      source: "tool",
      status: "completed",
      toolId: "read_open",
      inputHash: "hash-read-open",
      actionTaken: "Opened README.md.",
      keyFindings: ["contentLength=120"],
      answerReadiness: {
        canAnswer: true,
        reason: "Opened file content is available for answer generation.",
      },
      data: {
        kind: "read_open",
        path: "README.md",
        contentPreview: "hello",
        contentLength: 5,
        truncated: false,
        canAnswerFileQuestion: true,
      },
    },
    result: { type: "open", path: "README.md" },
    startedAt: "2026-07-06T10:00:00.000Z",
    finishedAt: "2026-07-06T10:00:01.000Z",
  });

  assert.equal(observation.source, "tool_execution");
  assert.equal(observation.actionType, "tool");
  assert.equal(observation.status, "completed");
  assert.equal(observation.toolId, "read_open");
  assert.equal(observation.toolCallId, "tool-call-1");
  assert.equal(observation.inputHash, "hash-read-open");
  assert.deepEqual(observation.argsPreview, { path: "README.md" });
  assert.deepEqual(observation.resultPreview, {
    kind: "read_open",
    path: "README.md",
    contentPreview: "hello",
    contentLength: 5,
    truncated: false,
    canAnswerFileQuestion: true,
  });
});

test("maps failed recoverable tool execution into a failed_recoverable execution observation", () => {
  const observation = toExecutionObservationFromToolExecution({
    toolCallId: "tool-call-recoverable",
    toolId: "terminal_session",
    inputHash: "hash-terminal",
    args: { command: "pnpm test" },
    status: "failed",
    errorMessage: "missing script: test",
    result: {
      command: "pnpm test",
      exitCode: 1,
      stderr: "missing script: test",
    },
    startedAt: "2026-07-06T10:00:00.000Z",
    finishedAt: "2026-07-06T10:00:01.000Z",
  });

  assert.equal(observation.status, "failed_recoverable");
  assert.equal(observation.recoverable, true);
  assert.equal(observation.errorMessage, "missing script: test");
  assert.deepEqual(observation.suggestedNextActions, [
    "inspect_failure_cause",
    "retry_with_adjustment",
    "switch_action",
  ]);
});

test("maps terminal blocking tool execution into a failed_terminal execution observation", () => {
  const observation = toExecutionObservationFromToolExecution({
    toolCallId: "tool-call-denied",
    toolId: "workspace_mutation",
    inputHash: "hash-write",
    args: { targetPath: "README.md" },
    status: "denied",
    errorMessage: "Policy denied the write.",
    startedAt: "2026-07-06T10:00:00.000Z",
    finishedAt: "2026-07-06T10:00:01.000Z",
  });

  assert.equal(observation.status, "failed_terminal");
  assert.equal(observation.errorMessage, "Policy denied the write.");
  assert.equal(observation.errorCode, "denied");
  assert.equal(observation.recoverable, false);
});

test("maps pending approval into a waiting_approval execution observation", () => {
  const observation = toExecutionObservationFromPendingApproval(
    {
      id: "approval-1",
      runId: "run-1",
      stepId: "approval",
      toolId: "terminal_session",
      toolCallId: "tool-call-3",
      inputHash: "hash-terminal",
      reason: "Needs approval before running.",
      input: { command: "dir" },
      createdAt: "2026-07-06T10:00:02.000Z",
    },
    undefined,
  );

  assert.equal(observation.source, "approval");
  assert.equal(observation.actionType, "approval");
  assert.equal(observation.status, "waiting_approval");
  assert.deepEqual(observation.argsPreview, { command: "dir" });
  assert.deepEqual(observation.suggestedNextActions, [
    "wait_for_approval",
    "resume_after_approval",
  ]);
});

test("buildExecutionObservationView treats evidence structures as fact sources and emits a unified planner view", () => {
  const observations = buildExecutionObservationView({
    observations: [],
    evidence: {
      observations: [
        {
          id: "obs-generate-1",
          runId: "run-1",
          stepId: "generate",
          status: "failed",
          facts: ["Agent final answer generation failed."],
          errorMessage: "provider unavailable",
          createdAt: "2026-07-06T10:00:03.000Z",
        },
      ],
      retrievals: [
        {
          knowledgeBaseId: "kb-1",
          query: "inspect docs",
          chunkCount: 1,
          chunks: [
            {
              chunkId: "c1",
              documentName: "README.md",
              content: "doc one",
            },
          ],
          createdAt: "2026-07-06T10:00:00.000Z",
        },
      ],
      toolExecutions: [],
    },
    lastToolExecution: {
      toolCallId: "tool-call-1",
      toolId: "read_open",
      inputHash: "hash-read-open",
      args: { path: "README.md" },
      status: "completed",
      result: { type: "open", path: "README.md" },
      startedAt: "2026-07-06T10:00:01.000Z",
      finishedAt: "2026-07-06T10:00:02.000Z",
    },
    pendingApproval: {
      id: "approval-1",
      runId: "run-1",
      stepId: "approval",
      toolId: "terminal_session",
      toolCallId: "tool-call-2",
      inputHash: "hash-terminal",
      reason: "Needs approval before running.",
      createdAt: "2026-07-06T10:00:04.000Z",
    },
  });

  assert.deepEqual(
    observations.map((item) => [item.actionType, item.source, item.status]),
    [
      ["retrieve", "retrieval", "completed"],
      ["tool", "tool_execution", "completed"],
      ["generate", "observation", "failed_terminal"],
      ["approval", "approval", "waiting_approval"],
    ],
  );
});
