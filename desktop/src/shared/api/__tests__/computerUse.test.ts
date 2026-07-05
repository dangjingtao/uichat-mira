import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  post: vi.fn(),
}));

import { get, post } from "@/shared/lib/request";
import {
  cancelComputerUseTask,
  createComputerUseTask,
  getComputerUseRuntime,
  getComputerUseTask,
  installComputerUseRuntime,
  resolveComputerUseApproval,
  startComputerUseTask,
  type ComputerUseTask,
  type ComputerUseRuntimeState,
} from "../computerUse";

const sampleRuntime: ComputerUseRuntimeState = {
  status: "ready",
  browserEngine: "chromium",
  version: "123.0.0",
  checkedAt: "2026-07-06T00:00:00.000Z",
};

const sampleTask: ComputerUseTask = {
  taskId: "task_1",
  goal: "Open example.com and summarize the hero text",
  siteScope: ["example.com"],
  status: "awaiting_approval",
  runtime: sampleRuntime,
  plan: {
    steps: [
      {
        id: "step_1",
        title: "Open the site",
        description: "Navigate to example.com",
        status: "awaiting_approval",
        requiresApproval: true,
      },
    ],
    summary: "Visit the site and read the hero content",
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
    version: 1,
  },
  pendingApproval: {
    id: "approval_1",
    stepId: "step_1",
    status: "pending",
    title: "Open website",
    reason: "The task is about to open example.com",
    requestedAt: "2026-07-06T00:00:01.000Z",
  },
  approvals: [],
  evidence: {
    entries: [],
    artifacts: [],
  },
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:01.000Z",
};

describe("computer use api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets runtime state from the shared route", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleRuntime);

    const result = await getComputerUseRuntime();

    expect(get).toHaveBeenCalledWith("/microapps/computer-use/runtime");
    expect(result).toBe(sampleRuntime);
  });

  it("posts runtime installation requests without reading runtime details directly", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleRuntime);

    const payload = {
      version: "123.0.0",
      archiveUrl: "https://example.com/chromium.zip",
      executableRelativePath: "chrome-win/chrome.exe",
      expectedSha256: "abc123",
    };

    const result = await installComputerUseRuntime(payload);

    expect(post).toHaveBeenCalledWith(
      "/microapps/computer-use/runtime/install",
      payload,
    );
    expect(result).toBe(sampleRuntime);
  });

  it("creates computer use tasks through the shared route", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleTask);

    const payload = {
      goal: "Open example.com and summarize the hero text",
      siteScope: ["example.com"],
      requestedBy: "tester",
      autoStart: false,
    };

    const result = await createComputerUseTask(payload);

    expect(post).toHaveBeenCalledWith("/microapps/computer-use/tasks", payload);
    expect(result).toBe(sampleTask);
  });

  it("gets a task by encoded id", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleTask);

    const result = await getComputerUseTask("task/with spaces");

    expect(get).toHaveBeenCalledWith(
      "/microapps/computer-use/tasks/task%2Fwith%20spaces",
    );
    expect(result).toBe(sampleTask);
  });

  it("starts a planned task by encoded id", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleTask);

    const result = await startComputerUseTask("task/start me");

    expect(post).toHaveBeenCalledWith(
      "/microapps/computer-use/tasks/task%2Fstart%20me/start",
    );
    expect(result).toBe(sampleTask);
  });

  it("submits approval decisions with the expected payload", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleTask);

    const payload = {
      approvalId: "approval_1",
      decision: "approved" as const,
      resolvedBy: "tester",
      resolutionNote: "Proceed",
    };

    const result = await resolveComputerUseApproval("task-1", payload);

    expect(post).toHaveBeenCalledWith(
      "/microapps/computer-use/tasks/task-1/approval",
      payload,
    );
    expect(result).toBe(sampleTask);
  });

  it("posts task cancellation with an optional reason", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleTask);

    const payload = {
      reason: "User requested cancellation",
    };

    const result = await cancelComputerUseTask("task-1", payload);

    expect(post).toHaveBeenCalledWith(
      "/microapps/computer-use/tasks/task-1/cancel",
      payload,
    );
    expect(result).toBe(sampleTask);
  });
});
