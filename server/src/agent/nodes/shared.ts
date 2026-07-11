/**
 * 节点共享工具：提供各节点通用的观察创建、意图解析和路径提取等辅助函数。
 */
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import { toAgentExecutionNode } from "../trace";
import { emitStepNode } from "../node-runtime";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";
import type { AgentObservation } from "../types";

export const nowIso = () => new Date().toISOString();

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
