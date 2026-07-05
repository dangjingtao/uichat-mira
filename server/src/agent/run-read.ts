import { agentRunRepository } from "@/db/repositories/agent-run.repository";
import { agentRunStore, hasAgentRunPersistence } from "./run-store";

export const getAgentRunById = (runId: string) => {
  const inMemoryRun = agentRunStore.get(runId);
  if (inMemoryRun) {
    return inMemoryRun;
  }

  if (!hasAgentRunPersistence()) {
    return undefined;
  }

  return agentRunRepository.get(runId);
};
