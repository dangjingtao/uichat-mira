import { Ollama, type Message as OllamaMessage } from "ollama";
import {
  modelConfigRepository,
  providerConnectionRepository,
  providerModelRepository,
} from "@/db/repositories";
import type { ModelType, ProviderCode } from "@/db/schema.js";
import { createCloudflareEmbeddings } from "@/services/cloudflare-provider.js";
import {
  type OpenAICompatibleContentPart,
  createOpenAICompatibleChatUrl,
  createOpenAICompatibleRerankUrl,
  createOpenAICompatibleEmbeddingsUrl,
  createOpenAICompatibleEmbeddings,
  type OpenAICompatibleChatMessage,
  streamOpenAICompatibleChat,
} from "@/services/openai-compatible-provider.js";
import { decryptSecret } from "@/utils/crypto.js";
import { getErrorMessage } from "@/utils/errors.js";
import { fetchJsonWithTimeout } from "@/utils/http.js";
import {
  getProviderDefinition,
  isCallableModelId,
} from "@/providers/catalog.js";
import { createAssistantTextStream } from "@/services/assistant-stream-events.js";
import { attachmentStorageService } from "@/services/attachment-storage.service.js";
import { isCloudflareBaseUrl } from "@/services/cloudflare-provider.js";

export interface UIMessagePart {
  type?: string;
  text?: string;
  image?: string;
  data?: string;
  url?: string;
  filename?: string;
  mimeType?: string;
  mediaType?: string;
}

export interface UIMessage {
  id?: string;
  role?: "system" | "user" | "assistant";
  parts?: UIMessagePart[];
}

export type NormalizedChatMessagePart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      url: string;
      filename?: string;
      mediaType?: string;
    }
  | {
      type: "file";
      url: string;
      filename?: string;
      mediaType?: string;
    };

