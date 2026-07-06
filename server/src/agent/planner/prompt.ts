import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import type { ToolIntentResult } from "../intent/index";
import type {
  AgentPlan,
  AgentToolExposureState,
  PlannerObservationContext,
} from "../types";
import { SCHEMA_REPLAN_ATTEMPT_LIMIT } from "./action-types";

export const normalizeToolExposure = (
  state: {
    toolExposure?: AgentToolExposureState;
    toolIntent?: ToolIntentResult;
  },
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
  observationContext: PlannerObservationContext;
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
        previousSchemaError: input.observationContext.recovery.schemaError ?? null,
        previousInvalidAction: input.observationContext.recovery.invalidAction ?? null,
        allowedTools: summarizeToolSchemas(input.toolExposure),
        observationContext: input.observationContext,
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
  observationContext: PlannerObservationContext;
  toolExposure: AgentToolExposureState;
  iteration: number;
  maxIterations: number;
}): NormalizedChatMessage[] => {
  if (
    input.observationContext.recovery.attemptCount > 0 &&
    input.observationContext.recovery.attemptCount <= SCHEMA_REPLAN_ATTEMPT_LIMIT
  ) {
    return buildSchemaReplanMessages({
      question: input.question,
      toolExposure: input.toolExposure,
      observationContext: input.observationContext,
    });
  }

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
        "如果 observationContext.latestEvidenceSummary.answerReadiness.canAnswer 为 true，且没有 missingInfo、pendingApproval 或 errorMessage，则下一步必须输出 answer。",
      ].join("\n"),
      parts: [],
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          question: input.question,
          plan: input.plan,
          observationContext: input.observationContext,
          toolExposure: {
            exposedTools: input.toolExposure.exposedTools,
            toolMeta: input.toolExposure.toolMeta,
          },
          iteration: input.iteration,
          maxIterations: input.maxIterations,
        },
        null,
        2,
      ),
      parts: [],
    },
  ];
};
