import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import type { AgentGraphState } from "../node-runtime";
import type {
  AgentApprovalRequest,
  AgentEvidencePayload,
  AgentEvidenceSummary,
  AgentObservation,
  AgentPlan,
  AgentRetrievalEvidence,
  AgentSchemaReplanDiagnostics,
  AgentToolExecutionResult,
  AgentToolExposureState,
} from "../types";
import { SCHEMA_REPLAN_ATTEMPT_LIMIT } from "./action-types";

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

const summarizePlannerEvidence = (evidence: AgentEvidencePayload | undefined) => {
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
    latestObservation:
      evidence.observations.length > 0
        ? summarizePlannerObservation(evidence.observations[evidence.observations.length - 1]!)
        : undefined,
    latestToolExecution:
      evidence.toolExecutions.length > 0
        ? summarizePlannerToolExecution(
            evidence.toolExecutions[evidence.toolExecutions.length - 1]!,
          )
        : undefined,
    latestRetrieval:
      evidence.retrievals.length > 0
        ? summarizePlannerRetrieval(evidence.retrievals[evidence.retrievals.length - 1]!)
        : undefined,
    latestEvidenceSummary: evidence.latestSummary,
  };
};

export const normalizeToolExposure = (
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

const summarizeToolSchemas = (toolExposure: AgentToolExposureState) =>
  toolExposure.toolMeta.map((tool) => {
    const schema = tool.inputSchema as
      | {
          properties?: Record<string, { type?: string }>;
          required?: string[];
          additionalProperties?: boolean;
        }
      | undefined;

    return {
      toolId: tool.toolId,
      domain: tool.domain ?? null,
      required: Array.isArray(schema?.required) ? schema.required : [],
      properties: Object.entries(schema?.properties ?? {}).map(([key, value]) => ({
        name: key,
        type: value?.type ?? "unknown",
      })),
      additionalProperties:
        typeof schema?.additionalProperties === "boolean"
          ? schema.additionalProperties
          : undefined,
    };
  });

const buildSchemaReplanMessages = (input: {
  question: string;
  toolExposure: AgentToolExposureState;
  diagnostics: AgentSchemaReplanDiagnostics;
}): NormalizedChatMessage[] => [
  {
    role: "system",
    content: [
      "你正在做一次 bounded replan。",
      "只允许返回一个合法的 nextAction JSON。",
      "允许动作只有 answer / retrieve / use_tool / error。",
      "不要输出 Markdown，不要输出代码块，不要输出解释。",
      "当前 workspace 已绑定。",
      "如果问题明显在问本地 workspace 或本地文件，不要使用 web_search 代替本地证据路径。",
      "如果选择 use_tool，toolId 必须来自允许工具列表，args 必须严格符合 schema。",
    ].join("\n"),
    parts: [],
  },
  {
    role: "user",
    content: JSON.stringify(
      {
        lastUserRequest: input.question,
        workspaceBound: true,
        previousSchemaError: input.diagnostics.schemaError,
        previousInvalidAction: input.diagnostics.invalidAction ?? null,
        allowedTools: summarizeToolSchemas(input.toolExposure),
        instruction:
          "Return exactly one valid nextAction JSON. If no safe local tool action is possible, return an error action.",
      },
      null,
      2,
    ),
    parts: [],
  },
];

export const buildNextActionPlannerMessages = (input: {
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
  schemaReplanDiagnostics?: AgentSchemaReplanDiagnostics;
}): NormalizedChatMessage[] => {
  if (
    input.schemaReplanDiagnostics &&
    input.schemaReplanDiagnostics.attemptCount <= SCHEMA_REPLAN_ATTEMPT_LIMIT
  ) {
    return buildSchemaReplanMessages({
      question: input.question,
      toolExposure: input.toolExposure,
      diagnostics: input.schemaReplanDiagnostics,
    });
  }

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
        "对 workspace-bound read 工具的 path 参数，当前 workspace 根目录一律用 '.' 表示。",
        "不要输出 '/workspace' 作为 path。",
        "不要把 workspace 根目录下的文件写成 '/README.md' 这类类 Unix 绝对路径；应写成 'README.md'。",
        "如果要读取 workspace 根目录下的嵌套文件，应写成 'docs/README.md' 这类 workspace-relative path。",
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
          schemaReplanDiagnostics: input.schemaReplanDiagnostics ?? null,
        },
        null,
        2,
      ),
      parts: [],
    },
  ];
};
