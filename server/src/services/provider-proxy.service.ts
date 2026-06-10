import { Readable } from "node:stream";
import { Ollama } from "ollama";
import {
  modelConfigRepository,
  providerConnectionRepository,
  providerModelRepository,
} from "@/db/repositories";
import type { ModelType, ProviderCode } from "@/db/schema.js";
import { createCloudflareEmbeddings } from "@/services/cloudflare-provider.js";
import {
  createOpenAICompatibleEmbeddings,
  streamOpenAICompatibleChat,
} from "@/services/openai-compatible-provider.js";
import { decryptSecret } from "@/utils/crypto.js";
import {
  getProviderDefinition,
  isCallableModelId,
} from "@/providers/catalog.js";

export interface UIMessagePart {
  type?: string;
  text?: string;
}

export interface UIMessage {
  role?: "system" | "user" | "assistant";
  parts?: UIMessagePart[];
}

export type NormalizedChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ProxyProviderParam = ProviderCode | "default";

export interface ProviderResolution {
  providerCode: ProviderCode;
  baseUrl: string;
  apiKey: string;
  model: string;
  modelConfigId: string;
  params: Record<string, unknown>;
}

export interface EmbeddingResult {
  providerCode: ProviderCode;
  model: string;
  modelConfigId: string;
  embeddings: number[][];
  dimensions: number;
}

