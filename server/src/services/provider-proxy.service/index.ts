import { Readable } from "node:stream";
import { Ollama } from "ollama";
import { modelConfigRepository } from "@/db/repositories";
import type { ModelType, ProviderCode } from "@/db/schema.js";
import {
  type AssistantStreamFinishReason,
  assistantDoneChunk,
  assistantErrorChunk,
  assistantFinishChunks,
  assistantTextDeltaChunk,
  assistantTextEndChunk,
  assistantTextStartChunks,
} from "@/services/chat-stream-events.js";
import { createCloudflareEmbeddings } from "@/services/cloudflare-provider.js";
import {
  createOpenAICompatibleEmbeddings,
  createOpenAICompatibleEmbeddingsUrl,
  createOpenAICompatibleRerankUrl,
} from "@/services/openai-compatible-provider.js";
import { getProviderDefinition } from "@/providers/catalog.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import {
  describeResolvedChatInvocation,
  streamResolvedChat,
} from "./chat-adapters.js";
import { parseModelParams, toEmbeddingOptions } from "./params.js";
import {
  assertOllamaModelAvailable,
  resolveExplicitProviderSelection,
  resolveProviderForRole,
} from "./resolution.js";
import { createUiMessageStream } from "./stream-normalizer.js";
import type {
  ProviderInvocationMetadata,
  ProviderResolution,
  ProxyProviderParam,
  RerankResolution,
} from "./types.js";

export type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
export type {
  ProviderInvocationMetadata,
  ProviderResolution,
  ProxyProviderParam,
  RerankResolution,
} from "./types.js";

export interface EmbeddingResult {
  providerCode: ProviderCode;
  model: string;
  modelConfigId: string;
  embeddings: number[][];
  dimensions: number;
}

export interface ExplicitProviderSelectionInput {
  providerCode: ProviderCode;
  remoteModelId: string;
  messages: NormalizedChatMessage[];
  params?: Record<string, unknown>;
}

export interface PersistedChatStreamInput {
  requestedProvider: ProxyProviderParam;
  threadId: string;
  userId: number;
  userMessageId: string;
  assistantMessageId: string;
  messages: NormalizedChatMessage[];
  params?: Record<string, unknown>;
  onComplete?: (input: {
    answer: string;
    finishReason: AssistantStreamFinishReason;
  }) => Promise<void> | void;
}

const syncResolvedEmbeddingDimensions = (
  resolved: ProviderResolution,
  dimensions: number,
) => {
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    return;
  }

  const modelConfig = modelConfigRepository.findDefaultByType("embedding");
  if (
    !modelConfig ||
    modelConfig.id !== resolved.modelConfigId ||
    !modelConfig.params
  ) {
    return;
  }

  const currentParams = parseModelParams(modelConfig.params);
  if (currentParams.dimensions === dimensions) {
    return;
  }

  modelConfigRepository.updateDefault("embedding", {
    params: JSON.stringify({
      ...currentParams,
      dimensions,
    }),
  });
};

const getEmbeddingInvocationUrl = (resolved: ProviderResolution) => {
  switch (getProviderDefinition(resolved.providerCode).embeddingAdapter) {
    case "ollama":
      return `${resolved.baseUrl.replace(/\/+$/, "")}/api/embed`;
    case "cloudflare":
    case "openai-compatible":
      return createOpenAICompatibleEmbeddingsUrl(resolved.baseUrl);
    default:
      throw new Error(`Unsupported provider "${resolved.providerCode}"`);
  }
};

const createEmbeddingInvocationMetadata = (
  resolved: ProviderResolution,
  input: string[],
): ProviderInvocationMetadata => {
  const protocol = getProviderDefinition(resolved.providerCode).embeddingAdapter;
  const endpoint = getEmbeddingInvocationUrl(resolved);

  return {
    providerCode: resolved.providerCode,
    providerLabel: getProviderDefinition(resolved.providerCode).displayName,
    protocol,
    operation: "embeddings",
    endpoint,
    model: resolved.model,
    modelConfigId: resolved.modelConfigId,
    params: resolved.params,
    request: {
      method: "POST",
      url: endpoint,
      body: {
        model: resolved.model,
        inputCount: input.length,
        params: toEmbeddingOptions(resolved.params),
      },
    },
  };
};

