import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { createAuditSection, createBaseAudit } from "./audit.js";
import { getContextBudgetPolicy } from "./policies.js";
import {
  estimateMessageTokens,
  estimateMessagesTokens,
  estimateTextTokens,
} from "./token-estimator.js";
import type {
  ContextBudgetPackInput,
  ContextBudgetPackResult,
  ContextBudgetPolicy,
  ContextBudgetPayload,
  PackedContextPayload,
} from "./types.js";

const TEXT_PART_OVERHEAD_TOKENS = 6;

const withTextPart = (message: NormalizedChatMessage): NormalizedChatMessage => ({
  ...message,
  parts:
    message.parts && message.parts.length > 0
      ? message.parts
      : [{ type: "text", text: message.content }],
});

const trimTextToTokenBudget = (text: string, tokenBudget: number) => {
  if (tokenBudget <= 0) {
    return "";
  }

  if (estimateTextTokens(text) <= tokenBudget) {
    return text;
  }

  const chars = Array.from(text);
  let low = 0;
  let high = chars.length;
  let best = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = chars.slice(0, mid).join("");
    if (estimateTextTokens(candidate) <= tokenBudget) {
      best = candidate;
      low = mid + 1;
      continue;
    }
    high = mid - 1;
  }

  return best.trimEnd();
};

const trimMessageContent = (
  message: NormalizedChatMessage,
  tokenBudget: number,
): NormalizedChatMessage | null => {
  const contentBudget = Math.max(tokenBudget - TEXT_PART_OVERHEAD_TOKENS, 0);
  const content = trimTextToTokenBudget(message.content, contentBudget);
  if (!content.trim()) {
    return null;
  }

  return withTextPart({
    role: message.role,
    content,
  });
};

const keepMessagesWithinBudget = (
  messages: NormalizedChatMessage[],
  tokenBudget: number,
  direction: "head" | "tail",
) => {
  if (tokenBudget <= 0 || messages.length === 0) {
    return [] as NormalizedChatMessage[];
  }

  const ordered = direction === "tail" ? [...messages].reverse() : messages;
  const kept: NormalizedChatMessage[] = [];
  let usedTokens = 0;

  for (const message of ordered) {
    const tokens = estimateMessageTokens(message);
    const remaining = tokenBudget - usedTokens;
    if (tokens <= remaining) {
      kept.push(message);
      usedTokens += tokens;
      continue;
    }

    const trimmed = trimMessageContent(message, remaining);
    if (trimmed) {
      kept.push(trimmed);
    }
    break;
  }

  return direction === "tail" ? kept.reverse() : kept;
};

const packPayloadMessages = <TMeta>(
  payloads: ContextBudgetPayload<TMeta>[] | undefined,
  budget: number,
) => {
  const packed: PackedContextPayload<TMeta>[] = [];
  if (!payloads?.length || budget <= 0) {
    return packed;
  }

  let usedTokens = 0;
  for (const payload of payloads) {
    const required = payload.required ?? false;
    const payloadTokens = estimateMessagesTokens(payload.messages);
    const remaining = budget - usedTokens;

    if (!required && remaining <= 0) {
      break;
    }

    if (payloadTokens <= remaining) {
      packed.push({
        id: payload.id,
        messages: payload.messages.map(withTextPart),
        ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
      });
      usedTokens += payloadTokens;
      continue;
    }

    const trimmedMessages = keepMessagesWithinBudget(
      payload.messages,
      Math.max(remaining, 0),
      "head",
    );
    if (trimmedMessages.length === 0 && !required) {
      break;
    }

    packed.push({
      id: payload.id,
      messages: trimmedMessages.map(withTextPart),
      ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
    });
    usedTokens += estimateMessagesTokens(trimmedMessages);
    break;
  }

  return packed;
};

const rebalanceForMaxInput = (input: {
  policy: ContextBudgetPolicy;
  prefaceMessages: NormalizedChatMessage[];
  instructionMessages: NormalizedChatMessage[];
  payloadMessages: NormalizedChatMessage[];
  historyMessages: NormalizedChatMessage[];
  latestUserMessage: NormalizedChatMessage;
}) => {
  const maxInputTokens = Math.max(
    input.policy.modelContextTokens - input.policy.reservedOutputTokens,
    0,
  );
  const fixedMessages = [
    ...input.prefaceMessages,
    ...input.instructionMessages,
    ...input.payloadMessages,
    input.latestUserMessage,
  ];
  const fixedTokens = estimateMessagesTokens(fixedMessages);
  const historyBudget = Math.max(maxInputTokens - fixedTokens, 0);

  return keepMessagesWithinBudget(
    input.historyMessages,
    Math.min(historyBudget, estimateMessagesTokens(input.historyMessages)),
    "tail",
  );
};

