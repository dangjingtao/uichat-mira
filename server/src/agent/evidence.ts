import type {
  AgentEvidencePayload,
  AgentEvidenceResolution,
  AgentEvidenceSummary,
  AgentObservation,
  AgentRepeatedActionGuardResult,
  AgentRetrievalEvidence,
  AgentNextAction,
  AgentTaskCompletionDecision,
  AgentTaskCoverageView,
  AgentToolExecutionResult,
  CurrentTaskFrame,
} from "./types";
import { createInvocationInputHash } from "./approval-fingerprint";
import { normalizeWorkspaceRelativePathArg } from "@/mcp/workspace-path-args";

type EvidenceState = Pick<
  {
    goal?: { text: string };
    messages?: Array<{ role: string; content: string }>;
    observations?: AgentObservation[];
    evidence?: AgentEvidencePayload;
  },
  "goal" | "messages" | "observations" | "evidence"
>;

const PREVIEW_ITEM_LIMIT = 5;
const TEXT_PREVIEW_LIMIT = 280;

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
const FILE_CONTENT_INTENT_PATTERNS = [
  /\b(open|read|content|contents|inside)\b/i,
  /详情|内容|打开|读取|阅读|查看/u,
] as const;

const WEB_SEARCH_TOKENS = [
  "search",
  "search for",
  "web",
  "online",
  "latest",
  "news",
  "联网",
  "搜索",
  "查一下",
  "网上",
  "最新",
];

const COMMAND_TOKENS = [
  "run",
  "command",
  "terminal",
  "shell",
  "execute",
  "执行",
  "命令",
  "终端",
  "运行",
];

const WORKSPACE_READ_TOOL_IDS = new Set([
  "read_list",
  "read_open",
  "read_locate",
  "read_extract",
  "read_slice",
]);
const WORKSPACE_MUTATION_TOOL_IDS = new Set([
  "workspace_mutation",
  "edit_file",
]);

