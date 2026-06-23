export const parseModelParams = (paramsJson: string) => {
  try {
    const parsed = JSON.parse(paramsJson || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const toOllamaChatOptions = (params: Record<string, unknown>) => {
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

export const toOpenAICompatibleChatOptions = (
  params: Record<string, unknown>,
) => {
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
  if (typeof params.reasoning_effort === "string") {
    options.reasoning_effort = params.reasoning_effort;
  }
  if (typeof params.thinking === "boolean") {
    options.thinking = params.thinking;
  }

  return options;
};

export const toEmbeddingOptions = (params: Record<string, unknown>) => {
  const options: Record<string, unknown> = {};

  if (typeof params.truncate === "boolean") {
    options.truncate = params.truncate;
  }
  if (typeof params.dimensions === "number") {
    options.dimensions = params.dimensions;
  }

  return options;
};
