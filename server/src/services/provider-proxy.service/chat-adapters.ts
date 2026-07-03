import { Ollama, type Message as OllamaMessage } from "ollama";
import {
  type OpenAICompatibleChatMessage,
  type OpenAICompatibleContentPart,
  createOpenAICompatibleChatUrl,
  streamOpenAICompatibleChat,
} from "@/services/openai-compatible-provider.js";
import { getProviderDefinition } from "@/providers/catalog.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { providerAttachmentResolver } from "./attachment-resolver.js";
import {
  toOllamaChatOptions,
  toOpenAICompatibleChatOptions,
} from "./params.js";
import type {
  ChatProviderAdapter,
  ProviderInvocationMetadata,
  ProviderResolution,
} from "./types.js";

type OllamaThinkLevel = "low" | "medium" | "high";

const isOllamaThinkParam = (
  value: unknown,
): value is boolean | OllamaThinkLevel =>
  value === true ||
  value === false ||
  value === "low" ||
  value === "medium" ||
  value === "high";

const getChatInvocationUrl = (resolved: ProviderResolution) => {
  switch (getProviderDefinition(resolved.providerCode).chatAdapter) {
    case "ollama":
      return `${resolved.baseUrl.replace(/\/+$/, "")}/api/chat`;
    case "openai-compatible":
      return createOpenAICompatibleChatUrl(resolved.baseUrl);
    default:
      throw new Error(`Unsupported provider "${resolved.providerCode}"`);
  }
};

const createChatInvocationMetadata = (
  resolved: ProviderResolution,
  messages: NormalizedChatMessage[],
  operation: "chat" | "task-chat",
): ProviderInvocationMetadata => {
  const protocol = getProviderDefinition(resolved.providerCode).chatAdapter;
  const endpoint = getChatInvocationUrl(resolved);

  return {
    providerCode: resolved.providerCode,
    providerLabel: getProviderDefinition(resolved.providerCode).displayName,
    protocol,
    operation,
    endpoint,
    model: resolved.model,
    modelConfigId: resolved.modelConfigId,
    params: resolved.params,
    request: {
      method: "POST",
      url: endpoint,
      body: {
        model: resolved.model,
        stream: true,
        ...(protocol === "ollama" && isOllamaThinkParam(resolved.params.think)
          ? { think: resolved.params.think }
          : {}),
        messageCount: messages.length,
        params:
          protocol === "ollama"
            ? toOllamaChatOptions(resolved.params)
            : toOpenAICompatibleChatOptions(resolved.params),
      },
    },
  };
};

export const trimHistoricalAttachmentsForProvider = (
  messages: NormalizedChatMessage[],
): NormalizedChatMessage[] => {
  const latestUserIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find((entry) => entry.message.role === "user")?.index;

  if (latestUserIndex === undefined) {
    return messages;
  }

  return messages.flatMap((message, index) => {
    if (index === latestUserIndex) {
      return [message];
    }

    if (!message.parts?.some((part) => part.type !== "text")) {
      return [message];
    }

    const textOnlyMessage = {
      ...message,
      parts: message.parts.filter((part) => part.type === "text"),
    };

    const hasTextPart = textOnlyMessage.parts.some(
      (part) => part.type === "text" && part.text.trim(),
    );

    return hasTextPart || textOnlyMessage.content.trim()
      ? [textOnlyMessage]
      : [];
  });
};

export const ollamaChatAdapter: ChatProviderAdapter = {
  async *streamChat({ resolved, messages }) {
    const ollamaOptions: ConstructorParameters<typeof Ollama>[0] = {
      host: resolved.baseUrl || undefined,
    };

    if (resolved.apiKey) {
      ollamaOptions.headers = {
        Authorization: `Bearer ${resolved.apiKey}`,
      };
    }

    const ollama = new Ollama(ollamaOptions);
    const ollamaMessages: OllamaMessage[] = [];

    for (const message of messages) {
      const textParts = (message.parts ?? [])
        .filter((part) => part.type === "text")
        .map((part) => part.text);
      const imageParts: string[] = [];

      for (const part of message.parts ?? []) {
        if (part.type === "image") {
          imageParts.push(
            await providerAttachmentResolver.resolveImageForOllama(part.image),
          );
        }
      }

      ollamaMessages.push({
        role: message.role,
        content:
          textParts.join("\n").trim() ||
          (imageParts.length > 0 ? message.content : message.content.trim()),
        ...(imageParts.length > 0 ? { images: imageParts } : {}),
      });
    }

    const response = await ollama.chat({
      model: resolved.model,
      messages: ollamaMessages,
      stream: true,
      ...(isOllamaThinkParam(resolved.params.think)
        ? { think: resolved.params.think }
        : {}),
      options: toOllamaChatOptions(resolved.params),
    });

    for await (const chunk of response) {
      const delta = chunk.message?.content ?? "";
      if (delta) {
        yield delta;
      }
    }
  },

  describeInvocation({ resolved, messages, operation }) {
    return createChatInvocationMetadata(resolved, messages, operation);
  },
};

export const openAICompatibleChatAdapter: ChatProviderAdapter = {
  async *streamChat({ resolved, messages }) {
    const openAiMessages: OpenAICompatibleChatMessage[] = [];

    for (const message of messages) {
      const multimodalParts: OpenAICompatibleContentPart[] = [];

      for (const part of message.parts ?? []) {
        if (part.type === "text") {
          multimodalParts.push({ type: "text", text: part.text });
          continue;
        }

        if (part.type === "image") {
          multimodalParts.push({
            type: "image_url",
            image_url: {
              url: await providerAttachmentResolver.resolveImage(part.image),
            },
          });
          continue;
        }

        if (part.type === "file") {
          const fileLabel = part.fileId
            ? `[File attachment: ${part.filename} (${part.fileId})]`
            : `[File attachment: ${part.filename}]`;

          multimodalParts.push({
            type: "text",
            text: `${fileLabel}\n${await providerAttachmentResolver.resolveFile(part.data)}`,
          });
        }
      }

      openAiMessages.push({
        role: message.role,
        content:
          multimodalParts.length === 0
            ? message.content
            : multimodalParts.length === 1 &&
                multimodalParts[0]?.type === "text"
              ? multimodalParts[0].text
              : multimodalParts,
      });
    }

    yield* streamOpenAICompatibleChat({
      baseUrl: resolved.baseUrl,
      apiKey: resolved.apiKey,
      model: resolved.model,
      messages: openAiMessages,
      params: toOpenAICompatibleChatOptions(resolved.params),
    });
  },

  describeInvocation({ resolved, messages, operation }) {
    return createChatInvocationMetadata(resolved, messages, operation);
  },
};

export const getChatProviderAdapter = (
  resolved: ProviderResolution,
): ChatProviderAdapter => {
  switch (getProviderDefinition(resolved.providerCode).chatAdapter) {
    case "ollama":
      return ollamaChatAdapter;
    case "openai-compatible":
      return openAICompatibleChatAdapter;
    default:
      throw new Error(`Unsupported provider "${resolved.providerCode}"`);
  }
};

export const streamResolvedChat = (
  resolved: ProviderResolution,
  messages: NormalizedChatMessage[],
) =>
  getChatProviderAdapter(resolved).streamChat({
    resolved,
    messages: trimHistoricalAttachmentsForProvider(messages),
  });

export const describeResolvedChatInvocation = (
  resolved: ProviderResolution,
  messages: NormalizedChatMessage[],
  operation: "chat" | "task-chat",
) =>
  getChatProviderAdapter(resolved).describeInvocation({
    resolved,
    messages,
    operation,
  });
