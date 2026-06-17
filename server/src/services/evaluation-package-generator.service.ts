import AdmZip from "adm-zip";
import { knowledgeBaseService } from "@/services/knowledge-base.service.js";
import { providerProxyService } from "@/services/provider-proxy.service.js";
import type { GenerateEvaluationPackageBody } from "@/routes/evaluation/types.js";
import { nowIsoForFileName } from "@/utils/time.js";

type GeneratedEvalsetItem = {
  id: string;
  question: string;
  expectedAnswer: string;
  goldSources: string[];
  tags: string[];
};

type GeneratedPackageArchive = {
  fileName: string;
  buffer: Buffer;
};

type ChunkCandidate = {
  documentName: string;
  chunkContent: string;
};

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const stripCodeFence = (value: string) =>
  value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const safeJsonParse = <T>(value: string): T | null => {
  try {
    return JSON.parse(stripCodeFence(value)) as T;
  } catch {
    return null;
  }
};

const clampInteger = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.floor(value)));

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  let timer: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const shuffleArray = <T>(items: T[]): T[] => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index]!;
    next[index] = next[swapIndex]!;
    next[swapIndex] = current;
  }
  return next;
};

const sanitizeDatasetName = (value: string) =>
  value.trim().replace(/[\\/:*?"<>|]+/g, "-") || "evaluation-package";

const fallbackQuestionFromChunk = (documentName: string, chunkContent: string) => {
  const excerpt = normalizeWhitespace(chunkContent).slice(0, 36);
  return `请根据《${documentName}》说明以下内容的关键信息：${excerpt}`;
};

const fallbackExpectedAnswerFromChunk = (chunkContent: string) =>
  normalizeWhitespace(chunkContent).slice(0, 180);

const buildPrompt = (input: {
  documentName: string;
  chunkContent: string;
}) => `
你是一个“RAG 评测包生成器”。
请基于给定文档片段，生成 1 条适合用于 RAG 评测的数据样本。

要求：
1. 问题必须可以从片段中回答，不要编造外部背景。
2. 问题要尽量像真实用户提问，不要机械复述。
3. expectedAnswer 必须简洁、准确，可直接作为参考答案。
4. tags 返回 1 到 3 个短标签。
5. 只返回 JSON，不要返回 Markdown，不要解释。

JSON 格式：
{
  "question": "string",
  "expectedAnswer": "string",
  "tags": ["string"]
}

文档名：
${input.documentName}

文档片段：
${input.chunkContent}
`.trim();

const generateEvalsetItem = async (
  candidate: ChunkCandidate,
  timeoutSeconds: number,
): Promise<Omit<GeneratedEvalsetItem, "id" | "goldSources"> & { goldSources: string[] }> => {
  const raw = await withTimeout(
    providerProxyService.generateTextForRole(
      "evaluation",
      [
        {
          role: "system",
          content: "你负责为 RAG 系统生成高质量评测样本，只输出 JSON。",
        },
        {
          role: "user",
          content: buildPrompt(candidate),
        },
      ],
      {
        temperature: 0.2,
        topP: 0.9,
        maxTokens: 512,
      },
    ),
    timeoutSeconds * 1000,
    `评测模型生成超时（>${timeoutSeconds}s）`,
  );

  const parsed = safeJsonParse<{
    question?: string;
    expectedAnswer?: string;
    tags?: unknown;
  }>(raw);

  const question =
    typeof parsed?.question === "string" && parsed.question.trim()
      ? parsed.question.trim()
      : fallbackQuestionFromChunk(candidate.documentName, candidate.chunkContent);
  const expectedAnswer =
    typeof parsed?.expectedAnswer === "string" && parsed.expectedAnswer.trim()
      ? parsed.expectedAnswer.trim()
      : fallbackExpectedAnswerFromChunk(candidate.chunkContent);
  const tags = Array.isArray(parsed?.tags)
    ? parsed.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 3)
    : [];

  return {
    question,
    expectedAnswer,
    goldSources: [candidate.documentName],
    tags,
  };
};

const runWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex]!, currentIndex);
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
};

