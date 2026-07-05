/**
 * 生成节点：基于检索证据和工具执行结果，生成面向用户的最终回答。
 */
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import { contextBudgetService } from "@/services/context-budget/index";
import { agentGenerateTextRunnable } from "../runnables";
import {
  appendObservationEvidence,
  getEvidencePayload,
  getLatestEvidenceSummary,
} from "../evidence";
import { emitStepNode } from "../node-runtime";
import {
  answerClaimsUnverifiedObservation,
  createObservation,
  getLatestUserQuestion,
  nowIso,
  queryMentionsWorkspace,
  queryRequestsDirectoryOverview,
  queryRequestsFileContent,
} from "./shared";
import type {
  AgentNodeState,
  EmitAgentExecutionNode,
} from "../node-runtime";
import type {
  AgentEvidenceSummary,
  AgentToolExecutionResult,
} from "../types";

const buildGenerateMessages = (
  state: AgentNodeState,
): NormalizedChatMessage[] => {
  const baseMessages = [
    ...(state.requestContextMessages ?? []),
    ...buildGenerateInstructionMessages(state),
  ];
  const evidenceMessages = buildGenerateEvidenceMessages(state);

  return [
    ...baseMessages,
    ...evidenceMessages,
    ...state.messages
      .slice(0, -1)
      .filter(
        (message) => message.role === "user" || message.role === "system",
      ),
    state.messages[state.messages.length - 1]!,
  ];
};

