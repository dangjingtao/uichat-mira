import {
  getHarnessLlmContentText,
  projectHarnessResultForLlm,
  type HarnessLlmContent,
} from "@/harness/llm-content";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import { readSkillDeliveryFromRequestContext } from "@/skills/flow/context.js";
import {
  emitStepNode,
  type AgentNodeState,
  type EmitAgentExecutionNode,
} from "../node-runtime";
import type { AgentToolExecutionResult } from "../types";
import type { AgentToolExecutionWithLlmContent } from "./harness-tool-result";
import { createObservation } from "./shared";
import { generateNode as baseGenerateNode } from "./generate";

const HARNESS_GENERATE_CONTEXT_CHAR_LIMIT = 48_000;

const getExecutionLlmContent = (
  execution: AgentToolExecutionResult,
): HarnessLlmContent | undefined =>
  (execution as AgentToolExecutionWithLlmContent).llmContent ??
  projectHarnessResultForLlm(execution.result);

export const buildHarnessGenerateContextText = (
  executions: AgentToolExecutionResult[],
  totalCharLimit = HARNESS_GENERATE_CONTEXT_CHAR_LIMIT,
) => {
  if (totalCharLimit <= 0) {
    return null;
  }

  const completed = executions
    .filter((execution) => execution.status === "completed")
    .map((execution) => ({
      execution,
      llmContent: getExecutionLlmContent(execution),
    }))
    .filter(
      (
        item,
      ): item is {
        execution: AgentToolExecutionResult;
        llmContent: HarnessLlmContent;
      } => Boolean(item.llmContent),
    );

  if (completed.length === 0) {
    return null;
  }

  const sections: string[] = [
    "以下是本轮 Agent 已实际执行完成的 Harness 工具结果。",
    "这些内容是回答用户所需的真实结果，不是 Evidence 摘要或前几项预览。",
    "请直接依据结果回答；若标记 truncated，只能使用已展示内容，并明确说明缺失范围。",
  ];
  let usedChars = sections.join("\n").length;

  for (const [index, item] of completed.entries()) {
    const header = [
      `# harness_tool_result_${index + 1}`,
      `toolId: ${item.execution.toolId}`,
      `toolCallId: ${item.execution.toolCallId ?? "unknown"}`,
      `status: ${item.execution.status}`,
      `resultTruncated: ${item.llmContent.truncated}`,
      `originalCharCount: ${item.llmContent.originalCharCount}`,
      `includedCharCount: ${item.llmContent.includedCharCount}`,
    ].join("\n");
    const body = getHarnessLlmContentText(item.llmContent) || "(empty result)";
    const remaining = totalCharLimit - usedChars - header.length - 2;

    if (remaining <= 160) {
      sections.push(
        `# harness_tool_result_${index + 1}\n[omitted because the Harness Generate context budget was exhausted]`,
      );
      break;
    }

    const marker = `\n...[tool result clipped by total Generate context budget; toolId=${item.execution.toolId}]`;
    const boundedBody =
      body.length > remaining
        ? `${body
            .slice(0, Math.max(0, remaining - marker.length))
            .trimEnd()}${marker}`
        : body;
    const section = [header, "llmContent:", boundedBody].join("\n");
    sections.push(section);
    usedChars += section.length + 2;

    if (usedChars >= totalCharLimit) {
      break;
    }
  }

  const text = sections.join("\n\n");
  if (text.length <= totalCharLimit) {
    return text;
  }

  const marker = "\n...[Harness Generate context truncated by total budget]";
  const boundedLength = Math.max(0, totalCharLimit - marker.length);
  return `${text.slice(0, boundedLength).trimEnd()}${marker}`;
};

const insertBeforeLatestMessage = (
  messages: NormalizedChatMessage[],
  contextMessage: NormalizedChatMessage,
) => {
  if (messages.length === 0) {
    return [contextMessage];
  }

  return [
    ...messages.slice(0, -1),
    contextMessage,
    messages[messages.length - 1]!,
  ];
};

export type GenerateNodeHandler = (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
) => Promise<Partial<AgentNodeState>>;

const deliverSkillRuntimeContent = async (
  state: AgentNodeState,
  emit: EmitAgentExecutionNode | undefined,
) => {
  if (state.nextAction?.type !== "answer" || !state.finalizationPacket) {
    return null;
  }
  const delivery = readSkillDeliveryFromRequestContext(state.requestContextMessages);
  if (!delivery) return null;

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-generate",
    nodeType: "generate",
    phase: "start",
    label: "生成回答",
    summary: "正在交付 Skill Runtime 已完成的结构化报告",
  });

  const observation = createObservation({
    runId: state.runId,
    stepId: "generate",
    status: "ok",
    facts: [
      `Delivered deterministic Skill Runtime content (${delivery.kind}), length=${Array.from(delivery.content).length}.`,
    ],
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-generate",
    nodeType: "generate",
    phase: "done",
    label: "生成回答",
    summary: "已交付 Skill Runtime 报告",
    details: {
      answerLength: Array.from(delivery.content).length,
      answerSource: "skill_runtime_delivery",
      deliveryKind: delivery.kind,
      deterministicDelivery: true,
      modelInvoked: false,
    },
  });

  return {
    answer: delivery.content,
    observations: [...(state.observations ?? []), observation],
    generatedAnswerEmptyFallback: false,
    schemaReplanDiagnostics: undefined,
  } satisfies Partial<AgentNodeState>;
};

export const createHarnessAwareGenerateNode = (
  generate: GenerateNodeHandler = baseGenerateNode,
): GenerateNodeHandler =>
  async (state, emit) => {
    const skillDelivery = await deliverSkillRuntimeContent(state, emit);
    if (skillDelivery) return skillDelivery;

    // Planner finalization references are the only evidence selection contract
    // for final answers. Do not prepend the legacy all-tools projection.
    if (state.finalizationPacket) {
      return generate(state, emit);
    }
    const contextText = buildHarnessGenerateContextText(
      state.evidence?.toolExecutions ?? [],
    );
    if (!contextText) {
      return generate(state, emit);
    }

    const contextMessage: NormalizedChatMessage = {
      role: "system",
      content: contextText,
      parts: [{ type: "text", text: contextText }],
    };

    return generate(
      {
        ...state,
        messages: insertBeforeLatestMessage(state.messages, contextMessage),
      },
      emit,
    );
  };

export const harnessAwareGenerateNode = createHarnessAwareGenerateNode();
