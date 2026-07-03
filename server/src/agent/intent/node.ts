import type { AgentNodeState, EmitAgentExecutionNode } from "../nodes.js";
import { listCapabilityDefinitions } from "@/mcp/harness/registry.js";
import {
  emitStepNode,
  getIterativeNodeId,
  getLatestUserQuestion,
  getTraceAttemptMeta,
} from "../nodes.js";
import { matchCapabilitiesByEmbedding } from "./embedding-capability-matcher.js";
import {
  resolveSelectedToolIds,
} from "./task-capability-selector.js";
import type { CapabilityIntentResult } from "./types.js";

const DEFAULT_TOOL_GUARD_CANDIDATE_LIMIT = 10;
const EXPLICIT_TARGET_READ_TOOLS = new Set(["read_open", "read", "read_slice"]);

const hasExplicitReadTarget = (query: string) => {
  const normalized = query.trim();
  if (!normalized) {
    return false;
  }

  if (/["'`].+?["'`]/u.test(normalized)) {
    return true;
  }

  if (/(^|[\s(])([a-zA-Z]:\\|\.{0,2}[\\/]|~[\\/])/u.test(normalized)) {
    return true;
  }

  if (/\b(readme|package\.json|tsconfig\.json|dockerfile)\b/i.test(normalized)) {
    return true;
  }

  return /[\w\-./\\]+\.[a-z0-9]{1,12}\b/i.test(normalized);
};

const buildSelectionReviewNotes = (state: AgentNodeState) => {
  const evidence = state.evidence;
  if (!evidence) {
    return [] as string[];
  }

  const notes: string[] = [];
  const latestRetrieval = evidence.retrievals.at(-1);
  const latestCompletedTool = [...evidence.toolExecutions]
    .reverse()
    .find((execution) => execution.status === "completed");

  if (latestRetrieval && latestRetrieval.chunkCount > 0) {
    const documentNames = latestRetrieval.chunks
      .slice(0, 3)
      .map((chunk) => chunk.documentName)
      .filter(Boolean);
    notes.push(
      `Knowledge retrieval already returned ${latestRetrieval.chunkCount} chunk(s)${
        documentNames.length > 0 ? ` from ${documentNames.join(", ")}` : ""
      }.`,
    );
  }

  if (latestCompletedTool) {
    const result = latestCompletedTool.result;
    if (result && typeof result === "object") {
      const value = result as Record<string, unknown>;
      if (Array.isArray(value.hits) && value.hits.length > 0) {
        notes.push(
          `${latestCompletedTool.toolId} already found ${value.hits.length} workspace hit(s).`,
        );
      } else if (Array.isArray(value.entries) && value.entries.length > 0) {
        notes.push(
          `${latestCompletedTool.toolId} already listed ${value.entries.length} workspace entr${
            value.entries.length === 1 ? "y" : "ies"
          }.`,
        );
      } else if (typeof value.content === "string" && value.content.trim()) {
        notes.push(
          `${latestCompletedTool.toolId} already opened content with ${Array.from(value.content.trim()).length} characters.`,
        );
      }
    }
  }

  return notes;
};

const applyToolGuard = (input: {
  query: string;
  capabilityIntent: CapabilityIntentResult;
}) => {
  const topCandidates = input.capabilityIntent.topCandidates.slice(
    0,
    DEFAULT_TOOL_GUARD_CANDIDATE_LIMIT,
  );
  const allowedCapabilityIds = new Set(
    topCandidates.map((candidate) => candidate.capabilityId),
  );
  const selectedCapabilityIds = input.capabilityIntent.selectedCapabilityIds.filter(
    (capabilityId) => allowedCapabilityIds.has(capabilityId),
  );
  const selectedToolIds = resolveSelectedToolIds({
    query: input.query,
    topCandidates,
    selectedCapabilityIds,
  });
  const selectedPairs = selectedCapabilityIds.map((capabilityId, index) => ({
    capabilityId,
    toolId: selectedToolIds[index],
  }));
  const registeredToolIds = new Set(
    listCapabilityDefinitions().map((definition) => definition.id),
  );
  const invalidSelectedToolIds = selectedPairs
    .filter(({ toolId }) => !toolId || !registeredToolIds.has(toolId))
    .map(({ toolId }) => toolId)
    .filter((toolId): toolId is string => Boolean(toolId));
  const targetlessReadToolIds = selectedPairs
    .filter(
      ({ toolId }) =>
        toolId &&
        EXPLICIT_TARGET_READ_TOOLS.has(toolId) &&
        !hasExplicitReadTarget(input.query),
    )
    .map(({ toolId }) => toolId as string);
  const validSelectedPairs = selectedPairs.filter(
    ({ toolId }) =>
      Boolean(toolId) &&
      registeredToolIds.has(toolId) &&
      !(
        toolId &&
        EXPLICIT_TARGET_READ_TOOLS.has(toolId) &&
        !hasExplicitReadTarget(input.query)
      ),
  );
  const validSelectedCapabilityIds = validSelectedPairs.map(
    ({ capabilityId }) => capabilityId,
  );
  const validSelectedToolIds = validSelectedPairs.map(({ toolId }) => toolId as string);

  let decisionReason = "Accepted Harness-selected candidates and passed local guard checks.";
  if (validSelectedCapabilityIds.length === 0) {
    decisionReason =
      "Harness candidate exposure did not yield a selected capability for this turn.";
  } else if (invalidSelectedToolIds.length > 0) {
    decisionReason =
      "Dropped unregistered tools during local guard checks before invocation.";
  } else if (targetlessReadToolIds.length > 0) {
    decisionReason =
      "Dropped read_open/read selections because the query did not provide an explicit read target.";
  } else if (
    input.capabilityIntent.topCandidates.length > DEFAULT_TOOL_GUARD_CANDIDATE_LIMIT
  ) {
    decisionReason = `Accepted Harness-selected candidates and trimmed guard context to top ${DEFAULT_TOOL_GUARD_CANDIDATE_LIMIT}.`;
  }

  return {
    resolvedCapabilityIntent: {
      ...input.capabilityIntent,
      topCandidates,
      selectedCapabilityIds: validSelectedCapabilityIds,
      selectedToolIds: validSelectedToolIds,
      decisionSource: "guard" as const,
      decisionReason,
    },
    invalidSelectedToolIds,
    targetlessReadToolIds,
  };
};

export const toolGuardNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const query = getLatestUserQuestion(state.messages) || state.goal.text;
  const nodeId = getIterativeNodeId("agent-tool-guard", state);
  const traceAttemptMeta = getTraceAttemptMeta("agent-tool-guard", state);

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "start",
    label: "调用前守卫",
    summary: "正在校验上游候选与本轮可调用工具",
  });

  const capabilityIntent: CapabilityIntentResult = state.capabilityIntent ?? {
    query,
    topCandidates: [],
    selectedCapabilityIds: [],
    selectedToolIds: [],
    decisionSource: "guard",
    decisionReason: "No upstream capability candidates were provided to the local guard.",
  };
  const {
    resolvedCapabilityIntent,
    invalidSelectedToolIds,
    targetlessReadToolIds,
  } = applyToolGuard({
    query,
    capabilityIntent,
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "done",
    label: "调用前守卫",
    summary:
      resolvedCapabilityIntent.selectedToolIds.length > 0
        ? `已确认 ${resolvedCapabilityIntent.selectedToolIds.length} 个待调用工具`
        : resolvedCapabilityIntent.topCandidates.length > 0
          ? `已完成候选守卫，当前未放行工具调用`
          : "上游未提供可用候选能力",
    details: {
      query,
      selectedCapabilityIds: resolvedCapabilityIntent.selectedCapabilityIds,
      selectedToolIds: resolvedCapabilityIntent.selectedToolIds,
      guardChecks: [
        "candidate-limit-top10",
        "selected-capability-membership",
        "registered-tool-membership",
        "explicit-read-target",
      ],
      invalidSelectedToolIds,
      targetlessReadToolIds,
      selectedCandidates: resolvedCapabilityIntent.topCandidates
        .filter((candidate) =>
          resolvedCapabilityIntent.selectedCapabilityIds.includes(candidate.capabilityId),
        )
        .map((candidate) => ({
          capabilityId: candidate.capabilityId,
          preferredToolId: candidate.preferredToolId,
          supportingToolIds: candidate.supportingToolIds,
          embeddingScore: candidate.embeddingScore,
          ruleScore: candidate.ruleScore,
          rerankScore: candidate.rerankScore ?? 0,
          finalScore: candidate.finalScore ?? candidate.score,
        })),
      topCandidates: resolvedCapabilityIntent.topCandidates,
      retrievalModel: resolvedCapabilityIntent.retrievalModel,
      exposureReasons: resolvedCapabilityIntent.exposureReasons,
      decisionSource: resolvedCapabilityIntent.decisionSource,
      decisionReason: resolvedCapabilityIntent.decisionReason,
    },
  });

  return {
    capabilityIntent: resolvedCapabilityIntent,
  };
};

