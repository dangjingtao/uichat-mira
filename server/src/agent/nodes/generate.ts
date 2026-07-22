/**
 * Generate: turn the Agent's accumulated runtime context into the user-facing answer.
 *
 * Pi-style rule: real tool/retrieval results are model context. Generate does not act as a
 * second semantic judge over Evidence and must not replace a grounded model answer merely
 * because an Evidence summary is partial, truncated, generic, or otherwise conservative.
 */
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import { contextBudgetService } from "@/services/context-budget/index";
import { agentGenerateTextRunnable } from "../runnables";
import { getEvidencePayload } from "../evidence";
import { emitStepNode } from "../node-runtime";
import {
  createObservation,
  getLatestUserQuestion,
} from "./shared";
import type {
  AgentNodeState,
  EmitAgentExecutionNode,
} from "../node-runtime";

const CONTEXT_PREVIEW_LIMIT = 48_000;

const clipText = (value: string, limit: number) =>
  value.length <= limit
    ? value
    : `${value.slice(0, Math.max(0, limit - 48)).trimEnd()}\n...[context clipped]`;

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return "[unserializable]";
  }
};

type ProtocolLeakReason =
  | "function_calls_xml"
  | "invoke_xml"
  | "pending_tool_call_envelope"
  | "tool_call_json_envelope";

