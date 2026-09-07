const activeRunControllers = new Map<string, AbortController>();

export const startAgentRunControl = (runId: string): AbortSignal => {
  const previous = activeRunControllers.get(runId);
  previous?.abort();

  const controller = new AbortController();
  activeRunControllers.set(runId, controller);
  return controller.signal;
};

export const getAgentRunSignal = (runId: string): AbortSignal | undefined =>
  activeRunControllers.get(runId)?.signal;

export const isAgentRunCancellationRequested = (runId: string): boolean =>
  activeRunControllers.get(runId)?.signal.aborted ?? false;

export const cancelAgentRunExecution = (runId: string): boolean => {
  const controller = activeRunControllers.get(runId);
  if (!controller) return false;
  controller.abort();
  return true;
};

export const finishAgentRunControl = (runId: string): void => {
  activeRunControllers.delete(runId);
};

export const clearAgentRunControls = (): void => {
  for (const controller of activeRunControllers.values()) {
    controller.abort();
  }
  activeRunControllers.clear();
};
