import {
  getWriter,
  type LangGraphRunnableConfig,
} from "@langchain/langgraph";
import type { RetrievedChunk } from "./rag-nodes";
import type { RagNodeEnvironment } from "./rag-node-contract";

export type RagNodePhase = "start" | "done" | "error";

export interface RagNodeEventPayload {
  nodeId: string;
  nodeType: string;
  phase: RagNodePhase;
  label: string;
  summary?: string;
  details?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
  environment?: RagNodeEnvironment;
}

export interface RagSourcesEventPayload {
  sources: RetrievedChunk[];
}

export interface RagNodeCustomChunk {
  type: "rag-node";
  data: RagNodeEventPayload;
}

export interface RagSourcesCustomChunk {
  type: "rag-sources";
  data: RagSourcesEventPayload;
}

export interface GenerateDeltaCustomChunk {
  type: "generate-delta";
  delta: string;
}

export type RagCustomStreamChunk =
  | RagNodeCustomChunk
  | RagSourcesCustomChunk
  | GenerateDeltaCustomChunk;

export interface RagRuntimeContext {
  runId: string;
  route: "run" | "retrieve" | "stream";
  startedAt: string;
  input?: Record<string, unknown>;
}

export interface RagRunStartedEvent {
  type: "run_started";
  runId: string;
  route: RagRuntimeContext["route"];
  startedAt: string;
  input?: Record<string, unknown>;
}

export interface RagRunCompletedEvent {
  type: "run_completed";
  runId: string;
  route: RagRuntimeContext["route"];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: "completed" | "failed";
  output?: Record<string, unknown>;
  error?: {
    type?: string;
    message: string;
  };
}

export interface RagNodeStartedRuntimeEvent {
  type: "node_started";
  runId: string;
  nodeId: string;
  nodeType: string;
  label: string;
  startedAt: string;
}

export interface RagNodeCompletedRuntimeEvent {
  type: "node_completed";
  runId: string;
  nodeId: string;
  nodeType: string;
  label: string;
  summary?: string;
  details?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
  environment?: RagNodeEnvironment;
}

export interface RagNodeFailedRuntimeEvent {
  type: "node_failed";
  runId: string;
  nodeId: string;
  nodeType: string;
  label: string;
  summary: string;
}

export interface RagNodeArtifactRuntimeEvent {
  type: "node_artifact";
  runId: string;
  nodeId: string;
  nodeType: string;
  artifacts: Record<string, unknown>;
}

export type RagRuntimeEvent =
  | RagRunStartedEvent
  | RagRunCompletedEvent
  | RagNodeStartedRuntimeEvent
  | RagNodeCompletedRuntimeEvent
  | RagNodeFailedRuntimeEvent
  | RagNodeArtifactRuntimeEvent;

export type RagRuntimeEventListener = (event: RagRuntimeEvent) => void;

const runtimeEventListeners = new Set<RagRuntimeEventListener>();

type RagRuntimeConfigLike = LangGraphRunnableConfig & {
  configurable?: {
    __ragRuntimeContext?: RagRuntimeContext;
  };
};

const emitCustomChunk = (
  config: LangGraphRunnableConfig | undefined,
  chunk: RagCustomStreamChunk,
) => {
  const writer = getWriter(config);
  writer?.(chunk);
};

const getRuntimeContext = (
  config: LangGraphRunnableConfig | undefined,
): RagRuntimeContext | null => {
  const runtimeContext = (config as RagRuntimeConfigLike | undefined)?.configurable
    ?.__ragRuntimeContext;

  return runtimeContext ?? null;
};

export const subscribeRagRuntimeEvents = (
  listener: RagRuntimeEventListener,
) => {
  runtimeEventListeners.add(listener);
  return () => {
    runtimeEventListeners.delete(listener);
  };
};

export const emitRagRuntimeEvent = (event: RagRuntimeEvent) => {
  for (const listener of runtimeEventListeners) {
    listener(event);
  }
};

