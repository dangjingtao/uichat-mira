import { Readable } from "node:stream";
import type { RetrievedChunk } from "./rag-nodes";
import type { NormalizedChatMessage } from "./provider-proxy.service";
import {
  ragGraph,
  type RAGGraphCustomStreamChunk,
  type RAGGraphStreamUpdate,
} from "./rag-graph";

export interface RAGPipelineInput {
  question: string;
  knowledgeBaseId?: string;
  topK?: number;
  topN?: number;
  systemPrompt?: string;
  conversationHistory?: NormalizedChatMessage[];
}

export interface RAGPipelineOutput {
  answer: string;
  sources: RetrievedChunk[];
}

export interface RAGPipelineStepOutput {
  type: "embed" | "retrieve" | "rerank" | "generate";
  data: unknown;
}

export interface AssistantStreamCompletePayload {
  messageId: string;
  answer: string;
  sources: RetrievedChunk[];
  finishReason: "stop" | "error";
}

const toSseChunk = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`;

const toUiRagSources = (sources: RetrievedChunk[]) =>
  sources.map((source) => ({
    chunkId: source.chunkId,
    documentId: source.documentId,
    documentName: source.documentName,
    score: source.score,
    content: source.content,
  }));

/**
 * RAG Pipeline
 * 组合各节点实现完整的 RAG 流程：
 * 用户消息 -> 向量化 -> 检索 -> Rerank -> 生成回答
 */
export const ragPipeline = {
  /**
   * 执行完整 RAG 流程（非流式）
   */
  async run(input: RAGPipelineInput): Promise<RAGPipelineOutput> {
    const result = await ragGraph.run(input);
    return {
      answer: result.answer,
      sources: result.sources,
    };
  },

  /**
   * 执行完整 RAG 流程（流式）
   * 返回 SSE 流，包含各步骤的中间状态
   */
  stream(input: RAGPipelineInput): Readable {
    return Readable.from(
      (async function* () {
        try {
          yield `data: ${JSON.stringify({ type: "start" })}\n\n`;
          yield `data: ${JSON.stringify({ type: "start-step" })}\n\n`;
          yield `data: ${JSON.stringify({ type: "step", step: "embed", status: "start" })}\n\n`;
          const stream = await ragGraph.streamEvents(input);
          let textStarted = false;
          let sawGenerateDelta = false;

          const ensureTextStarted = () => {
            const events: string[] = [];
            if (!textStarted) {
              textStarted = true;
              events.push(
                `data: ${JSON.stringify({ type: "step", step: "generate", status: "start" })}\n\n`,
                `data: ${JSON.stringify({ type: "text-start", id: "text-1" })}\n\n`,
              );
            }

            return events;
          };

          for await (const chunk of stream) {
            if (!Array.isArray(chunk) || chunk.length < 2) {
              continue;
            }

            const [mode, payload] = chunk as [
              "updates" | "custom",
              RAGGraphStreamUpdate | RAGGraphCustomStreamChunk,
            ];

            if (mode === "custom") {
              const customChunk = payload as RAGGraphCustomStreamChunk;
              if (customChunk.type !== "generate-delta" || !customChunk.delta) {
                continue;
              }

              for (const event of ensureTextStarted()) {
                yield event;
              }

              sawGenerateDelta = true;
              yield `data: ${JSON.stringify({
                type: "text-delta",
                id: "text-1",
                delta: customChunk.delta,
              })}\n\n`;
              continue;
            }

            const update = payload as RAGGraphStreamUpdate;

            if ("embed" in update && update.embed) {
              yield `data: ${JSON.stringify({
                type: "step",
                step: "embed",
                status: "done",
                data: { dimensions: update.embed.embedding?.length ?? 0 },
              })}\n\n`;
              yield `data: ${JSON.stringify({ type: "step", step: "retrieve", status: "start" })}\n\n`;
              continue;
            }

            if ("retrieve" in update && update.retrieve) {
              const retrievedChunks = update.retrieve.retrievedChunks ?? [];
              yield `data: ${JSON.stringify({
                type: "step",
                step: "retrieve",
                status: "done",
                data: {
                  count: retrievedChunks.length,
                  sources: retrievedChunks.map((c) => ({
                    documentName: c.documentName,
                    score: c.score,
                  })),
                },
              })}\n\n`;

              if (retrievedChunks.length > 0) {
                yield `data: ${JSON.stringify({ type: "step", step: "rerank", status: "start" })}\n\n`;
              } else {
                for (const event of ensureTextStarted()) {
                  yield event;
                }
              }
              continue;
            }

            if ("rerank" in update && update.rerank) {
              const rerankedChunks = update.rerank.rerankedChunks ?? [];
              yield `data: ${JSON.stringify({
                type: "step",
                step: "rerank",
                status: "done",
                data: {
                  count: rerankedChunks.length,
                  sources: rerankedChunks.map((c) => ({
                    documentName: c.documentName,
                    score: c.score,
                  })),
                },
              })}\n\n`;
              for (const event of ensureTextStarted()) {
                yield event;
              }
              continue;
            }

            if ("generate" in update && update.generate) {
              const sources = update.generate.sources ?? [];
              for (const event of ensureTextStarted()) {
                yield event;
              }

              if (!sawGenerateDelta && update.generate.answer) {
                yield `data: ${JSON.stringify({
                  type: "text-delta",
                  id: "text-1",
                  delta: update.generate.answer,
                })}\n\n`;
              }

              yield `data: ${JSON.stringify({
                type: "sources",
                data: sources.map((c) => ({
                  documentId: c.documentId,
                  documentName: c.documentName,
                  content: c.content.slice(0, 200),
                  score: c.score,
                })),
              })}\n\n`;
            }
          }

          yield `data: ${JSON.stringify({ type: "text-end", id: "text-1" })}\n\n`;
          yield `data: ${JSON.stringify({ type: "finish-step" })}\n\n`;
          yield `data: ${JSON.stringify({ type: "finish", finishReason: "stop" })}\n\n`;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          yield `data: ${JSON.stringify({ type: "error", errorText: message })}\n\n`;
          yield `data: ${JSON.stringify({ type: "finish-step" })}\n\n`;
          yield `data: ${JSON.stringify({ type: "finish", finishReason: "error" })}\n\n`;
        }
      })()
    );
  },

  /**
   * 执行兼容 assistant-ui / AI SDK transport 的纯文本流。
   * 仅输出标准 text 事件，避免自定义 step 事件导致客户端提前断流。
   */
  assistantStream(
    input: RAGPipelineInput,
    options?: {
      messageId?: string;
      onComplete?: (
        payload: AssistantStreamCompletePayload,
      ) => Promise<void> | void;
    },
  ): Readable {
    return Readable.from(
      (async function* () {
        const messageId = options?.messageId ?? crypto.randomUUID();
        const usage = {
          inputTokens: 0,
          outputTokens: 0,
        };
        let answer = "";
        let sources: RetrievedChunk[] = [];
        let textStarted = false;
        let textEnded = false;
        let sawGenerateDelta = false;

        const ensureTextStarted = function* () {
          if (textStarted) {
            return;
          }

          textStarted = true;
          yield toSseChunk({ type: "start", messageId });
          yield toSseChunk({ type: "text-start", id: "text-1" });
        };

        const ensureTextEnded = function* () {
          if (!textStarted || textEnded) {
            return;
          }

          textEnded = true;
          yield toSseChunk({ type: "text-end", id: "text-1" });
        };

        try {
          const stream = await ragGraph.streamEvents(input);

          for await (const chunk of stream) {
            if (!Array.isArray(chunk) || chunk.length < 2) {
              continue;
            }

            const [mode, payload] = chunk as [
              "updates" | "custom",
              RAGGraphStreamUpdate | RAGGraphCustomStreamChunk,
            ];

            if (mode === "custom") {
              const customChunk = payload as RAGGraphCustomStreamChunk;
              if (customChunk.type !== "generate-delta" || !customChunk.delta) {
                continue;
              }

              sawGenerateDelta = true;
              answer += customChunk.delta;
              yield* ensureTextStarted();
              yield toSseChunk({
                type: "text-delta",
                id: "text-1",
                delta: customChunk.delta,
              });
              continue;
            }

            const update = payload as RAGGraphStreamUpdate;
            if (
              "generate" in update &&
              update.generate &&
              !sawGenerateDelta &&
              update.generate.answer
            ) {
              answer = update.generate.answer;
              sources = update.generate.sources ?? [];
              yield* ensureTextStarted();
              yield toSseChunk({
                type: "text-delta",
                id: "text-1",
                delta: update.generate.answer,
              });
              continue;
            }

            if ("generate" in update && update.generate) {
              sources = update.generate.sources ?? [];
            }
          }

          yield* ensureTextStarted();
          yield* ensureTextEnded();

          if (sources.length > 0) {
            yield toSseChunk({
              type: "data-rag-sources",
              data: toUiRagSources(sources),
            });
          }

          await options?.onComplete?.({
            messageId,
            answer,
            sources,
            finishReason: "stop",
          });

          yield toSseChunk({
            type: "finish-step",
            finishReason: "stop",
            usage,
            isContinued: false,
          });
          yield toSseChunk({
            type: "finish",
            finishReason: "stop",
            usage,
          });
          yield "data: [DONE]\n\n";
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          if (sources.length > 0) {
            yield toSseChunk({
              type: "data-rag-sources",
              data: toUiRagSources(sources),
            });
          }

          await options?.onComplete?.({
            messageId,
            answer,
            sources,
            finishReason: "error",
          });

          yield* ensureTextEnded();
          yield toSseChunk({
            type: "error",
            errorText: message,
          });
          yield toSseChunk({
            type: "finish-step",
            finishReason: "error",
            usage,
            isContinued: false,
          });
          yield toSseChunk({
            type: "finish",
            finishReason: "error",
            usage,
          });
          yield "data: [DONE]\n\n";
        }
      })(),
    );
  },

  /**
   * 仅执行检索步骤（不生成）
   * 用于调试或单独使用检索功能
   */
  async retrieveOnly(input: RAGPipelineInput): Promise<RetrievedChunk[]> {
    return ragGraph.retrieve(input);
  },
};
