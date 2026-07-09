import type { AgentEvidenceSummary, AgentRetrievalEvidence } from "@/agent/types";
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
import { ManagedCodeGraphProcessManager } from "./managed-codegraph-process-manager.js";
import {
  isCodebaseExplorePlannerExposureEnabled,
  resolveManagedCodeGraphPlannerConfig,
} from "./planner-exposure-config.js";

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
    answerReadiness: partial
      ? {
          canAnswer: false,
          reason:
            "Codebase explore only produced partial verified evidence, so the agent must keep narrowing scope or read more original files before answering.",
          missingInfo: ["narrower workspace evidence"],
        }
      : {
          canAnswer: true,
          reason:
            "Verified codebase chunks are available and were confirmed through the verification bridge.",
        },
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
      "Use the managed CodeGraph wrapper to explore relevant workspace areas and return only verification-bridge-ready candidates.",
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
    if (!isCodebaseExplorePlannerExposureEnabled()) {
      throw mcpBadRequest(
        "codebase_explore is disabled. Enable UI_CHAT_CODEGRAPH_PLANNER_ENABLED=1 before exposing it to Planner.",
      );
    }

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

    const plannerConfig = resolveManagedCodeGraphPlannerConfig(workspaceRoot);
    const manager = new ManagedCodeGraphProcessManager({
      command: plannerConfig.command,
      startArgs: plannerConfig.startArgs,
      versionProbe: {
        args: plannerConfig.versionProbeArgs,
      },
      telemetryProbe: {
        args: plannerConfig.telemetryProbeArgs,
      },
      workspaceRoot,
      allowedWorkspaceRoot: workspaceRoot,
      logRoot: plannerConfig.logRoot,
      indexRoot: plannerConfig.indexRoot,
    });
    const wrapper = new CodebaseExploreWrapper(manager);
    const exploreResult = await wrapper.explore({
      query: queryValue,
    });
    const verification = verifyCodebaseExploreResult(exploreResult, {
      workspaceRoot,
    });
    const retrieval = toAgentRetrievalEvidenceFromVerification(verification);
    retrieval.createdAt = nowIso();
    retrieval.summary = createCodebaseExploreRetrievalSummary({
      retrieval,
      verification,
      exploreTrace: exploreResult.trace,
      verificationTrace: verification.trace,
    });

    context.addArtifact({
      kind: "search-results",
      title: `Codebase explore trace for ${queryValue.trim()}`,
      data: {
        exploreTrace: exploreResult.trace,
        verificationTrace: verification.trace,
      },
      metadata: {
        capabilityId: "codebase_explore",
        plannerExposure: "controlled_tool_only",
        verifiedChunkCount: retrieval.chunkCount,
      },
    });

    return {
      result: {
        capabilityId: "codebase_explore",
        plannerExposure: "controlled_tool_only",
        query: exploreResult.query,
        scope: exploreResult.scope,
        verifiedEvidenceInput: retrieval,
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
          explore: exploreResult.trace,
          verification: verification.trace,
        },
      },
    };
  },
};
