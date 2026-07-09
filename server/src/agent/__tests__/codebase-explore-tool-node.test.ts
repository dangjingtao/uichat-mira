import assert from "node:assert/strict";
import { test, vi } from "vitest";

import * as harnessInvocations from "@/harness/invocations";
import { toolNode } from "../nodes/tool-node";
import type { AgentNodeState } from "../node-runtime";

const createBaseState = (
  overrides: Partial<AgentNodeState> = {},
): AgentNodeState => ({
  runId: "run-codebase-explore",
  threadId: "thread-codebase-explore",
  userId: 1,
  goal: {
    id: "goal-1",
    text: "inspect agent runtime architecture",
    successCriteria: ["inspect agent runtime architecture"],
    constraints: [],
    riskLevel: "low",
  },
  plan: {
    id: "plan-1",
    goalId: "goal-1",
    version: 1,
    steps: [],
  },
  messages: [
    {
      role: "user",
      content: "梳理 planner 和 tool node 的关系",
      parts: [],
    },
  ],
  ...overrides,
});

test("toolNode appends only verified codebase_explore chunks into retrieval evidence", async () => {
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-codebase-explore-1",
      toolId: "codebase_explore",
      status: "completed",
      result: {
        capabilityId: "codebase_explore",
        plannerExposure: "controlled_tool_only",
        query: "梳理 planner 和 tool node 的关系",
        scope: ["agent-runtime"],
        verifiedEvidenceInput: {
          query: "梳理 planner 和 tool node 的关系",
          chunkCount: 1,
          chunks: [
            {
              chunkId: "codegraph:server/src/agent/nodes/tool-node.ts:1-10:0",
              documentName: "server/src/agent/nodes/tool-node.ts",
              score: 0.91,
              content: "export const toolNode = async (...) => { ... }",
            },
          ],
          summary: {
            source: "retrieval",
            status: "partial",
            actionTaken: "Codebase explore verified 1 workspace chunk.",
            keyFindings: ["verifiedChunkCount=1", "fallbackReason=broad_scope_requery_recommended"],
            answerReadiness: {
              canAnswer: false,
              reason: "verified chunks are available for planner review",
              missingInfo: ["planner must decide task completion based on task coverage"],
            },
            data: {
              kind: "retrieval",
              query: "梳理 planner 和 tool node 的关系",
              chunkCount: 1,
              documentsPreview: ["server/src/agent/nodes/tool-node.ts"],
            },
          },
          createdAt: "2026-07-09T00:00:00.000Z",
        },
        exploreResult: {
          status: "partial",
          truncated: false,
          degraded: false,
          limitations: ["broad_query_noise_detected", "requires_follow_up_read"],
          followUpHints: ["当前结果属于 broad explore，建议继续缩 scope 或直接读原文。"],
          fallbackSignal: {
            required: true,
            reason: "broad_scope_requery_recommended",
            suggestedChain: [
              "codegraph",
              "scoped_search_text",
              "workspace_inventory",
              "read_file_slice",
            ],
          },
        },
        verificationResult: {
          verifiedCount: 1,
          rejectedCount: 2,
          unverifiableCount: 1,
        },
        trace: {
          exposureMode: "controlled_tool_only",
          explore: {
            capabilityId: "codebase_explore",
            exposureMode: "controlled_tool_only",
            provider: "codegraph",
            providerVersion: "1.2.3",
            runtimeShape: "managed_mcp",
            workspaceHash: "workspace-hash",
            selectedScope: ["agent-runtime"],
            includePaths: ["server/src/agent/**"],
            excludePaths: ["node_modules/**"],
            originalQuery: "梳理 planner 和 tool node 的关系",
            normalizedQuery: "梳理 planner 和 tool node 的关系",
            internalCommand: "explore",
            resultCount: 1,
            truncated: false,
            limitations: ["broad_query_noise_detected", "requires_follow_up_read"],
            fallbackUsed: true,
            fallbackReason: "broad_scope_requery_recommended",
            verificationRequired: true,
            verificationReadCount: 4,
            status: "partial",
            durationMs: 42,
            indexStatus: "ready",
            telemetryStatus: "verified_off",
          },
          verification: {
            capabilityId: "codebase_explore",
            exposureMode: "controlled_tool_only",
            provider: "codegraph",
            providerVersion: "1.2.3",
            runtimeShape: "managed_mcp",
            workspaceHash: "workspace-hash",
            selectedScope: ["agent-runtime"],
            includePaths: ["server/src/agent/**"],
            excludePaths: ["node_modules/**"],
            originalQuery: "梳理 planner 和 tool node 的关系",
            normalizedQuery: "梳理 planner 和 tool node 的关系",
            internalCommand: "explore",
            resultCount: 1,
            truncated: false,
            limitations: ["broad_query_noise_detected", "requires_follow_up_read"],
            fallbackUsed: true,
            fallbackReason: "broad_scope_requery_recommended",
            verificationRequired: true,
            verificationReadCount: 4,
            status: "partial",
            durationMs: 15,
            indexStatus: "ready",
            telemetryStatus: "verified_off",
          },
        },
      },
      startedAt: "2026-07-09T00:00:00.000Z",
      finishedAt: "2026-07-09T00:00:01.000Z",
    });

  try {
    const result = await toolNode(
      createBaseState({
        policyDecision: {
          type: "allow",
          toolId: "codebase_explore",
          inputHash: "hash-codebase-explore",
          reason: "Allowed in test.",
        },
        pendingToolCall: {
          id: "pending-codebase-explore-1",
          toolId: "codebase_explore",
          args: { query: "梳理 planner 和 tool node 的关系" },
          inputHash: "hash-codebase-explore",
          source: "planner",
          status: "frozen",
          createdAt: "2026-07-09T00:00:00.000Z",
        },
      }),
    );

    assert.equal(executeHarnessInvocationSpy.mock.calls.length, 1);
    assert.equal(result.evidence?.toolExecutions.length, 1);
    assert.equal(result.evidence?.retrievals.length, 1);
    assert.equal(result.evidence?.retrievals[0]?.chunkCount, 1);
    assert.equal(result.retrievedChunks, undefined);
    assert.equal(result.evidence?.latestSummary?.source, "retrieval");
    assert.equal(result.evidence?.latestSummary?.status, "partial");
    assert.equal(result.evidence?.latestSummary?.answerReadiness.canAnswer, false);
    assert.equal(
      result.evidence?.latestSummary?.answerReadiness.reason,
      "verified chunks are available for planner review",
    );
  } finally {
    executeHarnessInvocationSpy.mockRestore();
  }
});

