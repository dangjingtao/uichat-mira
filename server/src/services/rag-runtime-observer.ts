import {
  subscribeRagRuntimeEvents,
  type RagRuntimeEvent,
} from "./rag-events";

export interface RagNodeExecutionRecord {
  nodeId: string;
  nodeType: string;
  label: string;
  status: "running" | "completed" | "failed";
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  summary?: string;
  details?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
  environment?: Record<string, unknown>;
  error?: {
    type?: string;
    message: string;
  };
}

export interface RagRunRecord {
  runId: string;
  route: "run" | "retrieve" | "stream";
  status: "running" | "completed" | "failed";
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: {
    type?: string;
    message: string;
  };
  nodes: RagNodeExecutionRecord[];
}

const toNodeDuration = (
  startedAt?: string,
  finishedAt?: string,
) => {
  if (!startedAt || !finishedAt) {
    return undefined;
  }

  return new Date(finishedAt).getTime() - new Date(startedAt).getTime();
};

export class InMemoryRagRuntimeObserver {
  private readonly runs = new Map<string, RagRunRecord>();

  private readonly unsubscribe: () => void;

  constructor() {
    this.unsubscribe = subscribeRagRuntimeEvents((event) => {
      this.observe(event);
    });
  }

  dispose() {
    this.unsubscribe();
  }

  getRun(runId: string) {
    const run = this.runs.get(runId);
    return run ? structuredClone(run) : null;
  }

  getRuns() {
    return Array.from(this.runs.values())
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .map((run) => structuredClone(run));
  }

  clear() {
    this.runs.clear();
  }

  private ensureRun(runId: string) {
    const existing = this.runs.get(runId);
    if (existing) {
      return existing;
    }

    const created: RagRunRecord = {
      runId,
      route: "run",
      status: "running",
      startedAt: new Date().toISOString(),
      nodes: [],
    };
    this.runs.set(runId, created);
    return created;
  }

  private ensureNode(run: RagRunRecord, input: {
    nodeId: string;
    nodeType: string;
    label: string;
  }) {
    const existing = run.nodes.find((node) => node.nodeId === input.nodeId);
    if (existing) {
      return existing;
    }

    const created: RagNodeExecutionRecord = {
      nodeId: input.nodeId,
      nodeType: input.nodeType,
      label: input.label,
      status: "running",
    };
    run.nodes.push(created);
    return created;
  }

  private observe(event: RagRuntimeEvent) {
    switch (event.type) {
      case "run_started": {
        this.runs.set(event.runId, {
          runId: event.runId,
          route: event.route,
          status: "running",
          startedAt: event.startedAt,
          ...(event.input ? { input: event.input } : {}),
          nodes: [],
        });
        return;
      }
      case "node_started": {
        const run = this.ensureRun(event.runId);
        const node = this.ensureNode(run, event);
        node.status = "running";
        node.startedAt = event.startedAt;
        return;
      }
      case "node_completed": {
        const run = this.ensureRun(event.runId);
        const node = this.ensureNode(run, event);
        const finishedAt = event.environment?.timing?.finishedAt ?? new Date().toISOString();
        node.status = "completed";
        node.summary = event.summary;
        node.details = event.details;
        node.artifacts = event.artifacts;
        node.environment = event.environment as Record<string, unknown> | undefined;
        node.finishedAt = finishedAt;
        node.durationMs =
          event.environment?.timing?.durationMs ??
          toNodeDuration(node.startedAt, finishedAt);
        return;
      }
      case "node_failed": {
        const run = this.ensureRun(event.runId);
        const node = this.ensureNode(run, event);
        const finishedAt = new Date().toISOString();
        node.status = "failed";
        node.summary = event.summary;
        node.error = { message: event.summary };
        node.finishedAt = finishedAt;
        node.durationMs = toNodeDuration(node.startedAt, finishedAt);
        return;
      }
      case "node_artifact": {
        const run = this.ensureRun(event.runId);
        const node = this.ensureNode(run, {
          nodeId: event.nodeId,
          nodeType: event.nodeType,
          label: event.nodeId,
        });
        node.artifacts = {
          ...(node.artifacts ?? {}),
          ...event.artifacts,
        };
        return;
      }
      case "run_completed": {
        const run = this.ensureRun(event.runId);
        run.status = event.status;
        run.finishedAt = event.finishedAt;
        run.durationMs = event.durationMs;
        run.output = event.output;
        run.error = event.error;
        return;
      }
    }
  }
}

export const ragRuntimeObserver = new InMemoryRagRuntimeObserver();
