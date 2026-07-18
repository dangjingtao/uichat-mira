import assert from "node:assert/strict";
import { test } from "vitest";
import { projectHarnessResultForLlm } from "@/harness/llm-content";
import type { AgentExecutionObservation } from "../types";
import type { AgentGraphState } from "../node-runtime";
import {
  buildPlannerAccumulatedActionLedger,
  buildPlannerLatestEvidenceContent,
} from "../planner/runtime-memory";

const createReadObservation = (input: {
  id: string;
  path: string;
  inputHash: string;
  createdAt: string;
}): AgentExecutionObservation => ({
  id: input.id,
  source: "tool_execution",
  actionType: "tool",
  status: "completed",
  createdAt: input.createdAt,
  toolId: "read_open",
  toolCallId: input.id,
  inputHash: input.inputHash,
  argsPreview: { path: input.path },
  summary: {
    source: "tool",
    status: "completed",
    toolId: "read_open",
    inputHash: input.inputHash,
    actionTaken: `Opened file ${input.path}.`,
    keyFindings: [`contentLength=${100 + Number(input.id.replace(/\D/g, "") || 0)}`],
  },
});

test("planner accumulated action ledger survives the recent execution window and collapses repeated semantic targets", () => {
  const observations: AgentExecutionObservation[] = [];

  for (let index = 0; index < 15; index += 1) {
    observations.push(
      createReadObservation({
        id: `call-${index}`,
        path: index === 0 || index === 14 ? "src/entry.ts" : `src/file-${index}.ts`,
        inputHash: `hash-${index}`,
        createdAt: `2026-07-19T00:00:${String(index).padStart(2, "0")}.000Z`,
      }),
    );
  }

  const ledger = buildPlannerAccumulatedActionLedger(observations);
  const entry = ledger.entries.find(
    (item) => item.toolId === "read_open" && item.target === "src/entry.ts",
  );

  assert.equal(ledger.totalExecutionObservations, 15);
  assert.equal(ledger.uniqueSemanticActions, 14);
  assert.equal(ledger.repeatedSemanticActions, 1);
  assert.ok(entry);
  assert.equal(entry.attempts, 2);
  assert.deepEqual(entry.inputHashes, ["hash-0", "hash-14"]);
});

test("planner latest evidence content exposes canonical bounded tool output beyond the Evidence preview", () => {
  const longSource = `${"A".repeat(600)}\nEND_MARKER_FROM_REAL_TOOL_RESULT`;
  const result = {
    type: "open",
    path: "src/entry.ts",
    source: { text: longSource },
  };
  const state = {
    evidence: {
      observations: [],
      retrievals: [],
      toolExecutions: [
        {
          toolCallId: "call-read-open",
          toolId: "read_open",
          inputHash: "hash-read-open",
          args: { path: "src/entry.ts" },
          status: "completed",
          result,
          llmContent: projectHarnessResultForLlm(result),
          summary: {
            source: "tool",
            status: "truncated",
            toolId: "read_open",
            inputHash: "hash-read-open",
            actionTaken: "Opened file src/entry.ts.",
            keyFindings: [longSource.slice(0, 280)],
            gaps: ["File content is truncated."],
          },
          startedAt: "2026-07-19T00:00:00.000Z",
          finishedAt: "2026-07-19T00:00:01.000Z",
        },
      ],
    },
  } as AgentGraphState;
  const latestObservation = createReadObservation({
    id: "call-read-open",
    path: "src/entry.ts",
    inputHash: "hash-read-open",
    createdAt: "2026-07-19T00:00:01.000Z",
  });

  const content = buildPlannerLatestEvidenceContent(state, latestObservation);

  assert.equal(content?.source, "tool");
  assert.match(content?.content ?? "", /END_MARKER_FROM_REAL_TOOL_RESULT/);
});
