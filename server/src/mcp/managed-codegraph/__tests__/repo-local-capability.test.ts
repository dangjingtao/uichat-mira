import { describe, expect, it } from "vitest";

import {
  canUseDeclaredRepoLocalCodeGraphCapability,
} from "../repo-local-capability.js";

const createGate = (overrides?: {
  reasons?: Array<{ code: string }>;
  checks?: Partial<{
    microAppEnabled: boolean;
    agentCapabilityEnabled: boolean;
    runtimeReady: boolean;
    telemetryVerifiedOff: boolean;
    workspaceMatched: boolean;
    repoPollutionSafe: boolean;
    appDataRootValid: boolean;
    capabilityRegistrationReady: boolean;
  }>;
}) => ({
  reasons: overrides?.reasons ?? [
    { code: "repo_pollution_risk" },
    { code: "runtime_not_ready" },
    { code: "telemetry_not_verified_off" },
  ],
  checks: {
    microAppEnabled: true,
    agentCapabilityEnabled: true,
    runtimeReady: false,
    telemetryVerifiedOff: false,
    workspaceMatched: true,
    repoPollutionSafe: false,
    appDataRootValid: true,
    capabilityRegistrationReady: false,
    ...(overrides?.checks ?? {}),
  },
});

describe("declared repo-local CodeGraph capability gate", () => {
  it("keeps the controlled tool available while repo-local runtime checks are pending", () => {
    expect(
      canUseDeclaredRepoLocalCodeGraphCapability(createGate()),
    ).toBe(true);
  });

  it("does not bypass the owner capability switch", () => {
    expect(
      canUseDeclaredRepoLocalCodeGraphCapability(
        createGate({
          checks: {
            agentCapabilityEnabled: false,
          },
        }),
      ),
    ).toBe(false);
  });

  it("does not bypass workspace or app-data boundary failures", () => {
    expect(
      canUseDeclaredRepoLocalCodeGraphCapability(
        createGate({
          checks: {
            workspaceMatched: false,
          },
        }),
      ),
    ).toBe(false);

    expect(
      canUseDeclaredRepoLocalCodeGraphCapability(
        createGate({
          checks: {
            appDataRootValid: false,
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects unrelated gate failures", () => {
    expect(
      canUseDeclaredRepoLocalCodeGraphCapability(
        createGate({
          reasons: [
            { code: "repo_pollution_risk" },
            { code: "workspace_mismatch" },
          ],
        }),
      ),
    ).toBe(false);
  });
});
