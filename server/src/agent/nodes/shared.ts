/**
 * 节点共享工具：提供各节点通用的观察创建、意图解析和路径提取等辅助函数。
 */
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import { toAgentExecutionNode } from "../trace";
import { emitStepNode } from "../node-runtime";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";
import type { AgentObservation } from "../types";

export const nowIso = () => new Date().toISOString();

const HIGH_RISK_WORKSPACE_MUTATION_PATTERNS = [
  /\b(delete|remove|rm|move|mv|rename|write|overwrite|modify|patch|replace)\b/i,
  /(删除|移除|删掉|移动|重命名|写入|覆盖|修改|替换)/,
];

const isHighRiskWorkspaceMutationRequest = (query: string) =>
  HIGH_RISK_WORKSPACE_MUTATION_PATTERNS.some((pattern) => pattern.test(query));

const getTerminalAutoExecutionBlockReason = (query: string) =>
  isHighRiskWorkspaceMutationRequest(query)
    ? "High-risk workspace mutations are blocked until a managed workspace tool exists for this operation."
    : "Agent does not auto-build terminal_session.command. Terminal execution must wait for explicit, reviewed parameters.";

const trimWrappedPath = (value: string) =>
  value
    .trim()
    .replace(/^["'`]/, "")
    .replace(/["'`]$/, "")
    .trim();

const extractQuotedValue = (query: string) => {
  const match = query.match(/["'`](.+?)["'`]/);
  return match ? trimWrappedPath(match[1]) : null;
};

const cleanTrailingPunctuation = (value: string) =>
  value.replace(/[。．，,；;！!？?]+$/u, "").trim();

export const extractExplicitPathTarget = (query: string) => {
  const quoted = extractQuotedValue(query);
  if (quoted) {
    return cleanTrailingPunctuation(quoted);
  }

  const directPathMatch = query.match(/(?:^|[\s(])([a-zA-Z]:\\[^\s)]+|[.~]{0,2}[\\/][^\s)]+)/u);
  if (directPathMatch?.[1]) {
    return cleanTrailingPunctuation(trimWrappedPath(directPathMatch[1]));
  }

  const fileNameMatch = query.match(/\b[\w.-]+\.[a-z0-9]{1,12}\b/i);
  return fileNameMatch?.[0] ? cleanTrailingPunctuation(fileNameMatch[0]) : null;
};

const getWorkspaceMutationBlockReason = (query: string) =>
  isHighRiskWorkspaceMutationRequest(query)
    ? "High-risk workspace mutation request could not be converted into reviewed structured parameters."
    : "Workspace mutation execution requires explicit structured parameters.";

export const createObservation = (input: {
  runId: string;
  stepId: string;
  status: AgentObservation["status"];
  facts: string[];
  errorMessage?: string;
}): AgentObservation => ({
  id: crypto.randomUUID(),
  runId: input.runId,
  stepId: input.stepId,
  status: input.status,
  facts: input.facts,
  ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
  createdAt: nowIso(),
});

export const getLatestUserQuestion = (messages: NormalizedChatMessage[]) => {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  return latest?.content.trim() ?? "";
};

export const emitNodeError = async (
  emit: EmitAgentExecutionNode | undefined,
  input: {
    runId: string;
    nodeId: string;
    label: string;
    summary: string;
    details?: Record<string, unknown>;
  },
) => {
  await emit?.(
    toAgentExecutionNode({
      runId: input.runId,
      nodeId: input.nodeId,
      nodeType: "error",
      phase: "error",
      label: input.label,
      summary: input.summary,
      details: input.details,
    }),
  );
};

export const emitApprovalNode = async (
  emit: EmitAgentExecutionNode | undefined,
  input: {
    runId: string;
    nodeId: string;
    label: string;
    summary: string;
    details?: Record<string, unknown>;
  },
) => {
  await emit?.(
    toAgentExecutionNode({
      runId: input.runId,
      nodeId: input.nodeId,
      nodeType: "approval",
      phase: "done",
      label: input.label,
      summary: input.summary,
      details: input.details,
    }),
  );
};

export const emitEvidenceUpdateNode = async (
  emit: EmitAgentExecutionNode | undefined,
  input: {
    runId: string;
    nodeId: string;
    summary: string;
    details: Record<string, unknown>;
  },
) => {
  await emitStepNode(emit, {
    runId: input.runId,
    nodeId: input.nodeId,
    nodeType: "reason",
    phase: "done",
    label: "证据写回",
    summary: input.summary,
    details: input.details,
  });
};

const DIRECTORY_OVERVIEW_TOKENS = [
  "list",
  "show",
  "what's in",
  "what is in",
  "contents",
  "under",
  "inside",
  "有哪些",
  "有啥",
  "有什么",
  "列出",
  "内容",
  "看看",
];

const FILE_CONTENT_TOKENS = [
  "open",
  "read",
  "content",
  "contents",
  "inside",
  "详情",
  "内容",
  "打开",
  "读取",
  "阅读",
  "查看",
];

const WORKSPACE_TOKENS = [
  "workspace",
  "folder",
  "directory",
  "repo",
  "repository",
  "project",
  "file",
  "files",
  "文件",
  "文件夹",
  "目录",
  "工作区",
  "项目",
  "仓库",
];

const normalizeIntentText = (value: string) => value.trim().toLowerCase();

const includesAnyToken = (value: string, tokens: string[]) =>
  tokens.some((token) => value.includes(token));

export const queryRequestsDirectoryOverview = (query: string) =>
  includesAnyToken(normalizeIntentText(query), DIRECTORY_OVERVIEW_TOKENS);

export const queryRequestsFileContent = (query: string) => {
  const normalized = normalizeIntentText(query);
  if (includesAnyToken(normalized, FILE_CONTENT_TOKENS)) {
    return true;
  }

  return /[\w-]+\.[a-z0-9]{1,12}\b/i.test(query);
};

export const queryMentionsWorkspace = (query: string) =>
  includesAnyToken(normalizeIntentText(query), WORKSPACE_TOKENS);

export const answerClaimsUnverifiedObservation = (answer: string) => {
  const normalized = answer.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const patterns = [
    /i (checked|looked at|opened|searched|found|read)\b/i,
    /(我已|我刚|我查看了|我看了|我打开了|我搜索了|我找到了|我读取了)/u,
    /(根据(文件|目录|网页|知识库|检索结果|工具结果))/u,
    /(search results|tool result|retrieved context|knowledge base)/i,
  ];

  return patterns.some((pattern) => pattern.test(answer));
};
