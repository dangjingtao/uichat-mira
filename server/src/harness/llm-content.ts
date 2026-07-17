export const HARNESS_LLM_RESULT_CHAR_LIMIT = 24_000;
export const HARNESS_LLM_MAX_DEPTH = 12;
export const HARNESS_LLM_MAX_ARRAY_ITEMS = 200;
export const HARNESS_LLM_MAX_OBJECT_KEYS = 200;
export const HARNESS_LLM_MAX_STRING_CHARS = 20_000;

export interface HarnessLlmTextBlock {
  type: "text";
  text: string;
}

export interface HarnessLlmContent {
  version: 1;
  source: "harness_result";
  blocks: HarnessLlmTextBlock[];
  truncated: boolean;
  originalCharCount: number;
  includedCharCount: number;
  omittedArrayItems: number;
  omittedObjectKeys: number;
}

type ProjectionStats = {
  omittedArrayItems: number;
  omittedObjectKeys: number;
  structuralTruncation: boolean;
};

const tryParseJsonText = (value: string): unknown => {
  const text = value.trim();
  if (
    text.length < 2 ||
    !(
      (text.startsWith("{") && text.endsWith("}")) ||
      (text.startsWith("[") && text.endsWith("]"))
    )
  ) {
    return value;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return value;
  }
};

const projectValue = (
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
  stats: ProjectionStats,
): unknown => {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    const parsed = tryParseJsonText(value);
    if (parsed !== value) {
      return projectValue(parsed, depth, seen, stats);
    }
    if (value.length <= HARNESS_LLM_MAX_STRING_CHARS) {
      return value;
    }
    stats.structuralTruncation = true;
    return `${value.slice(0, HARNESS_LLM_MAX_STRING_CHARS)}\n...[string truncated; originalCharCount=${value.length}]`;
  }

  if (typeof value === "undefined") {
    return "[undefined]";
  }

  if (typeof value === "function" || typeof value === "symbol") {
    return `[${typeof value}]`;
  }

  if (depth >= HARNESS_LLM_MAX_DEPTH) {
    stats.structuralTruncation = true;
    return "[max depth reached]";
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) {
    return "[circular reference]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const projected = value
      .slice(0, HARNESS_LLM_MAX_ARRAY_ITEMS)
      .map((item) => projectValue(item, depth + 1, seen, stats));
    if (value.length > HARNESS_LLM_MAX_ARRAY_ITEMS) {
      const omitted = value.length - HARNESS_LLM_MAX_ARRAY_ITEMS;
      stats.omittedArrayItems += omitted;
      stats.structuralTruncation = true;
      projected.push(`[${omitted} array item(s) omitted]`);
    }
    return projected;
  }

  const entries = Object.entries(value);
  const projected: Record<string, unknown> = {};
  for (const [key, entryValue] of entries.slice(0, HARNESS_LLM_MAX_OBJECT_KEYS)) {
    projected[key] = projectValue(entryValue, depth + 1, seen, stats);
  }
  if (entries.length > HARNESS_LLM_MAX_OBJECT_KEYS) {
    const omitted = entries.length - HARNESS_LLM_MAX_OBJECT_KEYS;
    stats.omittedObjectKeys += omitted;
    stats.structuralTruncation = true;
    projected.__omittedKeys = omitted;
  }
  return projected;
};

const serializeProjectedValue = (value: unknown, stats: ProjectionStats) => {
  try {
    const projected = projectValue(value, 0, new WeakSet<object>(), stats);
    return typeof projected === "string"
      ? projected
      : JSON.stringify(projected, null, 2) ?? "[unserializable result]";
  } catch (error) {
    stats.structuralTruncation = true;
    return `[Harness result serialization failed: ${
      error instanceof Error ? error.message : String(error)
    }]`;
  }
};

export const projectHarnessResultForLlm = (
  result: unknown,
  charLimit = HARNESS_LLM_RESULT_CHAR_LIMIT,
): HarnessLlmContent | undefined => {
  if (typeof result === "undefined" || charLimit <= 0) {
    return undefined;
  }

  const stats: ProjectionStats = {
    omittedArrayItems: 0,
    omittedObjectKeys: 0,
    structuralTruncation: false,
  };
  const serialized = serializeProjectedValue(result, stats);
  const originalCharCount = serialized.length;
  let text = serialized;
  let budgetTruncated = false;

  if (serialized.length > charLimit) {
    budgetTruncated = true;
    const marker = `\n...[Harness result truncated by LLM budget; originalCharCount=${serialized.length}]`;
    const boundedLength = Math.max(0, charLimit - marker.length);
    text = `${serialized.slice(0, boundedLength).trimEnd()}${marker}`;
  }

  const truncated = stats.structuralTruncation || budgetTruncated;
  const metadata = [
    `truncated=${truncated}`,
    `originalCharCount=${originalCharCount}`,
    `includedCharCount=${text.length}`,
    `omittedArrayItems=${stats.omittedArrayItems}`,
    `omittedObjectKeys=${stats.omittedObjectKeys}`,
  ].join("\n");

  return {
    version: 1,
    source: "harness_result",
    blocks: [
      {
        type: "text",
        text: [metadata, "result:", text || "(empty result)"].join("\n"),
      },
    ],
    truncated,
    originalCharCount,
    includedCharCount: text.length,
    omittedArrayItems: stats.omittedArrayItems,
    omittedObjectKeys: stats.omittedObjectKeys,
  };
};

export const getHarnessLlmContentText = (
  content: HarnessLlmContent | undefined,
) =>
  content?.blocks
    .filter((block) => block.type === "text" && block.text.trim())
    .map((block) => block.text)
    .join("\n\n") ?? "";