const unwrapJsonCodeFence = (value: string) => {
  const match = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(value);
  return match?.[1] ?? value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isExplicitToolCallJsonEnvelope = (value: unknown) => {
  if (!isRecord(value)) {
    return false;
  }

  if (isRecord(value.pendingToolCall)) {
    return true;
  }

  if (isRecord(value.function_call) || Array.isArray(value.tool_calls)) {
    return true;
  }

  const hasToolId = typeof value.toolId === "string" && value.toolId.trim().length > 0;
  const hasArgs = isRecord(value.args);
  return (value.type === "use_tool" && (hasToolId || hasArgs)) || (hasToolId && hasArgs);
};

const detectProtocolLeak = (answer: string): ProtocolLeakReason | undefined => {
  if (/<\/?function_calls?\b[^>]*>/i.test(answer)) {
    return "function_calls_xml";
  }
  if (/<\/?invoke\b[^>]*>/i.test(answer)) {
    return "invoke_xml";
  }
  if (/\bpendingToolCall\s*[:=]\s*\{/i.test(answer)) {
    return "pending_tool_call_envelope";
  }

  try {
    const parsed = JSON.parse(unwrapJsonCodeFence(answer));
    if (isExplicitToolCallJsonEnvelope(parsed)) {
      return isRecord(parsed) && isRecord(parsed.pendingToolCall)
        ? "pending_tool_call_envelope"
        : "tool_call_json_envelope";
    }
  } catch {
    // Only complete JSON envelopes are inspected here. Natural-language output is untouched.
  }

  return undefined;
};

const PROTOCOL_LEAK_FALLBACK =
  "本轮模型生成了内部工具调用格式，已阻止其显示。这段文本没有触发新的工具执行，请重试。";

const buildGenerateInstructionMessages = (
  state: AgentNodeState,
): NormalizedChatMessage[] => [
  {
    role: "system",
    content: [
      "你现在处于 Agent 的最终回答阶段，不是 Planner。",
      "请直接面向用户回答，不要输出 nextAction、toolId、args、pendingToolCall、function_calls 或其他内部协议。",
      "优先使用本轮 Agent 已实际执行得到的真实工具结果、检索结果和连续运行上下文。",
      "Evidence summary 只是辅助描述，不是第二套事实裁判：真实 execution.status=completed 和真实 tool result 不得因为 summary.status=partial/generic/truncated 而被当成不存在。",
      "若真实结果本身明确包含失败、超时、截断、审批等待或不可读信息，请按结果本身如实说明，不要编造。",
      state.pendingApproval
        ? "当前仍有工具等待审批；只能说明审批状态，不能假装该工具已经执行。"
        : "当前没有审批等待时，请基于已有真实结果正常回答，不要额外自我否定。",
    ].join("\n"),
    parts: [],
  },
];

const buildToolSummaryContext = (state: AgentNodeState) => {
  const evidence = getEvidencePayload(state);
  const executions = evidence.toolExecutions;
  if (executions.length === 0) {
    return undefined;
  }

  const text = [
    "AGENT TOOL EXECUTION RECORDS",
    "These are compact execution records. Canonical tool result payloads may also be present in the surrounding runtime context.",
    ...executions.map((execution, index) =>
      [
        `#${index + 1}`,
        `toolId=${execution.toolId}`,
        `executionStatus=${execution.status}`,
        `args=${safeStringify(execution.args)}`,
        execution.errorMessage ? `error=${execution.errorMessage}` : "",
        execution.summary ? `summary=${safeStringify(execution.summary)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n");

  return clipText(text, CONTEXT_PREVIEW_LIMIT);
};

const buildRetrievalContext = (state: AgentNodeState) => {
  const evidence = getEvidencePayload(state);
  if (evidence.retrievals.length === 0) {
    return undefined;
  }

  const text = [
    "AGENT RETRIEVAL RESULTS",
    ...evidence.retrievals.map((retrieval, index) =>
      [
        `#${index + 1} query=${retrieval.query}`,
        ...retrieval.chunks.map(
          (chunk) => `${chunk.documentName}\n${chunk.content}`,
        ),
      ].join("\n\n"),
    ),
  ].join("\n\n");

  return clipText(text, CONTEXT_PREVIEW_LIMIT);
};

const toSystemMessage = (content: string): NormalizedChatMessage => ({
  role: "system",
  content,
  parts: [{ type: "text", text: content }],
});

const getGenerateRequestContextMessages = (state: AgentNodeState) =>
  (state.requestContextMessages ?? []).filter(
    (message) => message.requestContextScope !== "agent-execution",
  );

const buildGenerateMessages = (
  state: AgentNodeState,
): NormalizedChatMessage[] => {
  const toolContext = buildToolSummaryContext(state);
  const retrievalContext = buildRetrievalContext(state);

  return [
    ...getGenerateRequestContextMessages(state),
    ...buildGenerateInstructionMessages(state),
    ...(toolContext ? [toSystemMessage(toolContext)] : []),
    ...(retrievalContext ? [toSystemMessage(retrievalContext)] : []),
    ...state.messages,
  ];
};

const buildGenerateContextBudget = (state: AgentNodeState) =>
  contextBudgetService.pack({
    policy: state.knowledgeBaseId ? "rag-chat" : "plain-chat",
    roleType: "llm",
    sections: {
      prefaceMessages: getGenerateRequestContextMessages(state),
      instructionMessages: buildGenerateInstructionMessages(state),
      payloads: [],
      historyMessages: state.messages.slice(0, -1),
      latestUserMessage: {
        role: "user",
        content: getLatestUserQuestion(state.messages) || state.goal.text,
      },
    },
  });

const buildEmptyAnswerFallback = (state: AgentNodeState) => {
  const evidence = getEvidencePayload(state);
  const latestRetrieval = evidence.retrievals.at(-1);
  const firstChunk = latestRetrieval?.chunks[0];
  if (firstChunk?.content?.trim()) {
    return `模型没有生成有效回答。当前至少有这条真实检索结果可用：${firstChunk.documentName}：${clipText(firstChunk.content.trim(), 600)}`;
  }

  const latestCompletedTool = [...evidence.toolExecutions]
    .reverse()
    .find((execution) => execution.status === "completed");
  if (latestCompletedTool) {
    const findings = latestCompletedTool.summary?.keyFindings?.filter(Boolean) ?? [];
    if (findings.length > 0) {
      return `模型没有生成有效回答。工具已实际执行完成，当前可用结果摘要：${findings.join("；")}`;
    }
    return "模型没有生成有效回答，但本轮工具已经实际执行完成。请重试生成回答。";
  }

  return "模型没有生成有效回答，请重试。";
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
    summary:
      state.nextAction?.type === "ask_user"
        ? "正在交付 Planner 澄清问题"
        : "正在生成 Agent 最终回答",
  });

  if (state.nextAction?.type === "ask_user") {
    const answer = state.nextAction.question;
    const observation = createObservation({
      runId: state.runId,
      stepId: "generate",
      status: "ok",
      facts: [
        "Delivered the Planner ask_user question deterministically without invoking the answer model.",
      ],
    });

    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-generate",
      nodeType: "generate",
      phase: "done",
      label: "生成回答",
      summary: "已向用户交付 Planner 澄清问题",
      details: {
        answerLength: Array.from(answer).length,
        answerSource: "planner_ask_user_question",
        deterministicAskUser: true,
        modelInvoked: false,
        protocolGuardTriggered: false,
      },
    });

    return {
      answer,
      observations: [...(state.observations ?? []), observation],
      schemaReplanDiagnostics: undefined,
      generatedAnswerEmptyFallback: false,
    };
  }

  const budget = buildGenerateContextBudget(state);
  const generationMessages = buildGenerateMessages(state);
  const generationInvocation = providerProxyService.describeChatInvocation(
    "default",
    generationMessages,
  );

  let answer: string;
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
      errorMessage,
      errorSourceNodeId: "agent-generate",
      contextBudget: budget.audit,
    };
  }

  const protocolLeakReason = detectProtocolLeak(answer);
  if (protocolLeakReason) {
    const observation = createObservation({
      runId: state.runId,
      stepId: "generate",
      status: "partial",
      facts: [
        "Blocked an internal tool-call protocol envelope from the user-facing answer; the envelope did not trigger tool execution.",
      ],
    });

    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-generate",
      nodeType: "generate",
      phase: "done",
      label: "生成回答",
      summary: "已阻止内部工具调用协议文本显示",
      details: {
        answerLength: Array.from(PROTOCOL_LEAK_FALLBACK).length,
        invocation: generationInvocation,
        contextBudget: budget.audit,
        messageCount: generationMessages.length,
        outputGuardTriggered: true,
        outputGuardReason: protocolLeakReason,
        protocolGuardTriggered: true,
        modelInvoked: true,
        generatedAnswerEmptyFallback: false,
      },
    });

    return {
      answer: PROTOCOL_LEAK_FALLBACK,
      observations: [...(state.observations ?? []), observation],
      contextBudget: budget.audit,
      schemaReplanDiagnostics: undefined,
      generatedAnswerEmptyFallback: false,
    };
  }

  if (!answer.trim()) {
    const fallbackAnswer = buildEmptyAnswerFallback(state);
    const observation = createObservation({
      runId: state.runId,
      stepId: "generate",
      status: "partial",
      facts: ["Generated answer was empty; a minimal fallback was returned."],
    });

    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-generate",
      nodeType: "generate",
      phase: "done",
      label: "生成回答",
      summary: "模型回答为空，已返回最小保底回答",
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
      contextBudget: budget.audit,
      schemaReplanDiagnostics: undefined,
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
    phase: "done",
    label: "生成回答",
    summary: "已生成 Agent 回答",
    details: {
      answerLength: Array.from(answer).length,
      invocation: generationInvocation,
      contextBudget: budget.audit,
      messageCount: generationMessages.length,
      outputGuardTriggered: false,
      protocolGuardTriggered: false,
      generatedAnswerEmptyFallback: false,
    },
  });

  return {
    answer,
    observations: [...(state.observations ?? []), observation],
    contextBudget: budget.audit,
    schemaReplanDiagnostics: undefined,
    generatedAnswerEmptyFallback: false,
  };
};