const WORKSPACE_ROOT_SENTINEL = "/workspace";
const TERMINAL_GARBLED_TEXT_PATTERNS = [/�/u, /锟斤拷/u, /\?\?\?/u];
const MUTATION_INTENT_PATTERNS = [
  /\b(delete|remove|edit|write|rewrite|modify|update|replace|create|overwrite|move|rename)\b/i,
  /删除|移除|删掉|修改|编辑|改成|改为|替换|写入|新建|创建|覆盖|移动|重命名/u,
] as const;
const MUTATION_VERIFY_PATTERNS = [
  /\b(verify|verification|confirm|check|inspect|validate)\b/i,
  /验证|确认|检查|核实|看看结果|看下结果|确认一下/u,
] as const;
const WRITE_LIKE_MUTATION_PATTERNS = [
  /\b(edit|write|rewrite|modify|update|replace|create|overwrite)\b/i,
  /修改|编辑|改成|改为|替换|写入|新建|创建|覆盖/u,
] as const;
const PATH_TARGET_PATTERN =
  /(?:[A-Za-z]:\\[^\s"'<>|]+|(?:\.{1,2}[\\/])?[A-Za-z0-9_./\\-]+\.[A-Za-z0-9_-]{1,12})/g;

export const getEvidencePayload = (state: EvidenceState): AgentEvidencePayload => ({
  observations: state.evidence?.observations ?? state.observations ?? [],
  toolExecutions: state.evidence?.toolExecutions ?? [],
  retrievals: state.evidence?.retrievals ?? [],
  latestSummary:
    state.evidence?.latestSummary ??
    state.evidence?.toolExecutions.at(-1)?.summary ??
    state.evidence?.retrievals.at(-1)?.summary ??
    state.evidence?.observations.at(-1)?.summary,
});

const normalizeIntentText = (value: string) => value.trim().toLowerCase();

const includesAnyToken = (value: string, tokens: string[]) =>
  tokens.some((token) => value.includes(token));

const explicitlyRequestsFileContent = (value: string) =>
  FILE_CONTENT_INTENT_PATTERNS.some((pattern) => pattern.test(value));

const trimTextPreview = (value: string, limit = TEXT_PREVIEW_LIMIT) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.length > limit
      ? `${normalized.slice(0, limit).trimEnd()}...`
    : normalized;
};

const toEvidenceResolutionFinding = (
  label: string,
  value: AgentEvidenceResolution,
) => `${label}=${value}`;

const containsVisibleText = (value: string) => value.trim().length > 0;
const containsNonAsciiText = (value: string) => /[^\x00-\x7F]/.test(value);

const getTerminalUnreadableReason = (input: {
  stdout: string;
  stderr: string;
  stdoutEncoding: string;
  stderrEncoding: string;
  binaryDetected: boolean;
}) => {
  if (input.binaryDetected) {
    return "Terminal output contains binary data and cannot be treated as natural-language evidence.";
  }

  const combinedText = `${input.stdout}\n${input.stderr}`;
  if (
    input.stdoutEncoding === "unknown" ||
    input.stderrEncoding === "unknown"
  ) {
    if (
      containsVisibleText(combinedText) &&
      containsNonAsciiText(combinedText)
    ) {
      return "Terminal output encoding could not be determined, so the text is not reliable enough to interpret.";
    }
  }

  if (
    TERMINAL_GARBLED_TEXT_PATTERNS.some((pattern) => pattern.test(combinedText))
  ) {
    return "Terminal output appears garbled, so the agent must not pretend it understood the text.";
  }

  return undefined;
};

const NOISY_WORKSPACE_ARTIFACT_PREFIXES = [
  "release/",
  "tauri/target/",
  "node_modules/",
  "server/logs/",
  "desktop/dist/",
  "dist/",
  "build/",
] as const;

const isNoisyWorkspaceArtifactPath = (value: string) => {
  const normalized = value.replace(/\\/g, "/").toLowerCase();
  return NOISY_WORKSPACE_ARTIFACT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const isDocumentationLikePath = (value: string) => {
  const normalized = value.replace(/\\/g, "/").toLowerCase();
  return (
    normalized === "agents.md" ||
    normalized === "readme.md" ||
    normalized.endsWith("/readme.md") ||
    normalized.endsWith("/agents.md") ||
    normalized.startsWith("docs/")
  );
};

const scoreReadLocateMatch = (input: {
  path: string;
  matchType: string;
}) => {
  const segments = input.path.replace(/\\/g, "/").split("/").filter(Boolean).length;
  return [
    isNoisyWorkspaceArtifactPath(input.path) ? 0 : 1,
    input.matchType === "content" ? 1 : 0,
    isDocumentationLikePath(input.path) ? 1 : 0,
    -segments,
    input.path.length * -1,
  ] as const;
};

const compareReadLocateMatchPriority = (
  left: { path: string; matchType: string },
  right: { path: string; matchType: string },
) => {
  const leftScore = scoreReadLocateMatch(left);
  const rightScore = scoreReadLocateMatch(right);
  for (let index = 0; index < leftScore.length; index += 1) {
    if (leftScore[index] !== rightScore[index]) {
      return rightScore[index] - leftScore[index];
    }
  }

  return left.path.localeCompare(right.path);
};

const getLatestUserQuestion = (state: EvidenceState) => {
  const latest = [...(state.messages ?? [])]
    .reverse()
    .find((message) => message.role === "user");
  return latest?.content.trim() ?? state.goal?.text?.trim() ?? "";
};

const normalizeTargetPath = (value: string) =>
  value.trim().replace(/\\/g, "/").replace(/^\.\/+/, "").toLowerCase();

const normalizeNamedTargetCandidate = (value: string) =>
  value
    .trim()
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "")
    .replace(/^(?:file|files|folder|folders|directory|directories)\s+/i, "")
    .replace(/^(?:文件|文件夹|目录)\s*/u, "")
    .replace(/[。；;，,、]+$/u, "");

const extractNamedTargetsFromMutationText = (text: string) => {
  const segments: string[] = [];
  const englishMatch = text.match(
    /\b(?:delete|remove|edit|write|rewrite|modify|update|replace|create|overwrite|move|rename)\b\s+(.+)/i,
  );
  if (englishMatch?.[1]) {
    segments.push(englishMatch[1]);
  }

  const chineseMatch = text.match(
    /(?:删除|移除|修改|编辑|改成|改为|替换|写入|新建|创建|覆盖|移动|重命名)(.+)/u,
  );
  if (chineseMatch?.[1]) {
    segments.push(chineseMatch[1]);
  }

  return segments.flatMap((segment) =>
    segment
      .split(/\s*(?:,|，|、|\band\b|\bor\b|和|与|及)\s*/iu)
      .map((item) =>
        normalizeNamedTargetCandidate(
          item.split(/\s+(?:then|then\s+tell|then\s+answer|afterwards|并且|然后|再|并说明)\b/iu)[0] ??
            item,
        ),
      )
      .filter(
        (item) =>
          item.length > 0 &&
          item.length <= 120 &&
          !/\s/.test(item) &&
          /[\p{Script=Han}A-Za-z0-9_\-.\\/]/u.test(item),
      ),
  );
};

const extractRequiredTargets = (texts: string[]) => {
  const targets = new Set<string>();
  for (const text of texts) {
    const matches = text.match(PATH_TARGET_PATTERN) ?? [];
    for (const match of matches) {
      const normalized = normalizeTargetPath(match);
      if (normalized.length > 0) {
        targets.add(normalized);
      }
    }

    for (const namedTarget of extractNamedTargetsFromMutationText(text)) {
      const normalized = normalizeTargetPath(namedTarget);
      if (normalized.length > 0) {
        targets.add(normalized);
      }
    }
  }

  return [...targets];
};

const hasMutationIntent = (texts: string[]) =>
  texts.some((text) => MUTATION_INTENT_PATTERNS.some((pattern) => pattern.test(text)));

const requiresMutationVerification = (texts: string[]) =>
  texts.some(
    (text) =>
      MUTATION_VERIFY_PATTERNS.some((pattern) => pattern.test(text)) &&
      WRITE_LIKE_MUTATION_PATTERNS.some((pattern) => pattern.test(text)),
  );

const collectTaskIntentTexts = (input: {
  question?: string;
  currentTaskFrame?: CurrentTaskFrame;
}) =>
  [
    input.question?.trim(),
    input.currentTaskFrame?.currentGoal?.trim(),
    ...(input.currentTaskFrame?.completionCriteria ?? []).map((item) => item.trim()),
  ].filter((value): value is string => Boolean(value));

const collectMutationResolvedTargets = (evidence: AgentEvidencePayload | undefined) => {
  const targets = new Set<string>();

  for (const execution of evidence?.toolExecutions ?? []) {
    if (
      execution.status === "failed" &&
      execution.failureKind === "terminal" &&
      WORKSPACE_MUTATION_TOOL_IDS.has(execution.toolId)
    ) {
      for (const target of collectCoveredTargetsFromExecutionArgs(execution.args)) {
        if (target.length > 0) {
          targets.add(target);
        }
      }
      continue;
    }

    if (execution.status !== "completed" || !execution.summary?.data) {
      continue;
    }

    const summaryData = execution.summary.data;
    if (
      summaryData.kind === "edit_file" &&
      summaryData.changed &&
      !summaryData.dryRun &&
      typeof summaryData.targetPath === "string"
    ) {
      targets.add(normalizeTargetPath(summaryData.targetPath));
    }

    if (
      summaryData.kind === "workspace_mutation" &&
      summaryData.changed &&
      !summaryData.dryRun
    ) {
      if (typeof summaryData.targetPath === "string") {
        targets.add(normalizeTargetPath(summaryData.targetPath));
      }
      if (typeof summaryData.destinationPath === "string") {
        targets.add(normalizeTargetPath(summaryData.destinationPath));
      }
    }
  }

  return [...targets];
};

const collectCoveredTargetsFromSummary = (summary: AgentEvidenceSummary | undefined) => {
  if (summary?.source !== "tool" || !summary.data) {
    return [];
  }

  switch (summary.data.kind) {
    case "read_locate":
      return summary.data.matchedPaths.map((path) => normalizeTargetPath(path));
    case "read_open":
    case "read_list":
      return [normalizeTargetPath(summary.data.path)];
    case "workspace_mutation": {
      const targets: string[] = [];
      if (typeof summary.data.targetPath === "string") {
        targets.push(normalizeTargetPath(summary.data.targetPath));
      }
      if (typeof summary.data.destinationPath === "string") {
        targets.push(normalizeTargetPath(summary.data.destinationPath));
      }
      return targets;
    }
    case "edit_file":
      return typeof summary.data.targetPath === "string"
        ? [normalizeTargetPath(summary.data.targetPath)]
        : [];
    default:
      return [];
  }
};

const collectCoveredTargetsFromExecutionArgs = (
  args: AgentToolExecutionResult["args"] | undefined,
) => {
  const targets: string[] = [];
  for (const key of ["path", "targetPath", "destinationPath"] as const) {
    const value = args?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      targets.push(normalizeTargetPath(value));
    }
  }

  return targets;
};

const collectEvidenceCoveredTargets = (input: {
  evidence?: AgentEvidencePayload;
  latestSummary?: AgentEvidenceSummary;
}) => {
  const targets = new Set<string>();

  for (const execution of input.evidence?.toolExecutions ?? []) {
    if (execution.status !== "completed") {
      continue;
    }

    for (const target of collectCoveredTargetsFromSummary(execution.summary)) {
      if (target.length > 0) {
        targets.add(target);
      }
    }

    if (!execution.summary) {
      for (const target of collectCoveredTargetsFromExecutionArgs(execution.args)) {
        if (target.length > 0) {
          targets.add(target);
        }
      }
    }
  }

  for (const target of collectCoveredTargetsFromSummary(input.latestSummary)) {
    if (target.length > 0) {
      targets.add(target);
    }
  }

  return [...targets];
};

const collectReadVerifiedTargets = (input: {
  evidence?: AgentEvidencePayload;
  latestSummary?: AgentEvidenceSummary;
}) => {
  const targets = new Set<string>();

  const addSummaryTargets = (summary: AgentEvidenceSummary | undefined) => {
    if (summary?.source !== "tool" || !summary.data) {
      return;
    }

    if (
      summary.data.kind === "read_list" ||
      summary.data.kind === "read_open" ||
      summary.data.kind === "read_locate"
    ) {
      for (const target of collectCoveredTargetsFromSummary(summary)) {
        if (target.length > 0) {
          targets.add(target);
        }
      }
    }
  };

  for (const execution of input.evidence?.toolExecutions ?? []) {
    if (execution.status !== "completed") {
      continue;
    }

    addSummaryTargets(execution.summary);
  }

  addSummaryTargets(input.latestSummary);

  return [...targets];
};

