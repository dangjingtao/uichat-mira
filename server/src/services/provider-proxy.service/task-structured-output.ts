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

const generateOpenAICompatibleStructuredOutput = async <T>(
  input: TaskStructuredOutputInput,
) => {
  const resolved = resolveAgentTaskProvider("default");
  const client = createOpenAICompatibleClient(resolved.baseUrl, resolved.apiKey);
  const params = toOpenAICompatibleChatOptions(resolved.params);
  const response = (await client.chat.completions.create({
    ...params,
    model: resolved.model,
    messages: toTextOnlyMessages(input.messages),
    stream: false,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        strict: true,
        schema: input.schema,
      },
    },
  } as any)) as any;

  const content = response.choices?.[0]?.message?.content ?? "";
  return parseStructuredJson<T>(content);
};

const generateOllamaStructuredOutput = async <T>(
  input: TaskStructuredOutputInput,
) => {
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

  const client = new Ollama(options);
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

/**
 * Uses the provider's native schema-constrained response mechanism. This is
 * intentionally a non-streaming call because Planner decisions are small and
 * must be validated as one complete object before execution can continue.
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
