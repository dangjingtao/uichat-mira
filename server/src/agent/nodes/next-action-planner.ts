/**
 * 下一步规划节点：根据当前状态决定下一步是回答、检索、调用工具还是报错。
 */
import { providerProxyService } from "@/services/provider-proxy.service/index";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import { writeStructuredLog } from "@/logger";
import { toAgentExecutionNode } from "../trace";
import {
  getAnswerStopDecision,
  getLatestEvidenceSummary,
  getRepeatedActionGuardResult,
} from "../evidence";
import type {
  AgentApprovalRequest,
  AgentEvidencePayload,
  AgentEvidenceSummary,
  AgentNextAction,
  AgentObservation,
  AgentPlan,
  AgentRepeatedActionGuardResult,
  AgentRetrievalEvidence,
  AgentSchemaReplanDiagnostics,
  AgentToolExecutionResult,
  AgentToolExposureState,
} from "../types";
import type { AgentGraphState, EmitAgentExecutionNode } from "../node-runtime";

const NEXT_ACTION_PLANNER_FALLBACK_REASON =
  "Planner fallback: unable to safely determine next action.";
const PLANNER_OUTPUT_PREVIEW_LIMIT = 500;
const ALLOWED_ACTION_TYPES = ["answer", "retrieve", "use_tool", "error"] as const;
const INVALID_PLANNER_OUTPUT_REASON =
  "Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.";
const LOCAL_INTENT_GUARD_REASON =
  "Workspace-local intent guard blocked web_search and redirected to a local evidence path.";
const LOCAL_INTENT_SAFE_ERROR_REASON =
  "当前请求需要读取本地 workspace 文件，但本轮没有可用的本地读取工具。请确认 workspace 已绑定后重试。";
const LOCATE_TO_OPEN_BRIDGE_REASON =
  "Workspace locate evidence found a likely file target, so the agent will open that file before answering.";
const SCHEMA_REPLAN_ATTEMPT_LIMIT = 1;
const FILE_CONTENT_TOKENS = [
  "open",
  "read",
  "content",
  "contents",
  "inside",
  "section",
  "runtime",
  "详情",
  "内容",
  "打开",
  "读取",
  "阅读",
  "查看",
  "一节",
] as const;
const WORKSPACE_LOCAL_TOKENS = [
  "workspace",
  "current workspace",
  "local project",
  "project",
  "repository",
  "repo",
  "folder",
  "directory",
  "file",
  "files",
  "readme.md",
  "工作区",
  "本地项目",
  "本地仓库",
  "目录",
  "文件",
  "文件内容",
  "基于文件内容",
] as const;
const RETRIEVE_INTENT_TOKENS = [
  "retrieve",
  "search workspace",
  "look up",
  "find",
  "检索",
  "搜索",
  "查找",
] as const;
const DIRECTORY_LISTING_TOKENS = [
  "list",
  "listing",
  "folder",
  "folders",
  "directory",
  "directories",
  "tree",
  "下面有",
  "有哪些",
  "文件夹",
  "目录",
  "列出",
  "看看文件夹",
] as const;
const LOCATE_QUERY_TRAILING_NOISE = [
  "说明",
  "介绍",
  "定义",
  "内容",
  "是什么",
  "资料",
  "信息",
] as const;
const LOCAL_EVIDENCE_TOOL_IDS = new Set([
  "read_open",
  "read_list",
  "read_locate",
  "read_extract",
  "read_slice",
]);
const DOCUMENTATION_PRIORITY_HINTS = ["readme", "agents", "docs/"] as const;
const README_FILE_PATTERN = /^readme(?:\.[a-z0-9]{1,12})?$/i;

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
  repeatedActionGuard?: AgentRepeatedActionGuardResult;
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
    repeatedToolGuardTriggered: input.repeatedActionGuard?.triggered ?? false,
    repeatedToolGuardReason: input.repeatedActionGuard?.reason,
    guardedActionType: input.repeatedActionGuard?.guardedActionType,
    guardedToolId: input.repeatedActionGuard?.guardedToolId,
    guardedArgsHash: input.repeatedActionGuard?.guardedArgsHash,
    guardedQuery: input.repeatedActionGuard?.guardedQuery,
    matchedEvidenceIndex: input.repeatedActionGuard?.matchedEvidenceIndex,
    matchedToolCallId: input.repeatedActionGuard?.matchedToolCallId,
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

