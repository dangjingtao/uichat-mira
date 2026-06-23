import type { FastifyReply } from "fastify";
import { Readable } from "node:stream";
import {
  assistantDoneChunk,
  assistantErrorChunk,
  assistantFinishChunks,
  assistantTextDeltaChunk,
  assistantTextEndChunk,
  assistantTextStartChunks,
  defaultAssistantStreamUsage,
  toAssistantSseChunk,
} from "@/services/chat-stream-events.js";

/** Configure a reply for ordinary provider SSE streams. */
export const prepareEventStreamReply = (reply: FastifyReply): void => {
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.type("text/event-stream; charset=utf-8");
};

/** Configure a reply for desktop chat data streams consumed by the renderer. */
export const prepareDataStreamReply = (reply: FastifyReply): void => {
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.setHeader("x-vercel-ai-ui-message-stream", "v1");
  reply.type("text/plain; charset=utf-8");
};

export interface StaticAssistantStreamInput {
  /** Assistant message id emitted in the stream start event. */
  messageId: string;
  /** Complete answer sent as a single text delta. */
  answer: string;
  /** Optional RAG node event shown by the frontend workflow observer. */
  ragNode?: {
    nodeId: string;
    nodeType: string;
    label: string;
    summary: string;
    details?: Record<string, unknown>;
    environment?: Record<string, unknown>;
  };
  /** Completion hook used to persist the synthetic assistant message. */
  onComplete?: () => Promise<void> | void;
}

/**
 * Build a complete chat stream for deterministic route-level answers,
 * such as the "empty knowledge base" RAG fallback.
 */
export const createStaticAssistantStream = (
  input: StaticAssistantStreamInput,
): Readable =>
  Readable.from(
    (async function* () {
      try {
        if (input.ragNode) {
          yield toAssistantSseChunk({
            type: "data-rag-node",
            data: {
              ...input.ragNode,
              phase: "done",
            },
          });
        }

        yield* assistantTextStartChunks({ messageId: input.messageId });
        yield assistantTextDeltaChunk(input.answer);
        yield assistantTextEndChunk();

        await input.onComplete?.();

        yield* assistantFinishChunks({
          finishReason: "stop",
          usage: defaultAssistantStreamUsage,
          isContinued: false,
          includeDone: true,
        });
      } catch (streamError) {
        const message =
          streamError instanceof Error ? streamError.message : String(streamError);

        yield assistantErrorChunk(message);
        yield* assistantFinishChunks({
          finishReason: "error",
          usage: defaultAssistantStreamUsage,
          isContinued: false,
          includeDone: false,
        });
        yield assistantDoneChunk();
      }
    })(),
  );
