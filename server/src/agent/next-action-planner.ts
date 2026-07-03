import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { toAgentExecutionNode } from "./trace.js";
import type {
  AgentApprovalRequest,
  AgentEvidencePayload,
  AgentNextAction,
  AgentObservation,
  AgentPlan,
  AgentRetrievalEvidence,
  AgentToolExecutionResult,
  AgentToolExposureState,
} from "./types.js";
import type { AgentGraphState, EmitAgentExecutionNode } from "./nodes.js";

const NEXT_ACTION_PLANNER_FALLBACK_REASON =
  "Planner fallback: unable to safely determine next action.";

const sanitizePlannerJson = (value: string) =>
  value
    .replace(/```json/gi, "```")
    .replace(/```[\r\n]?/g, "")
    .trim();

const getLatestUserQuestion = (messages: NormalizedChatMessage[]) => {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  return latest?.content.trim() ?? "";
};

const emitStepNode = async (
  emit: EmitAgentExecutionNode | undefined,
  input: Parameters<typeof toAgentExecutionNode>[0],
) => {
  await emit?.(toAgentExecutionNode(input));
};

const summarizePlannerObservation = (observation: AgentObservation) => ({
  stepId: observation.stepId,
  status: observation.status,
  facts: observation.facts.slice(0, 3),
  ...(observation.errorMessage ? { errorMessage: observation.errorMessage } : {}),
});

const summarizePlannerToolExecution = (execution: AgentToolExecutionResult) => ({
  toolId: execution.toolId,
  status: execution.status,
  ...(execution.errorMessage ? { errorMessage: execution.errorMessage } : {}),
});

const summarizePlannerRetrieval = (retrieval: AgentRetrievalEvidence) => ({
  query: retrieval.query,
  chunkCount: retrieval.chunkCount,
  documents: retrieval.chunks.slice(0, 3).map((chunk) => chunk.documentName),
});

const summarizePlannerEvidence = (
  evidence: AgentEvidencePayload | undefined,
) => {
  if (!evidence) {
    return {
      observationCount: 0,
      toolExecutionCount: 0,
      retrievalCount: 0,
    };
  }

  return {
    observationCount: evidence.observations.length,
    toolExecutionCount: evidence.toolExecutions.length,
    retrievalCount: evidence.retrievals.length,
    latestObservation: evidence.observations.length > 0
      ? summarizePlannerObservation(evidence.observations[evidence.observations.length - 1]!)
      : undefined,
    latestToolExecution: evidence.toolExecutions.length > 0
      ? summarizePlannerToolExecution(
          evidence.toolExecutions[evidence.toolExecutions.length - 1]!,
        )
      : undefined,
    latestRetrieval: evidence.retrievals.length > 0
      ? summarizePlannerRetrieval(evidence.retrievals[evidence.retrievals.length - 1]!)
      : undefined,
  };
};

const normalizeToolExposure = (
  state: Pick<AgentGraphState, "toolExposure" | "toolIntent">,
): AgentToolExposureState => {
  if (state.toolExposure) {
    return state.toolExposure;
  }

  const exposedDefinitions = state.toolIntent?.toolExposure.exposedDefinitions ?? [];
  return {
    exposedTools: state.toolIntent?.toolExposure.exposedToolIds ?? [],
    toolMeta: exposedDefinitions.map((definition) => ({
      toolId: definition.id,
      title: definition.title,
      description: definition.description,
      inputSchema: definition.inputSchema,
      domain: definition.domain,
      source: definition.source,
      tags: definition.tags,
      capabilities: definition.capabilities,
    })),
  };
};

const buildNextActionPlannerMessages = (input: {
  question: string;
  plan: AgentPlan;
  taskFrame?: AgentGraphState["taskFrame"];
  evidence: AgentEvidencePayload | undefined;
  lastToolExecution?: AgentToolExecutionResult;
  toolExposure: AgentToolExposureState;
  iteration: number;
  maxIterations: number;
  pendingApproval?: AgentApprovalRequest;
}): NormalizedChatMessage[] => {
  const evidenceSummary = summarizePlannerEvidence(input.evidence);

  return [
    {
      role: "system",
      content: [
        "你是 Agent graph 的 nextAction planner。",
        "你的唯一任务是决定当前这一轮的下一步动作。",
        "你必须只输出 JSON，不要输出解释性自然语言，不要输出 Markdown，不要输出代码块。",
        "允许输出的 JSON 只有四种：",
        '{"type":"answer","reason":"..."}',
        '{"type":"retrieve","query":"...","reason":"..."}',
        '{"type":"use_tool","toolId":"...","args":{},"reason":"..."}',
        '{"type":"error","reason":"..."}',
        "如果你选择 use_tool，toolId 必须来自当前暴露的真实工具列表，args 必须是 JSON object。",
        "不要输出 capabilityId，不要发明未暴露工具，不要输出额外字段。",
      ].join("\n"),
      parts: [],
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          question: input.question,
          plan: input.plan,
          taskFrame: input.taskFrame ?? null,
          evidenceSummary,
          lastToolExecution: input.lastToolExecution
            ? summarizePlannerToolExecution(input.lastToolExecution)
            : null,
          toolExposure: {
            exposedTools: input.toolExposure.exposedTools,
            toolMeta: input.toolExposure.toolMeta,
          },
          iteration: input.iteration,
          maxIterations: input.maxIterations,
          pendingApproval: input.pendingApproval
            ? {
                toolId: input.pendingApproval.toolId,
                reason: input.pendingApproval.reason,
              }
            : null,
        },
        null,
        2,
      ),
      parts: [],
    },
  ];
};

const toNextActionFallback = (reason = NEXT_ACTION_PLANNER_FALLBACK_REASON): AgentNextAction => ({
  type: "error",
  reason,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseNextActionPlannerOutput = (value: string): AgentNextAction | null => {
  const sanitized = sanitizePlannerJson(value);
  if (!sanitized) {
    return null;
  }

  try {
    const parsed = JSON.parse(sanitized) as Record<string, unknown>;
    if (!isPlainObject(parsed) || typeof parsed.type !== "string") {
      return null;
    }

    if (typeof parsed.reason !== "string" || !parsed.reason.trim()) {
      return null;
    }

    switch (parsed.type) {
      case "answer":
        return {
          type: "answer",
          reason: parsed.reason.trim(),
        };
      case "retrieve":
        if (typeof parsed.query !== "string" || !parsed.query.trim()) {
          return null;
        }
        return {
          type: "retrieve",
          query: parsed.query.trim(),
          reason: parsed.reason.trim(),
        };
      case "use_tool":
        if (
          typeof parsed.toolId !== "string" ||
          !parsed.toolId.trim() ||
          !isPlainObject(parsed.args)
        ) {
          return null;
        }
        return {
          type: "use_tool",
          toolId: parsed.toolId.trim(),
          args: parsed.args,
          reason: parsed.reason.trim(),
        };
      case "error":
        return {
          type: "error",
          reason: parsed.reason.trim(),
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
};

const validateNextAction = (
  action: AgentNextAction | null,
  exposedTools: string[],
): AgentNextAction => {
  if (!action) {
    return toNextActionFallback(
      "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.",
    );
  }

  if (action.type === "use_tool" && !exposedTools.includes(action.toolId)) {
    return toNextActionFallback(
      "Planner selected a tool that was not exposed for this turn; planner must stop.",
    );
  }

  return action;
};

export const nextActionPlannerNode = async (
  state: AgentGraphState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentGraphState>> => {
  const iteration = state.iterationCount ?? 0;
  const maxIterations = state.maxIterations ?? 0;
  const question =
    state.question?.trim() || getLatestUserQuestion(state.messages) || state.goal.text;
  const toolExposure = normalizeToolExposure(state);

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-next-action-planner",
    nodeType: "plan",
    phase: "start",
    label: "下一步动作决策",
    summary: "正在调用 task model 决定本轮下一步动作",
    details: {
      exposedToolCount: toolExposure.exposedTools.length,
      iteration,
      maxIterations,
    },
  });

  let nextAction: AgentNextAction;
  let rawOutput = "";

  if (maxIterations > 0 && iteration >= maxIterations) {
    nextAction = toNextActionFallback(
      "Planner reached the iteration limit and must stop.",
    );
  } else {
    const messages = buildNextActionPlannerMessages({
      question,
      plan: state.plan,
      taskFrame: state.taskFrame,
      evidence: state.evidence,
      lastToolExecution: state.lastToolExecution,
      toolExposure,
      iteration,
      maxIterations,
      pendingApproval: state.pendingApproval,
    });

    try {
      for await (const delta of providerProxyService.streamTaskChatText(messages)) {
        rawOutput += delta;
      }

      nextAction = validateNextAction(
        parseNextActionPlannerOutput(rawOutput),
        toolExposure.exposedTools,
      );
    } catch (error) {
      nextAction = toNextActionFallback(
        error instanceof Error && error.message.trim()
          ? `Planner task model call failed: ${error.message.trim()}`
          : NEXT_ACTION_PLANNER_FALLBACK_REASON,
      );
    }
  }

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-next-action-planner",
    nodeType: "plan",
    phase: "done",
    label: "下一步动作决策",
    summary: "已完成下一步动作决策",
    details: {
      exposedToolCount: toolExposure.exposedTools.length,
      selectedActionType: nextAction.type,
      selectedToolId: nextAction.type === "use_tool" ? nextAction.toolId : null,
      reason: nextAction.reason,
      iteration,
      maxIterations,
      rawOutputPreview: rawOutput ? rawOutput.slice(0, 200) : undefined,
    },
  });

  return {
    nextAction,
    ...(nextAction.type === "error"
      ? {
          errorMessage: nextAction.reason,
          blockedReason: nextAction.reason,
          errorSourceNodeId: "agent-next-action-planner",
        }
      : {}),
  };
};
