import type {
  AgentEvidencePayload,
  AgentEvidenceSummary,
  AgentObservation,
  AgentRepeatedActionGuardResult,
  AgentRetrievalEvidence,
  AgentNextAction,
  AgentToolExecutionResult,
} from "./types.js";
import { createInvocationInputHash } from "./approval-fingerprint.js";

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

const trimTextPreview = (value: string, limit = TEXT_PREVIEW_LIMIT) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.length > limit
    ? `${normalized.slice(0, limit).trimEnd()}...`
    : normalized;
};

const getLatestUserQuestion = (state: EvidenceState) => {
  const latest = [...(state.messages ?? [])]
    .reverse()
    .find((message) => message.role === "user");
  return latest?.content.trim() ?? state.goal?.text?.trim() ?? "";
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
    status: "completed",
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
    status: "completed",
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
  const exitCode =
    typeof value.exitCode === "number" || value.exitCode === null
      ? (value.exitCode as number | null)
      : null;
  const canAnswerCommandQuestion = !timedOut && queryRequestsCommandResult(input.question);

  return {
    source: "tool",
    status: "completed",
    toolId: input.execution.toolId,
    inputHash: input.execution.inputHash,
    actionTaken: `Executed terminal command "${value.command}".`,
    keyFindings: [
      `exitCode=${exitCode === null ? "null" : exitCode}`,
      ...(stdoutPreview ? [`stdout=${stdoutPreview}`] : []),
      ...(stderrPreview ? [`stderr=${stderrPreview}`] : []),
      `timedOut=${timedOut}`,
    ],
    answerReadiness: canAnswerCommandQuestion
      ? {
          canAnswer: true,
          reason: "Terminal command output is available for answer generation.",
        }
      : {
          canAnswer: false,
          reason: timedOut
            ? "Terminal session timed out before producing a stable result."
            : "Terminal result is not yet enough for a command-oriented answer.",
          missingInfo: timedOut ? ["a completed command result"] : ["clear command result intent"],
        },
    data: {
      kind: "terminal_session",
      command: value.command,
      exitCode,
      stdoutPreview,
      stderrPreview,
      timedOut,
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
      status: "awaiting_approval",
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

  if (input.execution.status === "failed") {
    return {
      source: "tool",
      status: "failed",
      toolId: input.execution.toolId,
      inputHash: input.execution.inputHash,
      actionTaken: `${input.execution.toolId} failed.`,
      keyFindings: [
        `toolId=${input.execution.toolId}`,
        ...(input.execution.errorMessage ? [input.execution.errorMessage] : []),
      ],
      answerReadiness: {
        canAnswer: false,
        reason: "Failed tool execution does not satisfy the answer stop rule.",
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
    createWebSearchSummary(input) ??
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
    const guardedArgsHash = createRepeatedToolArgsHash({
      toolId: nextToolId,
      args: input.nextAction.args,
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

  if (input.latestSummary.status !== "completed") {
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
