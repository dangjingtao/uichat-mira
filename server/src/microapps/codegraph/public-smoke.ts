import { CodebaseExploreWrapper } from "@/mcp/managed-codegraph/codebase-explore-wrapper.js";
import {
  toAgentRetrievalEvidenceFromVerification,
  verifyCodebaseExploreResult,
} from "@/mcp/managed-codegraph/codegraph-verification-bridge.js";
import {
  getRepoLocalManagedCodeGraphManagerForStudio,
  type RepoLocalManagedContext,
} from "@/mcp/managed-codegraph/repo-local-manager-cache.js";
import { isRealCodeGraphCommand } from "@/mcp/managed-codegraph/repo-local-process-manager.js";
import type {
  CodeGraphStudioService,
  CodeGraphStudioSmokeResult,
} from "./index.js";
import { normalizeCodeGraphStudioReport } from "./public-report.js";

const extractToolText = (payload: {
  content?: Array<{ type?: string; text?: string }>;
}) =>
  (payload.content ?? [])
    .map((entry) => entry.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();

const resolveStudioManager = async (service: CodeGraphStudioService) => {
  const report = normalizeCodeGraphStudioReport(await service.getReport());
  const workspaceRoot = report.config.workspaceRoot;
  const context = service.getManagedCapabilityContext(workspaceRoot);

  if (context.ok) {
    return {
      report,
      manager: context.manager,
    };
  }

  const manager = await getRepoLocalManagedCodeGraphManagerForStudio(
    workspaceRoot,
    context as RepoLocalManagedContext,
  );
  return {
    report,
    manager,
  };
};

const getNormalizedReport = async (service: CodeGraphStudioService) =>
  normalizeCodeGraphStudioReport(await service.getReport());

export const runCodeGraphStudioSmokeStatus = async (
  service: CodeGraphStudioService,
): Promise<CodeGraphStudioSmokeResult> => {
  if (!isRealCodeGraphCommand(service.getDraft().command)) {
    const result = await service.smokeStatus();
    return {
      ...result,
      report: normalizeCodeGraphStudioReport(result.report),
    };
  }

  try {
    await service.start();
    const { manager } = await resolveStudioManager(service);
    if (!manager) {
      return {
        kind: "status",
        ok: false,
        message: "CodeGraph managed runtime is unavailable.",
        payload: null,
        report: await getNormalizedReport(service),
      };
    }

    const started = await manager.start();
    if (started.status !== "ready") {
      return {
        kind: "status",
        ok: false,
        message: started.lastError ?? `CodeGraph runtime status: ${started.status}`,
        payload: started,
        report: await getNormalizedReport(service),
      };
    }

    const payload = await manager.callTool("codegraph_status", {});
    return {
      kind: "status",
      ok: !payload.isError,
      message: payload.isError
        ? extractToolText(payload) || "CodeGraph status tool reported an error."
        : "CodeGraph runtime and project index are ready.",
      payload,
      report: await getNormalizedReport(service),
    };
  } catch (error) {
    return {
      kind: "status",
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      payload: null,
      report: await getNormalizedReport(service),
    };
  }
};

export const runCodeGraphStudioSmokeQuery = async (
  service: CodeGraphStudioService,
  query: string,
): Promise<CodeGraphStudioSmokeResult> => {
  if (!isRealCodeGraphCommand(service.getDraft().command)) {
    const result = await service.smokeQuery(query);
    return {
      ...result,
      report: normalizeCodeGraphStudioReport(result.report),
    };
  }

  try {
    await service.start();
    const { report, manager } = await resolveStudioManager(service);
    if (!manager) {
      return {
        kind: "query",
        ok: false,
        message: "CodeGraph managed runtime is unavailable.",
        payload: null,
        report: await getNormalizedReport(service),
      };
    }

    const started = await manager.start();
    if (started.status !== "ready") {
      return {
        kind: "query",
        ok: false,
        message: started.lastError ?? `CodeGraph runtime status: ${started.status}`,
        payload: started,
        report: await getNormalizedReport(service),
      };
    }

    const wrapper = new CodebaseExploreWrapper(manager);
    const exploreResult = await wrapper.explore({
      query,
      maxFiles: report.config.maxResults,
      maxSnippets: Math.max(report.config.maxResults, report.config.queryLimit),
    });
    const verification = verifyCodebaseExploreResult(exploreResult, {
      workspaceRoot: report.config.workspaceRoot,
    });
    const retrieval = toAgentRetrievalEvidenceFromVerification(verification);

    return {
      kind: "query",
      ok: exploreResult.status === "ok" && !exploreResult.degraded,
      message:
        exploreResult.status === "ok" && !exploreResult.degraded
          ? `CodeGraph smoke query completed with ${verification.verified.length} verified candidate(s).`
          : exploreResult.followUpHints[0] ?? "CodeGraph smoke query degraded.",
      payload: {
        query: exploreResult.query,
        scope: exploreResult.scope,
        status: exploreResult.status,
        candidateCount: exploreResult.candidates.length,
        verifiedCount: verification.verified.length,
        rejectedCount: verification.rejected.length,
        unverifiableCount: verification.unverifiable.length,
        retrievalChunkCount: retrieval.chunkCount,
        fallbackSignal: exploreResult.fallbackSignal,
        limitations: exploreResult.limitations,
      },
      report: await getNormalizedReport(service),
    };
  } catch (error) {
    return {
      kind: "query",
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      payload: null,
      report: await getNormalizedReport(service),
    };
  }
};
