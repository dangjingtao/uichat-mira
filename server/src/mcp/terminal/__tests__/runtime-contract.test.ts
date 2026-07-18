import { afterEach, describe, expect, it } from "vitest";

import { resolveTerminalRuntimeId } from "../runtime-contract.js";

const originalRuntime = process.env.MIRA_TERMINAL_RUNTIME;

afterEach(() => {
  if (originalRuntime === undefined) {
    delete process.env.MIRA_TERMINAL_RUNTIME;
  } else {
    process.env.MIRA_TERMINAL_RUNTIME = originalRuntime;
  }
});

describe("terminal runtime contract", () => {
  it("defaults to host_spawn", () => {
    delete process.env.MIRA_TERMINAL_RUNTIME;
    expect(resolveTerminalRuntimeId()).toBe("host_spawn");
  });

  it("reserves sandbox_runtime without falling back to the legacy executor", () => {
    process.env.MIRA_TERMINAL_RUNTIME = "sandbox_runtime";
    expect(() => resolveTerminalRuntimeId()).toThrow(/reserved|not implemented/i);
  });

  it("does not accept unknown runtime names", () => {
    process.env.MIRA_TERMINAL_RUNTIME = "something-clever";
    expect(resolveTerminalRuntimeId()).toBe("host_spawn");
  });
});
