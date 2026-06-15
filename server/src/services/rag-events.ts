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

const emitCustomChunk = (
  config: LangGraphRunnableConfig | undefined,
  chunk: RagCustomStreamChunk,
) => {
  const writer = getWriter(config);
  writer?.(chunk);
};

export const emitRagNodeEvent = (
  config: LangGraphRunnableConfig | undefined,
  payload: RagNodeEventPayload,
) => {
  emitCustomChunk(config, {
    type: "rag-node",
    data: payload,
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
