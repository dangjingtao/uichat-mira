import { describe, expect, it } from "vitest";
import { browserResultFromRecord, getDebuggerInvocationStatus } from "../debugger-service.js";

describe("Computer Use debugger invocation status", () => {
  it("does not turn a completed browser failure into succeeded", () => {
    expect(getDebuggerInvocationStatus("completed", false)).toBe("failed");
    expect(getDebuggerInvocationStatus("completed", true)).toBe("succeeded");
    expect(getDebuggerInvocationStatus("awaiting_approval", false)).toBe("awaiting_approval");
  });

  it("reads the direct MCP result shape returned by executeInvocation", () => {
    const result = browserResultFromRecord({
      id: "invocation-1",
      toolId: "browser_observe",
      status: "completed",
      args: { sessionId: "session-1" },
      artifacts: [],
      result: {
        ok: true,
        sessionId: "session-1",
        invocationId: "invocation-1",
        page: { url: "https://example.com/", title: "Example Domain", snapshotHash: "hash-1" },
        observation: { snapshot: "h1 Example Domain", visibleText: "Example Domain", truncated: false },
        artifacts: [],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.page.title).toBe("Example Domain");
    expect(result.observation?.snapshot).toBe("h1 Example Domain");
  });

});