const GENERATE_OUTPUT_GUARD_PATTERNS = [
  /<function_calls?>/i,
  /^\s*\{[\s\S]*"type"\s*:\s*"(?:answer|retrieve|use_tool|error)"/i,
  /^\s*\{[\s\S]*"toolId"\s*:/i,
  /pendingToolCall\s*:/i,
  /toolId\s*:/i,
  /\bargs\s*:/i,
  /(我将调用|下一步我会|我会先调用|I will call|next step I will)/i,
];

const PENDING_APPROVAL_FAKE_EXECUTION_PATTERNS = [
  /(已经执行|已执行|执行完成|输出如下|结果如下)/u,
  /(already executed|executed successfully|output is|result is)/i,
];

const toPreviewText = (value: string, limit = 220) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.length > limit
    ? `${normalized.slice(0, limit).trimEnd()}...`
    : normalized;
};

const formatEvidenceBulletList = (items: string[]) =>
  items
    .filter((item) => item.trim())
    .map((item) => `- ${item}`)
    .join("\n");

const buildToolEvidenceBlock = (execution: AgentToolExecutionResult) => {
  const summary = execution.summary;
  if (!summary) {
    return [
      `toolId: ${execution.toolId}`,
      `status: ${execution.status}`,
      "keyFindings:",
      "- This tool completed, but no stable answer summary was attached.",
    ].join("\n");
  }

  const lines = [
    `toolId: ${execution.toolId}`,
    `status: ${summary.status}`,
    `actionTaken: ${summary.actionTaken}`,
  ];

  if (summary.data?.kind === "read_list") {
    lines.push(`path: ${summary.data.path}`);
    lines.push(`entryCount: ${summary.data.entryCount}`);
    lines.push(
      `entriesPreview: ${summary.data.entriesPreview.join(" | ") || "(none)"}`,
    );
    lines.push(`truncated: ${summary.data.truncated}`);
  } else if (summary.data?.kind === "read_locate") {
    lines.push(`scope: ${summary.data.scope}`);
    lines.push(`query: ${summary.data.query}`);
    lines.push(`searchMode: ${summary.data.searchMode}`);
    lines.push(`matchCount: ${summary.data.matchCount}`);
    lines.push(
      `matchesPreview: ${summary.data.matchesPreview.join(" | ") || "(none)"}`,
    );
    lines.push(`truncated: ${summary.data.truncated}`);
  } else if (summary.data?.kind === "read_open") {
    lines.push(`path: ${summary.data.path}`);
    lines.push(`contentPreview: ${summary.data.contentPreview || "(empty)"}`);
    lines.push(`contentLength: ${summary.data.contentLength}`);
  } else if (summary.data?.kind === "web_search") {
    lines.push(`query: ${summary.data.query}`);
    lines.push(`resultCount: ${summary.data.resultCount}`);
    lines.push(
      `topFindings: ${summary.data.topFindings.join(" | ") || "(none)"}`,
    );
  } else if (summary.data?.kind === "terminal_session") {
    lines.push(`command: ${summary.data.command}`);
    lines.push(
      `exitCode: ${summary.data.exitCode === null ? "null" : summary.data.exitCode}`,
    );
    lines.push(`stdoutPreview: ${summary.data.stdoutPreview || "(empty)"}`);
    lines.push(`stderrPreview: ${summary.data.stderrPreview || "(empty)"}`);
  }

  lines.push("keyFindings:");
  lines.push(formatEvidenceBulletList(summary.keyFindings));
  return lines.join("\n");
};

const READ_OPEN_FULL_TEXT_LIMIT = 4000;

const buildReadOpenRawContentBlock = (execution: AgentToolExecutionResult) => {
  if (!execution.result || typeof execution.result !== "object") {
    return null;
  }

  const value = execution.result as Record<string, unknown>;
  const source =
    value.type === "open" && value.source && typeof value.source === "object"
      ? (value.source as Record<string, unknown>)
      : null;
  const text =
    source && typeof source.text === "string" ? source.text.trim() : "";
  if (!text) {
    return null;
  }

  const boundedText =
    text.length > READ_OPEN_FULL_TEXT_LIMIT
      ? `${text.slice(0, READ_OPEN_FULL_TEXT_LIMIT).trimEnd()}\n...[truncated]`
      : text;

  return ["rawContent:", boundedText].join("\n");
};

const buildRetrievalEvidenceBlock = (retrieval: {
  query: string;
  chunkCount: number;
  chunks: Array<{ documentName: string; content: string }>;
  summary?: AgentEvidenceSummary;
}) => {
  const summary = retrieval.summary;
  const chunkPreview = retrieval.chunks
    .slice(0, 3)
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.documentName}: ${toPreviewText(chunk.content, 160)}`,
    )
    .join("\n");

  return [
    `query: ${retrieval.query}`,
    `chunkCount: ${retrieval.chunkCount}`,
    ...(summary?.data?.kind === "retrieval" &&
    summary.data.documentsPreview.length > 0
      ? [`documentsPreview: ${summary.data.documentsPreview.join(" | ")}`]
      : []),
    "chunks:",
    chunkPreview || "- (none)",
  ].join("\n");
};

const buildGenerateEvidenceMessages = (
  state: AgentNodeState,
): NormalizedChatMessage[] => {
  const evidence = getEvidencePayload(state);
  const evidenceMessages: NormalizedChatMessage[] = [];

  const completedToolExecutions = evidence.toolExecutions.filter(
    (execution) => execution.status === "completed",
  );

  if (completedToolExecutions.length > 0) {
    const toolEvidenceText = [
      "以下是本轮 Agent 已实际执行完成的工具证据摘要。",
      ...completedToolExecutions.map((execution, index) => {
        const sections = [`#${index + 1}`, buildToolEvidenceBlock(execution)];
        const rawContentBlock =
          execution.toolId === "read_open"
            ? buildReadOpenRawContentBlock(execution)
            : null;
        if (rawContentBlock) {
          sections.push(rawContentBlock);
        }
        return sections.join("\n");
      }),
      "你只能基于这些真实证据回答；不要复述工具协议，也不要输出工具 JSON。",
    ].join("\n\n");
    evidenceMessages.push({
      role: "system",
      content: toolEvidenceText,
      parts: [
        {
          type: "text",
          text: toolEvidenceText,
        },
      ],
    });
  }

  const retrievalEvidenceChunks =
    evidence.retrievals.length > 0
      ? evidence.retrievals
      : (state.retrievedChunks ?? []).map((chunk) => ({
          query: getLatestUserQuestion(state.messages) || state.goal.text,
          chunkCount: 1,
          chunks: [
            {
              chunkId: chunk.chunkId,
              documentName: chunk.documentName,
              score: chunk.score,
              content: chunk.content,
            },
          ],
          createdAt: nowIso(),
        }));

  if (retrievalEvidenceChunks.length > 0) {
    const contextText = retrievalEvidenceChunks
      .map((retrieval, index) =>
        [`#${index + 1}`, buildRetrievalEvidenceBlock(retrieval)].join("\n"),
      )
      .join("\n\n");

    evidenceMessages.push({
      role: "system",
      content: `以下是 Agent 检索到的真实上下文证据，请优先依据这些内容回答，并说明不确定性。\n\n${contextText}`,
      parts: [
        {
          type: "text",
          text: `以下是 Agent 检索到的真实上下文证据，请优先依据这些内容回答，并说明不确定性。\n\n${contextText}`,
        },
      ],
    });
  }

  return evidenceMessages;
};

