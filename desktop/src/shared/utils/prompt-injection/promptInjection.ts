import type { ChatMessage, ChatMessagePart, ChatRole } from "@/shared/uchat/core/types";

export type PromptInjectionPosition = "before-history" | "in-history";

export type PromptTemplateVariables = Record<string, unknown>;

export type PromptRenderPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      source: string;
      mimeType?: string;
      name?: string;
      assetId?: string;
    }
  | {
      type: "file";
      source: string;
      mimeType: string;
      name: string;
      assetId?: string;
    }
  | {
      type: "data";
      name: string;
      value: unknown;
    };

export interface PromptInjectionMessage {
  id?: string;
  role: ChatRole;
  parts: ChatMessagePart[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export type PromptInjectionMessageOrigin = "prompt" | "injection" | "history";

export interface PromptInjectionEntry {
  identifier: string;
  enabled?: boolean;
  role?: ChatRole;
  position?: PromptInjectionPosition;
  depth?: number;
  order?: number;
  triggers?: readonly string[];
  parts: readonly PromptRenderPart[];
  metadata?: Record<string, unknown>;
}

export interface PromptBuildContext {
  history: readonly ChatMessage[];
  generationType?: string;
  latestUserMessage?: ChatMessage | null;
  variables?: PromptTemplateVariables;
  budget?: PromptBudgetOptions;
  extensions?: readonly PromptInjectionExtension[];
}

export interface PromptBudgetOptions {
  maxContextTokens: number;
  reserveResponseTokens?: number;
  estimateTokens?: (message: PromptInjectionMessage) => number;
}

export interface PromptBuildResult {
  messages: PromptInjectionMessage[];
  tokenEstimate: number;
  debug: Array<{
    identifier: string;
    origin: PromptInjectionMessageOrigin;
    role: ChatRole;
  }>;
}

export interface PromptInjectionExtension {
  apply(input: {
    entry: PromptInjectionEntry;
    context: NormalizedPromptBuildContext;
    message: PromptInjectionMessage;
    origin: Exclude<PromptInjectionMessageOrigin, "history">;
  }): PromptInjectionMessage;
}

type RenderedPromptMessage = {
  identifier: string;
  origin: PromptInjectionMessageOrigin;
  role: ChatRole;
  depth: number;
  order: number;
  message: PromptInjectionMessage;
};

type NormalizedPromptBuildContext = {
  history: readonly ChatMessage[];
  generationType: string;
  latestUserMessage: ChatMessage | null;
  variables: PromptTemplateVariables;
  budget?: PromptBudgetOptions;
  extensions: readonly PromptInjectionExtension[];
};

const DEFAULT_DEPTH = 4;
const DEFAULT_ORDER = 100;

export const buildPromptInjectionMessages = (
  entries: readonly PromptInjectionEntry[],
  context: PromptBuildContext,
): PromptBuildResult => {
  const normalizedContext = normalizeBuildContext(context);
  const renderedEntries = entries
    .map((entry, index) => renderEntry(entry, index, normalizedContext))
    .filter((entry): entry is RenderedPromptMessage => Boolean(entry));

  const promptEntries = renderedEntries
    .filter((entry) => entry.origin === "prompt")
    .sort((left, right) => left.order - right.order);
  const injectionEntries = renderedEntries.filter(
    (entry) => entry.origin === "injection",
  );

  const historyMessages = mapHistoryMessages(normalizedContext.history);
  const injectedHistory = injectIntoHistory(historyMessages, injectionEntries);
  const combined = [...promptEntries, ...injectedHistory];
  const trimmedMessages = trimToBudget(
    combined,
    normalizedContext.latestUserMessage,
    normalizedContext.budget,
  );

  return {
    messages: trimmedMessages.map((entry) => entry.message),
    tokenEstimate: sumTokens(
      trimmedMessages.map((entry) => entry.message),
      normalizedContext.budget?.estimateTokens ?? estimatePromptMessageTokens,
    ),
    debug: trimmedMessages.map((entry) => ({
      identifier: entry.identifier,
      origin: entry.origin,
      role: entry.role,
    })),
  };
};

export const estimatePromptMessageTokens = (
  message: PromptInjectionMessage,
): number => {
  const text = message.parts
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }

      if (part.type === "image") {
        return `${part.name ?? ""}${part.mimeType ?? ""}`;
      }

      if (part.type === "file") {
        return `${part.name}${part.mimeType}`;
      }

      return JSON.stringify(part.value ?? "");
    })
    .join("\n");

  return Math.ceil(text.length / 4);
};