export const packContextBudget = <TMeta = unknown>(
  input: ContextBudgetPackInput,
): ContextBudgetPackResult => {
  const policy = getContextBudgetPolicy({
    name: input.policy,
    model: input.model,
    params: input.params,
  });
  const warnings: string[] = [];

  const latestUserMessage = withTextPart(input.sections.latestUserMessage);
  const beforePrefaceTokens = estimateMessagesTokens(
    input.sections.prefaceMessages ?? [],
  );
  const beforeInstructionTokens = estimateMessagesTokens(
    input.sections.instructionMessages ?? [],
  );
  const beforeHistoryTokens = estimateMessagesTokens(
    input.sections.historyMessages ?? [],
  );
  const beforePayloadTokens = estimateMessagesTokens(
    (input.sections.payloads ?? []).flatMap((payload) => payload.messages),
  );
  const beforeMessages = [
    ...(input.sections.prefaceMessages ?? []),
    ...(input.sections.instructionMessages ?? []),
    ...(input.sections.payloads ?? []).flatMap((payload) => payload.messages),
    ...(input.sections.historyMessages ?? []),
    latestUserMessage,
  ];

  const prefaceMessages = keepMessagesWithinBudget(
    input.sections.prefaceMessages ?? [],
    policy.prefaceMaxTokens,
    "head",
  );
  const instructionMessages = keepMessagesWithinBudget(
    input.sections.instructionMessages ?? [],
    policy.instructionMaxTokens,
    "head",
  );
  const payloads = packPayloadMessages(
    input.sections.payloads,
    policy.payloadMaxTokens,
  );
  const payloadMessages = payloads.flatMap((payload) => payload.messages);
  let historyMessages = keepMessagesWithinBudget(
    input.sections.historyMessages ?? [],
    policy.historyMaxTokens,
    "tail",
  );

  historyMessages = rebalanceForMaxInput({
    policy,
    prefaceMessages,
    instructionMessages,
    payloadMessages,
    historyMessages,
    latestUserMessage,
  });

  const afterPrefaceTokens = estimateMessagesTokens(prefaceMessages);
  const afterInstructionTokens = estimateMessagesTokens(instructionMessages);
  const afterHistoryTokens = estimateMessagesTokens(historyMessages);
  const afterPayloadTokens = estimateMessagesTokens(payloadMessages);

  const messages = [
    ...prefaceMessages,
    ...instructionMessages,
    ...payloadMessages,
    ...historyMessages,
    latestUserMessage,
  ];
  const totalAfter = estimateMessagesTokens(messages);
  const maxInputTokens = Math.max(
    policy.modelContextTokens - policy.reservedOutputTokens,
    0,
  );

  if (totalAfter > maxInputTokens) {
    warnings.push(
      `Packed context still exceeds input budget (${totalAfter}/${maxInputTokens}) because required messages are too large.`,
    );
  }

  const sections = [
    createAuditSection({
      name: "preface",
      beforeTokens: beforePrefaceTokens,
      afterTokens: afterPrefaceTokens,
      reason:
        afterPrefaceTokens < beforePrefaceTokens
          ? "preface exceeded section budget"
          : undefined,
    }),
    createAuditSection({
      name: "instructions",
      beforeTokens: beforeInstructionTokens,
      afterTokens: afterInstructionTokens,
      reason:
        afterInstructionTokens < beforeInstructionTokens
          ? "instruction payload exceeded section budget"
          : undefined,
    }),
    createAuditSection({
      name: "payload",
      beforeTokens: beforePayloadTokens,
      afterTokens: afterPayloadTokens,
      reason:
        afterPayloadTokens < beforePayloadTokens
          ? "payload section exceeded section budget"
          : undefined,
    }),
    createAuditSection({
      name: "history",
      beforeTokens: beforeHistoryTokens,
      afterTokens: afterHistoryTokens,
      reason:
        afterHistoryTokens < beforeHistoryTokens
          ? "history exceeded section or total input budget"
          : undefined,
    }),
    createAuditSection({
      name: "latestUser",
      beforeTokens: estimateMessageTokens(latestUserMessage),
      afterTokens: estimateMessageTokens(latestUserMessage),
    }),
  ];

  return {
    messages,
    payloads,
    audit: createBaseAudit({
      policy,
      policyName: input.policy,
      providerCode: input.providerCode,
      model: input.model,
      sections,
      warnings,
      totalEstimatedTokensBefore: estimateMessagesTokens(beforeMessages),
      totalEstimatedTokensAfter: totalAfter,
    }),
  };
};