export const capabilitySelectNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const query = getLatestUserQuestion(state.messages) || state.goal.text;
  const reviewNotes = buildSelectionReviewNotes(state);
  const effectiveQuery =
    reviewNotes.length > 0
      ? `${query}\n\nReview context:\n${reviewNotes.map((note) => `- ${note}`).join("\n")}`
      : query;
  const nodeId = getIterativeNodeId("agent-capability-select", state);
  const traceAttemptMeta = getTraceAttemptMeta("agent-capability-select", state);

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "start",
    label: "候选选择",
    summary: "正在获取 Harness 候选并选择本轮能力",
  });

  const capabilityIntent = await matchCapabilitiesByEmbedding({
    query: effectiveQuery,
    config: state.intentConfig,
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "done",
    label: "候选选择",
    summary:
      capabilityIntent.selectedCapabilityIds.length > 0
        ? `已选出 ${capabilityIntent.selectedCapabilityIds.length} 个能力候选`
        : capabilityIntent.topCandidates.length > 0
          ? "已得到候选集合，当前未选中能力"
          : "未收到可用候选能力",
    details: {
      query,
      effectiveQuery,
      reviewNotes,
      selectedCapabilityIds: capabilityIntent.selectedCapabilityIds,
      selectedToolIds: capabilityIntent.selectedToolIds,
      topCandidates: capabilityIntent.topCandidates,
      retrievalModel: capabilityIntent.retrievalModel,
      exposureReasons: capabilityIntent.exposureReasons,
      decisionSource: capabilityIntent.decisionSource,
      decisionReason: capabilityIntent.decisionReason,
    },
  });

  return {
    capabilityIntent: {
      ...capabilityIntent,
      query,
    },
  };
};

export const capabilityIntentNode = capabilitySelectNode;

export type { CapabilityIntentResult } from "./types.js";