const normalizeBuildContext = (
  context: PromptBuildContext,
): NormalizedPromptBuildContext => {
  const latestUserMessage =
    context.latestUserMessage ??
    [...context.history].reverse().find((message) => message.role === "user") ??
    null;

  return {
    history: context.history,
    generationType: context.generationType ?? "normal",
    latestUserMessage,
    variables: context.variables ?? {},
    budget: context.budget,
    extensions: context.extensions ?? [],
  };
};

const renderEntry = (
  entry: PromptInjectionEntry,
  index: number,
  context: NormalizedPromptBuildContext,
): RenderedPromptMessage | null => {
  if (entry.enabled === false) {
    return null;
  }

  if (
    entry.triggers &&
    entry.triggers.length > 0 &&
    !entry.triggers.includes(context.generationType)
  ) {
    return null;
  }

  const parts = renderParts(entry.parts, context.variables).filter(
    (part): part is ChatMessagePart => Boolean(part),
  );

  if (parts.length === 0) {
    return null;
  }

  let message: PromptInjectionMessage = {
    role: entry.role ?? "system",
    parts,
    ...(entry.metadata ? { metadata: renderObject(entry.metadata, context.variables) } : {}),
  };

  const origin =
    entry.position === "in-history" ? ("injection" as const) : ("prompt" as const);

  for (const extension of context.extensions) {
    message = extension.apply({
      entry,
      context,
      message,
      origin,
    });
  }

  return {
    identifier: entry.identifier,
    origin,
    role: message.role,
    depth: entry.depth ?? DEFAULT_DEPTH,
    order: (entry.order ?? DEFAULT_ORDER) + index / 1000,
    message,
  };
};

const renderParts = (
  parts: readonly PromptRenderPart[],
  variables: PromptTemplateVariables,
): Array<ChatMessagePart | null> =>
  parts.map((part) => {
    if (part.type === "text") {
      const text = substituteTemplate(part.text, variables).trim();
      return text ? { type: "text", text } : null;
    }

    if (part.type === "image") {
      const source = substituteTemplate(part.source, variables).trim();
      if (!source) {
        return null;
      }

      return {
        type: "image",
        source,
        ...(part.mimeType
          ? { mimeType: substituteTemplate(part.mimeType, variables).trim() }
          : {}),
        ...(part.name
          ? { name: substituteTemplate(part.name, variables).trim() }
          : {}),
        ...(part.assetId
          ? { assetId: substituteTemplate(part.assetId, variables).trim() }
          : {}),
      };
    }

    if (part.type === "file") {
      const source = substituteTemplate(part.source, variables).trim();
      const mimeType = substituteTemplate(part.mimeType, variables).trim();
      const name = substituteTemplate(part.name, variables).trim();

      if (!source || !mimeType || !name) {
        return null;
      }

      return {
        type: "file",
        source,
        mimeType,
        name,
        ...(part.assetId
          ? { assetId: substituteTemplate(part.assetId, variables).trim() }
          : {}),
      };
    }

    return {
      type: "data",
      name: substituteTemplate(part.name, variables),
      value: renderUnknown(part.value, variables),
    };
  });