export type NormalizedChatMessage = {
  id?: string;
  role: "system" | "user" | "assistant";
  content: string;
  parts?: NormalizedChatMessagePart[];
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

export interface RerankResolution {
  providerCode: ProviderCode;
  baseUrl: string;
  apiKey: string;
  model: string;
  modelConfigId: string;
  params: Record<string, unknown>;
  endpoint: string;
}

export interface ProviderInvocationMetadata {
  providerCode: ProviderCode;
  providerLabel: string;
  protocol: string;
  operation: string;
  endpoint: string;
  model: string;
  modelConfigId: string;
  params: Record<string, unknown>;
  request: {
    method: "POST";
    url: string;
    body: Record<string, unknown>;
  };
}

export interface ExplicitProviderSelectionInput {
  providerCode: ProviderCode;
  remoteModelId: string;
  messages: NormalizedChatMessage[];
  params?: Record<string, unknown>;
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

const parseModelParams = (paramsJson: string) => {
  try {
    const parsed = JSON.parse(paramsJson || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

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

const toOllamaImage = (url: string) => {
  const dataUrlMatch = url.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (dataUrlMatch?.[1]) {
    return dataUrlMatch[1];
  }

  return url;
};

const resolveImageUrlForProvider = async (url: string) =>
  attachmentStorageService.isInternalAttachmentUrl(url)
    ? attachmentStorageService.resolveToDataUrl(url)
    : url;

const resolveImageUrlForOllama = async (url: string) =>
  toOllamaImage(await resolveImageUrlForProvider(url));

const normalizePartText = (part: UIMessagePart) => {
  if (part?.type === "text" && typeof part.text === "string") {
    return part.text.trim();
  }

  if (part?.type === "image") {
    return part.filename
      ? `[Image attachment: ${part.filename}]`
      : "[Image attachment]";
  }

  if (part?.type === "file") {
    const isImage =
      typeof part.mediaType === "string" &&
      part.mediaType.startsWith("image/");

    if (isImage) {
      return part.filename
        ? `[Image attachment: ${part.filename}]`
        : "[Image attachment]";
    }

    return part.filename
      ? `[File attachment: ${part.filename}]`
      : "[File attachment]";
  }

  return "";
};

const normalizePart = (
  part: UIMessagePart,
): NormalizedChatMessagePart | null => {
  if (part?.type === "text" && typeof part.text === "string") {
    const text = part.text.trim();
    return text ? { type: "text", text } : null;
  }

  if (part?.type === "image") {
    const url =
      typeof part.image === "string"
        ? part.image
        : typeof part.url === "string"
          ? part.url
          : typeof part.data === "string"
            ? part.data
            : "";

    if (!url) {
      return null;
    }

    return {
      type: "image",
      url,
      ...(part.filename ? { filename: part.filename } : {}),
      ...(part.mediaType || part.mimeType
        ? { mediaType: part.mediaType || part.mimeType }
        : {}),
    };
  }

  if (part?.type === "file") {
    const url =
      typeof part.url === "string"
        ? part.url
        : typeof part.data === "string"
          ? part.data
          : "";

    if (!url) {
      return null;
    }

    const mediaType = part.mediaType || part.mimeType;
    if (mediaType?.startsWith("image/")) {
      return {
        type: "image",
        url,
        ...(part.filename ? { filename: part.filename } : {}),
        ...(mediaType ? { mediaType } : {}),
      };
    }

    return {
      type: "file",
      url,
      ...(part.filename ? { filename: part.filename } : {}),
      ...(mediaType ? { mediaType } : {}),
    };
  }

  return null;
};

const normalizeMessages = (messages: UIMessage[]): NormalizedChatMessage[] =>
  messages.reduce<NormalizedChatMessage[]>((result, message) => {
      if (!message.role || !Array.isArray(message.parts)) {
        return result;
      }

      const parts = message.parts
        .map((part) => normalizePart(part))
        .filter((part): part is NormalizedChatMessagePart => Boolean(part));

      const content = parts
        .map((part) =>
          part.type === "text"
            ? part.text
            : part.type === "image"
              ? part.filename
                ? `[Image attachment: ${part.filename}]`
                : "[Image attachment]"
              : part.filename
                ? `[File attachment: ${part.filename}]`
                : "[File attachment]",
        )
        .filter(Boolean)
        .join("\n");

      if (!content || parts.length === 0) {
        return result;
      }

      result.push({
        ...(typeof message.id === "string" ? { id: message.id } : {}),
        role: message.role,
        content,
        parts,
      });

      return result;
    }, []);

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

const assertProviderConnectionConfigured = (input: {
  providerCode: ProviderCode;
  baseUrl: string;
  apiKey: string;
  roleType: ModelType;
}) => {
  const providerLabel = getProviderDefinition(input.providerCode).displayName;
  const normalizedBaseUrl = input.baseUrl.trim();
  const normalizedApiKey = input.apiKey.trim();

  if (!normalizedBaseUrl) {
    throw new Error(
      `${providerLabel} ${input.roleType.toUpperCase()} provider base URL 未配置。请先在提供商设置中完成配置。`,
    );
  }

  if (input.providerCode === "cloudflare") {
    if (
      normalizedBaseUrl.includes("<ACCOUNT_ID>") ||
      normalizedBaseUrl.includes("[ACCOUNT_ID]")
    ) {
      throw new Error(
        'Cloudflare base URL 仍是占位符。请改成真实账号地址，例如 "https://api.cloudflare.com/client/v4/accounts/<你的 ACCOUNT_ID>/ai/v1"。',
      );
    }

    if (!isCloudflareBaseUrl(normalizedBaseUrl)) {
      throw new Error(
        'Cloudflare base URL 格式不正确。请使用 "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1"。',
      );
    }
  }

  if (
    (input.providerCode === "cloudflare" || input.providerCode === "openai") &&
    !normalizedApiKey
  ) {
    throw new Error(
      `${providerLabel} API Key 未配置。请先在提供商设置中填写有效的 API Key。`,
    );
  }
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

  const decryptedApiKey = decryptSecret(provider.apiKeyEncrypted);
  assertProviderConnectionConfigured({
    providerCode,
    baseUrl: provider.baseUrl ?? "",
    apiKey: decryptedApiKey,
    roleType,
  });

  return {
    providerCode,
    baseUrl: provider.baseUrl ?? "",
    apiKey: decryptedApiKey,
    model: resolveProviderModelIdentifier(roleType, providerCode, modelConfig),
    modelConfigId: modelConfig.id,
    params: parseModelParams(modelConfig.params),
  };
};

const resolveExplicitProviderSelection = (
  providerCode: ProviderCode,
  remoteModelId: string,
  params: Record<string, unknown> = {},
): ProviderResolution => {
  const provider = providerConnectionRepository.findByCode(providerCode);
  if (!provider) {
    throw new Error(`Provider "${providerCode}" not found`);
  }

  if (!provider.isEnabled) {
    throw new Error(`Provider "${providerCode}" is disabled`);
  }

  const decryptedApiKey = decryptSecret(provider.apiKeyEncrypted);
  assertProviderConnectionConfigured({
    providerCode,
    baseUrl: provider.baseUrl ?? "",
    apiKey: decryptedApiKey,
    roleType: "evaluation",
  });

  const model = remoteModelId.trim();
  if (!model) {
    throw new Error("Evaluation model is required");
  }

  return {
    providerCode,
    baseUrl: provider.baseUrl ?? "",
    apiKey: decryptedApiKey,
    model,
    modelConfigId: `manual:${providerCode}:${model}`,
    params,
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
  const ollamaMessages: OllamaMessage[] = [];

  for (const message of messages) {
    const textParts = (message.parts ?? [])
      .filter((part) => part.type === "text")
      .map((part) => part.text);
    const imageParts: string[] = [];

    for (const part of message.parts ?? []) {
      if (part.type === "image") {
        imageParts.push(await resolveImageUrlForOllama(part.url));
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
    model,
    messages: ollamaMessages,
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
  createAssistantTextStream(streamText, {
    includeStartStep: true,
    getErrorMessage,
  });

const trimHistoricalAttachments = (
  messages: NormalizedChatMessage[],
): NormalizedChatMessage[] => {
  const latestUserIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find((entry) => entry.message.role === "user")?.index;

  if (latestUserIndex === undefined) {
    return messages;
  }

  return messages.map((message, index) => {
    if (index === latestUserIndex) {
      return message;
    }

    if (!message.parts?.some((part) => part.type !== "text")) {
      return message;
    }

    return {
      ...message,
      parts: message.parts.filter((part) => part.type === "text"),
    };
  });
};

const streamResolvedChat = async function* (
  resolved: ProviderResolution,
  messages: NormalizedChatMessage[],
) {
  const preparedMessages = trimHistoricalAttachments(messages);

  switch (getProviderDefinition(resolved.providerCode).chatAdapter) {
    case "ollama":
      yield* streamOllamaChat({
        baseUrl: resolved.baseUrl,
        apiKey: resolved.apiKey,
        model: resolved.model,
        messages: preparedMessages,
        params: resolved.params,
      });
      return;
    case "openai-compatible":
      const openAiMessages: OpenAICompatibleChatMessage[] = [];

      for (const message of preparedMessages) {
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
                url: await resolveImageUrlForProvider(part.url),
              },
            });
            continue;
          }

          multimodalParts.push({
            type: "text",
            text: part.filename
              ? `[File attachment: ${part.filename}]`
              : "[File attachment]",
          });
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
      return;
    default:
      throw new Error(`Unsupported provider "${resolved.providerCode}"`);
  }
};

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
        messageCount: messages.length,
        params:
          protocol === "ollama"
            ? toOllamaChatOptions(resolved.params)
            : toOpenAICompatibleChatOptions(resolved.params),
      },
    },
  };
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

  const result = await fetchJsonWithTimeout<{ models?: Array<{ name: string }> }>(
    `${params.baseUrl.replace(/\/+$/, "")}/api/tags`,
    { headers },
    10_000,
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

  streamChatText(
    requestedProvider: ProxyProviderParam,
    messages: NormalizedChatMessage[],
  ) {
    const resolved = resolveProviderForRole("llm", requestedProvider);

    return streamResolvedChat(resolved, messages);
  },

  streamChat(
    requestedProvider: ProxyProviderParam,
    messages: NormalizedChatMessage[],
  ) {
    return createUiMessageStream(() =>
      this.streamChatText(requestedProvider, messages),
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
    return createChatInvocationMetadata(resolved, messages, "chat");
  },

  describeTaskChatInvocation(
    messages: NormalizedChatMessage[],
  ): ProviderInvocationMetadata {
    const resolved = resolveProviderForRole("task", "default");
    return createChatInvocationMetadata(resolved, messages, "task-chat");
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
