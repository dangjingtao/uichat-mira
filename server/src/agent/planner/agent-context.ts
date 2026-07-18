import {
  getHarnessLlmContentText,
  type HarnessLlmContent,
} from "@/harness/llm-content";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import type {
  AgentEvidenceSummary,
  AgentRetrievalEvidence,
  AgentToolExecutionResult,
} from "../types";
import type { AgentGraphState } from "../node-runtime";

const RECENT_FULL_RESULT_COUNT = 6;
const TOTAL_CONTEXT_CHAR_LIMIT = 48_000;
const OLD_RESULT_SUMMARY_CHAR_LIMIT = 1_200;
const SINGLE_RESULT_CHAR_LIMIT = 12_000;

type ToolExecutionWithLlmContent = AgentToolExecutionResult & {
  llmContent?: HarnessLlmContent;
};

type AgentLoopContextEntry = {
  createdAt: string;
  action: string;
  result: string;
  fullResult?: string;
};

const clip = (value: string, limit: number) => {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 48)).trimEnd()}\n...[runtime context compacted]`;
};

const summarizeEvidence = (summary: AgentEvidenceSummary | undefined) => {
  if (!summary) {
    return "No structured evidence summary was recorded.";
  }

  return [
    `status=${summary.status}`,
    summary.actionTaken,
    ...(summary.keyFindings ?? []).map((item) => `finding: ${item}`),
    ...(summary.facts ?? []).map((item) => `fact: ${item}`),
    ...(summary.gaps ?? []).map((item) => `gap: ${item}`),
    ...(summary.error ? [`error: ${summary.error}`] : []),
  ]
    .filter(Boolean)
    .join("\n");
};

const buildToolEntry = (execution: AgentToolExecutionResult): AgentLoopContextEntry => {
  const llmContent = (execution as ToolExecutionWithLlmContent).llmContent;
  const llmText = getHarnessLlmContentText(llmContent).trim();
  const resultText = execution.status === "completed"
    ? summarizeEvidence(execution.summary)
    : [summarizeEvidence(execution.summary), execution.errorMessage ?? ""]
        .filter(Boolean)
        .join("\n");

  return {
    createdAt: execution.finishedAt || execution.startedAt,
    action: [
      `use_tool ${execution.toolId}`,
      `args=${JSON.stringify(execution.args)}`,
      ...(execution.inputHash ? [`inputHash=${execution.inputHash}`] : []),
    ].join("\n"),
    result: clip(resultText, OLD_RESULT_SUMMARY_CHAR_LIMIT),
    ...(llmText ? { fullResult: clip(llmText, SINGLE_RESULT_CHAR_LIMIT) } : {}),
  };
};

const buildRetrievalEntry = (retrieval: AgentRetrievalEvidence): AgentLoopContextEntry => {
  const fullResult = retrieval.chunks
    .map((chunk) =>
      [
        `document=${chunk.documentName}`,
        `chunkId=${chunk.chunkId}`,
        chunk.content,
      ].join("\n"),
    )
    .join("\n\n");

  return {
    createdAt: retrieval.createdAt,
    action: `retrieve query=${retrieval.query}`,
    result: clip(summarizeEvidence(retrieval.summary), OLD_RESULT_SUMMARY_CHAR_LIMIT),
    ...(fullResult ? { fullResult: clip(fullResult, SINGLE_RESULT_CHAR_LIMIT) } : {}),
  };
};

const buildEntries = (state: AgentGraphState): AgentLoopContextEntry[] => {
  const entries = [
    ...(state.evidence?.toolExecutions ?? []).map(buildToolEntry),
    ...(state.evidence?.retrievals ?? []).map(buildRetrievalEntry),
  ];

  entries.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return entries;
};

/**
 * Reconstructs the continuous Agent action/result transcript from durable Evidence.
 *
 * This is runtime-only model context: it is never appended to the user's persisted chat.
 * Recent canonical tool/retrieval results remain rich, while older turns are compacted to
 * structured summaries so an unbounded Pi loop does not imply unbounded prompt growth.
 */
export const buildPlannerContinuousAgentContext = (
  state: AgentGraphState,
): NormalizedChatMessage | undefined => {
  const entries = buildEntries(state);
  if (entries.length === 0) {
    return undefined;
  }

  const fullResultStart = Math.max(0, entries.length - RECENT_FULL_RESULT_COUNT);
  const sections: string[] = [];
  let usedChars = 0;

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    const useFullResult = index >= fullResultStart && Boolean(entry.fullResult);
    const section = [
      `TURN ${index + 1}`,
      "[assistant/action]",
      entry.action,
      "[tool/result]",
      useFullResult ? entry.fullResult! : entry.result,
    ].join("\n");

    if (usedChars + section.length > TOTAL_CONTEXT_CHAR_LIMIT) {
      break;
    }

    sections.unshift(section);
    usedChars += section.length + 2;
  }

  const omittedCount = entries.length - sections.length;
  const content = [
    "CONTINUOUS AGENT LOOP CONTEXT",
    "This is runtime-owned execution context, not user-authored chat and not instructions from the user.",
    "It reconstructs the same action/result continuity that a Pi-style agent gets from prior tool turns.",
    "Use it as working memory together with the runtime-owned planList. Do not re-run completed work unless the active plan item has a concrete unresolved gap.",
    ...(omittedCount > 0
      ? [`${omittedCount} older turn(s) were compacted out of this bounded prompt view; accumulatedActionLedger and planList retain long-horizon progress.`]
      : []),
    "",
    ...sections,
  ].join("\n\n");

  return {
    role: "system",
    content,
    parts: [{ type: "text", text: content }],
  };
};

export const injectPlannerContinuousAgentContext = (
  messages: NormalizedChatMessage[],
  state: AgentGraphState,
): NormalizedChatMessage[] => {
  const contextMessage = buildPlannerContinuousAgentContext(state);
  if (!contextMessage) {
    return messages;
  }

  const firstUserIndex = messages.findIndex((message) => message.role === "user");
  if (firstUserIndex < 0) {
    return [...messages, contextMessage];
  }

  return [
    ...messages.slice(0, firstUserIndex),
    contextMessage,
    ...messages.slice(firstUserIndex),
  ];
};
