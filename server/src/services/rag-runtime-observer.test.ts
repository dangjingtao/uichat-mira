import { afterEach, describe, expect, it } from "vitest";
import { emitRagRuntimeEvent } from "./rag-events.js";
import { InMemoryRagRuntimeObserver } from "./rag-runtime-observer.js";

let observer: InMemoryRagRuntimeObserver | null = null;

afterEach(() => {
  observer?.dispose();
  observer = null;
});

describe("RAG runtime observer", () => {
  it("records completed nodes, artifacts, and final run output", () => {
    observer = new InMemoryRagRuntimeObserver();
    emitRagRuntimeEvent({
      type: "run_started",
      runId: "run-1",
      route: "run",
      startedAt: "2026-08-04T00:00:00.000Z",
      input: { question: "hello" },
    });
    emitRagRuntimeEvent({
      type: "node_started",
      runId: "run-1",
      nodeId: "retrieve",
      nodeType: "retrieve",
      label: "Retrieve",
      startedAt: "2026-08-04T00:00:01.000Z",
    });
    emitRagRuntimeEvent({
      type: "node_artifact",
      runId: "run-1",
      nodeId: "retrieve",
      nodeType: "retrieve",
      artifacts: { candidates: 3 },
    });
    emitRagRuntimeEvent({
      type: "node_completed",
      runId: "run-1",
      nodeId: "retrieve",
      nodeType: "retrieve",
      label: "Retrieve",
      summary: "3 chunks",
      artifacts: { selected: 2 },
      environment: { timing: { startedAt: "2026-08-04T00:00:01.000Z", finishedAt: "2026-08-04T00:00:01.025Z", durationMs: 25 } },
    });
    emitRagRuntimeEvent({
      type: "run_completed",
      runId: "run-1",
      route: "run",
      startedAt: "2026-08-04T00:00:00.000Z",
      finishedAt: "2026-08-04T00:00:02.000Z",
      durationMs: 2000,
      status: "completed",
      output: { answer: "done" },
    });

    expect(observer.getRun("run-1")).toMatchObject({
      status: "completed",
      durationMs: 2000,
      output: { answer: "done" },
      nodes: [{ status: "completed", durationMs: 25, artifacts: { selected: 2 } }],
    });
  });

  it("preserves a failed run and failed node for diagnostics", () => {
    observer = new InMemoryRagRuntimeObserver();
    emitRagRuntimeEvent({
      type: "node_failed",
      runId: "failed-run",
      nodeId: "rerank",
      nodeType: "rerank",
      label: "Rerank",
      summary: "provider offline",
    });
    emitRagRuntimeEvent({
      type: "run_completed",
      runId: "failed-run",
      route: "retrieve",
      startedAt: "2026-08-04T00:00:00.000Z",
      finishedAt: "2026-08-04T00:00:01.000Z",
      durationMs: 1000,
      status: "failed",
      error: { type: "ProviderError", message: "provider offline" },
    });

    const record = observer.getRun("failed-run");
    expect(record).toMatchObject({
      status: "failed",
      error: { type: "ProviderError", message: "provider offline" },
      nodes: [{ nodeId: "rerank", status: "failed", error: { message: "provider offline" } }],
    });

    record!.nodes[0]!.summary = "mutated";
    expect(observer.getRun("failed-run")?.nodes[0]?.summary).toBe("provider offline");
  });
});
