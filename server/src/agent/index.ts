import { agentGraph } from "./graph";
import { createAgentGoal } from "./nodes/index";
import { agentRunStore, configureAgentRunPersistence } from "./run-store";
import type { AgentGraphInput } from "./types";
import { agentRunRepository } from "@/db/repositories/agent-run.repository";

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
  input: Omit<AgentGraphInput, "runId" | "goal"> & {
    goalText: string;
    assistantMessageId?: string;
    assistantParentId?: string | null;
  },
) => {
  const goal = createAgentGoal(input.goalText);
  const run = agentRunStore.create({
    threadId: input.threadId,
    userId: input.userId,
    goal,
    assistantMessageId: input.assistantMessageId,
    assistantParentId: input.assistantParentId,
    runtimeInput: {
      messages: input.messages,
      requestContextMessages: input.requestContextMessages,
      params: input.params,
      knowledgeBaseId: input.knowledgeBaseId,
      intentConfig: input.intentConfig,
      workspaceRoot: input.workspaceRoot,
    },
  });

  agentRunStore.update(run.id, {
    status: "running",
  });

  try {
    const output = await agentGraph.run({
      ...input,
      runId: run.id,
      goal,
      approvedInvocations: [],
    });

    for (const observation of output.observations) {
      agentRunStore.addObservation(run.id, observation);
    }

    if (output.pendingApproval) {
      agentRunStore.update(run.id, {
        status: "waiting_approval",
        blockedReason: output.blockedReason,
        terminalReason: output.terminalReason,
        pendingApproval: output.pendingApproval,
        // selectedToolId is kept only for UI / trace continuity.
        selectedToolId: output.pendingApproval.toolId,
        pendingToolCall: output.pendingToolCall,
        lastToolExecution: output.lastToolExecution,
      });
    }

    agentRunStore.complete(run.id, {
      status: output.status,
      contextBudget: output.contextBudget,
      blockedReason: output.blockedReason,
      terminalReason: output.terminalReason,
      // Execution must still be derived from pendingToolCall, not this field.
      selectedToolId: output.selectedToolId ?? output.pendingApproval?.toolId,
      pendingToolCall: output.pendingToolCall,
      lastToolExecution: output.lastToolExecution,
      ...(output.pendingApproval
        ? { pendingApproval: output.pendingApproval }
        : { pendingApproval: undefined }),
    });

    return {
      run: agentRunStore.get(run.id) ?? run,
      output,
    };
  } catch (error) {
    agentRunStore.update(run.id, {
      status: "failed",
    });
    throw error;
  }
};

export { agentRunStore } from "./run-store";
export { configureAgentRunPersistence } from "./run-store";
export type * from "./types";
