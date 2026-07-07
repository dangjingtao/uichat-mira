import OpenAI from "openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  embedMany,
  streamText,
  type ModelMessage,
} from "ai";
import fetch from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";
import { generalSettingsRepository } from "@/db/repositories/general-settings.repository.js";
import {
  isCloudflareBaseUrl,
  normalizeCloudflareOpenAICompatibleBaseUrl,
} from "@/services/cloudflare-provider.js";

export type OpenAICompatibleContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: {
        url: string;
      };
    };

export interface OpenAICompatibleChatMessage {
  role: "system" | "user" | "assistant";
  content: string | OpenAICompatibleContentPart[];
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue | undefined };
type JsonObject = { [key: string]: JsonValue | undefined };

type OpenAICompatibleProviderOptions = {
  "openai-compatible"?: {
    reasoningEffort?: string;
    dimensions?: number;
  } & JsonObject;
};

type StoredProxySettings = {
  socks5Host: string;
  socks5Port: number;
  socks5Username: string;
  socks5Password: string;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const GOOGLE_OPENAI_COMPATIBLE_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai";
const VOLCENGINE_ARK_PLAN_PATH_PATTERN = /^\/api\/plan\/(v\d+)$/i;

const isGoogleGenerativeLanguageBaseUrl = (baseUrl: string) => {
  const normalized = trimTrailingSlash(baseUrl.trim()).toLowerCase();
  return (
    normalized === "https://generativelanguage.googleapis.com" ||
    normalized === "https://generativelanguage.googleapis.com/v1beta"
  );
};

const getStoredProxySettings = (): StoredProxySettings => {
  try {
    return generalSettingsRepository.get();
  } catch {
    return {
      socks5Host: "",
      socks5Port: 0,
      socks5Username: "",
      socks5Password: "",
    };
  }
};

export const buildSocks5ProxyUrl = (settings: StoredProxySettings) => {
  const host = settings.socks5Host.trim();
  const port = Number.isInteger(settings.socks5Port) ? settings.socks5Port : 0;

  if (!host || port <= 0) {
    return null;
  }

  const username = settings.socks5Username.trim();
  const password = settings.socks5Password.trim();
  const auth =
    username || password
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : "";

  return `socks5://${auth}${host}:${port}`;
};

const resolveVolcengineArkCodingBaseUrl = (baseUrl: string) => {
  const normalized = trimTrailingSlash(baseUrl.trim());

  try {
    const url = new URL(normalized);
    const match = url.pathname.match(VOLCENGINE_ARK_PLAN_PATH_PATTERN);
    if (!match) {
      return null;
    }

    if (!/^ark\..+\.volces\.com$/i.test(url.hostname)) {
      return null;
    }

    return `${url.origin}/api/coding/${match[1]}`;
  } catch {
    return null;
  }
};

const toWebResponse = async (response: Awaited<ReturnType<typeof fetch>>) => {
  const arrayBuffer = await response.arrayBuffer();
  return new Response(arrayBuffer, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers as unknown as HeadersInit,
  });
};

export const createProxyAwareFetch = (): typeof globalThis.fetch => {
  const proxyUrl = buildSocks5ProxyUrl(getStoredProxySettings());
  if (!proxyUrl) {
    return globalThis.fetch.bind(globalThis);
  }

  const agent = new SocksProxyAgent(proxyUrl);

  return (async (input, init) => {
    const response = await fetch(input as Parameters<typeof fetch>[0], {
      ...(init as Parameters<typeof fetch>[1]),
      agent,
    });

    return toWebResponse(response);
  }) as typeof globalThis.fetch;
};

export const normalizeOpenAICompatibleBaseUrl = (baseUrl: string) => {
  if (isCloudflareBaseUrl(baseUrl)) {
    return normalizeCloudflareOpenAICompatibleBaseUrl(baseUrl);
  }

  if (isGoogleGenerativeLanguageBaseUrl(baseUrl)) {
    return GOOGLE_OPENAI_COMPATIBLE_BASE_URL;
  }

  const normalized = trimTrailingSlash(baseUrl.trim());
  if (
    normalized.match(/\/v\d+$/) ||
    normalized.match(/\/v\d+beta\/openai$/i) ||
    normalized.endsWith("/openai")
  ) {
    return normalized;
  }
  return `${normalized}/v1`;
};

const createOpenAICompatibleProvider = (baseUrl: string, apiKey: string) =>
  createOpenAICompatible({
    baseURL: normalizeOpenAICompatibleBaseUrl(baseUrl),
    name: "openai-compatible",
    apiKey: apiKey.trim() || "not-needed",
    fetch: createProxyAwareFetch(),
  });

export const createOpenAICompatibleClient = (baseUrl: string, apiKey: string) =>
  new OpenAI({
    baseURL: normalizeOpenAICompatibleBaseUrl(baseUrl),
    apiKey: apiKey.trim() || "not-needed",
    fetch: createProxyAwareFetch(),
  });

export const createOpenAICompatibleChatUrl = (baseUrl: string) =>
  `${normalizeOpenAICompatibleBaseUrl(baseUrl)}/chat/completions`;

export const createOpenAICompatibleEmbeddingsUrl = (baseUrl: string) =>
  `${normalizeOpenAICompatibleBaseUrl(baseUrl)}/embeddings`;

