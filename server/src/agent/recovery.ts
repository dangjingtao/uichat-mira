import type {
  AgentSchemaReplanDiagnostics,
  AgentToolExecutionResult,
  PlannerObservationRecoveryContext,
} from "./types";
import { SCHEMA_REPLAN_ATTEMPT_LIMIT } from "./planner/action-types";

export const DEFAULT_AGENT_MAX_RECOVERY_ATTEMPTS = 2;

export const buildPlannerRecoveryContext = (state: {
  lastToolExecution?: AgentToolExecutionResult;
  schemaReplanDiagnostics?: AgentSchemaReplanDiagnostics;
}): PlannerObservationRecoveryContext => {
  const lastToolExecution = state.lastToolExecution;
  if (
    lastToolExecution?.status === "failed" &&
    lastToolExecution.failureKind === "recoverable"
  ) {
    const attemptCount = lastToolExecution.recoveryAttemptCount ?? 1;
    return {
      source: "tool_failure",
      attemptCount,
      maxAttempts: DEFAULT_AGENT_MAX_RECOVERY_ATTEMPTS,
      exhausted: attemptCount >= DEFAULT_AGENT_MAX_RECOVERY_ATTEMPTS,
      toolId: lastToolExecution.toolId,
      inputHash: lastToolExecution.inputHash,
      errorMessage: lastToolExecution.errorMessage,
      failureKind: lastToolExecution.failureKind,
    };
  }

  const schemaReplanDiagnostics = state.schemaReplanDiagnostics;
  if (schemaReplanDiagnostics) {
    return {
      source: "schema_replan",
      attemptCount: schemaReplanDiagnostics.attemptCount,
      maxAttempts: SCHEMA_REPLAN_ATTEMPT_LIMIT,
      exhausted: schemaReplanDiagnostics.attemptCount > SCHEMA_REPLAN_ATTEMPT_LIMIT,
      toolId: schemaReplanDiagnostics.toolId,
      errorMessage: schemaReplanDiagnostics.schemaError,
      schemaError: schemaReplanDiagnostics.schemaError,
      invalidAction: schemaReplanDiagnostics.invalidAction,
    };
  }

  return {
    source: "none",
    attemptCount: 0,
    maxAttempts: SCHEMA_REPLAN_ATTEMPT_LIMIT,
    exhausted: false,
  };
};

export const getRemainingPlannerRecoveryAttempts = (
  recovery: PlannerObservationRecoveryContext,
) => {
  if (recovery.source === "tool_failure") {
    return Math.max(0, recovery.maxAttempts - recovery.attemptCount);
  }

  if (recovery.source === "schema_replan") {
    return Math.max(0, recovery.maxAttempts - Math.max(0, recovery.attemptCount - 1));
  }

  return 0;
};