const buildGenerateInstructionMessages = (
  state: AgentNodeState,
): NormalizedChatMessage[] => {
  const evidence = getEvidencePayload(state);
  const hasCompletedToolEvidence = evidence.toolExecutions.some(
    (execution) => execution.status === "completed",
  );
  const hasRetrievalEvidence = evidence.retrievals.some(
    (retrieval) => retrieval.chunkCount > 0,
  );

  return [
    {
      role: "system",
      content: [
        "你现在处于 Agent 的最终回答阶段，不是 Planner。",
        "你的输出必须是直接面向用户的自然语言最终回答。",
        "不要输出工具调用 JSON、nextAction JSON、trace 文本、pendingToolCall、toolId、args、<function_calls> 或类似协议内容。",
        "不要说“我将调用工具”“下一步我会”或任何伪执行话术。",
        state.pendingApproval
          ? "当前存在 pendingApproval。你只能说明工具仍在等待审批，当前还没有真实执行结果，不能假装命令或工具已经执行。"
          : "如果已存在 completed evidence，请只基于这些真实 evidence 回答。",
        hasCompletedToolEvidence || hasRetrievalEvidence
          ? "如果 evidence 足够，请直接总结事实；如果 evidence 仍不足，请明确说明缺什么。"
          : "当前没有真实检索结果或已完成工具结果时，不要声称自己已经查看过文件、目录、网页、知识库或外部系统。",
      ].join("\n"),
    },
  ];
};

const buildGenerateContextBudget = (state: AgentNodeState) =>
  contextBudgetService.pack({
    policy: state.knowledgeBaseId ? "rag-chat" : "plain-chat",
    roleType: "llm",
    sections: {
      prefaceMessages: state.requestContextMessages,
      instructionMessages: buildGenerateInstructionMessages(state),
      payloads: getEvidencePayload(state).retrievals.length
        ? [
            {
              id: "agent-retrieval-payload",
              required: true,
              messages: getEvidencePayload(state).retrievals.flatMap(
                (retrieval) =>
                  retrieval.chunks.map((chunk, index) => ({
                    role: "system" as const,
                    content: `[${index + 1}] ${chunk.documentName}\n${chunk.content}`,
                  })),
              ),
            },
          ]
        : state.retrievedChunks?.length
          ? [
              {
                id: "agent-retrieval-payload",
                required: true,
                messages: state.retrievedChunks.map((chunk, index) => ({
                  role: "system" as const,
                  content: `[${index + 1}] ${chunk.documentName}\n${chunk.content}`,
                })),
              },
            ]
          : [],
      historyMessages: state.messages
        .slice(0, -1)
        .filter(
          (message) => message.role === "user" || message.role === "system",
        ),
      latestUserMessage: {
        role: "user",
        content: getLatestUserQuestion(state.messages) || state.goal.text,
      },
    },
  });

const normalizeIntentText = (value: string) => value.trim().toLowerCase();

const answerLooksLikeFabricatedWorkspaceResult = (input: {
  question: string;
  answer: string;
}) => {
  const normalizedQuestion = normalizeIntentText(input.question);
  if (
    !queryMentionsWorkspace(normalizedQuestion) &&
    !queryRequestsDirectoryOverview(normalizedQuestion) &&
    !queryRequestsFileContent(normalizedQuestion)
  ) {
    return false;
  }

  const answer = input.answer.trim();
  if (!answer) {
    return false;
  }

  const resultClaimPatterns = [
    /(当前|这个|该)?\s*(workspace|目录|文件夹|文件|folder|directory)\s*(下|里|中)?\s*(有|包含|包括|contains|includes|has)\s+/iu,
    /(workspace|directory|folder)\s+(contains|includes|has)\s+/iu,
  ];
  const filenamePattern = /\b[\w.-]+\.[a-z0-9]{1,12}\b/iu;
  const listPattern =
    /(?:^|[：:]\s*|有\s*)(?:[\w.-]+(?:\.[a-z0-9]{1,12})?)(?:\s*[、,，]\s*[\w.-]+(?:\.[a-z0-9]{1,12})?){1,}/iu;

  return (
    resultClaimPatterns.some((pattern) => pattern.test(answer)) &&
    (filenamePattern.test(answer) || listPattern.test(answer))
  );
};

