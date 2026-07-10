import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import type { ToolIntentResult } from "../intent/index";
import type {
  AgentToolExposureState,
  PlannerObservationContext,
} from "../types";
import { getRemainingPlannerRecoveryAttempts } from "../recovery";

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

const getRemainingRecoveryAttempts = (observationContext: PlannerObservationContext) =>
  getRemainingPlannerRecoveryAttempts(observationContext.recovery);

const buildProgressionRules = (input: {
  observationContext: PlannerObservationContext;
  iteration: number;
  maxIterations: number;
}) => {
  const latestObservation = input.observationContext.latestObservation;
  const remainingRecoveryAttempts = getRemainingRecoveryAttempts(
    input.observationContext,
  );
  const latestStatus = latestObservation?.status;
  const latestToolId = latestObservation?.toolId;
  const latestRecoverable = latestObservation?.recoverable === true;
  const rules = [
    "你必须根据 PlannerObservationContext 决定下一步，而不是忽略最近一次执行结果。",
    "如果上一次工具或检索失败但仍可恢复，不要默认输出 error。",
    "可恢复失败时，你可以：换参数重试同一工具、换另一个工具、先读取辅助文件或目录、ask_user，或在已有证据足够时直接 answer 说明失败影响。",
    "任何 use_tool 都只是提出动作，后续仍然必须经过 normalize / policy / approval；不要假装工具已经成功。",
    "不要无理由重复同一个失败调用；相同 toolId 只有在参数明显变化或理由明确时才能重试。",
  ];

  if (latestRecoverable) {
    rules.push(
      `最近一次 observation 是可恢复失败${
        latestToolId ? `（toolId=${latestToolId}）` : ""
      }；优先给出恢复动作，不要直接收成全局 error。`,
    );
  }

  if (latestStatus === "failed_terminal") {
    rules.push(
      "最近一次 observation 已经是终止失败；如果没有新的安全恢复路径，应输出明确终局，而不是继续假装推进。",
    );
  }

  if (remainingRecoveryAttempts <= 0) {
    rules.push(
      "当前恢复预算已经用完；必须给出明确终局，选择 ask_user 补齐关键信息，或 answer/error 清楚说明为什么无法继续，不能无限循环。",
    );
  } else {
    rules.push(
      `当前恢复预算还剩 ${remainingRecoveryAttempts} 次；如果继续恢复，必须说明这次为什么与上次不同。`,
    );
  }

  if (input.maxIterations > 0) {
    rules.push(
      `当前迭代进度为 ${input.iteration}/${input.maxIterations}；接近上限时优先收成明确结论，不要空转。`,
    );
  }

  return rules;
};

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
      "允许动作只有 answer / retrieve / use_tool / ask_user / error。",
      "不要输出 Markdown，不要输出代码块，不要输出解释。",
      "当前 workspace 已绑定。",
      "如果问题明显在问本地 workspace 或本地文件，不要使用 web_search 代替本地证据路径。",
      "如果选择 use_tool，toolId 必须来自允许工具列表，args 必须严格符合 schema。",
      "这次 replan 的目标是修正上一次失败动作：你可以改参数、换工具、ask_user，或在确实无法继续时输出明确终局。",
      "不要假装上一次工具已经成功，也不要重复同一个错误参数。",
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
        remainingRecoveryAttempts: getRemainingRecoveryAttempts(
          input.observationContext,
        ),
        allowedTools: summarizeToolSchemas(input.toolExposure),
        observationContext: input.observationContext,
        instruction:
          "Return exactly one valid nextAction JSON. Prefer a concrete recovery move; if a missing fact must come from the user, return ask_user; only return error when you can explain why no safe progression remains.",
      },
      null,
      2,
    ),
    parts: [],
  },
];