const normalizeIntentText = (value: string) => value.trim().toLowerCase();

const includesAnyToken = (value: string, tokens: readonly string[]) =>
  tokens.some((token) => value.includes(token));

const queryRequestsFileContent = (query: string) => {
  const normalized = normalizeIntentText(query);
  if (includesAnyToken(normalized, FILE_CONTENT_TOKENS)) {
    return true;
  }

  return /[\w.-]+\.[a-z0-9]{1,12}\b/i.test(query);
};

const queryMentionsWorkspaceLocal = (query: string) =>
  includesAnyToken(normalizeIntentText(query), WORKSPACE_LOCAL_TOKENS);

const queryRequestsRetrieve = (query: string) =>
  includesAnyToken(normalizeIntentText(query), RETRIEVE_INTENT_TOKENS);

const queryRequestsDirectoryListing = (query: string) =>
  includesAnyToken(normalizeIntentText(query), DIRECTORY_LISTING_TOKENS);

const trimWrappedPath = (value: string) =>
  value
    .trim()
    .replace(/^["'`]/, "")
    .replace(/["'`]$/, "")
    .trim();

const cleanTrailingPunctuation = (value: string) =>
  value.replace(/[。．，,；;！!？?]+$/u, "").trim();

const extractExplicitPathTarget = (query: string) => {
  const quoted = query.match(/["'`](.+?)["'`]/)?.[1];
  if (quoted) {
    return cleanTrailingPunctuation(trimWrappedPath(quoted));
  }

  const directPathMatch = query.match(/(?:^|[\s(])([a-zA-Z]:\\[^\s)]+|[.~]{0,2}[\\/][^\s)]+)/u);
  if (directPathMatch?.[1]) {
    return cleanTrailingPunctuation(trimWrappedPath(directPathMatch[1]));
  }

  const fileNameMatch = query.match(/\b[\w.-]+\.[a-z0-9]{1,12}\b/i);
  return fileNameMatch?.[0] ? cleanTrailingPunctuation(fileNameMatch[0]) : null;
};

const normalizeWorkspaceLocateQuery = (query: string, originalQuestion: string) => {
  const trimmed = cleanTrailingPunctuation(query).trim();
  if (!trimmed) {
    return cleanTrailingPunctuation(originalQuestion).trim();
  }

  const aboutMatch = originalQuestion.match(
    /关于\s+(.+?)\s+的?(?:说明|介绍|定义|内容|资料|信息)/u,
  );
  if (aboutMatch?.[1]) {
    return cleanTrailingPunctuation(aboutMatch[1]).trim();
  }

  const strippedTrailingNoise = LOCATE_QUERY_TRAILING_NOISE.reduce((value, token) => {
    const pattern = new RegExp(`\\s*${token}\\s*$`, "u");
    return value.replace(pattern, "").trim();
  }, trimmed);

  return strippedTrailingNoise || trimmed;
};

const scoreLocatePathForOpenFollowup = (path: string) => {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  const segments = normalized.split("/").filter(Boolean).length;
  const hasFileExtension = /\.[a-z0-9]{1,12}$/i.test(normalized);
  return [
    hasFileExtension ? 1 : 0,
    DOCUMENTATION_PRIORITY_HINTS.some((token) => normalized.includes(token)) ? 1 : 0,
    -segments,
    -normalized.length,
  ] as const;
};

const compareLocatePathPriority = (left: string, right: string) => {
  const leftScore = scoreLocatePathForOpenFollowup(left);
  const rightScore = scoreLocatePathForOpenFollowup(right);
  for (let index = 0; index < leftScore.length; index += 1) {
    if (leftScore[index] !== rightScore[index]) {
      return rightScore[index] - leftScore[index];
    }
  }

  return left.localeCompare(right);
};

const getReadOpenBridgeActionFromLocateEvidence = (input: {
  question: string;
  toolExposure: AgentToolExposureState;
  evidence: AgentEvidencePayload | undefined;
}) => {
  if (!queryRequestsFileContent(input.question)) {
    return null;
  }

  if (!input.toolExposure.exposedTools.includes("read_open")) {
    return null;
  }

  const latestLocateExecution = [...(input.evidence?.toolExecutions ?? [])]
    .reverse()
    .find(
      (execution) =>
        execution.status === "completed" &&
        execution.toolId === "read_locate" &&
        execution.result &&
        typeof execution.result === "object",
    );
  if (!latestLocateExecution?.result || typeof latestLocateExecution.result !== "object") {
    return null;
  }

  const result = latestLocateExecution.result as Record<string, unknown>;
  if (result.type !== "locate" || !Array.isArray(result.matches)) {
    return null;
  }

  const matchedPaths = result.matches
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => (typeof entry.path === "string" ? entry.path.trim() : ""))
    .filter((path) => Boolean(path))
    .sort(compareLocatePathPriority);
  const targetPath = matchedPaths[0];
  if (!targetPath) {
    return null;
  }

  return {
    type: "use_tool" as const,
    toolId: "read_open",
    args: {
      path: targetPath,
    },
    reason: LOCATE_TO_OPEN_BRIDGE_REASON,
  };
};

const buildListedEntryPath = (basePath: string, entryName: string) => {
  if (basePath === "." || basePath === "/workspace" || basePath === "") {
    return entryName;
  }

  const normalizedBase = basePath.replace(/[\\/]$/, "");
  return `${normalizedBase}/${entryName}`;
};

const getReadOpenBridgeActionFromListEvidence = (input: {
  question: string;
  toolExposure: AgentToolExposureState;
  evidence: AgentEvidencePayload | undefined;
}) => {
  if (!queryRequestsFileContent(input.question)) {
    return null;
  }

  if (!input.toolExposure.exposedTools.includes("read_open")) {
    return null;
  }

  const latestListExecution = [...(input.evidence?.toolExecutions ?? [])]
    .reverse()
    .find(
      (execution) =>
        execution.status === "completed" &&
        execution.toolId === "read_list" &&
        execution.result &&
        typeof execution.result === "object",
    );
  if (!latestListExecution?.result || typeof latestListExecution.result !== "object") {
    return null;
  }

  const result = latestListExecution.result as Record<string, unknown>;
  if (result.type !== "list" || typeof result.path !== "string" || !Array.isArray(result.entries)) {
    return null;
  }

  const matchingReadmeEntry = result.entries
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .find((entry) => {
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      const type = entry.type === "directory" ? "directory" : "file";
      return type === "file" && README_FILE_PATTERN.test(name);
    });
  const readmeName =
    matchingReadmeEntry && typeof matchingReadmeEntry.name === "string"
      ? matchingReadmeEntry.name.trim()
      : "";
  if (!readmeName) {
    return null;
  }

  return {
    type: "use_tool" as const,
    toolId: "read_open",
    args: {
      path: buildListedEntryPath(result.path, readmeName),
    },
    reason: LOCATE_TO_OPEN_BRIDGE_REASON,
  };
};

const isWorkspaceLocalEvidenceToolAction = (input: {
  nextAction: AgentNextAction;
  toolExposure: AgentToolExposureState;
}) => {
  if (input.nextAction.type !== "use_tool") {
    return false;
  }

  const nextToolAction = input.nextAction;

  if (!input.toolExposure.exposedTools.includes(nextToolAction.toolId)) {
    return false;
  }

  const toolMeta = input.toolExposure.toolMeta.find(
    (tool) => tool.toolId === nextToolAction.toolId,
  );
  if (!toolMeta || nextToolAction.toolId === "web_search") {
    return false;
  }

  if (toolMeta.domain === "read") {
    return true;
  }

  if (toolMeta.capabilities?.workspaceBound === true) {
    return true;
  }

  return LOCAL_EVIDENCE_TOOL_IDS.has(nextToolAction.toolId);
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

const getWorkspaceLocalIntentGuardAction = (input: {
  question: string;
  nextAction: AgentNextAction;
  toolExposure: AgentToolExposureState;
  workspaceRoot?: string | null;
  knowledgeBaseId?: string | null;
}) => {
  if (!input.workspaceRoot) {
    return null;
  }

  if (!queryMentionsWorkspaceLocal(input.question)) {
    return null;
  }

  if (
    isWorkspaceLocalEvidenceToolAction({
      nextAction: input.nextAction,
      toolExposure: input.toolExposure,
    })
  ) {
    return null;
  }

  const explicitPath = extractExplicitPathTarget(input.question);
  const exposedToolIds = new Set(input.toolExposure.exposedTools);
  const redirectedWorkspaceQuery =
    input.nextAction.type === "use_tool" &&
    input.nextAction.toolId === "web_search" &&
    typeof input.nextAction.args.query === "string" &&
    input.nextAction.args.query.trim()
      ? input.nextAction.args.query.trim()
      : input.nextAction.type === "retrieve" && input.nextAction.query.trim()
        ? input.nextAction.query.trim()
        : input.question;
  const isWebSearchAction =
    input.nextAction.type === "use_tool" && input.nextAction.toolId === "web_search";
  const isRetrieveWithoutKnowledgeBase =
    input.nextAction.type === "retrieve" && !input.knowledgeBaseId;
  const wantsDirectoryListing = queryRequestsDirectoryListing(input.question);
  const wantsFileContent = queryRequestsFileContent(input.question);
  const wantsRetrieve = queryRequestsRetrieve(input.question);

  if (
    explicitPath &&
    wantsFileContent &&
    exposedToolIds.has("read_open") &&
    (isWebSearchAction || isRetrieveWithoutKnowledgeBase)
  ) {
    return {
      guarded: true,
      nextAction: {
        type: "use_tool" as const,
        toolId: "read_open",
        args: { path: explicitPath },
        reason: LOCAL_INTENT_GUARD_REASON,
      },
      reason: LOCAL_INTENT_GUARD_REASON,
    };
  }

  const shouldRedirectWorkspaceRetrieve =
    wantsRetrieve && (isWebSearchAction || isRetrieveWithoutKnowledgeBase);

  if (shouldRedirectWorkspaceRetrieve && exposedToolIds.has("read_locate")) {
    return {
      guarded: true,
      nextAction: {
        type: "use_tool" as const,
        toolId: "read_locate",
        args: {
          query:
            explicitPath ??
            normalizeWorkspaceLocateQuery(redirectedWorkspaceQuery, input.question),
        },
        reason: LOCAL_INTENT_GUARD_REASON,
      },
      reason: LOCAL_INTENT_GUARD_REASON,
    };
  }

  if (
    wantsDirectoryListing &&
    (isWebSearchAction || isRetrieveWithoutKnowledgeBase) &&
    exposedToolIds.has("read_list")
  ) {
    return {
      guarded: true,
      nextAction: {
        type: "use_tool" as const,
        toolId: "read_list",
        args: {
          path: ".",
        },
        reason: LOCAL_INTENT_GUARD_REASON,
      },
      reason: LOCAL_INTENT_GUARD_REASON,
    };
  }

  if (wantsFileContent && explicitPath && exposedToolIds.has("read_open")) {
    return {
      guarded: true,
      nextAction: {
        type: "use_tool" as const,
        toolId: "read_open",
        args: {
          path: explicitPath,
        },
        reason: LOCAL_INTENT_GUARD_REASON,
      },
      reason: LOCAL_INTENT_GUARD_REASON,
    };
  }

  if ((isWebSearchAction || isRetrieveWithoutKnowledgeBase) && exposedToolIds.has("read_locate")) {
    return {
      guarded: true,
      nextAction: {
        type: "use_tool" as const,
        toolId: "read_locate",
        args: {
          query:
            explicitPath ??
            normalizeWorkspaceLocateQuery(redirectedWorkspaceQuery, input.question),
        },
        reason: LOCAL_INTENT_GUARD_REASON,
      },
      reason: LOCAL_INTENT_GUARD_REASON,
    };
  }

  if ((isWebSearchAction || isRetrieveWithoutKnowledgeBase) && exposedToolIds.has("read_list")) {
    return {
      guarded: true,
      nextAction: {
        type: "use_tool" as const,
        toolId: "read_list",
        args: {
          path: ".",
        },
        reason: LOCAL_INTENT_GUARD_REASON,
      },
      reason: LOCAL_INTENT_GUARD_REASON,
    };
  }

  return {
    guarded: true,
    nextAction: {
      type: "error" as const,
      reason: LOCAL_INTENT_SAFE_ERROR_REASON,
    },
    reason: LOCAL_INTENT_GUARD_REASON,
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
      schemaReplanAttemptCount: state.schemaReplanDiagnostics?.attemptCount ?? 0,
      schemaReplanError: state.schemaReplanDiagnostics?.schemaError ?? null,
    },
  });

  let nextAction: AgentNextAction;
  let rawOutput = "";
  let sanitizedOutput = "";
  let parseErrorReason: string | undefined;
  let parseWarnings: string[] | undefined;
  let repeatedActionGuard: AgentRepeatedActionGuardResult | undefined;
  let localIntentGuardTriggered = false;
  let localIntentGuardReason: string | undefined;
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
    const listToOpenBridgeAction = getReadOpenBridgeActionFromListEvidence({
      question,
      toolExposure,
      evidence: state.evidence,
    });
    const locateToOpenBridgeAction = getReadOpenBridgeActionFromLocateEvidence({
      question,
      toolExposure,
      evidence: state.evidence,
    });
    if (listToOpenBridgeAction) {
      nextAction = listToOpenBridgeAction;
    } else if (locateToOpenBridgeAction) {
      nextAction = locateToOpenBridgeAction;
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
      schemaReplanDiagnostics: state.schemaReplanDiagnostics,
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
      const localIntentGuardAction = getWorkspaceLocalIntentGuardAction({
        question,
        nextAction,
        toolExposure,
        workspaceRoot: state.workspaceRoot,
        knowledgeBaseId: state.knowledgeBaseId,
      });
      if (localIntentGuardAction?.guarded) {
        nextAction = localIntentGuardAction.nextAction;
        localIntentGuardTriggered = true;
        localIntentGuardReason = localIntentGuardAction.reason;
      }
      repeatedActionGuard = getRepeatedActionGuardResult({
        evidence: state.evidence,
        nextAction,
      });
      if (repeatedActionGuard.triggered) {
        nextAction = {
          type: "answer",
          reason:
            repeatedActionGuard.reason ??
            "Repeated action guard blocked a duplicate action and will answer from existing evidence.",
        };
      }
    } catch (error) {
      nextAction = toNextActionFallback(
        error instanceof Error && error.message.trim()
          ? `Planner task model call failed: ${error.message.trim()}`
          : NEXT_ACTION_PLANNER_FALLBACK_REASON,
      );
    }
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
    repeatedActionGuard,
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
      repeatedToolGuardTriggered: repeatedActionGuard?.triggered ?? false,
      repeatedToolGuardReason: repeatedActionGuard?.reason,
      guardedActionType: repeatedActionGuard?.guardedActionType,
      guardedToolId: repeatedActionGuard?.guardedToolId ?? null,
      guardedArgsHash: repeatedActionGuard?.guardedArgsHash,
      guardedQuery: repeatedActionGuard?.guardedQuery,
      matchedEvidenceIndex: repeatedActionGuard?.matchedEvidenceIndex,
      matchedToolCallId: repeatedActionGuard?.matchedToolCallId,
      localIntentGuardTriggered,
      localIntentGuardReason: localIntentGuardReason ?? null,
      schemaReplanAttemptCount: state.schemaReplanDiagnostics?.attemptCount ?? 0,
      schemaReplanError: state.schemaReplanDiagnostics?.schemaError ?? null,
      allowedActionTypes: [...ALLOWED_ACTION_TYPES],
    },
  });

  return {
    nextAction,
    ...(nextAction.type === "error" && state.schemaReplanDiagnostics
      ? {
          schemaReplanDiagnostics: state.schemaReplanDiagnostics,
        }
      : {}),
    ...(nextAction.type === "error"
      ? {
          errorMessage: nextAction.reason,
          blockedReason: nextAction.reason,
          errorSourceNodeId: "agent-next-action-planner",
        }
      : {}),
  };
};
