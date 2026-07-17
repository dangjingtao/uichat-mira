import type {
  AgentEvidencePayload,
  AgentGraphInput,
  AgentGraphOutput,
  AgentObservation,
  AgentRun,
  AgentToolExecutionResult,
  CurrentTaskFrame,
} from "./types";
import type { RetrievedChunk } from "@/services/rag-nodes";

export interface AgentRuntimeCheckpoint {
  currentTaskFrame?: CurrentTaskFrame;
  observations?: AgentObservation[];
  evidence?: AgentEvidencePayload;
  retrievedChunks?: RetrievedChunk[];
  lastToolExecution?: AgentToolExecutionResult;
  iterationCount?: number;
}

type PersistedRuntimeInput = NonNullable<AgentRun["runtimeInput"]>;
type RuntimeInputWithCheckpoint = PersistedRuntimeInput & {
  checkpoint?: AgentRuntimeCheckpoint;
};

export type AgentInputWithCheckpoint = AgentGraphInput & AgentRuntimeCheckpoint;
type AgentOutputWithCheckpoint = AgentGraphOutput & {
  iterationCount?: number;
};

export const getAgentRuntimeCheckpoint = (
  runtimeInput: AgentRun["runtimeInput"],
): AgentRuntimeCheckpoint | undefined =>
  (runtimeInput as RuntimeInputWithCheckpoint | undefined)?.checkpoint;

export const applyAgentRuntimeCheckpoint = (
  input: AgentGraphInput,
  checkpoint: AgentRuntimeCheckpoint | undefined,
): AgentInputWithCheckpoint => {
  const explicitInput = input as AgentInputWithCheckpoint;

  return {
    ...input,
    currentTaskFrame:
      explicitInput.currentTaskFrame ?? checkpoint?.currentTaskFrame,
    observations: explicitInput.observations ?? checkpoint?.observations,
    evidence: explicitInput.evidence ?? checkpoint?.evidence,
    retrievedChunks:
      explicitInput.retrievedChunks ?? checkpoint?.retrievedChunks,
    lastToolExecution:
      explicitInput.lastToolExecution ?? checkpoint?.lastToolExecution,
    iterationCount:
      explicitInput.iterationCount ?? checkpoint?.iterationCount,
  };
};

export const persistAgentRuntimeCheckpoint = (
  runtimeInput: PersistedRuntimeInput,
  output: AgentGraphOutput,
): RuntimeInputWithCheckpoint => {
  const checkpointOutput = output as AgentOutputWithCheckpoint;
  const derivedIterationCount =
    output.evidence.toolExecutions.length + output.evidence.retrievals.length;

  return {
    ...runtimeInput,
    checkpoint: {
      currentTaskFrame: output.currentTaskFrame,
      observations: output.observations,
      evidence: output.evidence,
      retrievedChunks: output.retrievedChunks,
      lastToolExecution: output.lastToolExecution,
      iterationCount:
        checkpointOutput.iterationCount ?? derivedIterationCount,
    },
  };
};