const createOllamaClient = (baseUrl: string, apiKey: string) => {
  const options: ConstructorParameters<typeof Ollama>[0] = {
    host: baseUrl || undefined,
  };

  if (apiKey) {
    options.headers = {
      Authorization: `Bearer ${apiKey}`,
    };
  }

  return new Ollama(options);
};

export const providerProxyService = {
  createUiMessageStream,

  streamChatText(
    requestedProvider: ProxyProviderParam,
    messages: NormalizedChatMessage[],
    params?: Record<string, unknown>,
  ) {
    const baseResolved = resolveProviderForRole("llm", requestedProvider);
    const resolved = {
      ...baseResolved,
      params: {
        ...baseResolved.params,
        ...(params ?? {}),
      },
    };

    return streamResolvedChat(resolved, messages);
  },

  streamChat(
    requestedProvider: ProxyProviderParam,
    messages: NormalizedChatMessage[],
    params?: Record<string, unknown>,
  ) {
    return createUiMessageStream(() =>
      this.streamChatText(requestedProvider, messages, params),
    );
  },

  createPersistedChatStream(input: PersistedChatStreamInput) {
    const service = this;

    return Readable.from(
      (async function* () {
        let answer = "";

        try {
          yield* assistantTextStartChunks({
            messageId: input.assistantMessageId,
            includeStartStep: true,
          });

          for await (const delta of service.streamChatText(
            input.requestedProvider,
            input.messages,
            input.params,
          )) {
            if (!delta) {
              continue;
            }

            answer += delta;
            yield assistantTextDeltaChunk(delta);
          }

          yield assistantTextEndChunk();
          await input.onComplete?.({
            answer,
            finishReason: "stop",
          });
          yield* assistantFinishChunks({
            finishReason: "stop",
            isContinued: false,
            includeDone: true,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          yield assistantErrorChunk(message);
          yield* assistantFinishChunks({
            finishReason: "error",
            isContinued: false,
            includeDone: false,
          });
          yield assistantDoneChunk();
        }
      })(),
    );
  },

  streamTaskChatText(messages: NormalizedChatMessage[]) {
    const resolved = resolveProviderForRole("task", "default");

    return streamResolvedChat(resolved, messages);
  },

  streamTaskChat(messages: NormalizedChatMessage[]) {
    return createUiMessageStream(() => this.streamTaskChatText(messages));
  },

  describeChatInvocation(
    requestedProvider: ProxyProviderParam,
    messages: NormalizedChatMessage[],
  ): ProviderInvocationMetadata {
    const resolved = resolveProviderForRole("llm", requestedProvider);
    return describeResolvedChatInvocation(resolved, messages, "chat");
  },

  describeTaskChatInvocation(
    messages: NormalizedChatMessage[],
  ): ProviderInvocationMetadata {
    const resolved = resolveProviderForRole("task", "default");
    return describeResolvedChatInvocation(resolved, messages, "task-chat");
  },

  describeEmbeddingInvocation(
    requestedProvider: ProxyProviderParam,
    input: string[],
  ): ProviderInvocationMetadata {
    const resolved = resolveProviderForRole("embedding", requestedProvider);
    return createEmbeddingInvocationMetadata(resolved, input);
  },

  async createEmbeddings(
    requestedProvider: ProxyProviderParam,
    input: string[],
  ): Promise<EmbeddingResult> {
    const normalizedInput = input.map((item) => item.trim()).filter(Boolean);
    if (normalizedInput.length === 0) {
      return {
        providerCode:
          requestedProvider === "default" ? "ollama" : requestedProvider,
        model: "",
        modelConfigId: "",
        embeddings: [],
        dimensions: 0,
      };
    }

    const resolved = resolveProviderForRole("embedding", requestedProvider);
    const embeddingOptions = toEmbeddingOptions(resolved.params);

    let embeddings: number[][] = [];

    switch (getProviderDefinition(resolved.providerCode).embeddingAdapter) {
      case "ollama": {
        await assertOllamaModelAvailable({
          baseUrl: resolved.baseUrl,
          apiKey: resolved.apiKey,
          model: resolved.model,
          role: "embedding",
        });

        const ollama = createOllamaClient(resolved.baseUrl, resolved.apiKey);
        const response = await ollama.embed({
          model: resolved.model,
          input: normalizedInput,
          ...embeddingOptions,
        });

        embeddings = response.embeddings ?? [];

        break;
      }
      case "cloudflare": {
        embeddings = await createCloudflareEmbeddings({
          baseUrl: resolved.baseUrl,
          apiKey: resolved.apiKey,
          model: resolved.model,
          input: normalizedInput,
          params: embeddingOptions,
        });
        break;
      }
      case "openai-compatible": {
        embeddings = await createOpenAICompatibleEmbeddings({
          baseUrl: resolved.baseUrl,
          apiKey: resolved.apiKey,
          model: resolved.model,
          input: normalizedInput,
          params: embeddingOptions,
        });
        break;
      }
      default:
        throw new Error(`Unsupported provider "${resolved.providerCode}"`);
    }

    if (embeddings.length !== normalizedInput.length) {
      throw new Error("Embedding result count does not match input count");
    }

    const dimensions = embeddings[0]?.length ?? 0;
    if (dimensions <= 0) {
      throw new Error("Embedding provider returned empty vectors");
    }

    syncResolvedEmbeddingDimensions(resolved, dimensions);

    return {
      providerCode: resolved.providerCode,
      model: resolved.model,
      modelConfigId: resolved.modelConfigId,
      embeddings,
      dimensions,
    };
  },

  resolveRerankProvider(
    requestedProvider: ProxyProviderParam = "default",
  ): RerankResolution {
    const resolved = resolveProviderForRole("rerank", requestedProvider);
    const providerDefinition = getProviderDefinition(resolved.providerCode);

    if (providerDefinition.chatAdapter !== "openai-compatible") {
      throw new Error(
        `Provider "${resolved.providerCode}" does not support the OpenAI-compatible rerank adapter`,
      );
    }

    return {
      ...resolved,
      endpoint: createOpenAICompatibleRerankUrl(resolved.baseUrl),
    };
  },

  async generateTextWithModelSelection(
    input: ExplicitProviderSelectionInput,
  ): Promise<string> {
    const resolved = resolveExplicitProviderSelection(
      input.providerCode,
      input.remoteModelId,
      input.params ?? {},
    );

    if (getProviderDefinition(resolved.providerCode).chatAdapter === "ollama") {
      await assertOllamaModelAvailable({
        baseUrl: resolved.baseUrl,
        apiKey: resolved.apiKey,
        model: resolved.model,
        role: "llm",
      });
    }

    let output = "";
    for await (const delta of streamResolvedChat(resolved, input.messages)) {
      output += delta;
    }

    return output.trim();
  },

  async generateTextForRole(
    roleType: ModelType,
    messages: NormalizedChatMessage[],
    params?: Record<string, unknown>,
  ): Promise<string> {
    const baseResolved = resolveProviderForRole(roleType, "default");
    const resolved: ProviderResolution = {
      ...baseResolved,
      params: {
        ...baseResolved.params,
        ...(params ?? {}),
      },
    };

    if (getProviderDefinition(resolved.providerCode).chatAdapter === "ollama") {
      await assertOllamaModelAvailable({
        baseUrl: resolved.baseUrl,
        apiKey: resolved.apiKey,
        model: resolved.model,
        role: roleType,
      });
    }

    let output = "";
    for await (const delta of streamResolvedChat(resolved, messages)) {
      output += delta;
    }

    return output.trim();
  },
};
