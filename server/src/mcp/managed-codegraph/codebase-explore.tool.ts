import type { AgentEvidenceSummary, AgentRetrievalEvidence } from "@/agent/types";
import { getActiveCodeGraphStudioService } from "@/microapps/codegraph/index.js";
import type { McpToolImplementation } from "../core/definitions.js";
import { mcpBadRequest, mcpInternalError } from "../core/errors.js";
import {
  type CodebaseExploreTrace,
  type CodebaseVerificationResult,
} from "./types.js";
import { CodebaseExploreWrapper } from "./codebase-explore-wrapper.js";
import {
  toAgentRetrievalEvidenceFromVerification,
  verifyCodebaseExploreResult,
} from "./codegraph-verification-bridge.js";
import {
  resolveManagedCodeGraphPlannerConfig,
} from "./planner-exposure-config.js";
import { createCodebaseExploreTrace } from "./codegraph-trace-diagnostics.js";
import type {
  ManagedCodeGraphProcessManager,
} from "./repo-local-process-manager.js";
import {
  getRepoLocalManagedCodeGraphManager,
  type RepoLocalManagedContext,
} from "./repo-local-manager-cache.js";

const nowIso = () => new Date().toISOString();

const createCodebaseExploreRetrievalSummary = (input: {
  retrieval: AgentRetrievalEvidence;
  verification: CodebaseVerificationResult;
  exploreTrace: CodebaseExploreTrace;
  verificationTrace: CodebaseExploreTrace;
}): AgentEvidenceSummary => {
  const documentsPreview = input.retrieval.chunks
    .slice(0, 5)
    .map((chunk) => chunk.documentName);
  const partial =
    input.exploreTrace.status !== "ok" ||
    input.verificationTrace.status !== "ok" ||
    input.exploreTrace.fallbackUsed;

  return {
    source: "retrieval",
    status: partial ? "partial" : "completed",
    actionTaken: `Codebase explore verified ${input.retrieval.chunkCount} workspace chunk(s) for "${input.retrieval.query}".`,
    keyFindings: [
      `verifiedChunkCount=${input.retrieval.chunkCount}`,
      `verifiedCandidateCount=${input.verification.verified.length}`,
      `rejectedCandidateCount=${input.verification.rejected.length}`,
      `unverifiableCandidateCount=${input.verification.unverifiable.length}`,
      `exploreStatus=${input.exploreTrace.status}`,
      `verificationStatus=${input.verificationTrace.status}`,
      ...(input.exploreTrace.fallbackReason
        ? [`fallbackReason=${input.exploreTrace.fallbackReason}`]
        : []),
      ...documentsPreview.map((name) => `document=${name}`),
    ],
    data: {
      kind: "retrieval",
      query: input.retrieval.query,
      chunkCount: input.retrieval.chunkCount,
      documentsPreview,
    },
  };
};