const collectReadOpenedTargets = (input: {
  evidence?: AgentEvidencePayload;
  latestSummary?: AgentEvidenceSummary;
}) => {
  const targets = new Set<string>();

  const addSummaryTargets = (summary: AgentEvidenceSummary | undefined) => {
    if (summary?.source !== "tool" || !summary.data) {
      return;
    }

    if (summary.data.kind === "read_open") {
      for (const target of collectCoveredTargetsFromSummary(summary)) {
        if (target.length > 0) {
          targets.add(target);
        }
      }
    }
  };

  for (const execution of input.evidence?.toolExecutions ?? []) {
    if (execution.status !== "completed") {
      continue;
    }

    addSummaryTargets(execution.summary);
  }

  addSummaryTargets(input.latestSummary);

  return [...targets];
};

const hasLatestRecoverableToolFailure = (evidence: AgentEvidencePayload | undefined) => {
  const latestExecution = evidence?.toolExecutions.at(-1);
  return (
    latestExecution?.status === "failed" &&
    latestExecution.failureKind === "recoverable"
  );
};

const buildTaskCompletionReason = (input: {
  pendingActions: string[];
  missingTargets: string[];
}) => {
  if (input.pendingActions.length > 0 && input.missingTargets.length > 0) {
    return `Task is not complete yet: pendingActions=${input.pendingActions.join(", ")}; missingTargets=${input.missingTargets.join(", ")}.`;
  }

  if (input.pendingActions.length > 0) {
    return `Task is not complete yet: pendingActions=${input.pendingActions.join(", ")}.`;
  }

  if (input.missingTargets.length > 0) {
    return `Task is not complete yet: missingTargets=${input.missingTargets.join(", ")}.`;
  }

  return "Current task coverage is complete.";
};

export const getTaskCompletionDecision = (input: {
  question?: string;
  currentTaskFrame?: CurrentTaskFrame;
  evidence?: AgentEvidencePayload;
  latestSummary?: AgentEvidenceSummary;
}): AgentTaskCompletionDecision => {
  const taskCoverageView = getTaskCoverageView(input);

  return {
    taskCompleted: taskCoverageView.taskCompletable,
    requiredTargets: taskCoverageView.requiredTargets,
    coveredTargets: taskCoverageView.coveredTargets,
    missingTargets: taskCoverageView.pendingTargets,
    pendingActions: taskCoverageView.pendingActions,
    reason:
      taskCoverageView.blockedReason ?? "Current task coverage is complete.",
    taskCoverageView,
  };
};

export const getTaskCoverageView = (input: {
  question?: string;
  currentTaskFrame?: CurrentTaskFrame;
  evidence?: AgentEvidencePayload;
  latestSummary?: AgentEvidenceSummary;
}): AgentTaskCoverageView => {
  const intentTexts = collectTaskIntentTexts(input);
  const mutationRequired = hasMutationIntent(intentTexts);
  const mutationVerificationRequired = requiresMutationVerification(intentTexts);
  const fileContentRequired = intentTexts.some((text) => explicitlyRequestsFileContent(text));
  const requiredTargets = extractRequiredTargets(intentTexts);
  const coveredTargets = collectEvidenceCoveredTargets(input);
  const resolvedMutationTargets = collectMutationResolvedTargets(input.evidence);
  const readVerifiedTargets = collectReadVerifiedTargets(input);
  const readOpenedTargets = collectReadOpenedTargets(input);
  const completionSatisfiedTargets = mutationRequired
    ? [...new Set([...coveredTargets, ...resolvedMutationTargets])]
    : coveredTargets;
  const pendingTargets = requiredTargets.filter(
    (target) => !completionSatisfiedTargets.includes(target),
  );
  const pendingActions: string[] = [];

  if (mutationRequired) {
    const mutationExecutionSatisfied =
      requiredTargets.length === 0
        ? resolvedMutationTargets.length > 0
        : resolvedMutationTargets.length > 0 &&
          requiredTargets.every((target) => resolvedMutationTargets.includes(target));
    if (!mutationExecutionSatisfied) {
      pendingActions.push("mutation_execution");
    }
  }

  if (
    mutationRequired &&
    mutationVerificationRequired &&
    requiredTargets.length > 0 &&
    !requiredTargets.every((target) => readVerifiedTargets.includes(target))
  ) {
    pendingActions.push("mutation_verification");
  }

  if (
    !mutationRequired &&
    fileContentRequired &&
    requiredTargets.length > 0 &&
    pendingTargets.length === 0 &&
    !requiredTargets.every((target) => readOpenedTargets.includes(target))
  ) {
    pendingActions.push("read_open");
  }

  if (hasLatestRecoverableToolFailure(input.evidence)) {
    pendingActions.push("recoverable_execution");
  }

  const blockedReason = buildTaskCompletionReason({
    pendingActions,
    missingTargets: pendingTargets,
  });

  return {
    requiredTargets,
    coveredTargets,
    pendingTargets,
    pendingActions,
    blockedReason:
      pendingActions.length === 0 && pendingTargets.length === 0
        ? undefined
        : blockedReason,
    taskCompletable: pendingActions.length === 0 && pendingTargets.length === 0,
  };
};

const queryRequestsDirectoryOverview = (query: string) =>
  includesAnyToken(normalizeIntentText(query), DIRECTORY_OVERVIEW_TOKENS);

const queryRequestsFileContent = (query: string) => {
  const normalized = normalizeIntentText(query);
  if (includesAnyToken(normalized, FILE_CONTENT_TOKENS)) {
    return true;
  }

  return /[\w-]+\.[a-z0-9]{1,12}\b/i.test(query);
};

const queryRequestsWebSearch = (query: string) =>
  includesAnyToken(normalizeIntentText(query), WEB_SEARCH_TOKENS);

const queryRequestsCommandResult = (query: string) =>
  includesAnyToken(normalizeIntentText(query), COMMAND_TOKENS);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const unwrapResultRecord = (result: unknown) => {
  if (!isRecord(result)) {
    return null;
  }

  if (isRecord(result.result)) {
    return {
      value: result.result,
      meta: result,
    };
  }

  if (isRecord(result.payload)) {
    return {
      value: result.payload,
      meta: result,
    };
  }

  return {
    value: result,
    meta: result,
  };
};

const toObservationSummaryStatus = (
  status: AgentObservation["status"],
): AgentEvidenceSummary["status"] => {
  switch (status) {
    case "ok":
      return "completed";
    case "partial":
      return "partial";
    case "failed":
      return "failed";
    case "blocked":
      return "blocked";
  }
};

export const createObservationEvidenceSummary = (input: {
  observation: AgentObservation;
  evidenceIndex: number;
}): AgentEvidenceSummary => ({
  source: "observation",
  status: toObservationSummaryStatus(input.observation.status),
  actionTaken: `Recorded observation for ${input.observation.stepId}.`,
  keyFindings: input.observation.facts.slice(0, 3),
  answerReadiness: {
    canAnswer: false,
    reason: "Observation evidence alone does not satisfy the answer stop rule.",
    missingInfo: ["grounded retrieval or tool result"],
  },
  data: {
    kind: "observation",
    stepId: input.observation.stepId,
    factsPreview: input.observation.facts.slice(0, 3),
  },
  rawRef: {
    evidenceIndex: input.evidenceIndex,
  },
});