const renderSummaryBasedAnswer = (summary: AgentEvidenceSummary) => {
  if (summary.source === "tool" && summary.data?.kind === "read_list") {
    const preview = summary.data.entriesPreview.join("、");
    return summary.data.entryCount > 0
      ? `当前 workspace 下共找到 ${summary.data.entryCount} 项，其中预览包括 ${preview}${summary.data.truncated ? " 等内容。" : "。"}`
      : `当前 workspace 路径 ${summary.data.path} 下没有列出任何条目。`;
  }

  if (summary.source === "tool" && summary.data?.kind === "read_open") {
    const keySections =
      summary.data.keySections && summary.data.keySections.length > 0
        ? `重点段落包括 ${summary.data.keySections.join("、")}。`
        : "";
    return summary.data.contentPreview
      ? `${summary.data.path} 的已读取内容显示：${summary.data.contentPreview}${keySections ? ` ${keySections}` : ""}`
      : `${summary.data.path} 已打开，但当前可用内容为空，暂时无法给出可靠概括。`;
  }

  if (summary.source === "tool" && summary.data?.kind === "web_search") {
    const finding = summary.data.topFindings[0];
    return finding
      ? `当前检索到 ${summary.data.resultCount} 条网页结果，最相关信息是：${finding}`
      : `这次网页搜索没有返回可用结果，暂时无法基于真实搜索证据回答。`;
  }

  if (summary.source === "tool" && summary.data?.kind === "terminal_session") {
    const parts = [`命令 \`${summary.data.command}\` 已执行。`];
    if (summary.data.exitCode !== null) {
      parts.push(`退出码是 ${summary.data.exitCode}。`);
    }
    if (summary.data.stdoutPreview) {
      parts.push(`stdout 预览：${summary.data.stdoutPreview}`);
    }
    if (summary.data.stderrPreview) {
      parts.push(`stderr 预览：${summary.data.stderrPreview}`);
    }
    if (summary.data.timedOut) {
      parts.push("这次执行发生超时，结果可能不完整。");
    }
    return parts.join(" ");
  }

  if (summary.source === "retrieval" && summary.data?.kind === "retrieval") {
    return summary.data.documentsPreview.length > 0
      ? `当前检索已命中 ${summary.data.chunkCount} 条上下文，主要来自 ${summary.data.documentsPreview.join("、")}。`
      : `当前检索已命中 ${summary.data.chunkCount} 条上下文，可以基于这些检索证据回答。`;
  }

  return "";
};

const buildEvidenceGroundedFallbackAnswer = (state: AgentNodeState) => {
  if (state.pendingApproval) {
    return `这个${state.pendingApproval.toolId === "terminal_session" ? "命令" : "工具调用"}需要你审批后才能执行，当前还没有真实执行结果。`;
  }

  const evidence = getEvidencePayload(state);
  const latestRetrieval = evidence.retrievals.at(-1);
  if (latestRetrieval && latestRetrieval.chunkCount > 0) {
    const chunkPreviews = latestRetrieval.chunks
      .slice(0, 3)
      .map((chunk) => ({
        documentName: chunk.documentName,
        preview: toPreviewText(chunk.content, 220),
      }))
      .filter((chunk) => chunk.preview);
    if (chunkPreviews.length > 0) {
      const [firstChunk, ...restChunks] = chunkPreviews;
      const extraPreview =
        restChunks.length > 0
          ? ` 另外还有 ${restChunks
              .map((chunk) => `${chunk.documentName} 片段：${chunk.preview}`)
              .join("；")}`
          : "";
      return `根据当前检索证据，${firstChunk.documentName} 片段提到：${firstChunk.preview}${extraPreview}`;
    }
  }

  const latestSummary =
    evidence.latestSummary ?? getLatestEvidenceSummary({ evidence });
  if (latestSummary) {
    const summaryAnswer = renderSummaryBasedAnswer(latestSummary);
    if (summaryAnswer) {
      return summaryAnswer;
    }
  }

  const latestCompletedTool = [...evidence.toolExecutions]
    .reverse()
    .find((execution) => execution.status === "completed");
  if (latestCompletedTool?.summary) {
    const summaryAnswer = renderSummaryBasedAnswer(latestCompletedTool.summary);
    if (summaryAnswer) {
      return summaryAnswer;
    }
  }

  return "当前还没有足够的已完成证据来可靠回答这个问题，所以我不能声称自己已经查看过相关文件、目录、网页或命令结果。";
};

