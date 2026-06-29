import { agentGraph } from "./graph.js";
import { createAgentGoal, createAgentPlan } from "./nodes.js";
import { agentRunStore, configureAgentRunPersistence } from "./run-store.js";
import type { AgentGraphInput } from "./types.js";
import { agentRunRepository } from "@/db/repositories/agent-run.repository.js";

configureAgentRunPersistence({
  create: (run) => {
    agentRunRepository.createPersistedRun(run);
  },
  get: agentRunRepository.get.bind(agentRunRepository),
  update: agentRunRepository.update.bind(agentRunRepository),
  addObservation: agentRunRepository.addObservation.bind(agentRunRepository),
  complete: agentRunRepository.complete.bind(agentRunRepository),
});

export const createAndRunAgent = async (
  input: Omit<AgentGraphInput, "runId" | "goal" | "plan"> & {
    goalText: string;
    assistantMessageId?: string;
    assistantParentId?: string | null;
  },
) => {
  const goal = createAgentGoal(input.goalText);
  const plan = createAgentPlan(goal);
  const run = agentRunStore.create({
    threadId: input.threadId,
    userId: input.userId,
    goal,
    plan,
    assistantMessageId: input.assistantMessageId,
    assistantParentId: input.assistantParentId,
    runtimeInput: {
      messages: input.messages,
      requestContextMessages: input.requestContextMessages,
      params: input.params,
      knowledgeBaseId: input.knowledgeBaseId,
      intentConfig: input.intentConfig,
    },
  });

  agentRunStore.update(run.id, {
    status: "running",
    currentStepId: plan.steps[0]?.id,
  });

  try {
    const output = await agentGraph.run({
      ...input,
      runId: run.id,
      goal,
      plan,
      approvedInvocations: [],
    });

    for (const observation of output.observations) {
      agentRunStore.addObservation(run.id, observation);
    }

    if (output.pendingApproval) {
      agentRunStore.update(run.id, {
        status: "waiting_approval",
        currentStepId: output.pendingApproval.stepId,
        pendingApproval: output.pendingApproval,
        selectedCapabilityId: output.selectedCapabilityId,
        selectedToolId: output.pendingApproval.toolId,
        pendingToolCall: output.pendingToolCall,
        lastToolExecution: output.lastToolExecution,
      });
    }

    agentRunStore.complete(run.id, {
      status: output.status,
      currentStepId: output.pendingApproval ? output.pendingApproval.stepId : undefined,
      contextBudget: output.contextBudget,
      selectedCapabilityId: output.selectedCapabilityId,
      selectedToolId: output.selectedToolId ?? output.pendingApproval?.toolId,
      pendingToolCall: output.pendingToolCall,
      lastToolExecution: output.lastToolExecution,
      ...(output.pendingApproval
        ? { pendingApproval: output.pendingApproval }
        : { pendingApproval: undefined }),
      ...(output.errorSourceNodeId
        ? { currentStepId: output.errorSourceNodeId }
        : {}),
    });

    return {
      run: agentRunStore.get(run.id) ?? run,
      output,
    };
  } catch (error) {
    agentRunStore.update(run.id, {
      status: "failed",
      currentStepId: undefined,
    });
    throw error;
  }
};

export { agentRunStore } from "./run-store.js";
export { configureAgentRunPersistence } from "./run-store.js";
export type * from "./types.js";
