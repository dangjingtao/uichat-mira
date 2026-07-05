import { listCapabilityDefinitions } from "@/harness/registry";
import {
  emitStepNode,
  getIterativeNodeId,
  getTraceAttemptMeta,
} from "../node-runtime";
import { getLatestUserQuestion } from "../nodes/index";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";
import { matchToolCandidatesByEmbedding } from "./embedding-capability-matcher";
import {
  resolveInvocationCandidateToolIds,
  selectToolWithTaskModel,
} from "./task-capability-selector";
import type { ToolIntentResult } from "./types";

const toAgentToolExposureState = (
  toolIntent: ToolIntentResult,
) => ({
  exposedTools: toolIntent.toolExposure.exposedToolIds,
  toolMeta: toolIntent.toolExposure.exposedDefinitions.map((definition) => ({
    toolId: definition.id,
    title: definition.title,
    description: definition.description,
    inputSchema: definition.inputSchema,
    domain: definition.domain,
    source: definition.source,
    tags: definition.tags,
    capabilities: definition.capabilities,
  })),
});

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
  toolIntent: ToolIntentResult;
}) => {
  const topCandidates = input.toolIntent.topCandidates.slice(
    0,
    DEFAULT_TOOL_GUARD_CANDIDATE_LIMIT,
  );
  const allowedToolIds = new Set(
    topCandidates.map((candidate) => candidate.toolId),
  );
  const selectedToolIds = input.toolIntent.selectedToolIds.filter(
    (toolId) => allowedToolIds.has(toolId),
  );
  const candidateToolIds = resolveInvocationCandidateToolIds({
    query: input.query,
    topCandidates,
    selectedToolIds,
  });
  const selectedPairs = selectedToolIds.map((toolId, index) => ({
    selectedToolId: toolId,
    candidateToolId: candidateToolIds[index],
  }));
  const registeredToolIds = new Set(
    listCapabilityDefinitions().map((definition) => definition.id),
  );
  const invalidSelectedToolIds = selectedPairs
    .filter(({ candidateToolId }) => !candidateToolId || !registeredToolIds.has(candidateToolId))
    .map(({ candidateToolId }) => candidateToolId)
    .filter((toolId): toolId is string => Boolean(toolId));
  const targetlessReadToolIds = selectedPairs
    .filter(
      ({ candidateToolId }) =>
        candidateToolId &&
        EXPLICIT_TARGET_READ_TOOLS.has(candidateToolId) &&
        !hasExplicitReadTarget(input.query),
    )
    .map(({ candidateToolId }) => candidateToolId as string);
  const validSelectedPairs = selectedPairs.filter(
    ({ candidateToolId }) =>
      Boolean(candidateToolId) &&
      registeredToolIds.has(candidateToolId) &&
      !(
        candidateToolId &&
        EXPLICIT_TARGET_READ_TOOLS.has(candidateToolId) &&
        !hasExplicitReadTarget(input.query)
      ),
  );
  const validSelectedToolIds = validSelectedPairs.map(({ selectedToolId }) => selectedToolId);
  const validInvocationCandidateToolIds = validSelectedPairs.map(
    ({ candidateToolId }) => candidateToolId as string,
  );

  let decisionReason = "Accepted Harness-selected candidates and passed local guard checks.";
  if (validSelectedToolIds.length === 0) {
    decisionReason = "Harness candidate exposure did not yield a selected tool for this turn.";
  } else if (invalidSelectedToolIds.length > 0) {
    decisionReason =
      "Dropped unregistered tools during local guard checks before invocation.";
  } else if (targetlessReadToolIds.length > 0) {
    decisionReason =
      "Dropped read_open/read selections because the query did not provide an explicit read target.";
  } else if (input.toolIntent.topCandidates.length > DEFAULT_TOOL_GUARD_CANDIDATE_LIMIT) {
    decisionReason = `Accepted Harness-selected candidates and trimmed guard context to top ${DEFAULT_TOOL_GUARD_CANDIDATE_LIMIT}.`;
  }

  return {
    resolvedToolIntent: {
      ...input.toolIntent,
      topCandidates,
      selectedToolIds: validSelectedToolIds,
      candidateToolIds: validInvocationCandidateToolIds,
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

  const toolIntent: ToolIntentResult = state.toolIntent ?? {
    query,
    topCandidates: [],
    toolCandidates: [],
    toolExposure: {
      exposedToolIds: [],
      exposedDefinitions: [],
      reason: [],
      blockedCapabilityIds: [],
    },
    selectedToolIds: [],
    candidateToolIds: [],
    decisionSource: "guard",
    decisionReason: "No upstream tool candidates were provided to the local guard.",
  };
  const {
    resolvedToolIntent,
    invalidSelectedToolIds,
    targetlessReadToolIds,
  } = applyToolGuard({
    query,
    toolIntent,
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "done",
    label: "调用前守卫",
    summary:
      resolvedToolIntent.candidateToolIds.length > 0
        ? `已确认 ${resolvedToolIntent.candidateToolIds.length} 个调用候选`
        : resolvedToolIntent.topCandidates.length > 0
          ? `已完成候选守卫，当前未放行工具调用`
          : "上游未提供可用工具候选",
    details: {
      query,
      selectedToolIds: resolvedToolIntent.selectedToolIds,
      candidateToolIds: resolvedToolIntent.candidateToolIds,
      guardChecks: [
        "candidate-limit-top10",
        "selected-tool-membership",
        "registered-tool-membership",
        "explicit-read-target",
      ],
      invalidSelectedToolIds,
      targetlessReadToolIds,
      selectedCandidates: resolvedToolIntent.topCandidates
        .filter((candidate) =>
          resolvedToolIntent.selectedToolIds.includes(candidate.toolId),
        )
        .map((candidate) => ({
          toolId: candidate.toolId,
          embeddingScore: candidate.embeddingScore,
          ruleScore: candidate.ruleScore,
          rerankScore: candidate.rerankScore ?? 0,
          finalScore: candidate.finalScore ?? candidate.score,
        })),
      topCandidates: resolvedToolIntent.topCandidates,
      retrievalModel: resolvedToolIntent.retrievalModel,
      exposureReasons: resolvedToolIntent.exposureReasons,
      decisionSource: resolvedToolIntent.decisionSource,
      decisionReason: resolvedToolIntent.decisionReason,
    },
  });

  return {
    toolIntent: resolvedToolIntent,
    toolExposure: toAgentToolExposureState(resolvedToolIntent),
  };
};

export const toolSelectNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const query = getLatestUserQuestion(state.messages) || state.goal.text;
  const reviewNotes = buildSelectionReviewNotes(state);
  const effectiveQuery =
    reviewNotes.length > 0
      ? `${query}\n\nReview context:\n${reviewNotes.map((note) => `- ${note}`).join("\n")}`
      : query;
  const nodeId = getIterativeNodeId("agent-tool-select", state);
  const traceAttemptMeta = getTraceAttemptMeta("agent-tool-select", state);

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "start",
    label: "候选选择",
    summary: "正在获取 Harness 候选并选择本轮工具",
  });

  const toolIntent = await matchToolCandidatesByEmbedding({
    query: effectiveQuery,
    config: state.intentConfig,
  });
  const taskSelection =
    toolIntent.selectedToolIds.length > 0
      ? {
          selectedToolIds: toolIntent.selectedToolIds,
          decisionSource: toolIntent.decisionSource ?? ("task-model" as const),
          decisionReason: toolIntent.decisionReason ?? "Tool selection was already provided upstream.",
        }
      : await selectToolWithTaskModel({
          query: effectiveQuery,
          topCandidates: toolIntent.topCandidates,
          messages: state.messages,
        });
  const candidateToolIds = resolveInvocationCandidateToolIds({
    query,
    topCandidates: toolIntent.topCandidates,
    selectedToolIds: taskSelection.selectedToolIds,
  });
  const resolvedToolIntent: ToolIntentResult = {
    ...toolIntent,
    query,
    selectedToolIds: taskSelection.selectedToolIds,
    candidateToolIds,
    decisionSource: taskSelection.decisionSource,
    decisionReason: taskSelection.decisionReason,
  };

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId,
    ...traceAttemptMeta,
    nodeType: "reason",
    phase: "done",
    label: "候选选择",
    summary:
      resolvedToolIntent.selectedToolIds.length > 0
        ? `已选出 ${resolvedToolIntent.selectedToolIds.length} 个工具候选`
        : resolvedToolIntent.topCandidates.length > 0
          ? "已得到候选集合，当前未选中工具"
          : "未收到可用工具候选",
    details: {
      query,
      effectiveQuery,
      reviewNotes,
      selectedToolIds: resolvedToolIntent.selectedToolIds,
      candidateToolIds: resolvedToolIntent.candidateToolIds,
      topCandidates: resolvedToolIntent.topCandidates,
      toolCandidates: resolvedToolIntent.toolCandidates,
      toolExposure: resolvedToolIntent.toolExposure,
      retrievalModel: resolvedToolIntent.retrievalModel,
      exposureReasons: resolvedToolIntent.exposureReasons,
      decisionSource: resolvedToolIntent.decisionSource,
      decisionReason: resolvedToolIntent.decisionReason,
    },
  });

  return {
    toolIntent: resolvedToolIntent,
    toolExposure: toAgentToolExposureState(resolvedToolIntent),
  };
};

export const toolIntentNode = toolSelectNode;

export type { ToolIntentResult } from "./types";
