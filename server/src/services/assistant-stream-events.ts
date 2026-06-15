import { Readable } from "node:stream";

export type AssistantStreamFinishReason = "stop" | "error";

export interface AssistantStreamUsage {
  inputTokens: number;
  outputTokens: number;
}

const DEFAULT_TEXT_ID = "text-1";

export const defaultAssistantStreamUsage: AssistantStreamUsage = {
  inputTokens: 0,
  outputTokens: 0,
};

/** Serialize one assistant-ui stream event as an SSE data frame. */
export const toAssistantSseChunk = (data: unknown): string =>
  `data: ${JSON.stringify(data)}\n\n`;

/** Terminal SSE marker used by assistant-ui compatible streams. */
export const assistantDoneChunk = (): string => "data: [DONE]\n\n";

export const assistantStartChunk = (messageId?: string): string =>
  toAssistantSseChunk(
    messageId ? { type: "start", messageId } : { type: "start" },
  );

export const assistantStartStepChunk = (): string =>
  toAssistantSseChunk({ type: "start-step" });

export const assistantTextStartChunk = (id = DEFAULT_TEXT_ID): string =>
  toAssistantSseChunk({ type: "text-start", id });

export const assistantTextDeltaChunk = (
  delta: string,
  id = DEFAULT_TEXT_ID,
): string =>
  toAssistantSseChunk({
    type: "text-delta",
    id,
    delta,
  });

export const assistantTextEndChunk = (id = DEFAULT_TEXT_ID): string =>
  toAssistantSseChunk({ type: "text-end", id });

export const assistantErrorChunk = (errorText: string): string =>
  toAssistantSseChunk({
    type: "error",
    errorText,
  });

export const assistantFinishStepChunk = (input?: {
  finishReason?: AssistantStreamFinishReason;
  usage?: AssistantStreamUsage;
  isContinued?: boolean;
}): string =>
  toAssistantSseChunk({
    type: "finish-step",
    ...(input?.finishReason ? { finishReason: input.finishReason } : {}),
    ...(input?.usage ? { usage: input.usage } : {}),
    ...(typeof input?.isContinued === "boolean"
      ? { isContinued: input.isContinued }
      : {}),
  });

export const assistantFinishChunk = (input: {
  finishReason: AssistantStreamFinishReason;
  usage?: AssistantStreamUsage;
}): string =>
  toAssistantSseChunk({
    type: "finish",
    finishReason: input.finishReason,
    ...(input.usage ? { usage: input.usage } : {}),
  });

export function* assistantTextStartChunks(input?: {
  messageId?: string;
  includeStartStep?: boolean;
}): Generator<string> {
  yield assistantStartChunk(input?.messageId);
  if (input?.includeStartStep) {
    yield assistantStartStepChunk();
  }
  yield assistantTextStartChunk();
}

export function* assistantFinishChunks(input: {
  finishReason: AssistantStreamFinishReason;
  usage?: AssistantStreamUsage;
  isContinued?: boolean;
  includeDone?: boolean;
}): Generator<string> {
  yield assistantFinishStepChunk({
    finishReason: input.finishReason,
    usage: input.usage,
    isContinued: input.isContinued,
  });
  yield assistantFinishChunk({
    finishReason: input.finishReason,
    usage: input.usage,
  });
  if (input.includeDone) {
    yield assistantDoneChunk();
  }
}

export interface AssistantTextStreamOptions {
  /** Optional assistant message id for assistant-ui data streams. */
  messageId?: string;
  /** Older provider streams include a start-step event before text starts. */
  includeStartStep?: boolean;
  /** Assistant-ui data streams expect a final [DONE] marker. */
  includeDone?: boolean;
  /** Usage payload attached to finish events when known. */
  usage?: AssistantStreamUsage;
  /** Convert thrown errors into user-visible stream error text. */
  getErrorMessage?: (error: unknown) => string;
}

/** Wrap a text-delta iterable into the shared assistant-ui event sequence. */
export const createAssistantTextStream = (
  streamText: () => AsyncIterable<string>,
  options: AssistantTextStreamOptions = {},
): Readable =>
  Readable.from(
    (async function* () {
      yield* assistantTextStartChunks({
        messageId: options.messageId,
        includeStartStep: options.includeStartStep,
      });

      try {
        for await (const delta of streamText()) {
          if (!delta) {
            continue;
          }

          yield assistantTextDeltaChunk(delta);
        }

        yield assistantTextEndChunk();
        yield* assistantFinishChunks({
          finishReason: "stop",
          usage: options.usage,
          isContinued: false,
          includeDone: options.includeDone,
        });
      } catch (error) {
        const message = options.getErrorMessage
          ? options.getErrorMessage(error)
          : error instanceof Error
            ? error.message
            : String(error);
        yield assistantErrorChunk(message);
        yield* assistantFinishChunks({
          finishReason: "error",
          usage: options.usage,
          isContinued: false,
          includeDone: options.includeDone,
        });
      }
    })(),
  );