export const buildAnswerCompletionReplanMessages = (input: {
  question: string;
  observationContext: PlannerObservationContext;
  toolExposure: AgentToolExposureState;
  iteration: number;
  maxIterations: number;
  blockedAnswerReason: string;
  previousAnswerReason: string;
}): NormalizedChatMessage[] => [
  {
    role: "system",
    content: [
      "你正在做一次 bounded completion replan。",
      "上一次 planner 输出了 answer，但这个 answer 被任务完成判定挡回。",
      "这次禁止再次输出 answer，除非你能基于当前证据明确说明为什么已经没有安全推进路径且只能终局。",
      "你必须改为给出下一步推进动作：retrieve、use_tool、ask_user，或在确实无法继续时输出 error。",
      "如果选择 use_tool，toolId 必须来自允许工具列表，args 必须严格符合 schema。",
      "不要假装工具已经成功，也不要把还能继续自主推进的情况直接改成人工确认。",
      ...buildProgressionRules({
        observationContext: input.observationContext,
        iteration: input.iteration,
        maxIterations: input.maxIterations,
      }),
    ].join("\n"),
    parts: [],
  },
  {
    role: "user",
    content: JSON.stringify(
      {
        question: input.question,
        observationContext: input.observationContext,
        blockedAnswerReason: input.blockedAnswerReason,
        previousAnswerReason: input.previousAnswerReason,
        toolExposure: {
          exposedTools: input.toolExposure.exposedTools,
          toolMeta: input.toolExposure.toolMeta,
        },
        instruction:
          "Return exactly one valid nextAction JSON. Do not return answer again just because the latest evidence looks answerable. Prefer the next autonomous step that closes the missing coverage.",
      },
      null,
      2,
    ),
    parts: [],
  },
];

export const buildNextActionPlannerMessages = (input: {
  question: string;
  observationContext: PlannerObservationContext;
  toolExposure: AgentToolExposureState;
  iteration: number;
  maxIterations: number;
}): NormalizedChatMessage[] => {
  if (
    input.observationContext.recovery.source === "schema_replan" &&
    !input.observationContext.recovery.exhausted
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
        "允许输出的 JSON 只有五种：",
        '{"type":"answer","reason":"..."}',
        '{"type":"retrieve","query":"...","reason":"..."}',
        '{"type":"use_tool","toolId":"...","args":{},"reason":"..."}',
        '{"type":"ask_user","question":"...","reason":"..."}',
        '{"type":"error","reason":"..."}',
      "如果你选择 use_tool，toolId 必须来自当前暴露的真实工具列表，args 必须是 JSON object。",
      "不要输出 capabilityId，不要发明未暴露工具，不要输出额外字段。",
      "对 workspace-bound read 工具的 path 参数，当前 workspace 根目录一律用 '.' 表示。",
      "不要输出 '/workspace' 作为 path。",
      "不要把 workspace 根目录下的文件写成 '/README.md' 这类类 Unix 绝对路径；应写成 'README.md'。",
      "如果要读取 workspace 根目录下的嵌套文件，应写成 'docs/README.md' 这类 workspace-relative path。",
      "对 terminal_session.cwd，只能输出 workspace-relative directory。",
      "如果命令就在 workspace 根目录执行，优先省略 cwd，或把 cwd 写成 '.'。",
      "不要把 terminal_session.cwd 写成 Windows 绝对路径、POSIX 绝对路径或父级跳转，例如 'D:\\workspace\\rag-demo'、'/workspace'、'..'、'../server'。",
      "必须同时区分“latest evidence 可局部回答”和“当前任务已经完成”。",
      "只有当 observationContext.taskCoverageView.taskCompletable 为 true，且 pendingTargets 与 pendingActions 都为空时，answer 才是合法输出。",
      "如果 observationContext.taskCoverageView 仍有 pendingTargets 或 pendingActions，你必须输出能继续补齐覆盖缺口的 retrieve、use_tool、ask_user 或 error，而不是提前 answer。",
      ...buildProgressionRules({
        observationContext: input.observationContext,
        iteration: input.iteration,
          maxIterations: input.maxIterations,
        }),
      ].join("\n"),
      parts: [],
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          question: input.question,
          observationContext: input.observationContext,
          progression: {
            remainingRecoveryAttempts: getRemainingRecoveryAttempts(
              input.observationContext,
            ),
            latestObservationStatus:
              input.observationContext.latestObservation?.status ?? null,
            latestObservationRecoverable:
              input.observationContext.latestObservation?.recoverable ?? false,
          },
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
