export const DEFAULT_TOP_K = 10;
export const DEFAULT_MIN_SCORE = 0.15;
export const DEFAULT_MAX_TOOLS = 8;
export const TOOL_EXPOSURE_RECALL_THRESHOLD = 20;

const normalizeQueryText = (value: string) => value.trim().toLowerCase();

const tokenize = (value: string) =>
  normalizeQueryText(value)
    .split(/[\s,.;:!?，。；：！？/\\()\-_\[\]{}]+/g)
    .map((token) => token.trim())
    .filter(Boolean);

const RULE_HINTS: Record<string, string[]> = {
  workspace_lookup: [
    "file",
    "files",
    "folder",
    "directory",
    "read",
    "open",
    "locate",
    "find",
    "文档",
    "文件",
    "文件夹",
    "目录",
    "打开",
    "查找",
    "定位",
    "列出",
    "看看",
  ],
  workspace_edit: ["edit", "write", "replace", "modify", "patch", "修改", "编辑", "写入", "替换"],
  web_research: ["latest", "current", "news", "web", "search", "today", "最新", "当前", "搜索", "联网"],
  terminal_execution: ["terminal", "command", "shell", "run", "cmd", "powershell", "命令", "终端", "执行"],
};

export const computeRuleScore = (input: {
  query: string;
  capabilityId: string;
  title: string;
  tags: string[];
  domain: string;
}) => {
  const query = normalizeQueryText(input.query);
  if (!query) {
    return 0;
  }

  const queryTokens = new Set(tokenize(query));
  const surfaceTokens = new Set([
    ...tokenize(input.title),
    ...input.tags.flatMap((tag) => tokenize(tag)),
    ...tokenize(input.domain),
    ...(RULE_HINTS[input.capabilityId] ?? []),
  ]);

  let score = 0;
  for (const token of queryTokens) {
    if (surfaceTokens.has(token)) {
      score += 0.18;
    }
  }

  if (query.includes("最新") || query.includes("current") || query.includes("today")) {
    if (input.domain === "web_search" || input.capabilityId === "web_research") {
      score += 0.2;
    }
  }

  if (query.includes("文件") || query.includes("readme") || query.includes("workspace")) {
    if (input.domain === "read") {
      score += 0.15;
    }
  }

  if (
    query.includes("文件夹") ||
    query.includes("目录") ||
    query.includes("folder") ||
    query.includes("directory")
  ) {
    if (input.domain === "read") {
      score += 0.22;
    }
  }

  if (query.includes("修改") || query.includes("edit") || query.includes("patch")) {
    if (input.domain === "edit") {
      score += 0.2;
    }
  }

  return Math.max(0, Math.min(score, 1));
};

const magnitude = (vector: number[]) =>
  Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

export const cosineSimilarity = (left: number[], right: number[]) => {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return -1;
  }

  const leftMagnitude = magnitude(left);
  const rightMagnitude = magnitude(right);
  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return -1;
  }

  let dotProduct = 0;
  for (let index = 0; index < left.length; index += 1) {
    dotProduct += (left[index] ?? 0) * (right[index] ?? 0);
  }

  return dotProduct / (leftMagnitude * rightMagnitude);
};

export const toReason = (input: {
  title: string;
  embeddingScore: number;
  ruleScore: number;
  rerankScore: number;
  finalScore: number;
}) =>
  [
    `matched ${input.title}`,
    `final=${input.finalScore.toFixed(4)}`,
    `embedding=${input.embeddingScore.toFixed(4)}`,
    `rule=${input.ruleScore.toFixed(4)}`,
    `rerank=${input.rerankScore.toFixed(4)}`,
  ].join("; ");
