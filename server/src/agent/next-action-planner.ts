import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { writeStructuredLog } from "@/logger";
import { toAgentExecutionNode } from "./trace.js";
import { getAnswerStopDecision, getLatestEvidenceSummary } from "./evidence.js";
import type {
  AgentApprovalRequest,
  AgentEvidencePayload,
  AgentEvidenceSummary,
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
const PLANNER_OUTPUT_PREVIEW_LIMIT = 500;
const ALLOWED_ACTION_TYPES = ["answer", "retrieve", "use_tool", "error"] as const;
const INVALID_PLANNER_OUTPUT_REASON =
  "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.";

const stripThinkBlocks = (value: string) =>
  value.replace(/^\s*(?:<think\b[^>]*>[\s\S]*?<\/think>\s*)+/i, "").trim();

const sanitizePlannerJson = (value: string) =>
  stripThinkBlocks(value)
    .replace(/```json/gi, "```")
    .replace(/```[\r\n]?/g, "")
    .trim();

const toPreview = (value: string) =>
  value.trim().slice(0, PLANNER_OUTPUT_PREVIEW_LIMIT);

const logPlannerDecisionDebug = (input: {
  runId: string;
  threadId: string;
  iteration: number;
  maxIterations: number;
  answerStopRuleTriggered: boolean;
  taskModelInvoked: boolean;
  nextAction: AgentNextAction;
  rawOutput: string;
  sanitizedOutput: string;
  parseErrorReason?: string;
  parseWarnings?: string[];
}) => {
  writeStructuredLog(input.parseErrorReason ? "warn" : "info", {
    msg: "Planner decision debug",
    event: "agent-next-action-planner-debug",
    runId: input.runId,
    threadId: input.threadId,
    iteration: input.iteration,
    maxIterations: input.maxIterations,
    answerStopRuleTriggered: input.answerStopRuleTriggered,
    taskModelInvoked: input.taskModelInvoked,
    selectedActionType: input.nextAction.type,
    selectedToolId: input.nextAction.type === "use_tool" ? input.nextAction.toolId : null,
    reason: input.nextAction.reason,
    parseErrorReason: input.parseErrorReason,
    parseWarnings: input.parseWarnings,
    rawOutputPreview: input.rawOutput ? toPreview(input.rawOutput) : undefined,
    sanitizedOutputPreview: input.sanitizedOutput
      ? toPreview(input.sanitizedOutput)
      : undefined,
    allowedActionTypes: [...ALLOWED_ACTION_TYPES],
  });
};

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
    latestEvidenceSummary: evidence.latestSummary,
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
  latestEvidenceSummary?: AgentEvidenceSummary;
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
        "如果 latestEvidenceSummary.answerReadiness.canAnswer 为 true，且没有 missingInfo、pendingApproval 或 errorMessage，则下一步必须输出 answer。",
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
          latestEvidenceSummary: input.latestEvidenceSummary ?? null,
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

type PlannerOutputParseResult = {
  action: AgentNextAction | null;
  sanitizedOutput: string;
  parseErrorReason: string | null;
  parseWarnings: string[];
};

const MISSING_REASON_DEFAULTED_WARNING = "missing_reason_defaulted";

const getDefaultPlannerReason = (
  type: AgentNextAction["type"],
  payload: Record<string, unknown>,
) => {
  switch (type) {
    case "answer":
      return "Planner selected final answer.";
    case "retrieve":
      return `Planner requested retrieval for query: ${String(payload.query ?? "").trim()}.`;
    case "use_tool":
      return `Planner selected tool ${String(payload.toolId ?? "").trim()}.`;
    case "error":
      return "Planner returned an error action without a reason.";
  }
};

const extractJsonObjectCandidates = (value: string) => {
  const candidates: string[] = [];
  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (!char) {
      continue;
    }

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === "\\") {
        escaping = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        candidates.push(value.slice(startIndex, index + 1));
        startIndex = -1;
      }
    }
  }

  return candidates;
};

const parseNextActionPlannerObject = (
  parsed: Record<string, unknown>,
): PlannerOutputParseResult => {
  if (typeof parsed.type !== "string") {
    return {
      action: null,
      sanitizedOutput: "",
      parseErrorReason: 'Planner JSON object must include a string "type" field.',
      parseWarnings: [],
    };
  }

  const parseWarnings: string[] = [];
  const reason: string =
    typeof parsed.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim()
      : (() => {
          parseWarnings.push(MISSING_REASON_DEFAULTED_WARNING);
          return (
            getDefaultPlannerReason(parsed.type as AgentNextAction["type"], parsed) ??
            "Planner returned an error action without a reason."
          );
        })();

  switch (parsed.type) {
    case "answer":
      return {
        action: {
          type: "answer",
          reason,
        },
        sanitizedOutput: "",
        parseErrorReason: null,
        parseWarnings,
      };
    case "retrieve":
      if (typeof parsed.query !== "string" || !parsed.query.trim()) {
        return {
          action: null,
          sanitizedOutput: "",
          parseErrorReason:
            'Planner "retrieve" action must include a non-empty string "query" field.',
          parseWarnings: [],
        };
      }
      return {
        action: {
          type: "retrieve",
          query: parsed.query.trim(),
          reason,
        },
        sanitizedOutput: "",
        parseErrorReason: null,
        parseWarnings,
      };
    case "use_tool":
      if (typeof parsed.toolId !== "string" || !parsed.toolId.trim()) {
        return {
          action: null,
          sanitizedOutput: "",
          parseErrorReason:
            'Planner "use_tool" action must include a non-empty string "toolId" field.',
          parseWarnings: [],
        };
      }
      if (!isPlainObject(parsed.args)) {
        return {
          action: null,
          sanitizedOutput: "",
          parseErrorReason:
            'Planner "use_tool" action must include an object-valued "args" field.',
          parseWarnings: [],
        };
      }
      return {
        action: {
          type: "use_tool",
          toolId: parsed.toolId.trim(),
          args: parsed.args,
          reason,
        },
        sanitizedOutput: "",
        parseErrorReason: null,
        parseWarnings,
      };
    case "error":
      return {
        action: {
          type: "error",
          reason,
        },
        sanitizedOutput: "",
        parseErrorReason: null,
        parseWarnings,
      };
    default:
      return {
        action: null,
        sanitizedOutput: "",
        parseErrorReason: `Planner action type "${parsed.type}" is not allowed.`,
        parseWarnings: [],
      };
  }
};

const parseNextActionPlannerOutputWithDiagnostics = (
  value: string,
): PlannerOutputParseResult => {
  const sanitized = sanitizePlannerJson(value);
  if (!sanitized) {
    return {
      action: null,
      sanitizedOutput: sanitized,
      parseErrorReason: "Planner output was empty after sanitization.",
      parseWarnings: [],
    };
  }

  const candidates = extractJsonObjectCandidates(sanitized);
  if (candidates.length === 0) {
    return {
      action: null,
      sanitizedOutput: sanitized,
      parseErrorReason: "Planner output did not contain a complete JSON object.",
      parseWarnings: [],
    };
  }

  if (candidates.length > 1) {
    return {
      action: null,
      sanitizedOutput: sanitized,
      parseErrorReason:
        "Planner output contained multiple JSON objects; planner must return exactly one decision object.",
      parseWarnings: [],
    };
  }

  try {
    const parsed = JSON.parse(candidates[0]!) as unknown;
    if (!isPlainObject(parsed)) {
      return {
        action: null,
        sanitizedOutput: sanitized,
        parseErrorReason: "Planner decision must be a JSON object.",
        parseWarnings: [],
      };
    }

    const result = parseNextActionPlannerObject(parsed);
    return {
      action: result.action,
      sanitizedOutput: sanitized,
      parseErrorReason: result.parseErrorReason,
      parseWarnings: result.parseWarnings,
    };
  } catch (error) {
    return {
      action: null,
      sanitizedOutput: sanitized,
      parseErrorReason:
        error instanceof Error && error.message.trim()
          ? `Planner JSON parse failed: ${error.message.trim()}`
          : "Planner JSON parse failed.",
      parseWarnings: [],
    };
  }
};

export const parseNextActionPlannerOutput = (value: string): AgentNextAction | null =>
  parseNextActionPlannerOutputWithDiagnostics(value).action;

const validateNextAction = (
  parseResult: PlannerOutputParseResult,
  exposedTools: string[],
): {
  action: AgentNextAction;
  parseErrorReason?: string;
  sanitizedOutput?: string;
  parseWarnings?: string[];
} => {
  if (!parseResult.action) {
    return {
      action: toNextActionFallback(INVALID_PLANNER_OUTPUT_REASON),
      parseErrorReason: parseResult.parseErrorReason ?? INVALID_PLANNER_OUTPUT_REASON,
      sanitizedOutput: parseResult.sanitizedOutput,
      parseWarnings: parseResult.parseWarnings,
    };
  }

  const action = parseResult.action;
  if (action.type === "use_tool" && !exposedTools.includes(action.toolId)) {
    return {
      action: toNextActionFallback(
        "Planner selected a tool that was not exposed for this turn; planner must stop.",
      ),
      sanitizedOutput: parseResult.sanitizedOutput,
      parseWarnings: parseResult.parseWarnings,
    };
  }

  return {
    action,
    sanitizedOutput: parseResult.sanitizedOutput,
    parseWarnings: parseResult.parseWarnings,
  };
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
  const latestEvidenceSummary = getLatestEvidenceSummary({
    evidence: state.evidence,
    observations: state.observations,
  });
  const answerStopDecision = getAnswerStopDecision({
    latestSummary: latestEvidenceSummary,
    pendingApproval: state.pendingApproval,
    errorMessage: state.errorMessage,
  });

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
      latestEvidenceSummary: latestEvidenceSummary ?? null,
      answerStopRuleTriggered: answerStopDecision.shouldAnswer,
      answerStopRuleReason: answerStopDecision.reason,
    },
  });

  let nextAction: AgentNextAction;
  let rawOutput = "";
  let sanitizedOutput = "";
  let parseErrorReason: string | undefined;
  let parseWarnings: string[] | undefined;
  const taskModelInvoked =
    !answerStopDecision.shouldAnswer && !(maxIterations > 0 && iteration >= maxIterations);

  if (answerStopDecision.shouldAnswer) {
    nextAction = {
      type: "answer",
      reason: answerStopDecision.reason,
    };
  } else if (maxIterations > 0 && iteration >= maxIterations) {
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
      latestEvidenceSummary,
    });

    try {
      for await (const delta of providerProxyService.streamTaskChatText(messages)) {
        rawOutput += delta;
      }

      const validationResult = validateNextAction(
        parseNextActionPlannerOutputWithDiagnostics(rawOutput),
        toolExposure.exposedTools,
      );
      nextAction = validationResult.action;
      sanitizedOutput = validationResult.sanitizedOutput ?? "";
      parseErrorReason = validationResult.parseErrorReason;
      parseWarnings = validationResult.parseWarnings;
    } catch (error) {
      nextAction = toNextActionFallback(
        error instanceof Error && error.message.trim()
          ? `Planner task model call failed: ${error.message.trim()}`
          : NEXT_ACTION_PLANNER_FALLBACK_REASON,
      );
    }
  }

  logPlannerDecisionDebug({
    runId: state.runId,
    threadId: state.threadId,
    iteration,
    maxIterations,
    answerStopRuleTriggered: answerStopDecision.shouldAnswer,
    taskModelInvoked,
    nextAction,
    rawOutput,
    sanitizedOutput,
    parseErrorReason,
    parseWarnings,
  });

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
      latestEvidenceSummary: latestEvidenceSummary ?? null,
      answerStopRuleTriggered: answerStopDecision.shouldAnswer,
      answerStopRuleReason: answerStopDecision.reason,
      rawOutputPreview: rawOutput ? toPreview(rawOutput) : undefined,
      sanitizedOutputPreview: sanitizedOutput ? toPreview(sanitizedOutput) : undefined,
      parseErrorReason,
      parseWarnings,
      allowedActionTypes: [...ALLOWED_ACTION_TYPES],
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
