import type { RetrievedChunk } from "./retrieve.service";
import { fetchJsonWithTimeout } from "@/utils/http";

export interface RerankInput {
  query: string;
  chunks: RetrievedChunk[];
  topN?: number;
}

export interface RerankOutput {
  chunks: RetrievedChunk[];
  rerankScores?: number[];
}

export interface RerankProviderConfig {
  provider: "cohere" | "jina" | "openai-compatible" | "custom";
  endpoint: string;
  apiKey?: string;
  model?: string;
}

/**
 * 重排序服务节点
 * 当前使用简单相似度排序，预留外部 Rerank 服务接口
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
