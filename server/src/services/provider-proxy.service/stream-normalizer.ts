import { createAssistantTextStream } from "@/services/chat-stream-events.js";
import { getErrorMessage } from "@/utils/errors.js";

export const createUiMessageStream = (
  streamText: () => AsyncIterable<string>,
) =>
  createAssistantTextStream(streamText, {
    includeStartStep: true,
    getErrorMessage,
  });