export const createRetrievalEvidenceSummary = (input: {
  retrieval: AgentRetrievalEvidence;
  question: string;
  evidenceIndex: number;
}): AgentEvidenceSummary => {
  const documentsPreview = input.retrieval.chunks
    .slice(0, PREVIEW_ITEM_LIMIT)
    .map((chunk) => chunk.documentName);
  const canAnswer = input.retrieval.chunkCount > 0;

  return {
    source: "retrieval",
    status: "completed",
    actionTaken: `Retrieved ${input.retrieval.chunkCount} knowledge chunk(s) for query "${input.retrieval.query}".`,
    keyFindings:
      input.retrieval.chunkCount > 0
        ? [
            `query=${input.retrieval.query}`,
            `chunkCount=${input.retrieval.chunkCount}`,
            ...documentsPreview.map((name) => `document=${name}`),
          ]
        : [`query=${input.retrieval.query}`, "chunkCount=0"],
    answerReadiness: canAnswer
      ? {
          canAnswer: true,
          reason: "Retrieved knowledge evidence is available for answer generation.",
        }
      : {
          canAnswer: false,
          reason: "Retrieval returned no knowledge chunks.",
          missingInfo: [`more evidence for "${input.question}"`],
        },
    data: {
      kind: "retrieval",
      query: input.retrieval.query,
      chunkCount: input.retrieval.chunkCount,
      documentsPreview,
    },
    rawRef: {
      evidenceIndex: input.evidenceIndex,
    },
  };
};

const createReadListSummary = (input: {
  question: string;
  execution: AgentToolExecutionResult;
  evidenceIndex: number;
}): AgentEvidenceSummary | null => {
  const result = input.execution.result;
  if (!result || typeof result !== "object") {
    return null;
  }

  const value = result as Record<string, unknown>;
  if (value.type !== "list" || typeof value.path !== "string" || !Array.isArray(value.entries)) {
    return null;
  }

  const entries = value.entries
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      name: typeof entry.name === "string" ? entry.name : "unknown",
      type: entry.type === "directory" ? "directory" : "file",
    }));
  const entryCount = entries.length;
  const fileCount = entries.filter((entry) => entry.type === "file").length;
  const directoryCount = entries.filter((entry) => entry.type === "directory").length;
  const entriesPreview = entries
    .slice(0, PREVIEW_ITEM_LIMIT)
    .map((entry) => `${entry.type === "directory" ? "[D]" : "[F]"} ${entry.name}`);
  const truncated = entryCount > PREVIEW_ITEM_LIMIT;
  const canAnswerDirectoryQuestion =
    queryRequestsDirectoryOverview(input.question) &&
    !queryRequestsFileContent(input.question);

  return {
    source: "tool",
    status: truncated ? "truncated" : "completed",
    toolId: input.execution.toolId,
    inputHash: input.execution.inputHash,
    actionTaken: `Listed workspace directory ${value.path}.`,
    keyFindings: [
      `entryCount=${entryCount}`,
      `fileCount=${fileCount}`,
      `directoryCount=${directoryCount}`,
      ...entriesPreview,
    ],
    answerReadiness: canAnswerDirectoryQuestion
      ? {
          canAnswer: true,
          reason: "Directory listing is sufficient for the user's workspace overview question.",
        }
      : {
          canAnswer: false,
          reason: "Directory listing alone does not satisfy a file-content question.",
          missingInfo: ["target file content or a narrower path"],
        },
    data: {
      kind: "read_list",
      path: value.path,
      entryCount,
      fileCount,
      directoryCount,
      entriesPreview,
      truncated,
      canAnswerDirectoryQuestion,
    },
    rawRef: {
      evidenceIndex: input.evidenceIndex,
      toolCallId: input.execution.toolCallId,
      invocationId: input.execution.invocationId,
    },
  };
};

