import { ConversationTrimmer } from "@/services/conversation-trimmer.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import type {
  AgentToolExposureState,
  PlannerObservationContext,
} from "../types";
import { getRemainingPlannerRecoveryAttempts } from "../recovery";

export const normalizeToolExposure = (
  state: {
    toolExposure?: AgentToolExposureState;
  },
): AgentToolExposureState => {
  return state.toolExposure ?? {
    exposedTools: [],
    toolMeta: [],
  };
};

const summarizeToolSchemas = (toolExposure: AgentToolExposureState) =>
  toolExposure.toolMeta.map((tool) => {
    const capabilities = tool.capabilities;
    const plannerDescription =
      tool.toolId === "read_discover"
        ? "Discover candidate files, directories, symbols, or keyword locations without opening file bodies."
        : tool.toolId === "read_open"
          ? "Open a known target and optionally read only a selected section; do not use it for fuzzy discovery or to mechanically reopen CodeGraph-verified source excerpts."
          : tool.toolId === "codebase_explore"
            ? "Primary local code-understanding tool. Successful results include bounded workspace-verified source excerpts with paths and line ranges. Those verified excerpts already count as source-body evidence; use read_open only for a specific unresolved target or missing surrounding context."
            : tool.description;

    return {
      toolId: tool.toolId,
      description: plannerDescription,
      domain: tool.domain ?? null,
      source: tool.source ?? null,
      risk: {
        requiresApproval: capabilities?.requiresApproval ?? false,
        sideEffect: capabilities?.sideEffect ?? "unknown",
        workspaceBound: capabilities?.workspaceBound ?? false,
        longRunning: capabilities?.longRunning ?? false,
      },
      boundaries: {
        workspace:
          capabilities?.workspaceBound === true
            ? "workspace-bound"
            : "not workspace-bound",
        sandbox:
          capabilities?.sideEffect === "none"
            ? "read-only or observation-only"
            : "may mutate state or spawn runtime side effects",
      },
      inputSchema: tool.inputSchema,
    };
  });

const getRemainingRecoveryAttempts = (observationContext: PlannerObservationContext) =>
  getRemainingPlannerRecoveryAttempts(observationContext.recovery);

const PLANNER_HISTORY_LIMIT = 12;
const PLANNER_HISTORY_ITEM_CHAR_LIMIT = 700;

const buildRelevantConversationHistory = (
  messages: NormalizedChatMessage[] | undefined,
  currentRequest: string,
) => {
  if (!messages?.length) {
    return undefined;
  }

  const filtered = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: ConversationTrimmer.trimText(
        message.content,
        PLANNER_HISTORY_ITEM_CHAR_LIMIT,
      ),
    }))
    .filter(
      (message) =>
        !(message.role === "user" && message.content.trim() === currentRequest.trim()),
    );
  const recent = ConversationTrimmer.take(filtered, PLANNER_HISTORY_LIMIT, "tail");

  return recent.length > 0 ? recent : undefined;
};

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
    "把每次工具或检索结果视为新的 observation；基于完整原始目标和累计执行历史滚动决定下一步。",
    "currentTaskFrame.skillRuntime.requirements 是 Skill 执行返回的结构化缺失条件，只描述缺什么和影响什么；它不是用户问题，也不是 nextAction。只有你可以判断它是否阻塞 globalGoal，并在确实阻塞时输出 ask_user、自己组织面向用户的问题。",
    "Skill requirement 当前不阻塞主线时，不要追问；继续其他可执行工作，并把未解决缺口保留在 remainingWork。不要把 skillRuntime、sessionId 或 stateRef 当作 workspace 文件线索去搜索。",
    "Skill 内部 TaskModel 调用属于 Skill Runtime 的受治理内部执行步骤，不需要你申请、调度或转换成用户追问。",
    "answer 是终止动作。只有完整用户目标中的每一项明确要求都已被执行证据覆盖时，才能选择 answer。",
    "不要只看 latestEvidenceSummary；必须同时检查 currentTaskFrame.completionCriteria、累计 executionHistory 和 evidenceHistory。",
    "CodeGraph 的 verifiedSource[...] 是已经重新读取 workspace 原文件后得到的正文证据，包含 path、line range、summary 与 excerpt；它不是普通 discover 候选。",
    "如果 CodeGraph verifiedSource 已覆盖当前问题所需实现细节，不要为了形式验证而逐个 read_open 同一批文件。只有存在明确 gap、缺失行号、被截断上下文、unverifiable/rejected candidate，或必须展开某个具体函数的相邻上下文时，才针对那个具体目标使用 read_open。",
    "代码架构/调用链任务优先先用 codebase_explore 缩小并解释搜索空间，再按明确缺口做少量 targeted read_open；禁止退化成无目标的逐文件 read_open crawl。",
    "如果上一次工具或检索失败但仍可恢复，不要默认输出 error。",
    "可恢复失败时，你可以：换参数重试同一工具、换另一个工具、先读取辅助文件或目录、ask_user，或在确实无法继续时选择 answer 并明确说明未完成项与失败影响。",
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
      `当前迭代进度为 ${input.iteration}/${input.maxIterations}；接近上限时优先执行最关键的剩余动作。迭代上限不是任务已经完成的证据，不得因此提前 answer。`,
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
      "Skill requirements 只是缺失条件事实；只有 Planner 可以在判断其阻塞完整目标后选择 ask_user 并组织用户问题。不要把 Skill stateRef 当作 workspace 路径。",
      "CodeGraph verifiedSource 是已重新读取原文件的正文证据；不要机械 read_open 同一批已验证文件，只补明确缺口。",
      "这次 replan 的目标是修正上一次失败动作：你可以改参数、换工具、ask_user，或在确实无法继续时输出明确终局。",
      "answer 是终止动作；只有完整用户目标已经覆盖，或确实无法继续且会明确报告未完成项时才能选择。",
      "不要假装上一次工具已经成功，也不要重复同一个错误参数。",
    ].join("\n"),
    parts: [],
  },
  {
    role: "user",
    content: JSON.stringify(
      {
        currentUserRequest: input.question,
        workspaceBound: true,
        previousSchemaError: input.observationContext.recovery.schemaError ?? null,
        previousInvalidAction: input.observationContext.recovery.invalidAction ?? null,
        remainingRecoveryAttempts: getRemainingRecoveryAttempts(
          input.observationContext,
        ),
        allowedTools: summarizeToolSchemas(input.toolExposure),
        observationContext: input.observationContext,
        instruction:
          "Return exactly one valid nextAction JSON. Prefer a concrete recovery move; if a missing fact must come from the user, return ask_user; only return answer/error when you can explain why no executable progression remains or why the complete goal is already covered.",
      },
      null,
      2,
    ),
    parts: [],
  },
];

