import type { AgentEvidencePayload, AgentNextAction, AgentToolExposureState } from "../types";

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
const DOCUMENTATION_PRIORITY_HINTS = ["readme", "agents", "docs/"] as const;
const README_FILE_PATTERN = /^readme(?:\.[a-z0-9]{1,12})?$/i;
const LOCATE_TO_OPEN_BRIDGE_REASON =
  "Workspace locate evidence found a likely file target, so the agent will open that file before answering.";

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

const buildListedEntryPath = (basePath: string, entryName: string) => {
  if (basePath === "." || basePath === "/workspace" || basePath === "") {
    return entryName;
  }

  const normalizedBase = basePath.replace(/[\\/]$/, "");
  return `${normalizedBase}/${entryName}`;
};

const toReadOpenAction = (path: string): AgentNextAction => ({
  type: "use_tool",
  toolId: "read_open",
  args: { path },
  reason: LOCATE_TO_OPEN_BRIDGE_REASON,
});

export const getReadOpenBridgeActionFromLocateEvidence = (input: {
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

  const targetPath = result.matches
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => (typeof entry.path === "string" ? entry.path.trim() : ""))
    .filter(Boolean)
    .sort(compareLocatePathPriority)[0];

  return targetPath ? toReadOpenAction(targetPath) : null;
};

export const getReadOpenBridgeActionFromListEvidence = (input: {
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

  const readmeName = result.entries
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .find((entry) => {
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      const type = entry.type === "directory" ? "directory" : "file";
      return type === "file" && README_FILE_PATTERN.test(name);
    });

  const matchedName =
    readmeName && typeof readmeName.name === "string" ? readmeName.name.trim() : "";
  return matchedName
    ? toReadOpenAction(buildListedEntryPath(result.path, matchedName))
    : null;
};