const createReadOpenSummary = (input: {
  execution: AgentToolExecutionResult;
  evidenceIndex: number;
}): AgentEvidenceSummary | null => {
  const result = input.execution.result;
  if (!result || typeof result !== "object") {
    return null;
  }

  const value = result as Record<string, unknown>;
  const source =
    value.type === "open" && value.source && typeof value.source === "object"
      ? (value.source as Record<string, unknown>)
      : null;
  if (value.type !== "open" || typeof value.path !== "string" || !source) {
    return null;
  }

  const text = typeof source.text === "string" ? source.text : "";
  const contentPreview = trimTextPreview(text);
  const contentLength = text.length;
  const truncated = contentPreview.length < contentLength;
  const keySections = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => /^#{1,6}\s+/.test(line))
    .slice(0, PREVIEW_ITEM_LIMIT)
    .map((line) => line.replace(/^#{1,6}\s+/, ""));
  const canAnswerFileQuestion = contentLength > 0;

  return {
    source: "tool",
    status: truncated ? "truncated" : "completed",
    toolId: input.execution.toolId,
    inputHash: input.execution.inputHash,
    actionTaken: `Opened file ${value.path}.`,
    keyFindings: [
      `contentLength=${contentLength}`,
      ...(contentPreview ? [contentPreview] : []),
    ],
    answerReadiness: canAnswerFileQuestion
      ? {
          canAnswer: true,
          reason: "Opened file content is available for answer generation.",
        }
      : {
          canAnswer: false,
          reason: "The opened file returned no usable content preview.",
          missingInfo: [`usable content from ${value.path}`],
        },
    data: {
      kind: "read_open",
      path: value.path,
      contentPreview,
      contentLength,
      truncated,
      ...(keySections.length > 0 ? { keySections } : {}),
      canAnswerFileQuestion,
    },
    rawRef: {
      evidenceIndex: input.evidenceIndex,
      toolCallId: input.execution.toolCallId,
      invocationId: input.execution.invocationId,
    },
  };
};

const createReadLocateSummary = (input: {
  question: string;
  execution: AgentToolExecutionResult;
  evidenceIndex: number;
}): AgentEvidenceSummary | null => {
  const result = input.execution.result;
  if (!result || typeof result !== "object") {
    return null;
  }

  const value = result as Record<string, unknown>;
  if (
    value.type !== "locate" ||
    typeof value.scope !== "string" ||
    typeof value.query !== "string" ||
    !Array.isArray(value.matches)
  ) {
    return null;
  }

  const matches = value.matches
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => {
      const path = typeof entry.path === "string" ? entry.path : "unknown";
      const matchType = entry.matchType === "content" ? "content" : "path";
      const preview =
        typeof entry.preview === "string" && entry.preview.trim()
          ? trimTextPreview(entry.preview, 120)
          : "";
      return { path, matchType, preview };
    })
    .sort(compareReadLocateMatchPriority);
  const matchCount = matches.length;
  const matchedPaths = matches.map((match) => match.path);
  const matchesPreview = matches
    .slice(0, PREVIEW_ITEM_LIMIT)
    .map((match) =>
      match.preview
        ? `[${match.matchType}] ${match.path}: ${match.preview}`
        : `[${match.matchType}] ${match.path}`,
    );
  const truncated = matchCount > PREVIEW_ITEM_LIMIT;
  const canAnswerLocateQuestion =
    matchCount > 0 && !queryRequestsFileContent(input.question);

  return {
    source: "tool",
    status: truncated ? "truncated" : "completed",
    toolId: input.execution.toolId,
    inputHash: input.execution.inputHash,
    actionTaken: `Located ${matchCount} workspace match(es) for "${value.query}".`,
    keyFindings:
      matchCount > 0
        ? [`matchCount=${matchCount}`, ...matchesPreview]
        : [`matchCount=0`, `query=${value.query}`],
    answerReadiness: canAnswerLocateQuestion
      ? {
          canAnswer: true,
          reason: "Workspace locate results are available for answer generation.",
        }
      : {
          canAnswer: false,
          reason:
            matchCount === 0
              ? "Workspace locate returned no matches."
              : "Locate results found targets, but the question still needs file content.",
          missingInfo:
            matchCount === 0
              ? [`workspace matches for "${value.query}"`]
              : ["opened file content for the matched workspace target"],
        },
    data: {
      kind: "read_locate",
      scope: value.scope,
      query: value.query,
      searchMode:
        value.searchMode === "path" || value.searchMode === "content"
          ? value.searchMode
          : "auto",
      matchCount,
      matchedPaths,
      matchesPreview,
      truncated,
      canAnswerLocateQuestion,
    },
    rawRef: {
      evidenceIndex: input.evidenceIndex,
      toolCallId: input.execution.toolCallId,
      invocationId: input.execution.invocationId,
    },
  };
};

const createWebSearchSummary = (input: {
  question: string;
  execution: AgentToolExecutionResult;
  evidenceIndex: number;
}): AgentEvidenceSummary | null => {
  const result = input.execution.result;
  if (!result || typeof result !== "object") {
    return null;
  }

  const value = result as Record<string, unknown>;
  if (typeof value.query !== "string" || !Array.isArray(value.results)) {
    return null;
  }

  const results = value.results
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
  const resultCount = results.length;
  const topFindings = results.slice(0, PREVIEW_ITEM_LIMIT).map((entry) =>
    trimTextPreview(
      [entry.title, entry.snippet].filter((part) => typeof part === "string" && part.trim()).join(": "),
      180,
    ),
  );
  const citationsPreview = results.slice(0, PREVIEW_ITEM_LIMIT).map((entry) => ({
    title: typeof entry.title === "string" ? entry.title : "",
    link: typeof entry.link === "string" ? entry.link : "",
  }));
  const canAnswerSearchQuestion = resultCount > 0;

  return {
    source: "tool",
    status: "completed",
    toolId: input.execution.toolId,
    inputHash: input.execution.inputHash,
    actionTaken: `Searched the web for "${value.query}".`,
    keyFindings:
      resultCount > 0
        ? [`resultCount=${resultCount}`, ...topFindings]
        : [`resultCount=0`, `query=${value.query}`],
    answerReadiness: canAnswerSearchQuestion
      ? {
          canAnswer: true,
          reason: "Web search returned results that can ground the answer.",
        }
      : {
          canAnswer: false,
          reason: "Web search returned no results.",
          missingInfo: [
            queryRequestsWebSearch(input.question)
              ? `more web results for "${value.query}"`
              : `grounded evidence for "${input.question}"`,
          ],
        },
    data: {
      kind: "web_search",
      query: value.query,
      resultCount,
      topFindings,
      citationsPreview,
      canAnswerSearchQuestion,
    },
    rawRef: {
      evidenceIndex: input.evidenceIndex,
      toolCallId: input.execution.toolCallId,
      invocationId: input.execution.invocationId,
    },
  };
};

const createEditFileSummary = (input: {
  execution: AgentToolExecutionResult;
  evidenceIndex: number;
}): AgentEvidenceSummary | null => {
  const unwrapped = unwrapResultRecord(input.execution.result);
  if (!unwrapped) {
    return null;
  }

  const { value, meta } = unwrapped;
  if (
    typeof value.path !== "string" ||
    (value.operation !== "write_file" && value.operation !== "replace_block")
  ) {
    return null;
  }

  const dryRun = value.dryRun === true;
  const actionProfileId =
    typeof meta.actionProfileId === "string" ? meta.actionProfileId : undefined;
  const runtimeToolId =
    typeof meta.runtimeToolId === "string"
      ? meta.runtimeToolId
      : input.execution.toolId;
  const operation =
    value.operation === "replace_block"
      ? "replace"
      : actionProfileId === "edit_overwrite_file"
        ? "overwrite"
        : actionProfileId === "edit_create_file"
          ? "create"
          : dryRun
            ? "unknown"
            : "create";
  const changed = !dryRun;
  const created = changed && operation === "create";
  const replaced =
    changed && (operation === "replace" || operation === "overwrite");
  const canAnswerMutationQuestion = true;
  const actionTaken = dryRun
    ? operation === "overwrite"
      ? `Prepared a dry-run preview to overwrite workspace file ${value.path}.`
      : operation === "replace"
        ? `Prepared a dry-run preview to replace content in workspace file ${value.path}.`
        : operation === "create"
          ? `Prepared a dry-run preview to create workspace file ${value.path}.`
          : `Prepared a dry-run preview edit for workspace file ${value.path}.`
    : operation === "replace"
      ? `Replaced content in workspace file ${value.path}.`
      : operation === "overwrite"
        ? `Overwrote workspace file ${value.path}.`
        : `Created workspace file ${value.path}.`;

  return {
    source: "tool",
    status: "completed",
    toolId: input.execution.toolId,
    inputHash: input.execution.inputHash,
    actionTaken,
    keyFindings: [
      `operation=${operation}`,
      `targetPath=${value.path}`,
      `dryRun=${dryRun}`,
      `changed=${changed}`,
      ...(created ? ["created=true"] : []),
      ...(replaced ? ["replaced=true"] : []),
      ...(typeof value.bytes === "number" ? [`bytes=${value.bytes}`] : []),
      ...(actionProfileId ? [`actionProfileId=${actionProfileId}`] : []),
      ...(runtimeToolId ? [`runtimeToolId=${runtimeToolId}`] : []),
    ],
    answerReadiness: {
      canAnswer: canAnswerMutationQuestion,
      reason: dryRun
        ? "This edit result is only a preview, so the answer must describe the proposed change without claiming the file was modified."
        : "This edit result completed and can ground a file-mutation answer.",
    },
    data: {
      kind: "edit_file",
      operation,
      targetPath: value.path,
      dryRun,
      changed,
      created,
      replaced,
      deleted: false,
      runtimeToolId,
      actionProfileId,
      canAnswerMutationQuestion,
    },
    rawRef: {
      evidenceIndex: input.evidenceIndex,
      toolCallId: input.execution.toolCallId,
      invocationId: input.execution.invocationId,
    },
  };
};

const createWorkspaceMutationSummary = (input: {
  execution: AgentToolExecutionResult;
  evidenceIndex: number;
}): AgentEvidenceSummary | null => {
  const unwrapped = unwrapResultRecord(input.execution.result);
  if (!unwrapped) {
    return null;
  }

  const { value, meta } = unwrapped;
  if (
    typeof value.targetPath !== "string" ||
    (value.operation !== "write" &&
      value.operation !== "delete" &&
      value.operation !== "move")
  ) {
    return null;
  }

  const dryRun = value.dryRun === true;
  const actionProfileId =
    typeof meta.actionProfileId === "string" ? meta.actionProfileId : undefined;
  const runtimeToolId =
    typeof meta.runtimeToolId === "string"
      ? meta.runtimeToolId
      : input.execution.toolId;
  const operation =
    value.operation === "delete"
      ? "delete"
      : value.operation === "move"
        ? "move"
        : value.overwrite === true
          ? "overwrite"
          : "create";
  const changed = !dryRun;
  const created = changed && operation === "create";
  const replaced = changed && operation === "overwrite";
  const deleted = changed && operation === "delete";
  const moved = changed && operation === "move";
  const canAnswerMutationQuestion = true;
  const destinationPath =
    typeof value.destinationPath === "string" ? value.destinationPath : undefined;

  let actionTaken: string;
  if (dryRun) {
    if (operation === "delete") {
      actionTaken = `Prepared a dry-run preview to delete workspace target ${value.targetPath}.`;
    } else if (operation === "move" && destinationPath) {
      actionTaken = `Prepared a dry-run preview to move workspace target ${value.targetPath} to ${destinationPath}.`;
    } else if (operation === "overwrite") {
      actionTaken = `Prepared a dry-run preview to overwrite workspace target ${value.targetPath}.`;
    } else {
      actionTaken = `Prepared a dry-run preview to create workspace target ${value.targetPath}.`;
    }
  } else if (operation === "delete") {
    actionTaken = `Deleted workspace target ${value.targetPath}.`;
  } else if (operation === "move" && destinationPath) {
    actionTaken = `Moved workspace target ${value.targetPath} to ${destinationPath}.`;
  } else if (operation === "overwrite") {
    actionTaken = `Overwrote workspace target ${value.targetPath}.`;
  } else {
    actionTaken = `Created workspace target ${value.targetPath}.`;
  }

  return {
    source: "tool",
    status: "completed",
    toolId: input.execution.toolId,
    inputHash: input.execution.inputHash,
    actionTaken,
    keyFindings: [
      `operation=${operation}`,
      `targetPath=${value.targetPath}`,
      `dryRun=${dryRun}`,
      `changed=${changed}`,
      ...(created ? ["created=true"] : []),
      ...(replaced ? ["replaced=true"] : []),
      ...(deleted ? ["deleted=true"] : []),
      ...(moved ? ["moved=true"] : []),
      ...(destinationPath ? [`destinationPath=${destinationPath}`] : []),
      ...(typeof value.bytes === "number" ? [`bytes=${value.bytes}`] : []),
      ...(actionProfileId ? [`actionProfileId=${actionProfileId}`] : []),
      ...(runtimeToolId ? [`runtimeToolId=${runtimeToolId}`] : []),
    ],
    answerReadiness: {
      canAnswer: canAnswerMutationQuestion,
      reason: dryRun
        ? "This workspace mutation result is only a preview, so the answer must not claim the target was already changed."
        : "This workspace mutation completed and can ground a mutation answer.",
    },
    data: {
      kind: "workspace_mutation",
      operation,
      targetPath: value.targetPath,
      ...(destinationPath ? { destinationPath } : {}),
      dryRun,
      changed,
      created,
      replaced,
      deleted,
      moved,
      runtimeToolId,
      actionProfileId,
      canAnswerMutationQuestion,
    },
    rawRef: {
      evidenceIndex: input.evidenceIndex,
      toolCallId: input.execution.toolCallId,
      invocationId: input.execution.invocationId,
    },
  };
};

const createTerminalSessionSummary = (input: {
  question: string;
  execution: AgentToolExecutionResult;
  evidenceIndex: number;
}): AgentEvidenceSummary | null => {
  const result = input.execution.result;
  if (!result || typeof result !== "object") {
    return null;
  }

  const value = result as Record<string, unknown>;
  if (typeof value.command !== "string" || !("timedOut" in value)) {
    return null;
  }

  const stdoutPreview = trimTextPreview(typeof value.stdout === "string" ? value.stdout : "");
  const stderrPreview = trimTextPreview(typeof value.stderr === "string" ? value.stderr : "");
  const timedOut = Boolean(value.timedOut);
  const stdoutEncoding =
    value.stdoutEncoding === "utf8" ||
    value.stdoutEncoding === "gbk" ||
    value.stdoutEncoding === "utf16le" ||
    value.stdoutEncoding === "unknown"
      ? value.stdoutEncoding
      : "utf8";
  const stderrEncoding =
    value.stderrEncoding === "utf8" ||
    value.stderrEncoding === "gbk" ||
    value.stderrEncoding === "utf16le" ||
    value.stderrEncoding === "unknown"
      ? value.stderrEncoding
      : "utf8";
  const truncated = Boolean(value.truncated);
  const binaryDetected = Boolean(value.binaryDetected);
  const violations = Array.isArray(value.violations)
    ? value.violations.filter((item): item is string => typeof item === "string")
    : [];
  const exitCode =
    typeof value.exitCode === "number" || value.exitCode === null
      ? (value.exitCode as number | null)
      : null;
  const unreadableReason = getTerminalUnreadableReason({
    stdout: typeof value.stdout === "string" ? value.stdout : "",
    stderr: typeof value.stderr === "string" ? value.stderr : "",
    stdoutEncoding,
    stderrEncoding,
    binaryDetected,
  });
  const outputInterpretable = !unreadableReason;
  const processCompleted = !timedOut;
  const commandSucceeded: AgentEvidenceResolution = processCompleted
    ? exitCode === 0
      ? "true"
      : typeof exitCode === "number"
        ? "false"
        : "unknown"
    : "unknown";
  const taskSatisfied: AgentEvidenceResolution = "unknown";
  const terminalStatus = binaryDetected
    ? "binaryDetected"
    : timedOut
      ? "timed_out"
      : truncated
        ? "truncated"
        : unreadableReason
          ? "blocked"
          : "completed";
  const canAnswerCommandQuestion =
    processCompleted &&
    !truncated &&
    !binaryDetected &&
    outputInterpretable &&
    queryRequestsCommandResult(input.question);

  return {
    source: "tool",
    status: terminalStatus,
    toolId: input.execution.toolId,
    inputHash: input.execution.inputHash,
    actionTaken: `Executed terminal command "${value.command}".`,
    keyFindings: [
      `exitCode=${exitCode === null ? "null" : exitCode}`,
      `processCompleted=${processCompleted}`,
      toEvidenceResolutionFinding("commandSucceeded", commandSucceeded),
      toEvidenceResolutionFinding("taskSatisfied", taskSatisfied),
      ...(stdoutPreview ? [`stdout=${stdoutPreview}`] : []),
      ...(stderrPreview ? [`stderr=${stderrPreview}`] : []),
      `stdoutEncoding=${stdoutEncoding}`,
      `stderrEncoding=${stderrEncoding}`,
      `timedOut=${timedOut}`,
      `truncated=${truncated}`,
      `binaryDetected=${binaryDetected}`,
      ...violations.slice(0, 3),
    ],
    answerReadiness: canAnswerCommandQuestion
      ? {
          canAnswer: true,
          reason:
            commandSucceeded === "true"
              ? "Terminal command completed successfully, but task satisfaction still requires answer-time interpretation."
              : "Terminal command completed with a non-zero exit code, so the answer must describe command failure without claiming the task succeeded.",
        }
      : {
          canAnswer: false,
          reason: binaryDetected
            ? "Terminal output included binary data and cannot be treated as natural-language evidence."
            : timedOut
              ? "Terminal session timed out before producing a stable result."
              : truncated
                ? "Terminal output was truncated before a stable natural-language result was available."
                : unreadableReason ??
                  "Terminal result is not yet enough for a command-oriented answer.",
          missingInfo:
            binaryDetected || unreadableReason
              ? ["a readable terminal result"]
              : timedOut || truncated
                ? ["a completed command result"]
                : ["clear command result intent"],
        },
    data: {
      kind: "terminal_session",
      command: value.command,
      exitCode,
      processCompleted,
      commandSucceeded,
      taskSatisfied,
      stdoutPreview,
      stderrPreview,
      stdoutEncoding,
      stderrEncoding,
      timedOut,
      truncated,
      binaryDetected,
      violations,
      outputInterpretable,
      ...(unreadableReason ? { unreadableReason } : {}),
      canAnswerCommandQuestion,
    },
    rawRef: {
      evidenceIndex: input.evidenceIndex,
      toolCallId: input.execution.toolCallId,
      invocationId: input.execution.invocationId,
    },
  };
};

export const createToolExecutionEvidenceSummary = (input: {
  execution: AgentToolExecutionResult;
  question: string;
  evidenceIndex: number;
}): AgentEvidenceSummary => {
  if (input.execution.status === "awaiting_approval") {
    return {
      source: "tool",
      status: "blocked",
      toolId: input.execution.toolId,
      inputHash: input.execution.inputHash,
      actionTaken: `${input.execution.toolId} is waiting for approval.`,
      keyFindings: [
        `toolId=${input.execution.toolId}`,
        ...(input.execution.approval?.reason ? [input.execution.approval.reason] : []),
      ],
      answerReadiness: {
        canAnswer: false,
        reason: "Tool execution is paused for approval and cannot satisfy the answer stop rule.",
        missingInfo: ["approval decision"],
      },
      rawRef: {
        evidenceIndex: input.evidenceIndex,
        toolCallId: input.execution.toolCallId,
        invocationId: input.execution.invocationId,
      },
    };
  }

  if (input.execution.status === "denied") {
    return {
      source: "tool",
      status: "denied",
      toolId: input.execution.toolId,
      inputHash: input.execution.inputHash,
      actionTaken: `${input.execution.toolId} was denied before execution.`,
      keyFindings: [
        `toolId=${input.execution.toolId}`,
        ...(input.execution.errorMessage ? [input.execution.errorMessage] : []),
      ],
      answerReadiness: {
        canAnswer: false,
        reason: "Denied tool execution does not satisfy the answer stop rule.",
        missingInfo: ["allowed grounded evidence"],
      },
      rawRef: {
        evidenceIndex: input.evidenceIndex,
        toolCallId: input.execution.toolCallId,
        invocationId: input.execution.invocationId,
      },
    };
  }

  if (input.execution.status === "failed") {
    const failureKind = input.execution.failureKind ?? "recoverable";
    return {
      source: "tool",
      status: "failed",
      toolId: input.execution.toolId,
      inputHash: input.execution.inputHash,
      actionTaken:
        failureKind === "terminal"
          ? `${input.execution.toolId} failed and stopped the current tool loop.`
          : `${input.execution.toolId} failed and can be retried or adjusted.`,
      keyFindings: [
        `toolId=${input.execution.toolId}`,
        `failureKind=${failureKind}`,
        ...(input.execution.failureCode
          ? [`failureCode=${input.execution.failureCode}`]
          : []),
        ...(typeof input.execution.recoveryAttemptCount === "number"
          ? [`recoveryAttemptCount=${input.execution.recoveryAttemptCount}`]
          : []),
        ...(input.execution.errorMessage ? [input.execution.errorMessage] : []),
      ],
      answerReadiness: {
        canAnswer: false,
        reason:
          failureKind === "terminal"
            ? "Terminal tool failure does not satisfy the answer stop rule."
            : "Recoverable tool failure does not satisfy the answer stop rule yet.",
        missingInfo: ["successful grounded evidence"],
      },
      rawRef: {
        evidenceIndex: input.evidenceIndex,
        toolCallId: input.execution.toolCallId,
        invocationId: input.execution.invocationId,
      },
    };
  }

  return (
    createReadListSummary(input) ??
    createReadOpenSummary(input) ??
    createReadLocateSummary(input) ??
    createWebSearchSummary(input) ??
    createEditFileSummary(input) ??
    createWorkspaceMutationSummary(input) ??
    createTerminalSessionSummary(input) ?? {
      source: "tool",
      status: "completed",
      toolId: input.execution.toolId,
      inputHash: input.execution.inputHash,
      actionTaken: `${input.execution.toolId} completed.`,
      keyFindings: [`toolId=${input.execution.toolId}`, "result=completed"],
      answerReadiness: {
        canAnswer: false,
        reason: "The completed tool result does not have a stable summary contract yet.",
        missingInfo: [`summary contract for ${input.execution.toolId}`],
      },
      rawRef: {
        evidenceIndex: input.evidenceIndex,
        toolCallId: input.execution.toolCallId,
        invocationId: input.execution.invocationId,
      },
    }
  );
};

export const getLatestEvidenceSummary = (state: EvidenceState) =>
  getEvidencePayload(state).latestSummary;

const normalizeRepeatedRetrievalQuery = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const normalizeRepeatedWorkspaceArg = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = normalizeWorkspaceRelativePathArg(value);
  if (normalized.type === "normalized") {
    return normalized.value;
  }

  return value.trim();
};

