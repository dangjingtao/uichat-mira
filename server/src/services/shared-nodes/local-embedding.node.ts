import { localModelRuntime } from "@/services/local-model-runtime/index.js";
import type { RagNodeResult } from "@/services/rag-node-contract.js";
import { createModelCallObservation } from "@/services/rag-node-observation.js";

export interface LocalEmbeddingNodeState {
  embeddingText?: string;
  embeddingTexts?: string[];
  embeddings?: number[][];
  embedding?: number[];
  embeddingDimensions?: number;
  embeddingModel?: string;
  embeddingModelConfigId?: string;
}

export interface LocalEmbeddingStatePatch {
  embeddings: number[][];
  embedding: number[];
  embeddingDimensions: number;
  embeddingModel: string;
  embeddingModelConfigId: string;
}

export interface LocalEmbeddingNodeInput<TState extends LocalEmbeddingNodeState> {
  state: TState;
  selectTexts?: (state: TState) => string[];
  mapResult?: (
    state: TState,
    result: Awaited<ReturnType<typeof localModelRuntime.embedTexts>>,
  ) => Partial<TState>;
}

const selectDefaultTexts = (state: LocalEmbeddingNodeState) => {
  if (state.embeddingTexts?.length) {
    return state.embeddingTexts;
  }
  return state.embeddingText ? [state.embeddingText] : [];
};

const mapDefaultResult = <TState extends LocalEmbeddingNodeState>(
  _state: TState,
  result: Awaited<ReturnType<typeof localModelRuntime.embedTexts>>,
): LocalEmbeddingStatePatch =>
  ({
    embeddings: result.embeddings,
    embedding: result.embeddings[0] ?? [],
    embeddingDimensions: result.dimensions,
    embeddingModel: result.model,
    embeddingModelConfigId: result.modelConfigId,
  });

export const localEmbeddingSharedNode = {
  async embedTexts(texts: string[]) {
    return localModelRuntime.embedTexts(texts);
  },

  async runGraphNode<TState extends LocalEmbeddingNodeState>(
    input: LocalEmbeddingNodeInput<TState>,
  ): Promise<Partial<TState>> {
    const texts = input.selectTexts?.(input.state) ?? selectDefaultTexts(input.state);
    const result = await localModelRuntime.embedTexts(texts);
    const patch = input.mapResult?.(input.state, result) ?? mapDefaultResult(input.state, result);
    return patch as Partial<TState>;
  },

  async runNode<TState extends LocalEmbeddingNodeState>(
    input: LocalEmbeddingNodeInput<TState>,
  ): Promise<RagNodeResult<Partial<TState>>> {
    const startedAtMs = Date.now();
    const texts = input.selectTexts?.(input.state) ?? selectDefaultTexts(input.state);
    const result = await localModelRuntime.embedTexts(texts);
    const state = input.mapResult?.(input.state, result) ?? mapDefaultResult(input.state, result);

    return {
      state: state as Partial<TState>,
      observation: createModelCallObservation({
        startedAtMs,
        label: "本地向量化",
        summary: `本地 embedding 完成，生成 ${result.embeddings.length} 个 ${result.dimensions} 维向量`,
        details: {
          inputCount: texts.length,
          dimensions: result.dimensions,
          runtime: result.runtime,
        },
        role: "embedding",
        providerCode: result.providerCode,
        providerLabel: "Local",
        protocol: result.runtime,
        operation: "local-embedding",
        endpoint: "local:model-runtime",
        model: result.model,
        modelConfigId: result.modelConfigId,
        result: {
          success: true,
          finishReason: "completed",
          metrics: {
            inputCount: texts.length,
            outputCount: result.embeddings.length,
          },
          response: {
            model: result.model,
            summary: {
              dimensions: result.dimensions,
              vectorCount: result.embeddings.length,
            },
          },
        },
      }),
    };
  },

  async run<TState extends LocalEmbeddingNodeState>(
    input: LocalEmbeddingNodeInput<TState>,
  ): Promise<Partial<TState>> {
    return this.runGraphNode(input);
  },
};