const parseModelParams = (paramsJson: string) => {
  try {
    const parsed = JSON.parse(paramsJson || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

const toSseChunk = (data: Record<string, unknown>) =>
  `data: ${JSON.stringify(data)}\n\n`;

const toOllamaChatOptions = (params: Record<string, unknown>) => {
  const options: Record<string, unknown> = {};

  if (typeof params.temperature === "number") {
    options.temperature = params.temperature;
  }
  if (typeof params.topP === "number") {
    options.top_p = params.topP;
  }
  if (typeof params.topK === "number") {
    options.top_k = params.topK;
  }
  if (typeof params.maxTokens === "number") {
    options.num_predict = params.maxTokens;
  }
  if (typeof params.frequencyPenalty === "number") {
    options.frequency_penalty = params.frequencyPenalty;
  }
  if (typeof params.presencePenalty === "number") {
    options.presence_penalty = params.presencePenalty;
  }
  if (Array.isArray(params.stop)) {
    options.stop = params.stop;
  }

  return options;
};

const toOpenAICompatibleChatOptions = (params: Record<string, unknown>) => {
  const options: Record<string, unknown> = {};

  if (typeof params.temperature === "number") {
    options.temperature = params.temperature;
  }
  if (typeof params.topP === "number") {
    options.top_p = params.topP;
  }
  if (typeof params.maxTokens === "number") {
    options.max_tokens = params.maxTokens;
  }
  if (typeof params.frequencyPenalty === "number") {
    options.frequency_penalty = params.frequencyPenalty;
  }
  if (typeof params.presencePenalty === "number") {
    options.presence_penalty = params.presencePenalty;
  }
  if (Array.isArray(params.stop)) {
    options.stop = params.stop;
  }

  return options;
};

const toEmbeddingOptions = (params: Record<string, unknown>) => {
  const options: Record<string, unknown> = {};

  if (typeof params.truncate === "boolean") {
    options.truncate = params.truncate;
  }
  if (typeof params.dimensions === "number") {
    options.dimensions = params.dimensions;
  }

  return options;
};

const normalizeMessages = (messages: UIMessage[]): NormalizedChatMessage[] =>
  messages
    .map((message) => {
      if (!message.role || !Array.isArray(message.parts)) {
        return null;
      }

      const content = message.parts
        .filter(
          (part) => part?.type === "text" && typeof part.text === "string",
        )
        .map((part) => part.text?.trim() ?? "")
        .filter(Boolean)
        .join("\n");

      if (!content) {
        return null;
      }

      return {
        role: message.role,
        content,
      };
    })
    .filter((message): message is NormalizedChatMessage => Boolean(message));

const resolveProviderModelIdentifier = (
  roleType: ModelType,
  providerCode: ProviderCode,
  modelConfig: ReturnType<typeof modelConfigRepository.findDefaultByType>,
) => {
  if (!modelConfig?.remoteModelId) {
    throw new Error(`No ${roleType.toUpperCase()} model configured`);
  }

  if (!getProviderDefinition(providerCode).callableModelIdPrefix) {
    return modelConfig.remoteModelId;
  }

  if (isCallableModelId(providerCode, modelConfig.remoteModelId)) {
    return modelConfig.remoteModelId;
  }

  if (isCallableModelId(providerCode, modelConfig.name)) {
    return modelConfig.name;
  }

  const providerModel = providerModelRepository.findByProviderAndRemoteModelId(
    providerCode,
    modelConfig.remoteModelId,
  );

  if (providerModel?.modelName && isCallableModelId(providerCode, providerModel.modelName)) {
    return providerModel.modelName;
  }

  throw new Error(
    `${getProviderDefinition(providerCode).displayName} ${roleType} model "${modelConfig.remoteModelId}" is not a callable model identifier`,
  );
};

const resolveProviderForRole = (
  roleType: ModelType,
  requestedProvider: ProxyProviderParam = "default",
): ProviderResolution => {
  const modelConfig = modelConfigRepository.findDefaultByType(roleType);
  if (!modelConfig) {
    throw new Error(`No ${roleType.toUpperCase()} model configured`);
  }

  if (!modelConfig.providerCode || !modelConfig.remoteModelId) {
    throw new Error(
      `${roleType.toUpperCase()} model has no provider or remote model assigned`,
    );
  }

  const providerCode =
    requestedProvider === "default"
      ? modelConfig.providerCode
      : requestedProvider;

  if (providerCode !== modelConfig.providerCode) {
    throw new Error(
      `Requested provider "${providerCode}" does not match current default ${roleType.toUpperCase()} provider "${modelConfig.providerCode}"`,
    );
  }

  const provider = providerConnectionRepository.findByCode(providerCode);
  if (!provider) {
    throw new Error(`Provider "${providerCode}" not found`);
  }

  if (!provider.isEnabled) {
    throw new Error(`Provider "${providerCode}" is disabled`);
  }

  return {
    providerCode,
    baseUrl: provider.baseUrl ?? "",
    apiKey: decryptSecret(provider.apiKeyEncrypted),
    model: resolveProviderModelIdentifier(roleType, providerCode, modelConfig),
    modelConfigId: modelConfig.id,
    params: parseModelParams(modelConfig.params),
  };
};

const streamOllamaChat = async function* ({
  baseUrl,
  apiKey,
  model,
  messages,
  params,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: NormalizedChatMessage[];
  params: Record<string, unknown>;
}) {
  const ollamaOptions: ConstructorParameters<typeof Ollama>[0] = {
    host: baseUrl || undefined,
  };

  if (apiKey) {
    ollamaOptions.headers = {
      Authorization: `Bearer ${apiKey}`,
    };
  }

  const ollama = new Ollama(ollamaOptions);
  const response = await ollama.chat({
    model,
    messages,
    stream: true,
    options: toOllamaChatOptions(params),
  });

  for await (const chunk of response) {
    const delta = chunk.message?.content ?? "";
    if (delta) {
      yield delta;
    }
  }
};

const createUiMessageStream = (streamText: () => AsyncIterable<string>) =>
  Readable.from(
    (async function* () {
      yield toSseChunk({ type: "start" });
      yield toSseChunk({ type: "start-step" });
      yield toSseChunk({ type: "text-start", id: "text-1" });

      try {
        for await (const delta of streamText()) {
          if (!delta) {
            continue;
          }

          yield toSseChunk({
            type: "text-delta",
            id: "text-1",
            delta,
          });
        }

        yield toSseChunk({ type: "text-end", id: "text-1" });
        yield toSseChunk({ type: "finish-step" });
        yield toSseChunk({ type: "finish", finishReason: "stop" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        yield toSseChunk({ type: "error", errorText: message });
        yield toSseChunk({ type: "finish-step" });
        yield toSseChunk({ type: "finish", finishReason: "error" });
      }
    })(),
  );

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

const assertOllamaModelAvailable = async (params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  role: ModelType;
}) => {
  const headers: HeadersInit = {};
  if (params.apiKey) {
    headers.Authorization = `Bearer ${params.apiKey}`;
  }

  const result = await fetchJson<{ models?: Array<{ name: string }> }>(
    `${params.baseUrl.replace(/\/+$/, "")}/api/tags`,
    { headers },
  );

  const availableModels = (result.models ?? []).map((item) => item.name);
  const isAvailable = availableModels.some(
    (name) =>
      name === params.model ||
      name === `${params.model}:latest` ||
      name.replace(/:latest$/, "") === params.model,
  );

  if (!isAvailable) {
    throw new Error(
      `Ollama ${params.role} 模型 "${params.model}" 当前未在 ${params.baseUrl} 可用。请先 pull 该模型，或在模型设置里重新选择一个已同步且已下载的模型。`,
    );
  }
};

export const providerProxyService = {
  normalizeMessages,

  createUiMessageStream,

  streamChat(
    requestedProvider: ProxyProviderParam,
    messages: NormalizedChatMessage[],
  ) {
    const resolved = resolveProviderForRole("llm", requestedProvider);

    return createUiMessageStream(() => {
      switch (getProviderDefinition(resolved.providerCode).chatAdapter) {
        case "ollama":
          return streamOllamaChat({
            baseUrl: resolved.baseUrl,
            apiKey: resolved.apiKey,
            model: resolved.model,
            messages,
            params: resolved.params,
          });
        case "openai-compatible":
          return streamOpenAICompatibleChat({
            baseUrl: resolved.baseUrl,
            apiKey: resolved.apiKey,
            model: resolved.model,
            messages,
            params: toOpenAICompatibleChatOptions(resolved.params),
          });
        default:
          throw new Error(`Unsupported provider "${resolved.providerCode}"`);
      }
    });
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

    return {
      providerCode: resolved.providerCode,
      model: resolved.model,
      modelConfigId: resolved.modelConfigId,
      embeddings,
      dimensions,
    };
  },
};
