// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ForgeWorkspace from "./ForgeWorkspace";
import type { ForgeWorkspaceSnapshot } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const snapshot: ForgeWorkspaceSnapshot = {
  projects: [{ id: "p1", name: "moBuzzer", repositoryPath: "C:/work/moBuzzer", branch: "main", activeRuntimeCount: 1, attentionCount: 1 }],
  selectedProjectId: "p1",
  tasks: [{ id: "MOB-031", title: "修复消息线程首屏加载延迟", repositoryState: "DOING", runtimeState: "reviewing", source: "docs/tasks/MOB-031.md", dependencies: [], readiness: "ready" }],
  selectedTaskId: "MOB-031",
  messages: [{ id: "m1", author: "mira", body: "Builder 已 Completed，Task 仍等待 Review。", createdAt: "14:10" }],
  runtimes: [{ id: "r1", taskId: "MOB-031", builder: "Codex", state: "reviewing", branch: "fix/thread-loading", summary: "3 tests passed" }],
  events: [{ id: "e1", timestamp: "14:10:00", kind: "task", message: "builder_result received", taskId: "MOB-031" }],
};

describe("ForgeWorkspace", () => {
  it("keeps repository and runtime state separate in the task context", () => {
    render(<ForgeWorkspace snapshot={snapshot} />);

    expect(screen.getByText("DOING")).toBeInTheDocument();
    expect(screen.getByText("Reviewing")).toBeInTheDocument();
    expect(screen.queryByText("PASS")).not.toBeInTheDocument();
    expect(screen.getByText("Main Thread")).toBeInTheDocument();
  });

  it("opens the event log through the keyboard shortcut", () => {
    render(<ForgeWorkspace snapshot={snapshot} />);

    fireEvent.keyDown(window, { key: "e", metaKey: true });

    expect(screen.getByText("Event Log")).toBeInTheDocument();
    expect(screen.getByText("builder_result received")).toBeInTheDocument();
  });

  it("keeps dispatch disabled when readiness is blocked", () => {
    const blocked = { ...snapshot, tasks: [{ ...snapshot.tasks[0], readiness: "blocked" as const, runtimeState: "blocked" as const, dependencies: ["MOB-032"] }] };
    render(<ForgeWorkspace snapshot={blocked} />);

    expect(screen.getAllByText("Dispatch unavailable").length).toBeGreaterThan(0);
    expect(screen.getByText(/Waiting for MOB-032/)).toBeInTheDocument();
  });

  it("renders the real empty state when the API snapshot is absent", () => {
    render(<ForgeWorkspace snapshot={null} />);

    expect(screen.getByRole("heading", { name: "淬行" })).toBeInTheDocument();
    expect(screen.getByText(/Register a local repository/)).toBeInTheDocument();
  });
});