const mapHistoryMessages = (
  history: readonly ChatMessage[],
): RenderedPromptMessage[] =>
  history.map((message) => ({
    identifier: message.id,
    origin: "history",
    role: message.role,
    depth: 0,
    order: 0,
    message: {
      id: message.id,
      role: message.role,
      parts: message.parts,
      ...(message.metadata ? { metadata: message.metadata } : {}),
    },
  }));

const injectIntoHistory = (
  history: readonly RenderedPromptMessage[],
  injections: readonly RenderedPromptMessage[],
): RenderedPromptMessage[] => {
  const grouped = new Map<number, RenderedPromptMessage[]>();

  for (const injection of injections) {
    const depth = Math.max(0, injection.depth);
    const list = grouped.get(depth) ?? [];
    list.push(injection);
    grouped.set(depth, list);
  }

  for (const list of grouped.values()) {
    list.sort((left, right) => left.order - right.order);
  }

  const result: RenderedPromptMessage[] = [];
  for (let index = 0; index <= history.length; index += 1) {
    const remainingAfterInsertPoint = history.length - index;
    const insertions = grouped.get(remainingAfterInsertPoint);
    if (insertions) {
      result.push(...insertions);
    }

    if (index < history.length) {
      result.push(history[index]);
    }
  }

  return result;
};

const trimToBudget = (
  messages: readonly RenderedPromptMessage[],
  latestUserMessage: ChatMessage | null,
  budget: PromptBudgetOptions | undefined,
): RenderedPromptMessage[] => {
  if (!budget) {
    return [...messages];
  }

  const estimate = budget.estimateTokens ?? estimatePromptMessageTokens;
  const maxPromptTokens = Math.max(
    0,
    budget.maxContextTokens - (budget.reserveResponseTokens ?? 0),
  );
  const result = [...messages];

  while (sumTokens(result.map((item) => item.message), estimate) > maxPromptTokens) {
    const removableIndex = result.findIndex(
      (item) => item.origin === "history" && item.role !== "system",
    );
    if (removableIndex === -1) {
      break;
    }

    result.splice(removableIndex, 1);
  }

  if (latestUserMessage) {
    const alreadyIncluded = result.some(
      (item) => item.origin === "history" && item.message.id === latestUserMessage.id,
    );

    if (!alreadyIncluded) {
      result.push({
        identifier: latestUserMessage.id,
        origin: "history",
        role: latestUserMessage.role,
        depth: 0,
        order: Number.MAX_SAFE_INTEGER,
        message: {
          id: latestUserMessage.id,
          role: latestUserMessage.role,
          parts: latestUserMessage.parts,
          ...(latestUserMessage.metadata
            ? { metadata: latestUserMessage.metadata }
            : {}),
        },
      });
    }
  }

  return result;
};

const sumTokens = (
  messages: readonly PromptInjectionMessage[],
  estimateTokens: (message: PromptInjectionMessage) => number,
) => messages.reduce((sum, message) => sum + estimateTokens(message), 0);

const renderUnknown = (
  value: unknown,
  variables: PromptTemplateVariables,
): unknown => {
  if (typeof value === "string") {
    return substituteTemplate(value, variables);
  }

  if (Array.isArray(value)) {
    return value.map((item) => renderUnknown(item, variables));
  }

  if (value && typeof value === "object") {
    return renderObject(value, variables);
  }

  return value;
};

const renderObject = <TValue>(value: TValue, variables: PromptTemplateVariables): TValue => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return renderUnknown(value, variables) as TValue;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    result[key] = renderUnknown(entryValue, variables);
  }

  return result as TValue;
};

const substituteTemplate = (
  input: string,
  variables: PromptTemplateVariables,
  maxPasses = 3,
): string => {
  let output = String(input);
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const next = output.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (match, key) => {
      return Object.prototype.hasOwnProperty.call(variables, key)
        ? String(variables[key] ?? "")
        : match;
    });

    if (next === output) {
      break;
    }

    output = next;
  }

  return output;
};
