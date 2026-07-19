import path from "node:path";

import { CodebaseExploreWrapper } from "@/mcp/managed-codegraph/codebase-explore-wrapper.js";
import {
  toAgentRetrievalEvidenceFromVerification,
  verifyCodebaseExploreResult,
} from "@/mcp/managed-codegraph/codegraph-verification-bridge.js";
import {
  createManagedCodeGraphPlannerStorageFromAppDataRoot,
  resolveManagedCodeGraphExternalIndexSupport,
  resolveManagedCodeGraphPlannerConfig,
} from "@/mcp/managed-codegraph/planner-exposure-config.js";
import {
  getRepoLocalManagedCodeGraphManagerForStudio,
  type RepoLocalRuntimeContext,
} from "@/mcp/managed-codegraph/repo-local-manager-cache.js";
import {
  createManagedCodeGraphWorkspaceHash,
  isRealCodeGraphCommand,
} from "@/mcp/managed-codegraph/repo-local-process-manager.js";
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

const createWorkspaceRuntimeContext = (
  service: CodeGraphStudioService,
  workspaceRoot: string,
): RepoLocalRuntimeContext => {
  const draft = service.getDraft();
  const workspaceHash = createManagedCodeGraphWorkspaceHash(workspaceRoot);
  const plannerConfig = resolveManagedCodeGraphPlannerConfig(workspaceRoot);
  const plannerStorage = draft.appDataRoot.trim()
    ? createManagedCodeGraphPlannerStorageFromAppDataRoot(
        workspaceHash,
        draft.appDataRoot,
      )
    : plannerConfig.storage;

  return {
    draft: {
      command: draft.command,
      startArgs: [...draft.startArgs],
      versionProbeArgs: [...draft.versionProbeArgs],
      telemetryProbeArgs: [...draft.telemetryProbeArgs],
      timeoutMs: draft.timeoutMs,
    },
    plannerStorage,
    externalIndexSupport: resolveManagedCodeGraphExternalIndexSupport(draft.command),
  };
};

const resolveStudioManager = async (
  service: CodeGraphStudioService,
  workspacePath?: string,
) => {
  const report = normalizeCodeGraphStudioReport(await service.getReport());
  const workspaceRoot = path.resolve(
    workspacePath?.trim() || report.config.workspaceRoot,
  );
  const manager = await getRepoLocalManagedCodeGraphManagerForStudio(
    workspaceRoot,
    createWorkspaceRuntimeContext(service, workspaceRoot),
  );
  return {
    report,
    manager,
    workspaceRoot,
  };
};

const getNormalizedReport = async (service: CodeGraphStudioService) =>
  normalizeCodeGraphStudioReport(await service.getReport());

export const runCodeGraphStudioSmokeStatus = async (
  service: CodeGraphStudioService,
  workspacePath?: string,
): Promise<CodeGraphStudioSmokeResult> => {
  if (!isRealCodeGraphCommand(service.getDraft().command)) {
    const result = await service.smokeStatus();
    return {
      ...result,
      report: normalizeCodeGraphStudioReport(result.report),
    };
  }

  try {
    const { manager, workspaceRoot } = await resolveStudioManager(
      service,
      workspacePath,
    );
    if (!manager) {
      return {
        kind: "status",
        ok: false,
        message: "CodeGraph managed runtime is unavailable.",
        payload: { workspaceRoot },
        report: await getNormalizedReport(service),
      };
    }

    const started = await manager.start();
    if (started.status !== "ready") {
      return {
        kind: "status",
        ok: false,
        message: started.lastError ?? `CodeGraph runtime status: ${started.status}`,
        payload: { workspaceRoot, runtime: started },
        report: await getNormalizedReport(service),
      };
    }

    const payload = await manager.callTool("codegraph_status", {});
    return {
      kind: "status",
      ok: !payload.isError,
      message: payload.isError
        ? extractToolText(payload) || "CodeGraph status tool reported an error."
        : `CodeGraph runtime and project index are ready for ${workspaceRoot}.`,
      payload: {
        workspaceRoot,
        result: payload,
      },
      report: await getNormalizedReport(service),
    };
  } catch (error) {
    return {
      kind: "status",
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      payload: workspacePath?.trim()
        ? { workspaceRoot: path.resolve(workspacePath.trim()) }
        : null,
      report: await getNormalizedReport(service),
    };
  }
};

export const runCodeGraphStudioSmokeQuery = async (
  service: CodeGraphStudioService,
  query: string,
  workspacePath?: string,
): Promise<CodeGraphStudioSmokeResult> => {
  if (!isRealCodeGraphCommand(service.getDraft().command)) {
    const result = await service.smokeQuery(query);
    return {
      ...result,
      report: normalizeCodeGraphStudioReport(result.report),
    };
  }

  try {
    const { report, manager, workspaceRoot } = await resolveStudioManager(
      service,
      workspacePath,
    );
    if (!manager) {
      return {
        kind: "query",
        ok: false,
        message: "CodeGraph managed runtime is unavailable.",
        payload: { workspaceRoot },
        report: await getNormalizedReport(service),
      };
    }

    const started = await manager.start();
    if (started.status !== "ready") {
      return {
        kind: "query",
        ok: false,
        message: started.lastError ?? `CodeGraph runtime status: ${started.status}`,
        payload: { workspaceRoot, runtime: started },
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
      workspaceRoot,
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
        workspaceRoot,
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
      payload: workspacePath?.trim()
        ? { workspaceRoot: path.resolve(workspacePath.trim()) }
        : null,
      report: await getNormalizedReport(service),
    };
  }
};