export const codebaseExploreTool: McpToolImplementation = {
  definition: {
    id: "codebase_explore",
    title: "Codebase Explore",
    description:
      "Explore code architecture, symbols, relationships, and impact through the controlled CodeGraph wrapper. Returned candidates are re-read from the workspace before they enter Agent Evidence.",
    domain: "read",
    source: "internal",
    mode: "sync",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
    },
    tags: ["codebase", "codegraph", "architecture", "explore", "verification"],
    capabilities: {
      sideEffect: "none",
      requiresApproval: false,
      workspaceBound: true,
    },
  },
  execute: async (context) => {
    const queryValue = context.args.query;
    if (typeof queryValue !== "string" || !queryValue.trim()) {
      throw mcpBadRequest("query is required");
    }

    const workspaceRoot = context.environment?.workspace.rootPath?.trim();
    if (!workspaceRoot) {
      throw mcpInternalError(
        "codebase_explore requires a resolved workspace root in the harness environment.",
      );
    }

    const studioService = getActiveCodeGraphStudioService();
    const plannerConfig = resolveManagedCodeGraphPlannerConfig(workspaceRoot);
    const managedContext = studioService?.getManagedCapabilityContext(workspaceRoot) ?? null;
    let manager: ManagedCodeGraphProcessManager | null = null;
    let runtimeMode: "studio" | "repo_local" = "studio";

    if (managedContext?.ok) {
      manager = managedContext.manager;
    } else if (managedContext) {
      manager = await getRepoLocalManagedCodeGraphManager(
        workspaceRoot,
        managedContext as RepoLocalManagedContext,
      );
      runtimeMode = "repo_local";
    }

    if (!manager) {
      const gateReasonRecord = managedContext?.gate.reasons ?? [];
      const prioritizedGateReason =
        gateReasonRecord.find((reason) => reason.code === "repo_pollution_risk") ??
        gateReasonRecord.find((reason) => reason.code === "app_data_root_unavailable") ??
        gateReasonRecord.find((reason) => reason.code === "workspace_mismatch") ??
        gateReasonRecord[0];
      const blockedReason =
        prioritizedGateReason?.message ??
        plannerConfig.externalIndexSupport.reason ??
        plannerConfig.storage.reason ??
        "Managed CodeGraph runtime is unavailable.";
      const trace = createCodebaseExploreTrace({
        originalQuery: queryValue,
        normalizedQuery: queryValue.trim(),
        selectedScope: ["workspace-general"],
        includePaths: [],
        excludePaths: [],
        internalCommand: "mixed",
        resultCount: 0,
        truncated: false,
        limitations: ["provider_unavailable", "query_failed"],
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
        verificationReadCount: 0,
        durationMs: 0,
        status: "failed",
        runtimeStatus: {
          providerVersion: null,
          telemetryStatus: "unavailable",
          workspaceHash: null,
          status: "blocked",
        },
      });
      const retrieval = {
        query: queryValue.trim(),
        chunkCount: 0,
        chunks: [],
        createdAt: nowIso(),
      };

      return {
        evidence: {
          actionTaken: `Attempted controlled CodeGraph exploration for "${queryValue.trim()}".`,
          facts: [
            "capabilityId=codebase_explore",
            "plannerExposure=controlled_tool_only",
            "verifiedChunkCount=0",
          ],
          gaps: [blockedReason],
          status: "partial",
          data: {
            kind: "codebase_explore",
            runtimeMode: "unavailable",
            fallbackRequired: true,
          },
        },
        result: {
          capabilityId: "codebase_explore",
          plannerExposure: "controlled_tool_only",
          query: queryValue.trim(),
          scope: ["workspace-general"],
          verifiedEvidenceInput: retrieval,
          retrievalEvidence: retrieval,
          exploreResult: {
            status: "degraded",
            truncated: false,
            degraded: true,
            limitations: ["provider_unavailable", "query_failed"],
            followUpHints: [blockedReason],
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
            runtimeMode: "unavailable",
            explore: trace,
            verification: trace,
          },
        },
      };
    }

    const wrapper = new CodebaseExploreWrapper(manager);
    const exploreResult = await wrapper.explore({
      query: queryValue,
    });
    const verification = verifyCodebaseExploreResult(exploreResult, {
      workspaceRoot,
    });
    const retrieval = toAgentRetrievalEvidenceFromVerification(verification);
    retrieval.createdAt = nowIso();
    const retrievalSummary = createCodebaseExploreRetrievalSummary({
      retrieval,
      verification,
      exploreTrace: exploreResult.trace,
      verificationTrace: verification.trace,
    });
    retrieval.summary = retrievalSummary;

    context.addArtifact({
      kind: "search-results",
      title: `Codebase explore trace for ${queryValue.trim()}`,
      data: {
        runtimeMode,
        exploreTrace: exploreResult.trace,
        verificationTrace: verification.trace,
      },
      metadata: {
        capabilityId: "codebase_explore",
        plannerExposure: "controlled_tool_only",
        verifiedChunkCount: retrieval.chunkCount,
        runtimeMode,
      },
    });

    return {
      evidence: {
        actionTaken: retrievalSummary.actionTaken,
        facts: retrievalSummary.keyFindings,
        ...(retrievalSummary.gaps?.length
          ? { gaps: retrievalSummary.gaps }
          : {}),
        status:
          retrievalSummary.status === "completed" ? "completed" : "partial",
        data: {
          kind: "codebase_explore",
          runtimeMode,
          query: retrieval.query,
          verifiedChunkCount: retrieval.chunkCount,
        },
      },
      result: {
        capabilityId: "codebase_explore",
        plannerExposure: "controlled_tool_only",
        query: exploreResult.query,
        scope: exploreResult.scope,
        verifiedEvidenceInput: retrieval,
        retrievalEvidence: retrieval,
        exploreResult: {
          status: exploreResult.status,
          truncated: exploreResult.truncated,
          degraded: exploreResult.degraded,
          limitations: exploreResult.limitations,
          followUpHints: exploreResult.followUpHints,
          fallbackSignal: exploreResult.fallbackSignal,
        },
        verificationResult: {
          verifiedCount: verification.verified.length,
          rejectedCount: verification.rejected.length,
          unverifiableCount: verification.unverifiable.length,
        },
        trace: {
          exposureMode: "controlled_tool_only",
          runtimeMode,
          explore: exploreResult.trace,
          verification: verification.trace,
        },
      },
    };
  },
};
