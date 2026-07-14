// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ComputerUseDebuggerPage, { buildActionInput, buildAssertionInput } from "../index";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const debuggerState = vi.hoisted(() => ({ current: undefined as Record<string, unknown> | undefined }));
vi.mock("../useComputerUseDebuggerState", () => ({
  useComputerUseDebuggerState: () => debuggerState.current ?? ({
    config: { runtime: "managed", url: "https://example.com", allowedDomains: ["example.com"], limits: { timeoutMs: 30000, maxSnapshotChars: 12000 }, approvalPolicy: "write_actions" },
    setConfig: vi.fn(), status: { runtime: { status: "ready" }, model: { status: "unavailable", message: "T120 is unavailable" } }, runtime: { status: "ready" }, model: { status: "unavailable", message: "T120 is unavailable" }, session: undefined, busy: false, error: undefined, refreshStatus: vi.fn(), newSession: vi.fn(), observe: vi.fn(), executeAction: vi.fn(), assertState: vi.fn(), approve: vi.fn(), reject: vi.fn(), stop: vi.fn(), reset: vi.fn(),
  }),
}));

describe("Computer Use Debugger", () => {
  it("renders browser state and complete execution feedback", () => {
    debuggerState.current = {
      config: { runtime: "managed", url: "https://example.com", allowedDomains: ["example.com"], limits: { timeoutMs: 30000, maxSnapshotChars: 12000 }, approvalPolicy: "write_actions" },
      setConfig: vi.fn(), status: { runtime: { status: "ready" }, model: { status: "unavailable", message: "T120 is unavailable" } }, runtime: { status: "ready" }, model: { status: "unavailable", message: "T120 is unavailable" }, busy: false, error: undefined, refreshStatus: vi.fn(), newSession: vi.fn(), observe: vi.fn(), executeAction: vi.fn(), assertState: vi.fn(), approve: vi.fn(), reject: vi.fn(), stop: vi.fn(), reset: vi.fn(),
      session: { sessionId: "session-1", status: "ready", config: {} as never, browser: { url: "https://example.com", title: "Example", snapshot: "ref=button-1", visibleText: "Visible heading", screenshotArtifact: "artifact-screenshot-1", snapshotHash: "hash-1" }, approval: { status: "pending", approvalId: "approval-1", reason: "Write action" }, invocations: [{ invocationId: "invocation-1", tool: "browser_act", args: { action: "click", ref: "button-1" }, status: "failed", artifactIds: ["artifact-screenshot-1"], error: { code: "REF_STALE", message: "The ref is stale" }, createdAt: "2026-07-14T00:00:00.000Z" }], evidence: { entries: [{ kind: "observation", message: "Observed page" }], artifacts: [{ id: "artifact-screenshot-1", kind: "screenshot" }] }, result: { status: "failed", summary: "Assertion failed" } },
    };
    render(<ComputerUseDebuggerPage />);
    expect(screen.getByText("Visible heading")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "settings.microApps.computerUseDebugger.browserState.screenshot" })).toBeInTheDocument();
    expect(screen.getByText(/REF_STALE: The ref is stale/)).toBeInTheDocument();
    expect(screen.getByText(/\"button-1\"/)).toBeInTheDocument();
    expect(screen.getByText(/approval-1/)).toBeInTheDocument();
    expect(screen.getByText(/Assertion failed/)).toBeInTheDocument();
    debuggerState.current = undefined;
  });

  it("shows structured debugger sections and an explicit T120 unavailable state", () => {
    render(<ComputerUseDebuggerPage />);
    expect(screen.getByText("settings.microApps.computerUseDebugger.runConfig.title")).toBeInTheDocument();
    expect(screen.getByText("settings.microApps.computerUseDebugger.browserState.title")).toBeInTheDocument();
    expect(screen.getByText("settings.microApps.computerUseDebugger.feedback.title")).toBeInTheDocument();
    expect(screen.getByText("settings.microApps.computerUseDebugger.model.unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "settings.microApps.computerUseDebugger.modelRun.run" })).toBeDisabled();
    expect(screen.queryByText("Goal")).not.toBeInTheDocument();
    expect(screen.queryByText("Create Plan")).not.toBeInTheDocument();
  });

  it("maps manual fields to the browser action protocol", () => {
    expect(buildActionInput("navigate", "ignored", "https://example.com", "https://example.com", "hash")).toEqual({ pageUrl: "https://example.com", snapshotHash: "hash", action: { kind: "navigate", url: "https://example.com" } });
    expect(buildActionInput("click", "ref-1", "ignored", "https://example.com", "hash")).toEqual({ pageUrl: "https://example.com", snapshotHash: "hash", action: { kind: "click", ref: "ref-1" } });
    expect(buildActionInput("type", "ref-1", "hello", "https://example.com", "hash")).toEqual({ pageUrl: "https://example.com", snapshotHash: "hash", action: { kind: "type", ref: "ref-1", text: "hello" } });
    expect(buildAssertionInput("visible", "ref-1", "ignored")).toEqual({ assertion: { kind: "visible", ref: "ref-1" } });
    expect(buildAssertionInput("title", "ignored", "Example")).toEqual({ assertion: { kind: "title", expected: "Example" } });
  });
});