export const evaluationPackageGeneratorService = {
  async generateArchive(
    input: GenerateEvaluationPackageBody,
  ): Promise<GeneratedPackageArchive> {
    const enabledDocuments = knowledgeBaseService.listDocuments({
      enabled: true,
      indexStatus: "ready",
      sortBy: "updatedAt",
      sortOrder: "desc",
    });

    if (enabledDocuments.length === 0) {
      throw new Error("当前默认知识库没有可用文档，无法生成评测包");
    }

    const documentLimit = clampInteger(input.documentCount, 1, enabledDocuments.length);
    const chunkLimit = clampInteger(input.chunksPerDocument, 1, 20);
    const sampleLimit = clampInteger(input.sampleCount, 1, 100);
    const concurrencyLimit = clampInteger(input.concurrency, 1, 10);
    const timeoutSeconds = clampInteger(input.timeoutSeconds, 5, 300);
    const selectedDocuments = shuffleArray(enabledDocuments).slice(0, documentLimit);

    const chunkCandidates = selectedDocuments.flatMap((document) => {
      const detail = knowledgeBaseService.getDocumentById(document.id);
      if (!detail || detail.chunks.length === 0) {
        return [];
      }

      return shuffleArray(detail.chunks)
        .slice(0, chunkLimit)
        .map((chunk) => ({
          documentName: detail.name,
          chunkContent: normalizeWhitespace(chunk.content).slice(0, 1200),
        }));
    });

    if (chunkCandidates.length === 0) {
      throw new Error("已选文档没有可用 chunk，无法生成评测包");
    }

    const evalsetItems: GeneratedEvalsetItem[] = [];
    const usedQuestions = new Set<string>();

    const generatedItems = await runWithConcurrency(
      chunkCandidates,
      concurrencyLimit,
      async (candidate) => {
        try {
          return await generateEvalsetItem(candidate, timeoutSeconds);
        } catch {
          return {
            question: fallbackQuestionFromChunk(
              candidate.documentName,
              candidate.chunkContent,
            ),
            expectedAnswer: fallbackExpectedAnswerFromChunk(
              candidate.chunkContent,
            ),
            goldSources: [candidate.documentName],
            tags: ["fallback"],
          };
        }
      },
    );

    for (const item of generatedItems) {
      if (evalsetItems.length >= sampleLimit) {
        break;
      }

      if (usedQuestions.has(item.question)) {
        continue;
      }

      usedQuestions.add(item.question);
      evalsetItems.push({
        id: `sample-${String(evalsetItems.length + 1).padStart(3, "0")}`,
        ...item,
      });
    }

    if (evalsetItems.length === 0) {
      throw new Error("评测模型没有生成出有效样本，请调整参数后重试");
    }

    const datasetName = sanitizeDatasetName(input.datasetName);
    const archive = new AdmZip();
    const involvedDocuments = Array.from(
      new Set(evalsetItems.flatMap((item) => item.goldSources)),
    );

    archive.addFile(
      "manifest.json",
      Buffer.from(
        JSON.stringify(
          {
            datasetName,
            knowledgeBaseId: "default",
            config: {
              mode: input.mode,
              topK: clampInteger(input.topK, 1, 50),
              topN: clampInteger(input.topN, 1, 20),
              repeat: clampInteger(input.repeat, 1, 10),
              concurrency: concurrencyLimit,
              timeoutSeconds,
            },
          },
          null,
          2,
        ),
        "utf8",
      ),
    );

    archive.addFile(
      "evalset.json",
      Buffer.from(JSON.stringify(evalsetItems, null, 2), "utf8"),
    );

    for (const documentName of involvedDocuments) {
      archive.addFile(
        `documents/${documentName}`,
        Buffer.from("Generated by evaluation package generator.\n", "utf8"),
      );
    }

    return {
      fileName: `${datasetName}-${nowIsoForFileName()}.zip`,
      buffer: archive.toBuffer(),
    };
  },
};
