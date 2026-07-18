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

  it("keeps sandbox_runtime as an explicit compatibility provider", () => {
    process.env.MIRA_TERMINAL_RUNTIME = "sandbox_runtime";
    expect(resolveTerminalRuntimeId()).toBe("sandbox_runtime");
  });

  it("does not accept unknown runtime names", () => {
    process.env.MIRA_TERMINAL_RUNTIME = "something-clever";
    expect(resolveTerminalRuntimeId()).toBe("host_spawn");
  });
});
