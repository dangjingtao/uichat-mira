import {
  CharacterTextSplitter,
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
  TokenTextSplitter,
  type SupportedTextSplitterLanguage,
} from "@langchain/textsplitters";
import { DEFAULT_CHUNKING_CONFIG as KNOWLEDGE_BASE_DEFAULT_CHUNKING_CONFIG } from "@/constants/knowledge-base.js";

export type SplitterType =
  | "character"
  | "recursive"
  | "markdown"
  | "token";

export type LengthMetric = "characters" | "utf8Bytes";

export interface ChunkingConfig {
  splitterType: SplitterType;
  chunkSize: number;
  chunkOverlap: number;
  keepSeparator: boolean;
  separator: string;
  separators: string[];
  presetLanguage: SupportedTextSplitterLanguage | null;
  encodingName: string;
  allowedSpecial: "all" | string[];
  disallowedSpecial: "all" | string[];
  lengthMetric: LengthMetric;
  replaceWhitespace: boolean;
  removeUrls: boolean;
  useQaSplit: boolean;
}

export interface SplitChunk {
  chunkIndex: number;
  content: string;
  charCount: number;
  startOffset: number | null;
  endOffset: number | null;
}

export type ChunkingPreviewStats = {
  totalChunks: number;
  minChunkLength: number;
  maxChunkLength: number;
  averageChunkLength: number;
  normalizedTextLength: number;
};

export type ChunkingPreviewResult = {
  normalizedText: string;
  chunkingConfig: ChunkingConfig;
  chunks: SplitChunk[];
  stats: ChunkingPreviewStats;
};

type BaseSplitter = {
  splitText(text: string): Promise<string[]>;
};

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  splitterType: "recursive",
  chunkSize: KNOWLEDGE_BASE_DEFAULT_CHUNKING_CONFIG.maxLength,
  chunkOverlap: KNOWLEDGE_BASE_DEFAULT_CHUNKING_CONFIG.overlap,
  keepSeparator: true,
  separator: KNOWLEDGE_BASE_DEFAULT_CHUNKING_CONFIG.separator,
  separators: ["\n\n", "\n", " ", ""],
  presetLanguage: "markdown",
  encodingName: "cl100k_base",
  allowedSpecial: [],
  disallowedSpecial: "all",
  lengthMetric: "characters",
  replaceWhitespace: KNOWLEDGE_BASE_DEFAULT_CHUNKING_CONFIG.replaceWhitespace,
  removeUrls: KNOWLEDGE_BASE_DEFAULT_CHUNKING_CONFIG.removeUrls,
  useQaSplit: KNOWLEDGE_BASE_DEFAULT_CHUNKING_CONFIG.useQaSplit,
};

const decodeSeparator = (separator: string) =>
  separator.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeText = (raw: string, settings: ChunkingConfig) => {
  let next = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (settings.removeUrls) {
    next = next.replace(/https?:\/\/\S+/g, "").replace(/\b\S+@\S+\.\S+\b/g, "");
  }

  if (settings.replaceWhitespace) {
    next = next
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
  }

  return next.trim();
};

