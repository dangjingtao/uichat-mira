import type { AssistantExecutionNodeEvent } from "@/services/chat-stream-events";
import type { AgentPlanStep } from "./types";

export const toAgentExecutionNode = (input: {
  runId: string;
  nodeId: string;
  nodeType: string;
  phase: AssistantExecutionNodeEvent["phase"];
  label: string;
  slotKey?: string;
  attemptKey?: string;
  iteration?: number;
  summary?: string;
  details?: Record<string, unknown>;
}): AssistantExecutionNodeEvent => ({
  nodeId: input.nodeId,
  nodeType: input.nodeType,
  phase: input.phase,
  label: input.label,
  traceDomain: "agent",
  ...(input.slotKey ? { slotKey: input.slotKey } : {}),
  ...(input.attemptKey ? { attemptKey: input.attemptKey } : {}),
  ...(typeof input.iteration === "number" ? { iteration: input.iteration } : {}),
  ...(input.summary ? { summary: input.summary } : {}),
  details: {
    runId: input.runId,
    ...(input.details ?? {}),
  },
});

export const toAgentErrorExecutionNode = (input: {
  runId: string;
  nodeId: string;
  label: string;
  summary: string;
  details?: Record<string, unknown>;
}) =>
  toAgentExecutionNode({
    ...input,
    nodeType: "error",
    phase: "error",
  });

export const toAgentApprovalExecutionNode = (input: {
  runId: string;
  nodeId: string;
  label: string;
  summary?: string;
  details?: Record<string, unknown>;
}) =>
  toAgentExecutionNode({
    ...input,
    nodeType: "approval",
    phase: "start",
  });

export const toPlanNodeDetails = (steps: AgentPlanStep[]) => ({
  steps: steps.map((step) => ({
    id: step.id,
    kind: step.kind,
    title: step.title,
    riskLevel: step.riskLevel,
    requiresApproval: step.requiresApproval,
    ...(step.toolId ? { toolId: step.toolId } : {}),
  })),
});
