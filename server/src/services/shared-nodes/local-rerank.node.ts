import {
  localModelRuntime,
  type LocalRerankCandidate,
} from "@/services/local-model-runtime/index.js";
import type { RagNodeResult } from "@/services/rag-node-contract.js";
import { createModelCallObservation } from "@/services/rag-node-observation.js";

export interface LocalRerankNodeState<TCandidateMeta = unknown> {
  rerankQuery?: string;
  rerankCandidates?: Array<LocalRerankCandidate<TCandidateMeta>>;
  rerankedCandidates?: Array<
    LocalRerankCandidate<TCandidateMeta> & {
      score: number;
      probability: number;
      rank: number;
    }
  >;
  rerankModel?: string;
  rerankModelConfigId?: string;
}

export interface LocalRerankStatePatch<TCandidateMeta = unknown> {
  rerankedCandidates: Array<
    LocalRerankCandidate<TCandidateMeta> & {
      score: number;
      probability: number;
      rank: number;
    }
  >;
  rerankModel: string;
  rerankModelConfigId: string;
}

export interface LocalRerankNodeInput<
  TState extends LocalRerankNodeState<TCandidateMeta>,
  TCandidateMeta = unknown,
> {
  state: TState;
  topN?: number;
  selectInput?: (state: TState) => {
    query: string;
    candidates: Array<LocalRerankCandidate<TCandidateMeta>>;
    topN?: number;
  };
  mapResult?: (
    state: TState,
    result: Awaited<ReturnType<typeof localModelRuntime.rerank<TCandidateMeta>>>,
  ) => Partial<TState>;
}

const selectDefaultInput = <TState extends LocalRerankNodeState<TCandidateMeta>, TCandidateMeta>(
  state: TState,
): {
  query: string;
  candidates: Array<LocalRerankCandidate<TCandidateMeta>>;
  topN?: number;
} => ({
  query: state.rerankQuery ?? "",
  candidates: state.rerankCandidates ?? [],
});

const mapDefaultResult = <
  TState extends LocalRerankNodeState<TCandidateMeta>,
  TCandidateMeta,
>(
  _state: TState,
  result: Awaited<ReturnType<typeof localModelRuntime.rerank<TCandidateMeta>>>,
): LocalRerankStatePatch<TCandidateMeta> =>
  ({
    rerankedCandidates: result.candidates,
    rerankModel: result.model,
    rerankModelConfigId: result.modelConfigId,
  });

export const localRerankSharedNode = {
  async rerank<TMeta = unknown>(input: {
    query: string;
    candidates: Array<LocalRerankCandidate<TMeta>>;
    topN?: number;
  }) {
    return localModelRuntime.rerank(input);
  },

  async runGraphNode<
    TState extends LocalRerankNodeState<TCandidateMeta>,
    TCandidateMeta = unknown,
  >(input: LocalRerankNodeInput<TState, TCandidateMeta>): Promise<Partial<TState>> {
    const selected = input.selectInput?.(input.state) ?? selectDefaultInput(input.state);
    const result = await localModelRuntime.rerank({
      ...selected,
      topN: input.topN ?? selected.topN,
    });
    const patch = input.mapResult?.(input.state, result) ?? mapDefaultResult(input.state, result);
    return patch as Partial<TState>;
  },

  async runNode<
    TState extends LocalRerankNodeState<TCandidateMeta>,
    TCandidateMeta = unknown,
  >(
    input: LocalRerankNodeInput<TState, TCandidateMeta>,
  ): Promise<RagNodeResult<Partial<TState>>> {
    const startedAtMs = Date.now();
    const selected = input.selectInput?.(input.state) ?? selectDefaultInput(input.state);
    const result = await localModelRuntime.rerank({
      ...selected,
      topN: input.topN ?? selected.topN,
    });
    const state = input.mapResult?.(input.state, result) ?? mapDefaultResult(input.state, result);

    return {
      state: state as Partial<TState>,
      observation: createModelCallObservation({
        startedAtMs,
        label: "本地重排序",
        summary: `本地 rerank 完成，返回 ${result.candidates.length} 条候选`,
        details: {
          inputCount: selected.candidates.length,
          returnedCount: result.candidates.length,
          runtime: result.runtime,
        },
        role: "rerank",
        providerCode: result.providerCode,
        providerLabel: "Local",
        protocol: result.runtime,
        operation: "local-rerank",
        endpoint: "local:model-runtime",
        model: result.model,
        modelConfigId: result.modelConfigId,
        result: {
          success: true,
          finishReason: "completed",
          metrics: {
            inputCount: selected.candidates.length,
            returnedCount: result.candidates.length,
          },
          response: {
            model: result.model,
            summary: {
              topScore: result.candidates[0]?.score ?? null,
            },
          },
        },
      }),
    };
  },

  async run<
    TState extends LocalRerankNodeState<TCandidateMeta>,
    TCandidateMeta = unknown,
  >(input: LocalRerankNodeInput<TState, TCandidateMeta>): Promise<Partial<TState>> {
    return this.runGraphNode(input);
  },
};