export const createOpenAICompatibleModelsUrl = (baseUrl: string) => {
  const volcengineCodingBaseUrl = resolveVolcengineArkCodingBaseUrl(baseUrl);
  if (volcengineCodingBaseUrl) {
    return `${volcengineCodingBaseUrl}/models`;
  }

  return `${normalizeOpenAICompatibleBaseUrl(baseUrl)}/models`;
};

const toModelMessages = (
  messages: OpenAICompatibleChatMessage[],
): ModelMessage[] =>
  messages.map((message): ModelMessage => {
    if (message.role === "system") {
      return {
        role: "system",
        content:
          typeof message.content === "string"
            ? message.content
            : message.content
                .filter((part): part is Extract<OpenAICompatibleContentPart, { type: "text" }> => part.type === "text")
                .map((part) => part.text)
                .join("\n"),
      };
    }

    if (message.role === "user") {
      if (typeof message.content === "string") {
        return {
          role: "user",
          content: message.content,
        };
      }

      return {
        role: "user",
        content: message.content.map((part) =>
          part.type === "text"
            ? { type: "text" as const, text: part.text }
            : {
                type: "image" as const,
                image: part.image_url.url,
              },
        ),
      };
    }

    if (typeof message.content === "string") {
      return {
        role: "assistant",
        content: message.content,
      };
    }

    return {
      role: "assistant",
      content: message.content
        .filter(
          (
            part,
          ): part is Extract<OpenAICompatibleContentPart, { type: "text" }> =>
            part.type === "text",
        )
        .map((part) => ({
          type: "text" as const,
          text: part.text,
        })),
    };
  });

const toAiSdkChatSettings = (
  params: Record<string, unknown>,
): {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  providerOptions?: OpenAICompatibleProviderOptions;
} => {
  const providerOptions: NonNullable<
    OpenAICompatibleProviderOptions["openai-compatible"]
  > = {};

  if (typeof params.reasoning_effort === "string") {
    providerOptions.reasoningEffort = params.reasoning_effort;
  }

  return {
    ...(typeof params.temperature === "number"
      ? { temperature: params.temperature }
      : {}),
    ...(typeof params.topP === "number" ? { topP: params.topP } : {}),
    ...(typeof params.maxTokens === "number"
      ? { maxTokens: params.maxTokens }
      : {}),
    ...(typeof params.frequencyPenalty === "number"
      ? { frequencyPenalty: params.frequencyPenalty }
      : {}),
    ...(typeof params.presencePenalty === "number"
      ? { presencePenalty: params.presencePenalty }
      : {}),
    ...(Array.isArray(params.stop) ? { stopSequences: params.stop as string[] } : {}),
    ...(Object.keys(providerOptions).length > 0
      ? {
          providerOptions: {
            "openai-compatible": providerOptions,
          },
        }
      : {}),
  };
};

const toAiSdkEmbeddingOptions = (
  params: Record<string, unknown>,
): { providerOptions?: OpenAICompatibleProviderOptions } => {
  const providerOptions: NonNullable<
    OpenAICompatibleProviderOptions["openai-compatible"]
  > = {};

  if (typeof params.dimensions === "number") {
    providerOptions.dimensions = params.dimensions;
  }

  return Object.keys(providerOptions).length > 0
    ? {
        providerOptions: {
          "openai-compatible": providerOptions,
        },
      }
    : {};
};

const getAuthHeaders = (apiKey: string): Record<string, string> => {
  const trimmedApiKey = apiKey.trim();
  if (!trimmedApiKey) {
    return {};
  }

  return {
    Authorization: `Bearer ${trimmedApiKey}`,
  };
};

export const listOpenAICompatibleModels = async (
  baseUrl: string,
  apiKey: string,
) => {
  const response = await createProxyAwareFetch()(createOpenAICompatibleModelsUrl(baseUrl), {
    method: "GET",
    headers: getAuthHeaders(apiKey),
  });

  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ id?: string }>;
  };

  return (payload.data ?? [])
    .filter((model): model is { id: string } => typeof model.id === "string")
    .map((model) => ({
      id: model.id,
      name: model.id,
      raw: model,
    }));
};

export const streamOpenAICompatibleChat = async function* ({
  baseUrl,
  apiKey,
  model,
  messages,
  params,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: OpenAICompatibleChatMessage[];
  params: Record<string, unknown>;
}) {
  const provider = createOpenAICompatibleProvider(baseUrl, apiKey);
  const result = streamText({
    model: provider.chatModel(model),
    messages: toModelMessages(messages),
    ...toAiSdkChatSettings(params),
  });

  for await (const delta of result.textStream) {
    if (delta) {
      yield delta;
    }
  }
};

export const createOpenAICompatibleEmbeddings = async ({
  baseUrl,
  apiKey,
  model,
  input,
  params,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  input: string[];
  params: Record<string, unknown>;
}) => {
  const provider = createOpenAICompatibleProvider(baseUrl, apiKey);
  const result = await embedMany({
    model: provider.embeddingModel(model),
    values: input,
    ...toAiSdkEmbeddingOptions(params),
  });

  return result.embeddings.filter((embedding) => embedding.length > 0);
};

export const createOpenAICompatibleRerankUrl = (baseUrl: string) =>
  `${normalizeOpenAICompatibleBaseUrl(baseUrl)}/rerank`;