export const buildNextActionPlannerMessages = (input: {
  question: string;
  messages?: NormalizedChatMessage[];
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
        "你是完整用户任务的唯一语义控制器：Harness 和 Evidence 只报告事实，不能替你宣布任务完成。",
        "currentTaskFrame.globalGoal 是稳定总目标：普通追问回答、补充信息、授权、执行结果和 planPatch 都不能把它改写成当前一句话或当前步骤。",
        "currentUserRequest 必须按用户原文保留；recentConversationHistory 是受限长度的最近对话，只用于你理解本轮请求与未完成任务的关系。",
        "当前请求可能只是对最近具体任务的授权、继续执行指示或执行方式修正。如果有限历史唯一确定了一个尚未完成的具体任务，你必须把当前请求与该任务合并理解，不能仅因本轮省略了目标就要求用户重新描述。",
        "如果有限历史存在多个可能目标或无法唯一确定要继续的任务，才使用 ask_user 澄清；不要自行猜测或继承不明确的任务。",
        "当你从有限历史继承任务语义时，planPatch.addItems 的 text 必须写出完整的语义目标和必要完成条件，不能只记录本轮的授权或方式说明；敏感值只需表述为已由用户提供，不要复制到计划文本；若工具和参数已经齐备，应在同一决策中直接选择 use_tool。",
        "你必须只输出 JSON，不要输出解释性自然语言，不要输出 Markdown，不要输出代码块。",
        "允许输出的 JSON 只有五种：",
        '{"type":"answer","reason":"...","completionProof":[{"criterion":"...","evidenceRefs":["tool:0"]}],"unresolvedGaps":[]}',
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
        "先逐项核对完整用户目标，再决定 answer。answer 等于停止整个 Agent Loop，不等于当前步骤完成。",
        "某一条 evidence 可解释，不等于整项任务已经完成。",
        "如果任务有多个目标，只完成一部分时不要提前 answer。",
        "读到一个文件只证明该读取动作完成；如果用户还要求比较、修改、发送、运行或验证，必须继续。",
        "如果最新 evidence 仍有 gaps、missing、truncated、timed_out 或明确 error，不要只因为拿到结果就 answer。",
        "read_discover 只负责发现对象；需要正文时应继续选择 read_open。",
        "codebase_explore 不属于普通 discover：其 verifiedSource[...] 是经过 workspace 原文件复读验证的正文证据，已覆盖的文件和行范围不得机械再次 read_open。",
        "只有当 CodeGraph 明确留下 gap、unverifiable/rejected candidate、缺少所需行范围、excerpt 被截断，或当前任务必须展开一个具体函数的相邻上下文时，才对那个具体目标执行 targeted read_open。",
        "如果 discover 的结构化结果已经足够支撑完整目标，可以直接 answer，不要机械追加 open。",
        "只有关键目标或关键参数确实无法从当前请求、有限历史和证据中推断时，才 ask_user。",
        "如果相同 toolId 和 args 已经有成功 evidence 且没有新 gap，通常应复用证据而不是重复调用。",
        "任何 answer 都必须基于累计 Evidence，不能编造工具执行、检索结果或文件事实。",
        "选择 answer 时，reason 必须逐项说明 completionCriteria 如何被累计 executionHistory/evidenceHistory 覆盖；存在未覆盖项就必须继续行动。",
        "选择 answer 时必须输出 completionProof；每项包含 criterion 和 evidenceRefs。evidenceRefs 只能逐字使用 observationContext.evidenceCatalog 中存在的 ref。",
        "如果某项完成条件只依赖用户原始请求而不依赖执行证据，该项 evidenceRefs 可以为空数组；不得伪造 Evidence ref。",
        "选择 answer 时 unresolvedGaps 必须是空数组；只要仍有 gap，就必须继续行动、ask_user 或 error。",
        "Evidence 只记录工具、检索和策略事实；是否回答、继续、检索或询问用户，必须由 Planner 自主决定。",
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
          currentUserRequest: input.question,
          recentConversationHistory: buildRelevantConversationHistory(
            input.messages,
            input.question,
          ),
          completionContract: {
            originalGoal:
              input.observationContext.currentTaskFrame?.globalGoal ??
              input.observationContext.currentTaskFrame?.currentGoal ??
              input.question,
            completionCriteria:
              input.observationContext.currentTaskFrame?.completionCriteria ?? [
                input.question,
              ],
            rule:
              "Choose answer only after every explicit requirement is covered by accumulated execution evidence. Otherwise choose the next executable action.",
          },
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
            toolMeta: summarizeToolSchemas(input.toolExposure),
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