const splitBySeparator = (text: string, separator: string) => {
  const decoded = decodeSeparator(separator);

  if (!decoded.trim()) {
    return text
      .split(/\n\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (/^\s+$/.test(decoded)) {
    return text
      .split(new RegExp(`${escapeRegExp(decoded)}+`, "g"))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return text
    .split(decoded)
    .map((item) => item.trim())
    .filter(Boolean);
};

const extractQaBlocks = (text: string) => {
  const lines = text.split("\n").map((line) => line.trim());
  const blocks: string[] = [];
  const questionPattern = /^(Q[:：]|问[:：]|问题[:：]?)/i;
  const answerPattern = /^(A[:：]|答[:：]|回答[:：]?)/i;

  let currentQuestion = "";
  let currentAnswer = "";

  for (const line of lines) {
    if (!line) {
      if (currentQuestion || currentAnswer) {
        blocks.push([currentQuestion, currentAnswer].filter(Boolean).join("\n"));
        currentQuestion = "";
        currentAnswer = "";
      }
      continue;
    }

    if (questionPattern.test(line)) {
      if (currentQuestion || currentAnswer) {
        blocks.push([currentQuestion, currentAnswer].filter(Boolean).join("\n"));
      }
      currentQuestion = line;
      currentAnswer = "";
      continue;
    }

    if (answerPattern.test(line)) {
      currentAnswer = currentAnswer ? `${currentAnswer}\n${line}` : line;
      continue;
    }

    if (currentAnswer) {
      currentAnswer = `${currentAnswer}\n${line}`;
      continue;
    }

    if (currentQuestion) {
      currentQuestion = `${currentQuestion}\n${line}`;
      continue;
    }
  }

  if (currentQuestion || currentAnswer) {
    blocks.push([currentQuestion, currentAnswer].filter(Boolean).join("\n"));
  }

  return blocks.filter(Boolean);
};

const lengthOf = async (text: string, metric: LengthMetric) => {
  if (metric === "utf8Bytes") {
    return new TextEncoder().encode(text).length;
  }

  return text.length;
};

const buildLengthFunction = (metric: LengthMetric) => {
  if (metric === "utf8Bytes") {
    return async (text: string) => lengthOf(text, metric);
  }

  return (text: string) => lengthOf(text, metric);
};

const normalizeStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const resolveSeparators = (value: unknown) => {
  const separators = normalizeStringArray(value);
  return (separators.length > 0 ? separators : DEFAULT_CHUNKING_CONFIG.separators).map(
    (separator) => decodeSeparator(separator),
  );
};

export const normalizeChunkingConfig = (
  value?: Partial<ChunkingConfig> | null,
): ChunkingConfig => {
  const merged = {
    ...DEFAULT_CHUNKING_CONFIG,
    ...(value ?? {}),
  } as Partial<ChunkingConfig> & Record<string, unknown>;

  const fallbackSize =
    Number(merged.chunkSize ?? merged.maxLength) || DEFAULT_CHUNKING_CONFIG.chunkSize;
  const safeChunkSize = Math.max(100, fallbackSize);
  const fallbackOverlap =
    Number(merged.chunkOverlap ?? merged.overlap) || DEFAULT_CHUNKING_CONFIG.chunkOverlap;
  const safeChunkOverlap = Math.max(0, Math.min(fallbackOverlap, safeChunkSize - 1));
  const splitterType = ["character", "recursive", "markdown", "token"].includes(
    String(merged.splitterType ?? ""),
  )
    ? (merged.splitterType as SplitterType)
    : DEFAULT_CHUNKING_CONFIG.splitterType;
  const lengthMetric =
    merged.lengthMetric === "utf8Bytes" ? "utf8Bytes" : DEFAULT_CHUNKING_CONFIG.lengthMetric;

  return {
    splitterType,
    chunkSize: safeChunkSize,
    chunkOverlap: safeChunkOverlap,
    keepSeparator:
      typeof merged.keepSeparator === "boolean"
        ? merged.keepSeparator
        : DEFAULT_CHUNKING_CONFIG.keepSeparator,
    separator:
      typeof merged.separator === "string" && merged.separator.length > 0
        ? merged.separator
        : DEFAULT_CHUNKING_CONFIG.separator,
    separators: resolveSeparators(merged.separators),
    presetLanguage:
      typeof merged.presetLanguage === "string" &&
      ["markdown", "latex", "html", "js", "python", "cpp", "go", "java", "php", "proto", "rst", "ruby", "rust", "scala", "swift", "sol"].includes(
        merged.presetLanguage,
      )
        ? (merged.presetLanguage as SupportedTextSplitterLanguage)
        : DEFAULT_CHUNKING_CONFIG.presetLanguage,
    encodingName:
      typeof merged.encodingName === "string" && merged.encodingName.trim()
        ? merged.encodingName.trim()
        : DEFAULT_CHUNKING_CONFIG.encodingName,
    allowedSpecial:
      merged.allowedSpecial === "all"
        ? "all"
        : normalizeStringArray(merged.allowedSpecial),
    disallowedSpecial:
      merged.disallowedSpecial === "all"
        ? "all"
        : normalizeStringArray(merged.disallowedSpecial),
    lengthMetric,
    replaceWhitespace:
      typeof merged.replaceWhitespace === "boolean"
        ? merged.replaceWhitespace
        : DEFAULT_CHUNKING_CONFIG.replaceWhitespace,
    removeUrls:
      typeof merged.removeUrls === "boolean"
        ? merged.removeUrls
        : DEFAULT_CHUNKING_CONFIG.removeUrls,
    useQaSplit:
      typeof merged.useQaSplit === "boolean"
        ? merged.useQaSplit
        : DEFAULT_CHUNKING_CONFIG.useQaSplit,
  };
};

const createSplitter = (settings: ChunkingConfig): BaseSplitter => {
  const common = {
    chunkSize: settings.chunkSize,
    chunkOverlap: settings.chunkOverlap,
    keepSeparator: settings.keepSeparator,
    lengthFunction: buildLengthFunction(settings.lengthMetric),
  };

  switch (settings.splitterType) {
    case "character":
      return new CharacterTextSplitter({
        ...common,
        separator: decodeSeparator(settings.separator),
      });
    case "markdown":
      return new MarkdownTextSplitter(common);
    case "token":
      return new TokenTextSplitter({
        ...common,
        encodingName: settings.encodingName as never,
        allowedSpecial: settings.allowedSpecial,
        disallowedSpecial: settings.disallowedSpecial,
      });
    case "recursive":
    default:
      if (settings.presetLanguage) {
        return RecursiveCharacterTextSplitter.fromLanguage(settings.presetLanguage, common);
      }

      return new RecursiveCharacterTextSplitter({
        ...common,
        separators: settings.separators,
      });
  }
};

const takeOverlapText = (text: string, overlap: number) => {
  if (overlap <= 0 || text.length <= overlap) {
    return text;
  }

  const tail = text.slice(-overlap);
  const whitespaceIndex = Math.max(tail.indexOf(" "), tail.indexOf("\n"));

  if (whitespaceIndex > -1 && whitespaceIndex < tail.length - 1) {
    return tail.slice(whitespaceIndex + 1).trim();
  }

  return tail.trim();
};

const splitBlockToChunks = async (
  block: string,
  settings: ChunkingConfig,
  baseOffset: number,
  startIndex: number,
) => {
  const splitter = createSplitter(settings);
  const blockChunks = await splitter.splitText(block);
  const chunks: SplitChunk[] = [];
  let cursor = 0;

  for (const chunk of blockChunks) {
    const textValue = chunk.trim();
    if (!textValue) {
      continue;
    }

    let startOffset = block.indexOf(textValue, cursor);
    if (startOffset < 0) {
      startOffset = block.indexOf(textValue);
    }
    if (startOffset < 0) {
      startOffset = cursor;
    }

    const absoluteStart = baseOffset + startOffset;
    const absoluteEnd = absoluteStart + textValue.length;
    chunks.push({
      chunkIndex: startIndex + chunks.length,
      content: textValue,
      charCount: textValue.length,
      startOffset: absoluteStart,
      endOffset: absoluteEnd,
    });

    cursor = Math.max(startOffset + textValue.length - settings.chunkOverlap, startOffset + 1);
  }

  return chunks;
};

const splitTextBlocks = (text: string, settings: ChunkingConfig) => {
  if (!settings.useQaSplit) {
    return [{ text, baseOffset: 0 }];
  }

  const blocks = extractQaBlocks(text);
  if (blocks.length === 0) {
    return [{ text, baseOffset: 0 }];
  }

  const result: Array<{ text: string; baseOffset: number }> = [];
  let cursor = 0;

  for (const block of blocks) {
    const position = text.indexOf(block, cursor);
    const baseOffset = position >= 0 ? position : cursor;
    result.push({ text: block, baseOffset });
    cursor = Math.max(baseOffset + block.length, cursor + 1);
  }

  return result;
};

export const splitDocumentText = async (
  rawText: string,
  config?: Partial<ChunkingConfig> | null,
): Promise<ChunkingPreviewResult> => {
  const settings = normalizeChunkingConfig(config);
  const normalizedText = normalizeText(rawText, settings);
  const blocks = splitTextBlocks(normalizedText, settings);
  const chunks: SplitChunk[] = [];

  for (const block of blocks) {
    const blockChunks = await splitBlockToChunks(
      block.text,
      settings,
      block.baseOffset,
      chunks.length + 1,
    );
    chunks.push(...blockChunks);
  }

  const chunkLengths = chunks.map((chunk) => chunk.charCount);
  const totalLength = chunkLengths.reduce((sum, value) => sum + value, 0);

  return {
    normalizedText,
    chunkingConfig: settings,
    chunks,
    stats: {
      totalChunks: chunks.length,
      minChunkLength: chunkLengths.length ? Math.min(...chunkLengths) : 0,
      maxChunkLength: chunkLengths.length ? Math.max(...chunkLengths) : 0,
      averageChunkLength: chunkLengths.length ? Math.round(totalLength / chunkLengths.length) : 0,
      normalizedTextLength: normalizedText.length,
    },
  };
};

export const decodeChunkingConfigSeparators = decodeSeparator;

export const overlapChunkPreviewText = takeOverlapText;
