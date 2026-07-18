import { isRealCodeGraphCommand } from "@/mcp/managed-codegraph/repo-local-process-manager.js";
import type {
  CodeGraphStudioCapabilityGate,
  CodeGraphStudioReport,
  CodeGraphStudioStatus,
} from "./index.js";

const DECLARED_REPO_LOCAL_SOFT_REASONS = new Set([
  "external_index_root_unsupported",
  "repo_pollution_risk",
]);

const toStudioStatus = (value: string): CodeGraphStudioStatus => {
  switch (value) {
    case "ready":
    case "blocked":
    case "unavailable":
    case "degraded":
    case "stopped":
      return value;
    case "starting":
    case "failed":
      return "degraded";
    default:
      return "unavailable";
  }
};

export const normalizeDeclaredRepoLocalCapabilityGate = (
  gate: CodeGraphStudioCapabilityGate,
  input: {
    command: string;
    capabilityRegistered: boolean;
  },
): CodeGraphStudioCapabilityGate => {
  if (!isRealCodeGraphCommand(input.command)) {
    return gate;
  }

  const reasons = gate.reasons.filter(
    (reason) => reason.code !== "repo_pollution_risk",
  );
  const checks = {
    ...gate.checks,
    repoPollutionSafe: true,
  };
  const capabilityRegistrationReady =
    checks.microAppEnabled &&
    checks.agentCapabilityEnabled &&
    checks.runtimeReady &&
    checks.telemetryVerifiedOff &&
    checks.workspaceMatched &&
    checks.appDataRootValid;

  return {
    available: capabilityRegistrationReady,
    registered:
      capabilityRegistrationReady && input.capabilityRegistered,
    reasons,
    checks: {
      ...checks,
      capabilityRegistrationReady,
    },
  };
};

/**
 * Public/runtime truth for the real CodeGraph provider.
 *
 * CodeGraph's workspace-local `.codegraph` directory is an accepted runtime
 * requirement for the controlled integration. It remains visible in the
 * report for diagnostics, but it no longer turns an otherwise healthy runtime
 * into a fake `blocked` state.
 */
export const normalizeCodeGraphStudioReport = (
  report: CodeGraphStudioReport,
): CodeGraphStudioReport => {
  if (!isRealCodeGraphCommand(report.config.command)) {
    return report;
  }

  const blockedReasons = report.blockedReasons.filter(
    (reason) => !DECLARED_REPO_LOCAL_SOFT_REASONS.has(reason.code),
  );
  const capability = normalizeDeclaredRepoLocalCapabilityGate(
    report.capability,
    {
      command: report.config.command,
      capabilityRegistered: report.config.capabilityRegistered,
    },
  );
  const runtimeStatus = toStudioStatus(report.debug.rawManagerStatus);
  const resolvedAppDataRoot =
    report.config.appDataRoot.trim() || report.config.appDataRootResolved || "";

  return {
    ...report,
    status:
      blockedReasons.length > 0
        ? "blocked"
        : runtimeStatus === "blocked" && capability.checks.runtimeReady
          ? "ready"
          : runtimeStatus,
    blockedReasons,
    config: {
      ...report.config,
      appDataRoot: resolvedAppDataRoot,
    },
    capability,
    pollutionGuard: {
      ...report.pollutionGuard,
      status: "ready",
      blockedReason: null,
    },
  };
};
