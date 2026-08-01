export const shouldCommitTurnToMemory = (
  metadata: Record<string, unknown> | undefined,
) => {
  if (metadata?.rag && typeof metadata.rag === "object") {
    return false;
  }

  if (metadata?.agent && typeof metadata.agent === "object") {
    const status = (metadata.agent as { status?: unknown }).status;
    return status === "completed";
  }

  return true;
};