const normalizeRepeatedToolArgs = (
  toolId: string,
  args: Record<string, unknown>,
) => {
  if (WORKSPACE_READ_TOOL_IDS.has(toolId)) {
    const rawPath = args.path;
    if (typeof rawPath !== "string") {
      return args;
    }

    const trimmedPath = rawPath.trim();
    // Only align repeated-guard hashing with workspace-bound path normalization.
    // This keeps planner repeat detection consistent with frozen pendingToolCall args.
    if (
      trimmedPath !== WORKSPACE_ROOT_SENTINEL &&
      trimmedPath !== `${WORKSPACE_ROOT_SENTINEL}/` &&
      !trimmedPath.startsWith(`${WORKSPACE_ROOT_SENTINEL}/`)
    ) {
      return args;
    }

    return {
      ...args,
      path: normalizeRepeatedWorkspaceArg(rawPath),
    };
  }

  if (WORKSPACE_MUTATION_TOOL_IDS.has(toolId)) {
    let nextArgs: Record<string, unknown> | null = null;

    for (const key of ["targetPath", "destinationPath"] as const) {
      if (typeof args[key] !== "string") {
        continue;
      }

      const normalizedValue = normalizeRepeatedWorkspaceArg(args[key]);
      if (normalizedValue !== args[key]) {
        nextArgs ??= { ...args };
        nextArgs[key] = normalizedValue;
      }
    }

    return nextArgs ?? args;
  }

  return args;
};

