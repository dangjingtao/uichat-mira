import { describe, expect, it } from "vitest";
import { createHarnessEnvironmentSnapshot } from "./environment.js";

describe("harness environment", () => {
  it("exposes a powershell shell profile on Windows", () => {
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });

    try {
      const snapshot = createHarnessEnvironmentSnapshot();
      expect(snapshot.terminal.shellProfile.shell).toContain("powershell");
      expect(snapshot.terminal.shellProfile).toEqual({
        shell: snapshot.terminal.shellProfile.shell,
        shellFamily: "powershell",
        argsMode: "powershell",
        stdoutEncoding: "utf16le",
        stderrEncoding: "utf16le",
      });
    } finally {
      if (originalPlatformDescriptor) {
        Object.defineProperty(process, "platform", originalPlatformDescriptor);
      }
    }
  });
});
