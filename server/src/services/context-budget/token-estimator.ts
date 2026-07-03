import type {
  NormalizedChatMessage,
  NormalizedChatMessagePart,
} from "@/services/provider-proxy.message-protocol.js";

const MESSAGE_OVERHEAD_TOKENS = 6;

const isCjk = (char: string) => /[\u3400-\u9fff\uf900-\ufaff]/u.test(char);
const isAsciiWordLike = (char: string) => /[A-Za-z0-9_]/u.test(char);

export const estimateTextTokens = (text: string): number => {
  if (!text) {
    return 0;
  }

  let cjkCount = 0;
  let asciiWordLikeCount = 0;
  let otherCount = 0;

  for (const char of Array.from(text)) {
    if (isCjk(char)) {
      cjkCount += 1;
      continue;
    }
    if (isAsciiWordLike(char)) {
      asciiWordLikeCount += 1;
      continue;
    }
    if (!/\s/u.test(char)) {
      otherCount += 1;
    }
  }

  return Math.ceil(cjkCount + asciiWordLikeCount / 4 + otherCount / 2);
};

const estimatePartTokens = (part: NormalizedChatMessagePart): number => {
  if (part.type === "text") {
    return estimateTextTokens(part.text);
  }

  if (part.type === "image") {
    return 85;
  }

  return estimateTextTokens(part.data) + estimateTextTokens(part.filename);
};

export const estimateMessageTokens = (
  message: NormalizedChatMessage,
): number => {
  const partTokens =
    message.parts && message.parts.length > 0
      ? message.parts.reduce((sum, part) => sum + estimatePartTokens(part), 0)
      : estimateTextTokens(message.content);

  return partTokens + MESSAGE_OVERHEAD_TOKENS;
};

export const estimateMessagesTokens = (
  messages: NormalizedChatMessage[],
): number =>
  messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0);
