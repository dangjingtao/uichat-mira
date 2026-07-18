export type RepoLocalCodeGraphGate = {
  reasons: Array<{ code: string; message?: string }>;
  checks: {
    microAppEnabled: boolean;
    agentCapabilityEnabled: boolean;
    runtimeReady: boolean;
    telemetryVerifiedOff: boolean;
    workspaceMatched: boolean;
    repoPollutionSafe: boolean;
    appDataRootValid: boolean;
    capabilityRegistrationReady: boolean;
  };
};

const REPO_LOCAL_RECOVERABLE_GATE_REASONS = new Set([
  "repo_pollution_risk",
  "runtime_not_ready",
  "telemetry_not_verified_off",
]);

/**
 * Allows the controlled `codebase_explore` surface to remain registered when
 * the only structural blocker is CodeGraph's declared workspace-local index.
 * Runtime readiness and telemetry are still re-probed by the managed process
 * before any provider command is executed.
 */
export const canUseDeclaredRepoLocalCodeGraphCapability = (
  gate: RepoLocalCodeGraphGate,
) => {
  const reasonCodes = gate.reasons.map((reason) => reason.code);
  const hasRepoLocalRisk = reasonCodes.includes("repo_pollution_risk");
  const reasonsAreRecoverable = reasonCodes.every((code) =>
    REPO_LOCAL_RECOVERABLE_GATE_REASONS.has(code),
  );

  return (
    gate.checks.microAppEnabled &&
    gate.checks.agentCapabilityEnabled &&
    gate.checks.workspaceMatched &&
    gate.checks.appDataRootValid &&
    hasRepoLocalRisk &&
    reasonsAreRecoverable
  );
};
