import type {
  AgentEvidencePayload,
  AgentObservation,
  AgentRetrievalEvidence,
  AgentToolExecutionResult,
} from "./types.js";

type EvidenceState = Pick<
  {
    observations?: AgentObservation[];
    evidence?: AgentEvidencePayload;
  },
  "observations" | "evidence"
>;

export const getEvidencePayload = (state: EvidenceState): AgentEvidencePayload => ({
  observations: state.evidence?.observations ?? state.observations ?? [],
  toolExecutions: state.evidence?.toolExecutions ?? [],
  retrievals: state.evidence?.retrievals ?? [],
});

const appendUniqueObservation = (
  observations: AgentObservation[],
  observation: AgentObservation,
) => {
  if (observations.some((item) => item.id === observation.id)) {
    return observations;
  }

  return [...observations, observation];
};

const isSameToolExecution = (
  left: AgentToolExecutionResult,
  right: AgentToolExecutionResult,
) =>
  Boolean(
    (left.toolCallId &&
      right.toolCallId &&
      left.toolCallId === right.toolCallId &&
      left.status === right.status) ||
      (left.inputHash &&
        right.inputHash &&
        left.inputHash === right.inputHash &&
        left.toolId === right.toolId &&
        left.status === right.status &&
        left.startedAt === right.startedAt),
  );

const appendUniqueToolExecution = (
  executions: AgentToolExecutionResult[],
  execution: AgentToolExecutionResult,
) => {
  if (executions.some((item) => isSameToolExecution(item, execution))) {
    return executions;
  }

  return [...executions, execution];
};

const isSameRetrieval = (
  left: AgentRetrievalEvidence,
  right: AgentRetrievalEvidence,
) => {
  if (left.query !== right.query || left.chunkCount !== right.chunkCount) {
    return false;
  }

  const leftChunkIds = left.chunks.map((chunk) => String(chunk.chunkId)).join("|");
  const rightChunkIds = right.chunks.map((chunk) => String(chunk.chunkId)).join("|");
  return leftChunkIds === rightChunkIds;
};

const appendUniqueRetrieval = (
  retrievals: AgentRetrievalEvidence[],
  retrieval: AgentRetrievalEvidence,
) => {
  if (retrievals.some((item) => isSameRetrieval(item, retrieval))) {
    return retrievals;
  }

  return [...retrievals, retrieval];
};

export const appendObservationEvidence = (
  state: EvidenceState,
  observation: AgentObservation,
): AgentEvidencePayload => {
  const current = getEvidencePayload(state);
  return {
    ...current,
    observations: appendUniqueObservation(current.observations, observation),
  };
};

export const appendToolExecutionEvidence = (
  state: EvidenceState,
  execution: AgentToolExecutionResult,
): AgentEvidencePayload => {
  const current = getEvidencePayload(state);
  return {
    ...current,
    toolExecutions: appendUniqueToolExecution(current.toolExecutions, execution),
  };
};

export const appendRetrievalEvidence = (
  state: EvidenceState,
  retrieval: AgentRetrievalEvidence,
): AgentEvidencePayload => {
  const current = getEvidencePayload(state);
  return {
    ...current,
    retrievals: appendUniqueRetrieval(current.retrievals, retrieval),
  };
};

export const getEvidenceCounts = (state: EvidenceState) => {
  const evidence = getEvidencePayload(state);
  return {
    observations: evidence.observations.length,
    toolExecutions: evidence.toolExecutions.length,
    retrievals: evidence.retrievals.length,
  };
};
