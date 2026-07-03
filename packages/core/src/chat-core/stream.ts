import { createParser, type EventSourceMessage } from "eventsource-parser";
import type { ChatStreamEvent } from "./types";

const parseEventData = (data: string): ChatStreamEvent | null => {
  const trimmed = data.trim();
  if (!trimmed || trimmed === "[DONE]") {
    return null;
  }

  try {
    return JSON.parse(trimmed) as ChatStreamEvent;
  } catch {
    return null;
  }
};

export const parseChatStream = async (
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void | Promise<void>,
) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  const parser = createParser({
    onEvent(event: EventSourceMessage) {
      const parsed = parseEventData(event.data);
      if (parsed) {
        void onEvent(parsed);
      }
    },
  });

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    parser.feed(decoder.decode(value, { stream: true }));
  }

  parser.feed(decoder.decode());
};
