import type { RetrievedChunk } from "./retrieve.service";
import type { ProviderCode } from "@/db/schema.js";
import { modelConfigRepository } from "@/db/repositories";
import { providerProxyService } from "@/services/provider-proxy.service";
import { fetchJsonWithTimeout } from "@/utils/http";
import { writeStructuredLog } from "@/logger";
import type { RagNodeResult } from "@/services/rag-node-contract";
import {
  createModelCallObservation,
} from "@/services/rag-node-observation";
import { getProviderDefinition } from "@/providers/catalog.js";

export interface RerankInput {
  query: string;
  chunks: RetrievedChunk[];
  topN?: number;
}

export interface RerankOutput {
  chunks: RetrievedChunk[];
  rerankScores?: number[];
  execution: {
    applied: boolean;
    degraded: boolean;
    finishReason:
      | "reranked"
      | "fallback-no-config"
      | "fallback-disabled"
      | "fallback-missing-provider-or-model"
      | "fallback-provider-call-failed";
    error?: {
      type?: string;
      message: string;
    };
  };
}

export interface RerankStatePatch {
  rerankedChunks: RetrievedChunk[];
  sources: RetrievedChunk[];
}

export interface RerankProviderConfig {
  provider: "cohere" | "jina" | "openai-compatible" | "custom";
  endpoint: string;
  apiKey?: string;
  model?: string;
}

export interface RerankContext {
  providerCode: ProviderCode | null;
  remoteModelId: string | null;
  enabled?: boolean;
  topN?: number;
  scoreThreshold?: number;
}

