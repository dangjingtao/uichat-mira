import { Ollama } from "ollama";

import { getProviderDefinition } from "@/providers/catalog.js";
import { createOpenAICompatibleClient } from "@/services/openai-compatible-provider.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { assertOllamaModelAvailable, resolveAgentTaskProvider } from "./resolution.js";
import { toOllamaChatOptions, toOpenAICompatibleChatOptions } from "./params.js";

export type TaskStructuredOutputInput = {
  messages: NormalizedChatMessage[];
  schema: Record<string, unknown>;
  name: string;
  description?: string;
};

const parseStructuredJson = <T>(text: string): T => {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error("Structured task model returned an empty response.");
  }
  const parsed = JSON.parse(normalized) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Structured task model response must be one JSON object.");
  }
  return parsed as T;
};

const toTextOnlyMessages = (messages: NormalizedChatMessage[]) =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

const buildOpenAICompatibleStructuredRequest = (
  input: TaskStructuredOutputInput,
  stream: boolean,
) => {
  const resolved = resolveAgentTaskProvider("default");
  return {
    resolved,
    request: {
      ...toOpenAICompatibleChatOptions(resolved.params),
      model: resolved.model,
      messages: toTextOnlyMessages(input.messages),
      stream,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
          strict: true,
          schema: input.schema,
        },
      },
    },
  };
};

const generateOpenAICompatibleStructuredOutput = async <T>(
  input: TaskStructuredOutputInput,
) => {
  const { resolved, request } = buildOpenAICompatibleStructuredRequest(input, false);
  const client = createOpenAICompatibleClient(resolved.baseUrl, resolved.apiKey);
  const response = (await client.chat.completions.create(request as any)) as any;
  const content = response.choices?.[0]?.message?.content ?? "";
  return parseStructuredJson<T>(content);
};

const streamOpenAICompatibleStructuredOutputText = async function* (
  input: TaskStructuredOutputInput,
): AsyncGenerator<string> {
  const { resolved, request } = buildOpenAICompatibleStructuredRequest(input, true);
  const client = createOpenAICompatibleClient(resolved.baseUrl, resolved.apiKey);
  const response = (await client.chat.completions.create(request as any)) as any;
  let sawText = false;

  for await (const chunk of response) {
    const delta = chunk?.choices?.[0]?.delta?.content;
    if (typeof delta !== "string" || !delta) {
      continue;
    }
    sawText = true;
    yield delta;
  }

  if (!sawText) {
    throw new Error("Structured task model returned an empty streamed response.");
  }
};

const createOllamaClient = async () => {
  const resolved = resolveAgentTaskProvider("default");
  await assertOllamaModelAvailable({
    baseUrl: resolved.baseUrl,
    apiKey: resolved.apiKey,
    model: resolved.model,
    role: "llm",
  });

  const options: ConstructorParameters<typeof Ollama>[0] = {
    host: resolved.baseUrl || undefined,
  };
  if (resolved.apiKey) {
    options.headers = {
      Authorization: `Bearer ${resolved.apiKey}`,
    };
  }

  return {
    resolved,
    client: new Ollama(options),
  };
};

const generateOllamaStructuredOutput = async <T>(
  input: TaskStructuredOutputInput,
) => {
  const { resolved, client } = await createOllamaClient();
  const response = (await client.chat({
    model: resolved.model,
    messages: toTextOnlyMessages(input.messages),
    stream: false,
    format: input.schema,
    options: toOllamaChatOptions(resolved.params),
    ...(resolved.params.think !== undefined
      ? { think: resolved.params.think }
      : {}),
  } as any)) as any;

  return parseStructuredJson<T>(response.message?.content ?? "");
};

const streamOllamaStructuredOutputText = async function* (
  input: TaskStructuredOutputInput,
): AsyncGenerator<string> {
  const { resolved, client } = await createOllamaClient();
  const response = (await client.chat({
    model: resolved.model,
    messages: toTextOnlyMessages(input.messages),
    stream: true,
    format: input.schema,
    options: toOllamaChatOptions(resolved.params),
    ...(resolved.params.think !== undefined
      ? { think: resolved.params.think }
      : {}),
  } as any)) as any;
  let sawText = false;

  for await (const chunk of response) {
    const delta = chunk?.message?.content;
    if (typeof delta !== "string" || !delta) {
      continue;
    }
    sawText = true;
    yield delta;
  }

  if (!sawText) {
    throw new Error("Structured task model returned an empty streamed response.");
  }
};

/**
 * Uses the provider's native schema-constrained response mechanism and exposes
 * text deltas as they arrive. Planner can surface the public `reason` field as
 * live narration while still waiting for the complete decision object before
 * validation/execution.
 */
export const streamTaskStructuredOutputText = (
  input: TaskStructuredOutputInput,
): AsyncGenerator<string> => {
  const resolved = resolveAgentTaskProvider("default");
  const adapter = getProviderDefinition(resolved.providerCode).chatAdapter;

  switch (adapter) {
    case "openai-compatible":
      return streamOpenAICompatibleStructuredOutputText(input);
    case "ollama":
      return streamOllamaStructuredOutputText(input);
    default:
      throw new Error(
        `Task provider ${resolved.providerCode} does not expose native structured output streaming through Mira's current adapter.`,
      );
  }
};

/**
 * Non-streaming native structured output remains available for callers that
 * need the parsed object directly.
 */
export const generateTaskStructuredOutput = async <T>(
  input: TaskStructuredOutputInput,
): Promise<T> => {
  const resolved = resolveAgentTaskProvider("default");
  const adapter = getProviderDefinition(resolved.providerCode).chatAdapter;

  switch (adapter) {
    case "openai-compatible":
      return await generateOpenAICompatibleStructuredOutput<T>(input);
    case "ollama":
      return await generateOllamaStructuredOutput<T>(input);
    default:
      throw new Error(
        `Task provider ${resolved.providerCode} does not expose native structured output through Mira's current adapter.`,
      );
  }
};