export const createRagRuntimeContext = (input: {
  route: RagRuntimeContext["route"];
  input?: Record<string, unknown>;
}): RagRuntimeContext => ({
  runId: crypto.randomUUID(),
  route: input.route,
  startedAt: new Date().toISOString(),
  ...(input.input ? { input: input.input } : {}),
});

export const withRagRuntimeContext = (
  runtimeContext: RagRuntimeContext,
): RagRuntimeConfigLike => ({
  configurable: {
    __ragRuntimeContext: runtimeContext,
  },
});

export const emitRagRunStartedEvent = (runtimeContext: RagRuntimeContext) => {
  emitRagRuntimeEvent({
    type: "run_started",
    runId: runtimeContext.runId,
    route: runtimeContext.route,
    startedAt: runtimeContext.startedAt,
    ...(runtimeContext.input ? { input: runtimeContext.input } : {}),
  });
};

export const emitRagRunCompletedEvent = (
  runtimeContext: RagRuntimeContext,
  input: {
    status: "completed" | "failed";
    output?: Record<string, unknown>;
    error?: {
      type?: string;
      message: string;
    };
  },
) => {
  const finishedAt = new Date().toISOString();
  emitRagRuntimeEvent({
    type: "run_completed",
    runId: runtimeContext.runId,
    route: runtimeContext.route,
    startedAt: runtimeContext.startedAt,
    finishedAt,
    durationMs:
      new Date(finishedAt).getTime() - new Date(runtimeContext.startedAt).getTime(),
    status: input.status,
    ...(input.output ? { output: input.output } : {}),
    ...(input.error ? { error: input.error } : {}),
  });
};

export const emitRagNodeEvent = (
  config: LangGraphRunnableConfig | undefined,
  payload: RagNodeEventPayload,
) => {
  emitCustomChunk(config, {
    type: "rag-node",
    data: payload,
  });

  const runtimeContext = getRuntimeContext(config);
  if (!runtimeContext) {
    return;
  }

  if (payload.phase === "start") {
    emitRagRuntimeEvent({
      type: "node_started",
      runId: runtimeContext.runId,
      nodeId: payload.nodeId,
      nodeType: payload.nodeType,
      label: payload.label,
      startedAt: new Date().toISOString(),
    });
    return;
  }

  if (payload.phase === "done") {
    emitRagRuntimeEvent({
      type: "node_completed",
      runId: runtimeContext.runId,
      nodeId: payload.nodeId,
      nodeType: payload.nodeType,
      label: payload.label,
      ...(payload.summary ? { summary: payload.summary } : {}),
      ...(payload.details ? { details: payload.details } : {}),
      ...(payload.artifacts ? { artifacts: payload.artifacts } : {}),
      ...(payload.environment ? { environment: payload.environment } : {}),
    });
    return;
  }

  emitRagRuntimeEvent({
    type: "node_failed",
    runId: runtimeContext.runId,
    nodeId: payload.nodeId,
    nodeType: payload.nodeType,
    label: payload.label,
    summary: payload.summary ?? "Unknown node error",
  });
};

export const emitRagArtifactEvent = (
  config: LangGraphRunnableConfig | undefined,
  input: {
    nodeId: string;
    nodeType: string;
    artifacts: Record<string, unknown>;
  },
) => {
  const runtimeContext = getRuntimeContext(config);
  if (!runtimeContext) {
    return;
  }

  emitRagRuntimeEvent({
    type: "node_artifact",
    runId: runtimeContext.runId,
    nodeId: input.nodeId,
    nodeType: input.nodeType,
    artifacts: input.artifacts,
  });
};

export const emitRagSourcesEvent = (
  config: LangGraphRunnableConfig | undefined,
  sources: RetrievedChunk[],
) => {
  emitCustomChunk(config, {
    type: "rag-sources",
    data: { sources },
  });
};

export const emitGenerateDelta = (
  config: LangGraphRunnableConfig | undefined,
  delta: string,
) => {
  emitCustomChunk(config, {
    type: "generate-delta",
    delta,
  });
};
