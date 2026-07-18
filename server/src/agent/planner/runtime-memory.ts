import {
  getHarnessLlmContentText,
  type HarnessLlmContent,
} from "@/harness/llm-content";
import type {
  AgentExecutionObservation,
  AgentToolExecutionResult,
} from "../types";
import type { AgentGraphState } from "../node-runtime";
import { getToolTraceTargetPreview } from "../trace";

const PLANNER_LATEST_EVIDENCE_CONTENT_CHAR_LIMIT = 12_000;
const PLANNER_ACTION_LEDGER_CHAR_LIMIT = 24_000;
const PLANNER_LEDGER_FINDING_CHAR_LIMIT = 320;

type AgentToolExecutionWithLlmContent = AgentToolExecutionResult & {
  llmContent?: HarnessLlmContent;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const trimPlannerText = (value: string, limit: number) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= limit
    ? normalized
    : `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
};

const getObservationTarget = (observation: AgentExecutionObservation) => {
  if (
    observation.actionType === "tool" &&
    observation.toolId &&
    isRecord(observation.argsPreview)
  ) {
    return getToolTraceTargetPreview(observation.toolId, observation.argsPreview);
  }

  if (
    observation.actionType === "retrieve" &&
    isRecord(observation.argsPreview) &&
    typeof observation.argsPreview.query === "string"
  ) {
    return trimPlannerText(observation.argsPreview.query, 160);
  }

  return undefined;
};

const getSemanticActionKey = (observation: AgentExecutionObservation) => {
  if (isRecord(observation.argsPreview)) {
    const path = observation.argsPreview.path;
    const query = observation.argsPreview.query;

    if (
      observation.actionType === "tool" &&
      observation.toolId?.startsWith("read_") &&
      typeof path === "string" &&
      path.trim()
    ) {
      return `${observation.actionType}:${observation.toolId}:path:${path.trim()}`;
    }

    if (
      (observation.actionType === "retrieve" ||
        observation.toolId === "read_discover" ||
        observation.toolId === "read_locate" ||
        observation.toolId === "codebase_explore") &&
      typeof query === "string" &&
      query.trim()
    ) {
      return `${observation.actionType}:${observation.toolId ?? "retrieval"}:query:${query.trim()}`;
    }
  }

  return [
    observation.actionType,
    observation.toolId ?? "",
    observation.inputHash ?? observation.id,
  ].join(":");
};

/**
 * Compact full-run working ledger rebuilt from accumulated Evidence every Planner turn.
 * It is intentionally separate from the recent execution window: repeated semantic
 * targets collapse into one entry, so long Pi loops remember prior work without replaying
 * every raw executor payload into the task-model context.
 */
export const buildPlannerAccumulatedActionLedger = (
  observations: AgentExecutionObservation[],
  charLimit = PLANNER_ACTION_LEDGER_CHAR_LIMIT,
) => {
  const byAction = new Map<
    string,
    {
      actionType: AgentExecutionObservation["actionType"];
      toolId?: string;
      target?: string;
      status: AgentExecutionObservation["status"];
      attempts: number;
      inputHashes: string[];
      latestActionTaken?: string;
      latestFindings?: string[];
      latestGaps?: string[];
    }
  >();

  for (const observation of observations) {
    const semanticKey = getSemanticActionKey(observation);
    const previous = byAction.get(semanticKey);
    const target = getObservationTarget(observation);
    const inputHashes = [
      ...(previous?.inputHashes ?? []),
      ...(observation.inputHash ? [observation.inputHash.slice(0, 16)] : []),
    ].filter((item, index, items) => item && items.indexOf(item) === index);
    const summary = observation.summary;

    byAction.set(semanticKey, {
      actionType: observation.actionType,
      ...(observation.toolId ? { toolId: observation.toolId } : {}),
      ...(target ? { target } : {}),
      status: observation.status,
      attempts: (previous?.attempts ?? 0) + 1,
      inputHashes,
      ...(summary?.actionTaken
        ? {
            latestActionTaken: trimPlannerText(
              summary.actionTaken,
              PLANNER_LEDGER_FINDING_CHAR_LIMIT,
            ),
          }
        : {}),
      ...(summary?.keyFindings?.length
        ? {
            latestFindings: summary.keyFindings
              .slice(0, 3)
              .map((finding) =>
                trimPlannerText(finding, PLANNER_LEDGER_FINDING_CHAR_LIMIT),
              ),
          }
        : {}),
      ...(summary?.gaps?.length
        ? {
            latestGaps: summary.gaps
              .slice(0, 3)
              .map((gap) => trimPlannerText(gap, PLANNER_LEDGER_FINDING_CHAR_LIMIT)),
          }
        : {}),
    });
  }

  const entries = [...byAction.values()];
  const base = {
    totalExecutionObservations: observations.length,
    uniqueSemanticActions: entries.length,
    repeatedSemanticActions: entries.filter((entry) => entry.attempts > 1).length,
  };
  const selectedEntries: typeof entries = [];
  let usedChars = JSON.stringify(base).length;

  for (const entry of entries) {
    const entrySize = JSON.stringify(entry).length;
    if (usedChars + entrySize > charLimit) {
      break;
    }
    selectedEntries.push(entry);
    usedChars += entrySize;
  }

  return {
    ...base,
    entries: selectedEntries,
    omittedUniqueActions: Math.max(0, entries.length - selectedEntries.length),
    instruction:
      "This ledger is rebuilt from the full accumulated Evidence, not the recent-history window. Reuse successful prior work and do not repeat the same semantic target unless a concrete unresolved gap requires a materially different action.",
  };
};

/**
 * Exposes only the latest canonical LLM-safe executor payload to Planner. Do not rebuild
 * this from arbitrary raw result objects here: if Harness did not attach llmContent, the
 * Planner falls back to the normal Evidence summary instead of crossing that boundary.
 */
export const buildPlannerLatestEvidenceContent = (
  state: AgentGraphState,
  latestObservation: AgentExecutionObservation | undefined,
) => {
  if (latestObservation?.actionType === "tool") {
    const executions = state.evidence?.toolExecutions ?? [];
    const execution = latestObservation.toolCallId
      ? [...executions]
          .reverse()
          .find((item) => item.toolCallId === latestObservation.toolCallId)
      : executions.at(-1);

    if (!execution || execution.status !== "completed") {
      return undefined;
    }

    const llmContent = (execution as AgentToolExecutionWithLlmContent).llmContent;
    const text = getHarnessLlmContentText(llmContent);
    if (!llmContent || !text.trim()) {
      return undefined;
    }

    return {
      source: "tool" as const,
      toolId: execution.toolId,
      inputHash: execution.inputHash,
      truncated: llmContent.truncated,
      originalCharCount: llmContent.originalCharCount,
      includedCharCount: Math.min(
        llmContent.includedCharCount,
        PLANNER_LATEST_EVIDENCE_CONTENT_CHAR_LIMIT,
      ),
      content:
        text.length <= PLANNER_LATEST_EVIDENCE_CONTENT_CHAR_LIMIT
          ? text
          : `${text
              .slice(0, PLANNER_LATEST_EVIDENCE_CONTENT_CHAR_LIMIT)
              .trimEnd()}\n...[latest tool evidence clipped for Planner]`,
    };
  }

  if (latestObservation?.actionType === "retrieve") {
    const retrieval = state.evidence?.retrievals.at(-1);
    if (!retrieval) {
      return undefined;
    }

    const sections: string[] = [];
    let usedChars = 0;
    let truncated = false;
    for (const chunk of retrieval.chunks) {
      const section = [
        `document: ${chunk.documentName}`,
        `chunkId: ${chunk.chunkId}`,
        "content:",
        chunk.content,
      ].join("\n");
      const remaining = PLANNER_LATEST_EVIDENCE_CONTENT_CHAR_LIMIT - usedChars;
      if (remaining <= 0) {
        truncated = true;
        break;
      }
      if (section.length > remaining) {
        sections.push(
          `${section.slice(0, remaining).trimEnd()}\n...[latest retrieval evidence clipped for Planner]`,
        );
        truncated = true;
        break;
      }
      sections.push(section);
      usedChars += section.length + 2;
    }

    return {
      source: "retrieval" as const,
      query: retrieval.query,
      chunkCount: retrieval.chunkCount,
      truncated,
      content: sections.join("\n\n"),
    };
  }

  return undefined;
};