const createRepeatedToolArgsHash = (input: {
  toolId: string;
  args: Record<string, unknown>;
}) =>
  createInvocationInputHash({
    toolId: input.toolId,
    args: input.args,
    source: "planner",
  });

export const getRepeatedActionGuardResult = (input: {
  evidence: AgentEvidencePayload | undefined;
  nextAction: AgentNextAction | undefined;
}): AgentRepeatedActionGuardResult => {
  if (!input.evidence || !input.nextAction) {
    return { triggered: false };
  }

  if (input.nextAction.type === "use_tool") {
    const nextToolId = input.nextAction.toolId;
    const guardedArgs = normalizeRepeatedToolArgs(
      nextToolId,
      input.nextAction.args,
    );
    const guardedArgsHash = createRepeatedToolArgsHash({
      toolId: nextToolId,
      args: guardedArgs,
    });
    const matchedEvidenceIndex = input.evidence.toolExecutions.findIndex(
      (execution) =>
        execution.status === "completed" &&
        execution.toolId === nextToolId &&
        execution.inputHash === guardedArgsHash,
    );
    if (matchedEvidenceIndex >= 0) {
      const matchedExecution = input.evidence.toolExecutions[matchedEvidenceIndex]!;
      return {
        triggered: true,
        reason: `Repeated tool guard: identical ${nextToolId} call already completed in this run; answer from existing evidence.`,
        guardedActionType: "use_tool",
        guardedToolId: nextToolId,
        guardedArgsHash,
        matchedEvidenceIndex,
        matchedToolCallId: matchedExecution.toolCallId,
      };
    }
  }

  if (input.nextAction.type === "retrieve") {
    const guardedQuery = normalizeRepeatedRetrievalQuery(input.nextAction.query);
    const matchedEvidenceIndex = input.evidence.retrievals.findIndex(
      (retrieval) =>
        normalizeRepeatedRetrievalQuery(retrieval.query) === guardedQuery,
    );
    if (matchedEvidenceIndex >= 0) {
      return {
        triggered: true,
        reason: `Repeated retrieval guard: identical retrieval query already completed in this run; answer from existing evidence.`,
        guardedActionType: "retrieve",
        guardedQuery,
        matchedEvidenceIndex,
      };
    }
  }

  return { triggered: false };
};

