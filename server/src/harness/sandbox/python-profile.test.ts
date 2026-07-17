import { describe, expect, it } from "vitest";
import { getPythonSandboxStatus } from "@/sandbox/python-executor.js";
import {
  getSandboxContractCoverage,
  getSandboxProfileCoverage,
  runSandboxPythonDirect,
} from "./index.js";

const workspaceRoot = process.cwd();

describe("managed Python sandbox profile", () => {
  it("keeps Python unavailable without managed runtime configuration", async () => {
    expect(getPythonSandboxStatus()).toMatchObject({ available: false });
    expect(getSandboxProfileCoverage().python).toBe("blocked");

    const result = await runSandboxPythonDirect({
      code: "print('no')",
      workspaceRoot,
    });

    expect(result.status).toBe("blocked");
  });

  it("reports Python separately from the V1.6 command gate", () => {
    const coverage = getSandboxContractCoverage();

    expect(coverage.declaredProfiles.python).toBe("blocked");
    expect(coverage.v16GateProfiles).toEqual({ command: "implemented" });
    expect(coverage.futureProfiles).toEqual({
      read_only: "blocked",
      workspace_write: "blocked",
      networked_command: "blocked",
    });
    expect(coverage.v16GateSatisfied).toBe(true);
  });
});