const buildSchemaReplanSafeErrorAnswer = (state: AgentNodeState) => {
  const schemaError = state.schemaReplanDiagnostics?.schemaError;
  if (!schemaError) {
    return "当前没有可用证据，而且工具参数规划没有形成可执行调用，所以我不能可靠回答这个问题。";
  }

  return `这次没有执行任何工具，因为生成的工具参数不符合要求：${schemaError}。我目前也没有可用证据可以基于文件或检索结果回答，请重试，或把要读取的文件和目标说得更明确一些。`;
};

const buildGenerateEmptyAnswerFallback = (state: AgentNodeState) => {
  const evidence = getEvidencePayload(state);
  const latestSummary =
    evidence.latestSummary ?? getLatestEvidenceSummary({ evidence });
  if (latestSummary) {
    const summaryAnswer = renderSummaryBasedAnswer(latestSummary);
    if (summaryAnswer) {
      return `工具已执行，但模型没有生成有效回答。以下是当前可用证据摘要：${summaryAnswer}`;
    }
  }

  const latestCompletedTool = [...evidence.toolExecutions]
    .reverse()
    .find((execution) => execution.status === "completed");
  if (latestCompletedTool?.summary) {
    const summaryAnswer = renderSummaryBasedAnswer(latestCompletedTool.summary);
    if (summaryAnswer) {
      return `工具已执行，但模型没有生成有效回答。以下是当前可用证据摘要：${summaryAnswer}`;
    }
  }

  const latestRetrieval = evidence.retrievals.at(-1);
  if (latestRetrieval && latestRetrieval.chunkCount > 0) {
    const firstChunk = latestRetrieval.chunks[0];
    if (firstChunk?.content?.trim()) {
      return `工具已执行，但模型没有生成有效回答。当前至少有这条检索证据可用：${firstChunk.documentName} 提到 ${toPreviewText(firstChunk.content, 220)}`;
    }
  }

  return "模型没有生成有效回答，而且当前也没有可用证据可供总结。";
};

const detectGenerateOutputGuardReason = (answer: string) => {
  if (!answer.trim()) {
    return undefined;
  }

  if (GENERATE_OUTPUT_GUARD_PATTERNS.some((pattern) => pattern.test(answer))) {
    return "generate output exposed tool-style protocol text instead of a user-facing final answer";
  }

  return undefined;
};

const answerLeaksCompletedToolId = (input: {
  answer: string;
  completedToolIds: string[];
}) => {
  const normalized = input.answer.trim();
  if (!normalized) {
    return false;
  }

  return input.completedToolIds.some((toolId) => {
    const escapedToolId = toolId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const leakagePatterns = [
      new RegExp(`\\b${escapedToolId}\\s+completed\\b`, "i"),
      new RegExp(`^${escapedToolId}\\b`, "i"),
    ];
    return leakagePatterns.some((pattern) => pattern.test(normalized));
  });
};

