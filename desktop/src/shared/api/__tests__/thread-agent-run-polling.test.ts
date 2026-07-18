// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  ApiError: class MockApiError extends Error {},
}));

import { get, post } from "@/shared/lib/request";
import {
  AGENT_RUN_UPDATED_EVENT,
  approveAgentRun,
  type AgentRun,
  type AgentRunUpdatedEventDetail,
} from "../thread";

const runningRun: AgentRun = {
  id: "run-1",
  threadId: "thread-1",
  userId: 1,
  status: "running",
  traceId: "trace-1",
  createdAt: "2026-07-18T00:00:00.000Z",
  updatedAt: "2026-07-18T00:00:00.000Z",
};

const completedRun: AgentRun = {
  ...runningRun,
  status: "completed",
  updatedAt: "2026-07-18T00:00:01.000Z",
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

test("approveAgentRun emits running immediately and polls until settled", async () => {
  vi.mocked(post).mockResolvedValueOnce(runningRun);
  vi.mocked(get).mockResolvedValueOnce(completedRun);
  const observedStatuses: string[] = [];
  const listener = (event: Event) => {
    const run = (event as CustomEvent<AgentRunUpdatedEventDetail>).detail.run;
    observedStatuses.push(run.status);
  };
  window.addEventListener(AGENT_RUN_UPDATED_EVENT, listener);

  try {
    const result = await approveAgentRun("run-1");

    expect(result).toBe(runningRun);
    expect(observedStatuses).toEqual(["running"]);
    expect(get).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(800);

    expect(get).toHaveBeenCalledWith("/agent/runs/run-1", { timeout: 0 });
    expect(observedStatuses).toEqual(["running", "completed"]);
  } finally {
    window.removeEventListener(AGENT_RUN_UPDATED_EVENT, listener);
  }
});
