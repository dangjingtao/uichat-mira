import { newsItemsRepository } from "@/db/repositories/news-items.repository.js";
import { newsItemsVectorRepository } from "@/db/repositories/news-items-vector.repository.js";
import { executeLocalEmbedding } from "@/services/internal-capabilities/local-embedding.js";
import { cosineSimilarity } from "@/harness/candidates-core/scoring.js";
import {
  fuseRetrievalCandidates,
  rerankRetrievalCandidates,
} from "@/services/retrieval/hybrid-retrieval.js";
import type {
  RetrievalCandidate,
  RetrievalDiagnostics,
} from "@/services/retrieval/types.js";

export type NewsSearchResult = {
  title: string;
  link: string;
  snippet: string;
  metadata: {
    provider: "local_news_hub";
    sourceKey: string;
    sourceName: string;
    publishedAt: string | null;
    tags: string[];
  };
};

export type NewsSearchResponse = {
  results: NewsSearchResult[];
  diagnostics: RetrievalDiagnostics;
};

const NEWS_INTENT_PATTERN = /\b(news|headline|headlines|breaking|latest|changelog|release notes|rss|feed)\b|新闻|资讯|头条|时事|快讯|动态|订阅源/i;

export const hasNewsIntent = (query: string) => NEWS_INTENT_PATTERN.test(query);

const toCandidate = (item: ReturnType<typeof newsItemsRepository.listRecent>["items"][number], score: number): RetrievalCandidate => ({
  id: item.id,
  title: item.title,
  content: [item.summary, item.contentText].filter(Boolean).join("\n"),
  metadata: {
    sourceKey: item.sourceKey,
    sourceName: item.sourceName,
    url: item.url,
    publishedAt: item.publishedAt,
    tags: item.tags,
  },
  score,
  rawScore: score,
});

export const searchNewsHubCache = async (input: {
  query: string;
  maxResults: number;
}): Promise<NewsSearchResponse> => {
  const keywordItems = newsItemsRepository.searchKeyword(input.query, Math.max(input.maxResults * 4, 20));
  const keywordCandidates = keywordItems.map((item) => toCandidate(item, item.keywordScore));
  const indexed = newsItemsVectorRepository.listAll();
  const allItems = newsItemsRepository.listAll();
  const itemMap = new Map(allItems.map((item) => [item.id, item]));
  let vectorCandidates: RetrievalCandidate[] = [];
  let embedding: RetrievalDiagnostics["embedding"] = "not_configured";

  if (indexed.length > 0) {
    try {
      const embeddingResult = await executeLocalEmbedding({ texts: [input.query] });
      const queryEmbedding = embeddingResult.embeddings?.[0];
      if (!queryEmbedding) {
        throw new Error("query embedding was empty");
      }
      const compatibleIndexed = newsItemsVectorRepository.listAll({
        model: embeddingResult.embeddingModel ?? "",
        modelConfigId: embeddingResult.embeddingModelConfigId ?? "",
      });
      if (compatibleIndexed.length === 0) {
        throw new Error("news embedding index model is stale");
      }
      vectorCandidates = compatibleIndexed
        .map((entry) => {
          const item = itemMap.get(entry.newsItemId);
          if (!item) return null;
          const score = cosineSimilarity(queryEmbedding, entry.embedding);
          return score >= 0 ? toCandidate(item, score) : null;
        })
        .filter((item): item is RetrievalCandidate => item !== null)
        .sort((left, right) => (right.rawScore ?? 0) - (left.rawScore ?? 0))
        .slice(0, Math.max(input.maxResults * 4, 20));
      embedding = "used";
    } catch {
      embedding = "unavailable";
    }
  }

  const fused = fuseRetrievalCandidates({
    keywordCandidates,
    vectorCandidates,
    maxResults: Math.max(input.maxResults * 3, input.maxResults),
  });
  const reranked = await rerankRetrievalCandidates({
    query: input.query,
    candidates: fused,
    maxResults: input.maxResults,
  });

  return {
    results: reranked.candidates.map((candidate) => ({
      title: candidate.title,
      link: String(candidate.metadata.url ?? ""),
      snippet: candidate.content.slice(0, 600),
      metadata: {
        provider: "local_news_hub",
        sourceKey: String(candidate.metadata.sourceKey ?? ""),
        sourceName: String(candidate.metadata.sourceName ?? ""),
        publishedAt: typeof candidate.metadata.publishedAt === "string" ? candidate.metadata.publishedAt : null,
        tags: Array.isArray(candidate.metadata.tags)
          ? candidate.metadata.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
      },
    })),
    diagnostics: {
      keyword: keywordCandidates.length,
      vector: vectorCandidates.length,
      fused: fused.length,
      reranked: reranked.candidates.length,
      embedding,
      rerank: reranked.status,
    },
  };
};

export const indexNewsHubCache = async () => {
  const items = newsItemsRepository.listAll();
  if (items.length === 0) return { indexedCount: 0, status: "empty" as const };
  try {
    let indexedCount = 0;
    for (let offset = 0; offset < items.length; offset += 32) {
      const batch = items.slice(offset, offset + 32);
      const result = await executeLocalEmbedding({
        texts: batch.map((item) => [item.title, item.summary, item.contentText, item.sourceName, item.topic, ...item.tags].filter(Boolean).join("\n")),
      });
      const embeddings = result.embeddings ?? [];
      newsItemsVectorRepository.upsertMany(
        batch.flatMap((item, index) => {
          const embedding = embeddings[index];
          return embedding
            ? [{ newsItemId: item.id, embedding, model: result.embeddingModel ?? "", modelConfigId: result.embeddingModelConfigId ?? "" }]
            : [];
        }),
      );
      indexedCount += embeddings.length;
    }
    return { indexedCount, status: "succeeded" as const };
  } catch {
    return { indexedCount: 0, status: "unavailable" as const };
  }
};
