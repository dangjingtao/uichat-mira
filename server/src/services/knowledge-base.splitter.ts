import { DEFAULT_CHUNKING_CONFIG as KNOWLEDGE_BASE_DEFAULT_CHUNKING_CONFIG } from "@/constants/knowledge-base.js";

export interface ChunkingConfig {
  separator: string;
  maxLength: number;
  overlap: number;
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

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig =
  KNOWLEDGE_BASE_DEFAULT_CHUNKING_CONFIG;

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

const splitIntoSentences = (text: string) =>
  text
    .split(/(?<=[。！？!?\.])\s+|(?<=[:：；;])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

const splitIntoClauses = (text: string) =>
  text
    .split(/(?<=[，,、])/)
    .map((item) => item.trim())
    .filter(Boolean);

const hardSplit = (text: string, maxLength: number, overlap: number) => {
  const chunks: string[] = [];
  const safeMaxLength = Math.max(1, maxLength);
  const safeOverlap = Math.max(0, Math.min(overlap, safeMaxLength - 1));
  let cursor = 0;

  while (cursor < text.length) {
    const limit = Math.min(cursor + safeMaxLength, text.length);
    let end = limit;

    if (limit < text.length) {
      const windowStart = Math.max(cursor + Math.floor(safeMaxLength * 0.55), cursor);
      const window = text.slice(windowStart, limit);
      const localBreak = Math.max(
        window.lastIndexOf("。"),
        window.lastIndexOf("！"),
        window.lastIndexOf("？"),
        window.lastIndexOf("."),
        window.lastIndexOf("；"),
        window.lastIndexOf(";"),
        window.lastIndexOf("，"),
        window.lastIndexOf(","),
        window.lastIndexOf(" "),
      );

      if (localBreak > -1) {
        end = windowStart + localBreak + 1;
      }
    }

    const piece = text.slice(cursor, end).trim();
    if (piece) {
      chunks.push(piece);
    }

    if (end >= text.length) {
      break;
    }

    cursor = Math.max(end - safeOverlap, cursor + 1);
  }

  return chunks;
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

const toUnits = (text: string, settings: ChunkingConfig) => {
  const qaBlocks = settings.useQaSplit ? extractQaBlocks(text) : [];
  const baseBlocks = qaBlocks.length > 0 ? qaBlocks : splitBySeparator(text, settings.separator);
  const units: string[] = [];

  for (const block of baseBlocks) {
    if (block.length <= settings.maxLength) {
      units.push(block);
      continue;
    }

    const sentences = splitIntoSentences(block);
    const sentenceUnits = sentences.length > 1 ? sentences : splitIntoClauses(block);

    for (const sentence of sentenceUnits) {
      if (sentence.length <= settings.maxLength) {
        units.push(sentence);
        continue;
      }

      units.push(...hardSplit(sentence, settings.maxLength, settings.overlap));
    }
  }

  return units;
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

export const normalizeChunkingConfig = (
  value?: Partial<ChunkingConfig> | null,
): ChunkingConfig => {
  const merged = {
    ...DEFAULT_CHUNKING_CONFIG,
    ...(value ?? {}),
  };

  const safeMaxLength = Math.max(100, Number(merged.maxLength) || DEFAULT_CHUNKING_CONFIG.maxLength);
  const safeOverlap = Math.max(
    0,
    Math.min(Number(merged.overlap) || 0, safeMaxLength - 1),
  );

  return {
    separator: merged.separator || DEFAULT_CHUNKING_CONFIG.separator,
    maxLength: safeMaxLength,
    overlap: safeOverlap,
    replaceWhitespace: Boolean(merged.replaceWhitespace),
    removeUrls: Boolean(merged.removeUrls),
    useQaSplit: Boolean(merged.useQaSplit),
  };
};

export const splitDocumentText = (
  rawText: string,
  config?: Partial<ChunkingConfig> | null,
) => {
  const settings = normalizeChunkingConfig(config);
  const normalizedText = normalizeText(rawText, settings);
  const units = toUnits(normalizedText, settings);
  const chunks: SplitChunk[] = [];
  let current = "";

  const pushChunk = (value: string) => {
    const textValue = value.trim();
    if (!textValue) {
      return "";
    }

    const startOffset = normalizedText.indexOf(textValue);
    const endOffset = startOffset > -1 ? startOffset + textValue.length : null;

    chunks.push({
      chunkIndex: chunks.length + 1,
      content: textValue,
      charCount: textValue.length,
      startOffset: startOffset > -1 ? startOffset : null,
      endOffset,
    });

    return takeOverlapText(textValue, settings.overlap);
  };

  for (const unit of units) {
    const nextValue = current ? `${current}\n\n${unit}` : unit;

    if (nextValue.length <= settings.maxLength) {
      current = nextValue;
      continue;
    }

    const overlapSeed = pushChunk(current);
    current = overlapSeed ? `${overlapSeed}\n\n${unit}` : unit;

    if (current.length > settings.maxLength) {
      const hardChunks = hardSplit(current, settings.maxLength, settings.overlap);
      current = "";

      for (let index = 0; index < hardChunks.length; index += 1) {
        const piece = hardChunks[index];
        if (index === hardChunks.length - 1) {
          current = piece;
        } else {
          pushChunk(piece);
        }
      }
    }
  }

  pushChunk(current);

  return {
    normalizedText,
    chunkingConfig: settings,
    chunks,
  };
};
