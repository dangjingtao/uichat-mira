import { listCapabilityDefinitions } from "@/harness/registry";
import {
  emitStepNode,
  buildPlannerObservationContext,
  getIterativeNodeId,
  getTraceAttemptMeta,
} from "../node-runtime";
import { getLatestUserQuestion } from "../nodes/index";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";
import type { PlannerObservationContext } from "../types";
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
const READ_CONTENT_TOKENS = ["read", "open", "content", "contents", "读取", "打开", "内容", "阅读"];
const LOCATE_TOKENS = ["find", "locate", "where", "查找", "定位", "在哪里"];
const MUTATION_TOKENS = ["delete", "remove", "write", "overwrite", "rename", "move", "删除", "移除", "写入", "覆盖", "重命名", "移动"];

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

const normalizeCoverageQuery = (query: string) => query.trim().toLowerCase();

const includesCoverageToken = (query: string, tokens: string[]) => {
  const normalized = normalizeCoverageQuery(query);
  return tokens.some((token) => normalized.includes(token));
};

const extractFallbackCoverageTarget = (query: string) => {
  const quotedMatch = [...query.matchAll(/["'`“”‘’]([^"'`“”‘’]+)["'`“”‘’]/g)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value))
    .at(-1);
  if (quotedMatch) {
    return quotedMatch;
  }

  const fileLikeMatch = query.match(/([\w./\\-]+\.[a-z0-9]{1,12})\b/i);
  if (fileLikeMatch?.[1]) {
    return fileLikeMatch[1];
  }

  const chineseTargetMatch = query.match(/(?:删除|移除|删掉|打开|读取|查看|写入|覆盖)\s+([^\s，。！？]+)/u);
  if (chineseTargetMatch?.[1]) {
    return chineseTargetMatch[1].trim();
  }

  return undefined;
};

const buildSelectionReviewNotes = (
  state: AgentNodeState,
  observationContext: PlannerObservationContext,
) => {
  const evidence = state.evidence;
  const notes: string[] = [];
  if (state.currentTaskFrame?.currentSubtask) {
    notes.push(`Current subtask: ${state.currentTaskFrame.currentSubtask}`);
  }
  if (state.currentTaskFrame?.currentBlocker) {
    notes.push(`Current blocker: ${state.currentTaskFrame.currentBlocker}`);
  }

  if (!evidence) {
    return notes;
  }

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

  if (
    observationContext.recovery.source === "tool_failure" &&
    observationContext.recovery.errorMessage
  ) {
    const toolLabel = observationContext.recovery.toolId ?? "the previous tool";
    notes.push(
      `${toolLabel} failed recoverably: ${observationContext.recovery.errorMessage}`,
    );
  }

  return notes;
};

const buildPreferredCoverageActionContext = (input: {
  query: string;
  taskCoverageView: NonNullable<PlannerObservationContext["taskCoverageView"]>;
  recovery: PlannerObservationContext["recovery"];
}) => {
  const nextPendingAction = input.taskCoverageView.pendingActions[0];
  const nextPendingTarget =
    input.taskCoverageView.pendingTargets[0] ??
    input.taskCoverageView.requiredTargets.find(
      (target) => !input.taskCoverageView.coveredTargets.includes(target),
    ) ??
    extractFallbackCoverageTarget(input.query);
  const lines = ["Preferred next coverage action:"];
  const inferredPendingAction =
    nextPendingAction ??
    (nextPendingTarget
      ? includesCoverageToken(input.query, MUTATION_TOKENS)
        ? "mutation_execution"
        : includesCoverageToken(input.query, READ_CONTENT_TOKENS)
          ? "read_open"
          : includesCoverageToken(input.query, LOCATE_TOKENS)
            ? "read_locate"
            : "read_locate"
      : undefined);

  switch (inferredPendingAction) {
    case "read_open":
      lines.push("- action: read_open");
      lines.push(`- target: ${nextPendingTarget ?? "unknown"}`);
      lines.push("- guidance: prioritize the remaining unopened target and avoid already opened targets.");
      break;
    case "read_locate":
      lines.push("- action: read_locate");
      lines.push(`- target: ${nextPendingTarget ?? "unknown"}`);
      lines.push("- guidance: prioritize the target that is still not located.");
      break;
    case "mutation_execution":
      lines.push("- action: mutation_execution");
      lines.push(`- target: ${nextPendingTarget ?? "unknown"}`);
      lines.push("- guidance: prioritize edit or mutation capabilities over read-only answer collection.");
      break;
    case "mutation_verification":
      lines.push("- action: mutation_verification");
      lines.push(`- target: ${nextPendingTarget ?? "unknown"}`);
      lines.push("- guidance: prioritize read_open or read_extract style verification evidence.");
      break;
    case "recoverable_execution":
      lines.push("- action: recoverable_execution");
      lines.push(`- tool: ${input.recovery.toolId ?? "unknown"}`);
      if (nextPendingTarget) {
        lines.push(`- target: ${nextPendingTarget}`);
      }
      lines.push(
        `- failureSummary: ${input.recovery.errorMessage ?? "The previous attempt failed recoverably."}`,
      );
      lines.push(
        "- recoveryRequirement: the next attempt must differ from the previous failed invocation.",
      );
      break;
    case "read_list":
      lines.push("- action: read_list");
      lines.push("- guidance: prioritize directory listing evidence before answering.");
      break;
    case "search_execution":
      lines.push("- action: search_execution");
      lines.push("- guidance: prioritize external or retrieval evidence for the remaining search gap.");
      break;
    case "terminal_execution":
      lines.push("- action: terminal_execution");
      lines.push("- guidance: prioritize command execution evidence before answering.");
      break;
    default:
      if (!inferredPendingAction && !nextPendingTarget) {
        return undefined;
      }
      lines.push(`- action: ${inferredPendingAction ?? "coverage_gap_review"}`);
      if (nextPendingTarget) {
        lines.push(`- target: ${nextPendingTarget}`);
      }
      break;
  }

  return lines.join("\n");
};

const buildTaskCoverageReviewContext = (input: {
  query: string;
  taskCoverageView?: PlannerObservationContext["taskCoverageView"];
  recovery: PlannerObservationContext["recovery"];
}) => {
  const taskCoverageView = input.taskCoverageView;
  if (!taskCoverageView) {
    return undefined;
  }

  const { pendingTargets, pendingActions, blockedReason } = taskCoverageView;
  if (pendingTargets.length === 0 && pendingActions.length === 0 && !blockedReason) {
    return undefined;
  }

  const lines = [
    "Remaining task coverage:",
    `- pendingTargets: [${pendingTargets.join(", ")}]`,
    `- pendingActions: [${pendingActions.join(", ")}]`,
  ];
  if (blockedReason) {
    lines.push(`- blockedReason: ${blockedReason}`);
  }
  const preferredNextCoverageAction = buildPreferredCoverageActionContext({
    query: input.query,
    taskCoverageView,
    recovery: input.recovery,
  });

  return {
    taskCoverageView,
    reviewText: lines.join("\n"),
    preferredNextCoverageAction,
  };
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
  const observationContext = buildPlannerObservationContext(state);
  const reviewNotes = buildSelectionReviewNotes(state, observationContext);
  const taskCoverageReviewContext = buildTaskCoverageReviewContext({
    query,
    taskCoverageView: observationContext.taskCoverageView,
    recovery: observationContext.recovery,
  });
  const effectiveQuery =
    reviewNotes.length > 0 || taskCoverageReviewContext
      ? [
          `Original user query:\n${query}`,
          `Review context:\n${
            reviewNotes.length > 0
              ? reviewNotes.map((note) => `- ${note}`).join("\n")
              : "- none"
          }`,
          taskCoverageReviewContext?.reviewText,
          taskCoverageReviewContext?.preferredNextCoverageAction,
        ]
          .filter((section): section is string => Boolean(section))
          .join("\n\n")
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
      taskCoverageView: taskCoverageReviewContext?.taskCoverageView ?? null,
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
