import OpenAI from "openai";

export interface OpenAICompatibleChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const normalizeOpenAICompatibleBaseUrl = (baseUrl: string) => {
  const normalized = trimTrailingSlash(baseUrl.trim());
  if (normalized.match(/\/v\d+$/)) {
    return normalized;
  }
  return `${normalized}/v1`;
};

export const createOpenAICompatibleClient = (baseUrl: string, apiKey: string) =>
  new OpenAI({
    baseURL: normalizeOpenAICompatibleBaseUrl(baseUrl),
    apiKey: apiKey.trim() || "not-needed",
  });

export const listOpenAICompatibleModels = async (
  baseUrl: string,
  apiKey: string,
) => {
  const client = createOpenAICompatibleClient(baseUrl, apiKey);
  const response = await client.models.list();

  return response.data.map((model) => ({
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
  const client = createOpenAICompatibleClient(baseUrl, apiKey);
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
    ...params,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
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
  const client = createOpenAICompatibleClient(baseUrl, apiKey);
  const response = await client.embeddings.create({
    model,
    input,
    ...params,
  });

  return response.data
    .map((item) => item.embedding ?? [])
    .filter((embedding) => embedding.length > 0);
};