test("toolNode does not append retrieval evidence when codebase_explore verification produced no verified chunks", async () => {
  const executeHarnessInvocationSpy = vi
    .spyOn(harnessInvocations, "executeHarnessInvocation")
    .mockResolvedValue({
      id: "invocation-codebase-explore-2",
      toolId: "codebase_explore",
      status: "completed",
      result: {
        capabilityId: "codebase_explore",
        plannerExposure: "controlled_tool_only",
        query: "梳理 planner 和 tool node 的关系",
        scope: ["agent-runtime"],
        verifiedEvidenceInput: {
          query: "梳理 planner 和 tool node 的关系",
          chunkCount: 0,
          chunks: [],
          createdAt: "2026-07-09T00:00:00.000Z",
        },
        exploreResult: {
          status: "degraded",
          truncated: false,
          degraded: true,
          limitations: ["provider_unavailable", "query_failed"],
          followUpHints: ["CodeGraph 不可用，下一步应走 scoped search_text 或 workspace_inventory。"],
          fallbackSignal: {
            required: true,
            reason: "provider_unavailable",
            suggestedChain: [
              "codegraph",
              "scoped_search_text",
              "workspace_inventory",
              "read_file_slice",
            ],
          },
        },
        verificationResult: {
          verifiedCount: 0,
          rejectedCount: 0,
          unverifiableCount: 0,
        },
        trace: {
          exposureMode: "controlled_tool_only",
          explore: {
            capabilityId: "codebase_explore",
            exposureMode: "controlled_tool_only",
            provider: "codegraph",
            providerVersion: null,
            runtimeShape: "managed_mcp",
            workspaceHash: "workspace-hash",
            selectedScope: ["agent-runtime"],
            includePaths: ["server/src/agent/**"],
            excludePaths: ["node_modules/**"],
            originalQuery: "梳理 planner 和 tool node 的关系",
            normalizedQuery: "梳理 planner 和 tool node 的关系",
            internalCommand: "query",
            resultCount: 0,
            truncated: false,
            limitations: ["provider_unavailable", "query_failed"],
            fallbackUsed: true,
            fallbackReason: "provider_unavailable",
            verificationRequired: true,
            verificationReadCount: 0,
            status: "failed",
            durationMs: 10,
            indexStatus: "blocked",
            telemetryStatus: "verified_off",
          },
          verification: {
            capabilityId: "codebase_explore",
            exposureMode: "controlled_tool_only",
            provider: "codegraph",
            providerVersion: null,
            runtimeShape: "managed_mcp",
            workspaceHash: "workspace-hash",
            selectedScope: ["agent-runtime"],
            includePaths: ["server/src/agent/**"],
            excludePaths: ["node_modules/**"],
            originalQuery: "梳理 planner 和 tool node 的关系",
            normalizedQuery: "梳理 planner 和 tool node 的关系",
            internalCommand: "query",
            resultCount: 0,
            truncated: false,
            limitations: ["provider_unavailable", "query_failed"],
            fallbackUsed: true,
            fallbackReason: "provider_unavailable",
            verificationRequired: true,
            verificationReadCount: 0,
            status: "failed",
            durationMs: 3,
            indexStatus: "blocked",
            telemetryStatus: "verified_off",
          },
        },
      },
      startedAt: "2026-07-09T00:00:00.000Z",
      finishedAt: "2026-07-09T00:00:01.000Z",
    });

  try {
    const result = await toolNode(
      createBaseState({
        policyDecision: {
          type: "allow",
          toolId: "codebase_explore",
          inputHash: "hash-codebase-explore-empty",
          reason: "Allowed in test.",
        },
        pendingToolCall: {
          id: "pending-codebase-explore-2",
          toolId: "codebase_explore",
          args: { query: "梳理 planner 和 tool node 的关系" },
          inputHash: "hash-codebase-explore-empty",
          source: "planner",
          status: "frozen",
          createdAt: "2026-07-09T00:00:00.000Z",
        },
      }),
    );

    assert.equal(result.evidence?.toolExecutions.length, 1);
    assert.equal(result.evidence?.retrievals.length, 0);
    assert.equal(result.retrievedChunks, undefined);
    assert.equal(result.evidence?.latestSummary?.source, "tool");
  } finally {
    executeHarnessInvocationSpy.mockRestore();
  }
});
