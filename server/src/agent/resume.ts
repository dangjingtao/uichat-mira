import { agentGraph } from "./graph.js";
import { agentRunStore } from "./run-store.js";

export const resumeApprovedAgentRun = async (runId: string) => {
  const run = agentRunStore.get(runId);
  if (!run) {
    throw new Error(`AgentRun not found: ${runId}`);
  }

  const runtimeInput = run.runtimeInput;
  if (!runtimeInput) {
    throw new Error(`AgentRun missing runtime input: ${runId}`);
  }

  agentRunStore.update(runId, {
    status: "running",
    pendingApproval: undefined,
    approvedToolIds: [
      ...(run.approvedToolIds ?? []),
      ...(run.pendingApproval?.toolId ? [run.pendingApproval.toolId] : []),
    ],
  });

  const output = await agentGraph.run({
    runId,
    threadId: run.threadId,
    userId: run.userId,
    goal: run.goal,
    plan: run.plan,
    messages: runtimeInput.messages,
    requestContextMessages: runtimeInput.requestContextMessages,
    params: runtimeInput.params,
    knowledgeBaseId: runtimeInput.knowledgeBaseId,
    intentConfig: runtimeInput.intentConfig,
    approvedToolIds: [
      ...(run.approvedToolIds ?? []),
      ...(run.pendingApproval?.toolId ? [run.pendingApproval.toolId] : []),
    ],
  });

  for (const observation of output.observations) {
    agentRunStore.addObservation(runId, observation);
  }

  agentRunStore.complete(runId, {
    status: output.status,
    currentStepId: output.pendingApproval?.stepId,
    contextBudget: output.contextBudget,
    ...(output.pendingApproval
      ? { pendingApproval: output.pendingApproval }
      : { pendingApproval: undefined }),
    ...(output.status === "completed"
      ? { pendingApproval: undefined }
      : {}),
  });

  return {
    run: agentRunStore.get(runId),
    output,
  };
};
