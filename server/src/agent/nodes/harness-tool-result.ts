import {
  projectHarnessResultForLlm,
  type HarnessLlmContent,
} from "@/harness/llm-content";
import type {
  AgentNodeState,
  EmitAgentExecutionNode,
} from "../node-runtime";
import type { AgentToolExecutionResult } from "../types";
import { toolNode as baseToolNode } from "./tool-node";

export type AgentToolExecutionWithLlmContent = AgentToolExecutionResult & {
  llmContent?: HarnessLlmContent;
};

export const attachHarnessLlmContentToExecution = (
  execution: AgentToolExecutionResult | undefined,
): AgentToolExecutionWithLlmContent | undefined => {
  if (!execution || execution.status !== "completed") {
    return execution;
  }

  const existing = (execution as AgentToolExecutionWithLlmContent).llmContent;
  if (existing) {
    return execution as AgentToolExecutionWithLlmContent;
  }

  const llmContent = projectHarnessResultForLlm(execution.result);
  return llmContent ? { ...execution, llmContent } : execution;
};

export const harnessAwareToolNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const patch = await baseToolNode(state, emit);
  const pendingToolExecution = attachHarnessLlmContentToExecution(
    patch.pendingToolExecution,
  );
  const lastToolExecution =
    patch.lastToolExecution === patch.pendingToolExecution
      ? pendingToolExecution
      : attachHarnessLlmContentToExecution(patch.lastToolExecution);

  return {
    ...patch,
    ...(Object.prototype.hasOwnProperty.call(patch, "pendingToolExecution")
      ? { pendingToolExecution }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, "lastToolExecution")
      ? { lastToolExecution }
      : {}),
  };
};
