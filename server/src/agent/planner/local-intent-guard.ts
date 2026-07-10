import type { AgentNextAction, AgentToolExposureState } from "../types";

// V1.5 legacy safety guard. V1.6 should migrate this into harness exposure contract.
const LOCAL_INTENT_GUARD_REASON =
  "Workspace-local intent guard blocked web_search and redirected to a local evidence path.";
const LOCAL_INTENT_SAFE_ERROR_REASON =
  "当前请求需要读取本地 workspace 文件，但本轮没有可用的本地读取工具。请确认 workspace 已绑定后重试。";
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

const normalizeIntentText = (value: string) => value.trim().toLowerCase();

const includesAnyToken = (value: string, tokens: readonly string[]) =>
  tokens.some((token) => value.includes(token));

const queryMentionsWorkspaceLocal = (query: string) =>
  includesAnyToken(normalizeIntentText(query), WORKSPACE_LOCAL_TOKENS);

const queryRequestsRetrieve = (query: string) =>
  includesAnyToken(normalizeIntentText(query), RETRIEVE_INTENT_TOKENS);

const queryRequestsDirectoryListing = (query: string) =>
  includesAnyToken(normalizeIntentText(query), DIRECTORY_LISTING_TOKENS);

const queryRequestsFileContent = (query: string) => {
  const normalized = normalizeIntentText(query);
  if (includesAnyToken(normalized, FILE_CONTENT_TOKENS)) {
    return true;
  }

  return /[\w.-]+\.[a-z0-9]{1,12}\b/i.test(query);
};

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

export const getWorkspaceLocalIntentGuardAction = (input: {
  question: string;
  nextAction: AgentNextAction;
  toolExposure: AgentToolExposureState;
  workspaceRoot?: string | null;
  knowledgeBaseId?: string | null;
}) => {
  if (!input.workspaceRoot || !queryMentionsWorkspaceLocal(input.question)) {
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

  if (wantsRetrieve && (isWebSearchAction || isRetrieveWithoutKnowledgeBase)) {
    if (exposedToolIds.has("read_locate")) {
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
        args: { path: "." },
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
        args: { path: explicitPath },
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
        args: { path: "." },
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

export { LOCAL_INTENT_GUARD_REASON };
