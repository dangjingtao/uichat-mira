import { RunnableLambda } from "@langchain/core/runnables";
import {
  embedService,
  retrieveService,
  rerankService,
  generateService,
  type RetrievedChunk,
} from "./rag-nodes";
import { ragGraph, type RAGGraphInput } from "./rag-graph";

/**
 * Embed Runnable
 * 输入: string
 * 输出: number[]
 */
export const embedRunnable = RunnableLambda.from(async (text: string) => {
  return embedService.embedSingle(text);
});

/**
 * Retrieve Runnable
 * 输入: { embedding, knowledgeBaseId?, topK? }
 * 输出: RetrievedChunk[]
 */
export const retrieveRunnable = RunnableLambda.from(
  async (input: {
    embedding: number[];
    knowledgeBaseId?: string;
    topK?: number;
  }) => {
    const result = await retrieveService.retrieve({
      embedding: input.embedding,
      knowledgeBaseId: input.knowledgeBaseId,
      topK: input.topK ?? 10,
    });
    return result.chunks;
  },
);

/**
 * Rerank Runnable
 * 输入: { query, chunks, topN? }
 * 输出: RetrievedChunk[]
 */
export const rerankRunnable = RunnableLambda.from(
  async (input: {
    query: string;
    chunks: RetrievedChunk[];
    topN?: number;
  }) => {
    const result = await rerankService.rerank({
      query: input.query,
      chunks: input.chunks,
      topN: input.topN ?? 4,
    });
    return result.chunks;
  },
);

/**
 * Generate Runnable
 * 输入: { query, chunks, systemPrompt? }
 * 输出: string
 */
export const generateRunnable = RunnableLambda.from(
  async (input: {
    query: string;
    chunks: RetrievedChunk[];
    systemPrompt?: string;
  }) => {
    const result = await generateService.generate({
      query: input.query,
      chunks: input.chunks,
      systemPrompt: input.systemPrompt,
    });
    return result.answer;
  },
);

/**
 * RAG Pipeline Runnable
 * 输入: RAGGraphInput
 * 输出: { answer, sources }
 */
export const ragRunnableSequence = RunnableLambda.from(
  async (input: RAGGraphInput) => {
    const result = await ragGraph.run(input);
    return {
      answer: result.answer,
      sources: result.sources,
    };
  },
);

/**
 * 仅检索 Runnable（不生成）
 * 输入: RAGGraphInput
 * 输出: RetrievedChunk[]
 */
export const retrieveOnlyRunnable = RunnableLambda.from(
  async (input: RAGGraphInput) => {
    return ragGraph.retrieve(input);
  },
);

/**
 * 并行检索 Runnable（多知识库并行）
 * 输入: { question, knowledgeBaseIds, topK? }
 * 输出: Record<knowledgeBaseId, RetrievedChunk[]>
 */
export const parallelRetrieveRunnable = RunnableLambda.from(
  async (input: {
    question: string;
    knowledgeBaseIds: string[];
    topK?: number;
  }) => {
    const entries = await Promise.all(
      input.knowledgeBaseIds.map(async (knowledgeBaseId) => {
        const chunks = await ragGraph.retrieve({
          question: input.question,
          knowledgeBaseId,
          topK: input.topK,
        });

        return [knowledgeBaseId, chunks] as const;
      }),
    );

    return Object.fromEntries(entries);
  },
);

/**
 * Graph 原生更新流
 * 输入: RAGGraphInput
 * 输出: LangGraph updates stream
 */
export const ragUpdatesRunnable = RunnableLambda.from(
  async (input: RAGGraphInput) => {
    return ragGraph.streamUpdates(input);
  },
);

/**
 * Graph 原生状态流
 * 输入: RAGGraphInput
 * 输出: LangGraph values stream
 */
export const ragValuesRunnable = RunnableLambda.from(
  async (input: RAGGraphInput) => {
    return ragGraph.streamValues(input);
  },
);
