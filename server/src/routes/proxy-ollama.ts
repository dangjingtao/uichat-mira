import { Readable } from "node:stream";
import { Ollama } from "ollama";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import {
  modelConfigRepository,
  providerConnectionRepository,
} from "@/db/repositories";
import { decryptSecret } from "@/utils/crypto.js";
import { error, ErrorCodes, handleValidationError } from "@/utils/index.js";

interface UIMessagePart {
  type?: string;
  text?: string;
}

interface UIMessage {
  role?: "system" | "user" | "assistant";
  parts?: UIMessagePart[];
}

interface ChatBody {
  messages: UIMessage[];
}

type NormalizedChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAICompatibleChatChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

const parseModelParams = (paramsJson: string) => {
  try {
    const parsed = JSON.parse(paramsJson || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeOpenAICompatibleBaseUrl = (baseUrl: string) => {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/v1")) {
    return normalized;
  }
  return `${normalized}/v1`;
};

const toSseChunk = (data: Record<string, unknown>) =>
  `data: ${JSON.stringify(data)}\n\n`;

const createErrorResponse = (reply: FastifyReply, message: string) =>
  reply.code(400).send(error(message, ErrorCodes.VALIDATION_ERROR));

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

const toOllamaOptions = (params: Record<string, unknown>) => {
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

const toOpenAICompatibleOptions = (params: Record<string, unknown>) => {
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
    options: toOllamaOptions(params),
  });

  for await (const chunk of response) {
    const delta = chunk.message?.content ?? "";
    if (delta) {
      yield delta;
    }
  }
};

const streamOpenAICompatibleChat = async function* ({
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
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(
    `${normalizeOpenAICompatibleBaseUrl(baseUrl)}/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        ...toOpenAICompatibleOptions(params),
      }),
    },
  );

  if (!response.ok || !response.body) {
    const message = (await response.text()) || "Provider request failed";
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) {
        continue;
      }

      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") {
        continue;
      }

      const chunk = JSON.parse(data) as OpenAICompatibleChatChunk;
      const delta = chunk.choices?.[0]?.delta?.content ?? "";

      if (delta) {
        yield delta;
      }
    }

    if (done) {
      if (buffer.trim().startsWith("data:")) {
        const data = buffer.trim().slice(5).trim();
        if (data && data !== "[DONE]") {
          const chunk = JSON.parse(data) as OpenAICompatibleChatChunk;
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            yield delta;
          }
        }
      }
      break;
    }
  }
};

const proxyOllamaRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: ChatBody }>(
    "/proxy/ollama/chat",
    {
      attachValidation: true,
      schema: {
        tags: ["Proxy Ollama"],
        summary: "Proxy chat request to configured LLM provider",
        description:
          "Stream chat completion through the configured LLM provider (Ollama, LM Studio, or OpenAI compatible). The backend resolves the current active LLM role config and proxy request body to the provider's chat endpoint, streaming SSE back to the client.",
        operationId: "proxyOllamaChat",
        body: {
          type: "object",
          required: ["messages"],
          properties: {
            messages: {
              type: "array",
              items: {
                type: "object",
                required: ["role", "parts"],
                properties: {
                  role: {
                    type: "string",
                    enum: ["system", "user", "assistant"],
                  },
                  parts: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: true,
                    },
                  },
                },
              },
            },
          },
        },
        response: {
          200: {
            description: "Server-Sent Events stream delivering chat chunks",
            type: "string",
          },
          400: {
            type: "object",
            required: ["success", "message", "timestamp"],
            properties: {
              success: { type: "boolean", const: false },
              message: { type: "string" },
              code: { type: "string" },
              errors: { type: "array", items: {} },
              timestamp: { type: "string", format: "date-time" },
            },
          },
          500: {
            type: "object",
            required: ["success", "message", "timestamp"],
            properties: {
              success: { type: "boolean", const: false },
              message: { type: "string" },
              code: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const validationResponse = handleValidationError(request, reply);
      if (validationResponse) {
        return validationResponse;
      }

      try {
        const payload = request.body;
        const messages = normalizeMessages(payload.messages);

        if (messages.length === 0) {
          return createErrorResponse(reply, "No valid chat messages provided");
        }

        const modelConfig = modelConfigRepository.findDefaultByType("llm");
        if (!modelConfig) {
          return createErrorResponse(reply, "No LLM model configured");
        }

        if (!modelConfig.providerCode || !modelConfig.remoteModelId) {
          return createErrorResponse(
            reply,
            "LLM model has no provider or remote model assigned",
          );
        }

        const provider = providerConnectionRepository.findByCode(
          modelConfig.providerCode,
        );
        if (!provider) {
          return createErrorResponse(
            reply,
            `Provider "${modelConfig.providerCode}" not found`,
          );
        }

        const apiKey = decryptSecret(provider.apiKeyEncrypted);
        const modelParams = parseModelParams(modelConfig.params);
        const providerCode = modelConfig.providerCode;
        const remoteModelId = modelConfig.remoteModelId;

        const streamText = () => {
          switch (providerCode) {
            case "ollama":
              return streamOllamaChat({
                baseUrl: provider.baseUrl ?? "",
                apiKey,
                model: remoteModelId,
                messages,
                params: modelParams,
              });
            case "lmstudio":
            case "openai":
              return streamOpenAICompatibleChat({
                baseUrl: provider.baseUrl ?? "",
                apiKey,
                model: remoteModelId,
                messages,
                params: modelParams,
              });
            default:
              throw new Error(`Unsupported provider "${providerCode}"`);
          }
        };

        reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
        reply.raw.setHeader("Connection", "keep-alive");
        reply.type("text/event-stream; charset=utf-8");

        return reply.send(createUiMessageStream(streamText));
      } catch (err) {
        app.log.error({ err }, "[proxy-ollama] chat failed");
        const message = err instanceof Error ? err.message : "Unknown error";
        return reply.code(500).send(error(message, ErrorCodes.INTERNAL_ERROR));
      }
    },
  );
};

export default proxyOllamaRoute;