export const generateNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-generate",
    nodeType: "generate",
    phase: "start",
    label: "生成回答",
    summary: "正在生成 Agent 最终回答",
  });

  const budget = buildGenerateContextBudget(state);
  const messages = buildGenerateMessages(state);
  const generationMessages = messages;
  const generationInvocation = providerProxyService.describeChatInvocation(
    "default",
    generationMessages,
  );
  if (
    state.schemaReplanDiagnostics &&
    state.schemaReplanDiagnostics.attemptCount > 1 &&
    !getEvidencePayload(state).toolExecutions.some(
      (execution) => execution.status === "completed",
    ) &&
    !getEvidencePayload(state).retrievals.some(
      (retrieval) => retrieval.chunkCount > 0,
    )
  ) {
    const answer = buildSchemaReplanSafeErrorAnswer(state);
    const observation = createObservation({
      runId: state.runId,
      stepId: "generate",
      status: "partial",
      facts: [
        "Schema-safe fallback answer was returned after bounded replan was exhausted.",
      ],
    });

    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-generate",
      nodeType: "generate",
      phase: "done",
      label: "生成回答",
      summary: "bounded replan 已用尽，返回安全收口回答",
      details: {
        answerLength: Array.from(answer).length,
        invocation: generationInvocation,
        contextBudget: budget.audit,
        messageCount: generationMessages.length,
        schemaSafeErrorFallback: true,
        schemaError: state.schemaReplanDiagnostics.schemaError,
      },
    });

    return {
      answer,
      observations: [...(state.observations ?? []), observation],
      evidence: appendObservationEvidence(state, observation),
      contextBudget: budget.audit,
      schemaReplanDiagnostics: undefined,
      generatedAnswerEmptyFallback: false,
    };
  }
  let answer: string;
  let outputGuardReason: string | undefined;
  try {
    answer = await agentGenerateTextRunnable.invoke({
      messages: generationMessages,
      params: state.params,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const observation = createObservation({
      runId: state.runId,
      stepId: "generate",
      status: "failed",
      facts: ["Agent final answer generation failed."],
      errorMessage,
    });

    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-generate",
      nodeType: "generate",
      phase: "error",
      label: "生成回答",
      summary: `Agent 最终回答生成失败: ${errorMessage}`,
      details: {
        errorMessage,
        invocation: generationInvocation,
        contextBudget: budget.audit,
        messageCount: generationMessages.length,
      },
    });

    return {
      observations: [...(state.observations ?? []), observation],
      evidence: appendObservationEvidence(state, observation),
      errorMessage,
      errorSourceNodeId: "agent-generate",
      contextBudget: budget.audit,
    };
  }
  outputGuardReason = detectGenerateOutputGuardReason(answer);
  if (!outputGuardReason) {
    if (
      state.pendingApproval &&
      PENDING_APPROVAL_FAKE_EXECUTION_PATTERNS.some((pattern) =>
        pattern.test(answer),
      )
    ) {
      outputGuardReason =
        "generate output pretended a pending-approval tool had already executed";
    }
  }
  if (!outputGuardReason) {
    const evidence = getEvidencePayload(state);
    const completedToolIds = evidence.toolExecutions
      .filter((execution) => execution.status === "completed")
      .map((execution) => execution.toolId);
    if (answerLeaksCompletedToolId({ answer, completedToolIds })) {
      outputGuardReason =
        "generate output leaked completed tool id text instead of a user-facing final answer";
    }
  }
  if (!outputGuardReason) {
    const evidence = getEvidencePayload(state);
    const hasCompletedToolEvidence = evidence.toolExecutions.some(
      (execution) => execution.status === "completed",
    );
    const hasRetrievalEvidence = evidence.retrievals.some(
      (retrieval) => retrieval.chunkCount > 0,
    );
    if (
      !hasCompletedToolEvidence &&
      !hasRetrievalEvidence &&
      (answerClaimsUnverifiedObservation(answer) ||
        answerLooksLikeFabricatedWorkspaceResult({
          question: getLatestUserQuestion(state.messages) || state.goal.text,
          answer,
        }))
    ) {
      outputGuardReason =
        "generate output claimed grounded observation without completed evidence";
    }
  }
  if (outputGuardReason) {
    answer = buildEvidenceGroundedFallbackAnswer(state);
  }
  if (!answer.trim()) {
    const observation = createObservation({
      runId: state.runId,
      stepId: "generate",
      status: "partial",
      facts: [
        "Generated answer was empty; deterministic fallback answer was returned.",
      ],
    });
    const fallbackAnswer = buildGenerateEmptyAnswerFallback(state);
    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-generate",
      nodeType: "generate",
      phase: "done",
      label: "生成回答",
      summary: "模型回答为空，已返回保底回答",
      details: {
        answerLength: 0,
        invocation: generationInvocation,
        contextBudget: budget.audit,
        messageCount: generationMessages.length,
        generatedAnswerEmptyFallback: true,
      },
    });

    return {
      answer: fallbackAnswer,
      observations: [...(state.observations ?? []), observation],
      evidence: appendObservationEvidence(state, observation),
      generatedAnswerEmptyFallback: true,
    };
  }
  const observation = createObservation({
    runId: state.runId,
    stepId: "generate",
    status: "ok",
    facts: [`Generated answer length: ${Array.from(answer).length}`],
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-generate",
    nodeType: "generate",
    phase: answer.trim() ? "done" : "error",
    label: "生成回答",
    summary: answer.trim() ? "已生成 Agent 回答" : "Agent 回答为空",
    details: {
      answerLength: Array.from(answer).length,
      invocation: generationInvocation,
      contextBudget: budget.audit,
      messageCount: generationMessages.length,
      outputGuardTriggered: Boolean(outputGuardReason),
      outputGuardReason: outputGuardReason ?? null,
      generatedAnswerEmptyFallback: false,
    },
  });

  return {
    answer,
    observations: [...(state.observations ?? []), observation],
    evidence: appendObservationEvidence(state, observation),
    contextBudget: budget.audit,
    schemaReplanDiagnostics: undefined,
    generatedAnswerEmptyFallback: false,
  };
};
