import type {
  ContextBudgetPolicy,
  ContextBudgetPolicyName,
} from "./types.js";

const DEFAULT_MODEL_CONTEXT_TOKENS = 8192;

const MODEL_CONTEXT_WINDOWS: Array<{
  pattern: RegExp;
  tokens: number;
}> = [
  { pattern: /^qwen2\.5(?::|$)/i, tokens: 8192 },
  { pattern: /^gpt-4\.1/i, tokens: 128000 },
  { pattern: /^gpt-4o/i, tokens: 128000 },
  { pattern: /^gpt-5/i, tokens: 128000 },
];

export const resolveModelContextTokens = (model?: string): number => {
  const normalized = model?.trim();
  if (!normalized) {
    return DEFAULT_MODEL_CONTEXT_TOKENS;
  }

  return (
    MODEL_CONTEXT_WINDOWS.find((entry) => entry.pattern.test(normalized))
      ?.tokens ?? DEFAULT_MODEL_CONTEXT_TOKENS
  );
};

const resolveReservedOutputTokens = (
  params: Record<string, unknown> | undefined,
  fallback: number,
) =>
  typeof params?.maxTokens === "number" && params.maxTokens > 0
    ? Math.ceil(params.maxTokens)
    : fallback;

export const getContextBudgetPolicy = (input: {
  name: ContextBudgetPolicyName;
  model?: string;
  params?: Record<string, unknown>;
}): ContextBudgetPolicy => {
  const modelContextTokens = resolveModelContextTokens(input.model);

  if (input.name === "task-chat") {
    return {
      name: input.name,
      modelContextTokens,
      reservedOutputTokens: resolveReservedOutputTokens(input.params, 512),
      prefaceMaxTokens: 800,
      instructionMaxTokens: 800,
      payloadMaxTokens: 0,
      historyMaxTokens: 1200,
    };
  }

  if (input.name === "plain-chat") {
    return {
      name: input.name,
      modelContextTokens,
      reservedOutputTokens: resolveReservedOutputTokens(input.params, 1024),
      prefaceMaxTokens: 1200,
      instructionMaxTokens: 1200,
      payloadMaxTokens: 0,
      historyMaxTokens: 6000,
    };
  }

  if (input.name === "agent-generate") {
    const reservedOutputTokens = resolveReservedOutputTokens(input.params, 2048);
    const usableInputTokens = Math.max(
      modelContextTokens - reservedOutputTokens,
      0,
    );
    return {
      name: input.name,
      modelContextTokens,
      reservedOutputTokens,
      prefaceMaxTokens: Math.min(1600, Math.floor(usableInputTokens * 0.15)),
      instructionMaxTokens: Math.min(2400, Math.floor(usableInputTokens * 0.2)),
      payloadMaxTokens: Math.min(32_000, Math.floor(usableInputTokens * 0.5)),
      historyMaxTokens: Math.min(6000, Math.floor(usableInputTokens * 0.15)),
    };
  }

  return {
    name: input.name,
    modelContextTokens,
    reservedOutputTokens: resolveReservedOutputTokens(input.params, 1024),
    prefaceMaxTokens: 1200,
    instructionMaxTokens: 1200,
    payloadMaxTokens: 5000,
    historyMaxTokens: 2500,
  };
};