const parseRerankParams = (paramsJson?: string) => {
  try {
    const parsed = JSON.parse(paramsJson || "{}");
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const getDefaultRerankContext = (): RerankContext | null => {
  const config = modelConfigRepository.findDefaultByType("rerank");
  if (!config) {
    return null;
  }

  const params = parseRerankParams(config.params);
  return {
    providerCode: config.providerCode ?? null,
    remoteModelId: config.remoteModelId ?? null,
    enabled: params.enabled === true,
    topN:
      typeof params.topN === "number" && params.topN > 0
        ? params.topN
        : undefined,
    scoreThreshold:
      typeof params.scoreThreshold === "number"
        ? params.scoreThreshold
        : undefined,
  };
};

const logRerankInfo = (event: string, data: Record<string, unknown>) => {
  writeStructuredLog("info", {
    scope: "rag-rerank",
    event,
    ...data,
  });
};

const logRerankWarn = (event: string, data: Record<string, unknown>) => {
  writeStructuredLog("warn", {
    scope: "rag-rerank",
    event,
    ...data,
  });
};

const normalizeScores = (values: number[]) => {
  if (values.length === 0) {
    return [];
  }

  if (values.length === 1) {
    return [1];
  }

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  if (maxValue === minValue) {
    return values.map((_value, index) => 1 - index / (values.length - 1));
  }

  return values.map((value) => (value - minValue) / (maxValue - minValue));
};

const normalizeRerankedChunks = (chunks: RetrievedChunk[]) => {
  const normalizedScores = normalizeScores(
    chunks.map((chunk) => chunk.rawScore ?? chunk.score),
  );

  return chunks.map((chunk, index) => ({
    ...chunk,
    score: normalizedScores[index] ?? 0,
  }));
};

const toContentSnippet = (content: string, maxChars = 200) =>
  Array.from(content).slice(0, maxChars).join("");

const toRerankCandidates = (
  stage: "input" | "output",
  chunks: RetrievedChunk[],
) =>
  chunks.map((chunk, index) => ({
    stage,
    rank: index + 1,
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    rawScore: chunk.rawScore ?? chunk.score,
    score: chunk.score,
    matchType: chunk.matchType ?? null,
    hitModes: chunk.hitModes ?? [],
    contentSnippet: toContentSnippet(chunk.content),
    contentLength: Array.from(chunk.content).length,
  }));

/**
 * 重排序服务节点
 * 优先调用已配置的 OpenAI-compatible Rerank 服务；
 * 未配置、未启用或调用失败时，回退到原始相似度排序
 */
export const rerankService = {
  /**
   * 重排序检索结果
   * @param input 查询文本、检索结果、返回数量
   * @returns 重排序后的结果
   */
  async rerank(input: RerankInput): Promise<RerankOutput> {
    const topN = input.topN ?? input.chunks.length;

    // 当前实现：基于原始相似度分数排序
    const sortedChunks = [...input.chunks]
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);

    return {
      chunks: sortedChunks,
      rerankScores: sortedChunks.map((chunk) => chunk.score),
      execution: {
        applied: false,
        degraded: false,
        finishReason: "fallback-no-config",
      },
    };
  },

  async rerankWithProvider(
    input: RerankInput,
    context?: RerankContext,
  ): Promise<RerankOutput> {
    const resolvedContext = context ?? getDefaultRerankContext();
    const topN =
      input.topN ?? resolvedContext?.topN ?? input.chunks.length;
    const baseChunks = [...input.chunks].sort((a, b) => b.score - a.score);

    if (
      !resolvedContext?.enabled ||
      !resolvedContext.providerCode ||
      !resolvedContext.remoteModelId
    ) {
      logRerankInfo("skipped", {
        reason: !resolvedContext
          ? "no-default-config"
          : !resolvedContext.enabled
            ? "disabled"
            : !resolvedContext.providerCode || !resolvedContext.remoteModelId
              ? "missing-provider-or-model"
              : "unknown",
        topN,
        chunkCount: baseChunks.length,
        providerCode: resolvedContext?.providerCode ?? null,
        remoteModelId: resolvedContext?.remoteModelId ?? null,
      });
      const fallback = await this.rerank({
        ...input,
        topN,
        chunks: baseChunks,
      });
      return {
        ...fallback,
        execution: {
          applied: false,
          degraded: false,
          finishReason: !resolvedContext
            ? "fallback-no-config"
            : !resolvedContext.enabled
              ? "fallback-disabled"
              : "fallback-missing-provider-or-model",
        },
      };
    }

    try {
      logRerankInfo("start", {
        providerCode: resolvedContext.providerCode,
        remoteModelId: resolvedContext.remoteModelId,
        topN,
        scoreThreshold: resolvedContext.scoreThreshold ?? null,
        chunkCount: baseChunks.length,
      });

      const resolved = providerProxyService.resolveRerankProvider(
        resolvedContext.providerCode,
      );
      const scores = await this.callOpenAICompatibleRerank(
        {
          provider: "openai-compatible",
          endpoint: resolved.endpoint,
          apiKey: resolved.apiKey,
          model: resolved.model,
        },
        input.query,
        baseChunks,
      );

      const rankedChunks = baseChunks
        .map((chunk, index) => ({
          chunk,
          score: scores[index] ?? chunk.score,
        }))
        .filter((item) =>
          typeof resolvedContext.scoreThreshold === "number"
            ? item.score >= resolvedContext.scoreThreshold
            : true,
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);

      logRerankInfo("success", {
        providerCode: resolvedContext.providerCode,
        remoteModelId: resolvedContext.remoteModelId,
        requestedChunkCount: baseChunks.length,
        returnedChunkCount: rankedChunks.length,
        topN,
        scoreThreshold: resolvedContext.scoreThreshold ?? null,
        topScores: rankedChunks.map((item) => item.score).slice(0, 5),
      });

      return {
        chunks: normalizeRerankedChunks(
          rankedChunks.map((item) => ({
            ...item.chunk,
            rawScore: item.score,
            score: item.score,
          })),
        ),
        rerankScores: rankedChunks.map((item) => item.score),
        execution: {
          applied: true,
          degraded: false,
          finishReason: "reranked",
        },
      };
    } catch (error) {
      logRerankWarn("fallback", {
        reason: "provider-call-failed",
        providerCode: resolvedContext.providerCode,
        remoteModelId: resolvedContext.remoteModelId,
        topN,
        chunkCount: baseChunks.length,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : String(error),
      });
      const fallback = await this.rerank({
        ...input,
        topN,
        chunks: baseChunks,
      });
      return {
        ...fallback,
        execution: {
          applied: false,
          degraded: true,
          finishReason: "fallback-provider-call-failed",
          error: {
            ...(error instanceof Error ? { type: error.name } : {}),
            message: error instanceof Error ? error.message : String(error),
          },
        },
      };
    }
  },

  async runNode(
    input: RerankInput,
    context?: RerankContext,
  ): Promise<RagNodeResult<RerankStatePatch>> {
    const startedAtMs = Date.now();
    const result = await this.rerankWithProvider(input, context);
    const resolvedContext = context ?? getDefaultRerankContext();
    let resolvedProvider: ReturnType<
      typeof providerProxyService.resolveRerankProvider
    > | null = null;

    if (resolvedContext?.providerCode && resolvedContext?.remoteModelId) {
      try {
        resolvedProvider = providerProxyService.resolveRerankProvider(
          resolvedContext.providerCode,
        );
      } catch (error) {
        logRerankWarn("resolve-provider-failed", {
          providerCode: resolvedContext.providerCode,
          remoteModelId: resolvedContext.remoteModelId,
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : String(error),
        });
      }
    }
    const topN = input.topN ?? resolvedContext?.topN ?? null;
    const rerankApplied = result.execution.applied;
    const rerankDegraded = result.execution.degraded;
    const inputCandidates = [...input.chunks].sort((a, b) => b.score - a.score);
    const rerankSummary = rerankApplied
      ? `已筛选 ${result.chunks.length} 个高相关片段`
      : rerankDegraded
        ? "重排服务不可用，已回退原始检索排序"
        : "未启用重排，已使用原始检索排序";

    return {
      state: {
        rerankedChunks: result.chunks,
        sources: result.chunks,
      },
      observation: createModelCallObservation({
        startedAtMs,
        label: "重排候选结果",
        summary: rerankSummary,
        details: {
          count: result.chunks.length,
          topN,
          rerankApplied,
          rerankDegraded,
          finishReason: result.execution.finishReason,
          error: result.execution.error ?? null,
          counts: {
            inputCandidates: inputCandidates.length,
            outputCandidates: result.chunks.length,
          },
          rerankBreakdown: {
            applied: rerankApplied,
            degraded: rerankDegraded,
            finishReason: result.execution.finishReason,
            counts: {
              inputCandidates: inputCandidates.length,
              outputCandidates: result.chunks.length,
            },
            candidates: [
              ...toRerankCandidates("input", inputCandidates),
              ...toRerankCandidates("output", result.chunks),
            ],
          },
          sources: result.chunks.slice(0, 5).map((chunk) => ({
            chunkId: chunk.chunkId,
            documentName: chunk.documentName,
            rawScore: chunk.rawScore ?? chunk.score,
            score: chunk.score,
            matchType: chunk.matchType ?? null,
            hitModes: chunk.hitModes ?? [],
            contentPreview: toContentSnippet(chunk.content, 100),
          })),
        },
        role: "rerank",
        providerCode: resolvedContext?.providerCode ?? undefined,
        providerLabel: resolvedContext?.providerCode
          ? getProviderDefinition(resolvedContext.providerCode).displayName
          : undefined,
        protocol: resolvedProvider
          ? getProviderDefinition(resolvedProvider.providerCode).chatAdapter
          : undefined,
        operation: resolvedProvider ? "rerank" : undefined,
        endpoint: resolvedProvider?.endpoint,
        model: resolvedContext?.remoteModelId ?? undefined,
        modelConfigId: resolvedProvider?.modelConfigId,
        params: {
          providerParams: resolvedProvider?.params ?? null,
          topN,
          scoreThreshold: resolvedContext?.scoreThreshold ?? null,
          enabled: resolvedContext?.enabled ?? null,
        },
        request: resolvedProvider
          ? {
              method: "POST",
              url: resolvedProvider.endpoint,
              body: {
                model: resolvedProvider.model,
                queryLength: Array.from(input.query).length,
                documentCount: input.chunks.length,
                topN: input.topN ?? resolvedContext?.topN ?? input.chunks.length,
                params: {
                  scoreThreshold: resolvedContext?.scoreThreshold ?? null,
                },
              },
            }
          : undefined,
        result: {
          success: rerankApplied,
          finishReason: result.execution.finishReason,
          ...(result.execution.error
            ? {
                error: {
                  ...(result.execution.error.type
                    ? { type: result.execution.error.type }
                    : {}),
                  message: result.execution.error.message,
                },
              }
            : {}),
          metrics: {
            inputCount: input.chunks.length,
            candidateCount: input.chunks.length,
            returnedCount: result.chunks.length,
          },
          response: {
            model: resolvedProvider?.model ?? resolvedContext?.remoteModelId ?? undefined,
            summary: {
              rerankApplied,
              rerankDegraded,
              counts: {
                inputCandidates: inputCandidates.length,
                outputCandidates: result.chunks.length,
              },
              topScores: result.chunks.slice(0, 5).map((chunk) => chunk.score),
            },
          },
        },
        retrieval: {
          topN,
          candidateCount: input.chunks.length,
          returnedCount: result.chunks.length,
        },
      }),
    };
  },

  /**
   * 外部 Rerank 服务接口
   * 支持 Cohere、Jina、OpenAI-compatible 等服务
   *
   * @param config 外部服务配置
   * @param query 查询文本
   * @param chunks 检索结果
   * @returns 重排序分数
   */
  async callExternalRerank(
    config: RerankProviderConfig,
    query: string,
    chunks: RetrievedChunk[],
  ): Promise<number[]> {
    if (chunks.length === 0) {
      return [];
    }

    switch (config.provider) {
      case "cohere":
        return this.callCohereRerank(config, query, chunks);

      case "jina":
        return this.callJinaRerank(config, query, chunks);

      case "openai-compatible":
        return this.callOpenAICompatibleRerank(config, query, chunks);

      case "custom":
        // 自定义服务，假设返回格式与 OpenAI-compatible 相同
        return this.callOpenAICompatibleRerank(config, query, chunks);
    }
  },

  /**
   * Cohere Rerank API
   * https://docs.cohere.com/reference/rerank
   */
  async callCohereRerank(
    config: RerankProviderConfig,
    query: string,
    chunks: RetrievedChunk[],
  ): Promise<number[]> {
    const response = await fetchJsonWithTimeout<{
      results: Array<{ index: number; relevance_score: number }>;
    }>(
      config.endpoint || "https://api.cohere.ai/v1/rerank",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          query,
          documents: chunks.map((c) => c.content),
          model: config.model || "rerank-english-v3.0",
          top_n: chunks.length,
        }),
      },
      30_000,
    );

    // Cohere 返回按 relevance_score 排序的结果，需要映射回原始索引
    const scores = new Array(chunks.length).fill(0);
    for (const result of response.results) {
      scores[result.index] = result.relevance_score;
    }

    return scores;
  },

  /**
   * Jina Rerank API
   * https://jina.ai/reranker/
   */
  async callJinaRerank(
    config: RerankProviderConfig,
    query: string,
    chunks: RetrievedChunk[],
  ): Promise<number[]> {
    const response = await fetchJsonWithTimeout<{
      results: Array<{ index: number; relevance_score: number }>;
    }>(
      config.endpoint || "https://api.jina.ai/v1/rerank",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          query,
          documents: chunks.map((c) => c.content),
          model: config.model || "jina-reranker-v2-base-multilingual",
          top_n: chunks.length,
        }),
      },
      30_000,
    );

    const scores = new Array(chunks.length).fill(0);
    for (const result of response.results) {
      scores[result.index] = result.relevance_score;
    }

    return scores;
  },

  /**
   * OpenAI-compatible Rerank API
   * 支持 Xinference、LocalAI 等封装的 Rerank 服务
   *
   * 常见格式：
   * POST /v1/rerank
   * Body: { query, documents, model }
   * Response: { results: [{ index, relevance_score }] }
   */
  async callOpenAICompatibleRerank(
    config: RerankProviderConfig,
    query: string,
    chunks: RetrievedChunk[],
  ): Promise<number[]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetchJsonWithTimeout<{
      results: Array<{ index: number; relevance_score: number }>;
    }>(
      config.endpoint,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          query,
          documents: chunks.map((c) => c.content),
          model: config.model,
          top_n: chunks.length,
        }),
      },
      30_000,
    );

    const scores = new Array(chunks.length).fill(0);
    for (const result of response.results) {
      scores[result.index] = result.relevance_score;
    }

    return scores;
  },
};