export const getAnswerStopDecision = (input: {
  latestSummary: AgentEvidenceSummary | undefined;
  pendingApproval?: unknown;
  errorMessage?: string;
  question?: string;
  currentTaskFrame?: CurrentTaskFrame;
  evidence?: AgentEvidencePayload;
}) => {
  if (!input.latestSummary) {
    return {
      shouldAnswer: false,
      reason: "No latest evidence summary is available for answer stop evaluation.",
    };
  }

  if (input.pendingApproval) {
    return {
      shouldAnswer: false,
      reason: "Answer stop rule is blocked because the run is waiting for approval.",
    };
  }

  if (input.errorMessage) {
    return {
      shouldAnswer: false,
      reason: "Answer stop rule is blocked because the run already has an error.",
    };
  }

  if (
    input.latestSummary.status !== "completed" &&
    input.latestSummary.status !== "truncated"
  ) {
    return {
      shouldAnswer: false,
      reason: `Answer stop rule requires completed evidence, but latest status is ${input.latestSummary.status}.`,
    };
  }

  if (!input.latestSummary.answerReadiness.canAnswer) {
    return {
      shouldAnswer: false,
      reason:
        input.latestSummary.answerReadiness.reason ||
        "Latest evidence summary does not mark the answer as ready.",
    };
  }

  if ((input.latestSummary.answerReadiness.missingInfo?.length ?? 0) > 0) {
    return {
      shouldAnswer: false,
      reason: "Latest evidence summary still declares missing information.",
    };
  }

  const taskCoverageView = getTaskCoverageView({
    question: input.question,
    currentTaskFrame: input.currentTaskFrame,
    evidence: input.evidence,
    latestSummary: input.latestSummary,
  });
  if (!taskCoverageView.taskCompletable) {
    return {
      shouldAnswer: false,
      reason:
        taskCoverageView.blockedReason ?? "Current task coverage is not complete yet.",
    };
  }

  return {
    shouldAnswer: true,
    reason: input.latestSummary.answerReadiness.reason,
  };
};

const appendUniqueObservation = (
  observations: AgentObservation[],
  observation: AgentObservation,
) => {
  if (observations.some((item) => item.id === observation.id)) {
    return observations;
  }

  return [...observations, observation];
};

const isSameToolExecution = (
  left: AgentToolExecutionResult,
  right: AgentToolExecutionResult,
) =>
  Boolean(
    (left.toolCallId &&
      right.toolCallId &&
      left.toolCallId === right.toolCallId &&
      left.status === right.status) ||
      (left.inputHash &&
        right.inputHash &&
        left.inputHash === right.inputHash &&
        left.toolId === right.toolId &&
        left.status === right.status &&
        left.startedAt === right.startedAt),
  );

const appendUniqueToolExecution = (
  executions: AgentToolExecutionResult[],
  execution: AgentToolExecutionResult,
) => {
  if (executions.some((item) => isSameToolExecution(item, execution))) {
    return executions;
  }

  return [...executions, execution];
};

const isSameRetrieval = (
  left: AgentRetrievalEvidence,
  right: AgentRetrievalEvidence,
) => {
  if (left.query !== right.query || left.chunkCount !== right.chunkCount) {
    return false;
  }

  const leftChunkIds = left.chunks.map((chunk) => String(chunk.chunkId)).join("|");
  const rightChunkIds = right.chunks.map((chunk) => String(chunk.chunkId)).join("|");
  return leftChunkIds === rightChunkIds;
};

const appendUniqueRetrieval = (
  retrievals: AgentRetrievalEvidence[],
  retrieval: AgentRetrievalEvidence,
) => {
  if (retrievals.some((item) => isSameRetrieval(item, retrieval))) {
    return retrievals;
  }

  return [...retrievals, retrieval];
};

export const appendObservationEvidence = (
  state: EvidenceState,
  observation: AgentObservation,
): AgentEvidencePayload => {
  const current = getEvidencePayload(state);
  const summary =
    observation.summary ??
    createObservationEvidenceSummary({
      observation,
      evidenceIndex: current.observations.length,
    });
  const keepExistingLatestSummary =
    Boolean(current.latestSummary) &&
    (observation.stepId === "generate" || observation.stepId === "evaluate") &&
    observation.status === "ok";
  return {
    ...current,
    observations: appendUniqueObservation(current.observations, {
      ...observation,
      summary,
    }),
    latestSummary: keepExistingLatestSummary ? current.latestSummary : summary,
  };
};

export const appendToolExecutionEvidence = (
  state: EvidenceState,
  execution: AgentToolExecutionResult,
): AgentEvidencePayload => {
  const current = getEvidencePayload(state);
  const summary =
    execution.summary ??
    createToolExecutionEvidenceSummary({
      execution,
      question: getLatestUserQuestion(state),
      evidenceIndex: current.toolExecutions.length,
    });
  return {
    ...current,
    toolExecutions: appendUniqueToolExecution(current.toolExecutions, {
      ...execution,
      summary,
    }),
    latestSummary: summary,
  };
};

export const appendRetrievalEvidence = (
  state: EvidenceState,
  retrieval: AgentRetrievalEvidence,
): AgentEvidencePayload => {
  const current = getEvidencePayload(state);
  const summary =
    retrieval.summary ??
    createRetrievalEvidenceSummary({
      retrieval,
      question: getLatestUserQuestion(state),
      evidenceIndex: current.retrievals.length,
    });
  return {
    ...current,
    retrievals: appendUniqueRetrieval(current.retrievals, {
      ...retrieval,
      summary,
    }),
    latestSummary: summary,
  };
};

export const getEvidenceCounts = (state: EvidenceState) => {
  const evidence = getEvidencePayload(state);
  return {
    observations: evidence.observations.length,
    toolExecutions: evidence.toolExecutions.length,
    retrievals: evidence.retrievals.length,
  };
};
