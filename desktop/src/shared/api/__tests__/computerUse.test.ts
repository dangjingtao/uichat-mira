import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/shared/lib/request", () => ({ get: vi.fn(), post: vi.fn() }));
import { get, post } from "@/shared/lib/request";
import { approveComputerUseSession, assertComputerUseSession, createComputerUseSession, executeComputerUseAction, getComputerUseDebuggerStatus, getComputerUseSession, observeComputerUseSession, rejectComputerUseSession, resolveComputerUseArtifactUrl, stopComputerUseSession } from "../computerUse";

describe("computer use debugger api", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reads debugger capability status", async () => { await getComputerUseDebuggerStatus(); expect(get).toHaveBeenCalledWith("/microapps/computer-use/debugger/status"); });
  it("maps structured session actions", async () => {
    const config = { runtime: "managed" as const, url: "https://example.com", allowedDomains: ["example.com"], limits: { timeoutMs: 1, maxSnapshotChars: 2 }, approvalPolicy: "write_actions" as const };
    await createComputerUseSession(config); expect(post).toHaveBeenCalledWith("/microapps/computer-use/sessions", config);
    await getComputerUseSession("session/a"); expect(get).toHaveBeenCalledWith("/microapps/computer-use/sessions/session%2Fa");
    await observeComputerUseSession("s"); expect(post).toHaveBeenCalledWith("/microapps/computer-use/sessions/s/observe");
    const action = { action: "click" as const, ref: "ref-1", snapshotHash: "hash" }; await executeComputerUseAction("s", action); expect(post).toHaveBeenCalledWith("/microapps/computer-use/sessions/s/action", action);
    const assertion = { assertion: "title" as const, expected: "Example" }; await assertComputerUseSession("s", assertion); expect(post).toHaveBeenCalledWith("/microapps/computer-use/sessions/s/assert", assertion);
    await stopComputerUseSession("s"); expect(post).toHaveBeenCalledWith("/microapps/computer-use/sessions/s/stop");
  });

  it("resolves artifact routes through the active API base", () => {
    expect(resolveComputerUseArtifactUrl("/microapps/computer-use/artifacts/a/content")).toContain("/microapps/computer-use/artifacts/a/content");
    expect(resolveComputerUseArtifactUrl("https://example.com/image.png")).toBe("https://example.com/image.png");
  });

  it("posts approval resumes with the frozen invocation id", async () => {
    await approveComputerUseSession("session-1", "invocation-1");
    expect(post).toHaveBeenCalledWith("/microapps/computer-use/sessions/session-1/approval", { invocationId: "invocation-1" });
  });

  it("posts rejection without reusing the approval endpoint", async () => {
    await rejectComputerUseSession("session-1", "invocation-1", "Unsafe action");
    expect(post).toHaveBeenCalledWith("/microapps/computer-use/sessions/session-1/approval/reject", { invocationId: "invocation-1", reason: "Unsafe action" });
  });
});
