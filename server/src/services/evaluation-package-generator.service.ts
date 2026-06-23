import AdmZip from "adm-zip";
import { knowledgeBaseService } from "@/services/knowledge-base.service.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
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

const summarizeModelOutput = (value: string) =>
  normalizeWhitespace(value).slice(0, 200) || "[empty output]";

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
        // Ollama reasoning models may stream thinking tokens without content,
        // which makes evaluation package generation appear as empty output.
        think: false,
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
  if (!parsed) {
    throw new Error(
      `评测模型返回了无法解析的 JSON：${summarizeModelOutput(raw)}`,
    );
  }

  const question =
    typeof parsed.question === "string" ? parsed.question.trim() : "";
  if (!question) {
    throw new Error("评测模型返回缺少有效 question");
  }

  const expectedAnswer =
    typeof parsed.expectedAnswer === "string"
      ? parsed.expectedAnswer.trim()
      : "";
  if (!expectedAnswer) {
    throw new Error("评测模型返回缺少有效 expectedAnswer");
  }

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
    const knowledgeBaseId = input.knowledgeBaseId.trim();
    const knowledgeBase = knowledgeBaseService.getKnowledgeBaseById(
      knowledgeBaseId,
    );

    if (!knowledgeBase) {
      throw new Error(`知识库 "${knowledgeBaseId}" 不存在，无法生成评测包`);
    }

    const enabledDocuments = knowledgeBaseService.listDocuments(knowledgeBaseId, {
      enabled: true,
      indexStatus: "ready",
      sortBy: "updatedAt",
      sortOrder: "desc",
    });

    if (enabledDocuments.length === 0) {
      throw new Error(
        `知识库“${knowledgeBase.name}”没有可用文档，无法生成评测包`,
      );
    }

    const documentLimit = clampInteger(input.documentCount, 1, enabledDocuments.length);
    const chunkLimit = clampInteger(input.chunksPerDocument, 1, 20);
    const sampleLimit = clampInteger(input.sampleCount, 1, 100);
    const concurrencyLimit = clampInteger(input.concurrency, 1, 10);
    const timeoutSeconds = clampInteger(input.timeoutSeconds, 5, 300);
    const evalsetItems: GeneratedEvalsetItem[] = [];
    const usedQuestions = new Set<string>();

    const selectedDocumentQueue = shuffleArray(enabledDocuments).slice(
      0,
      documentLimit,
    );
    const selectedDocumentIds = new Set<string>();
    const selectedChunkKeys = new Set<string>();
    const chunkCandidates: ChunkCandidate[] = [];

    while (
      chunkCandidates.length < sampleLimit &&
      (selectedDocumentQueue.length > 0 ||
        selectedDocumentIds.size < enabledDocuments.length)
    ) {
      if (selectedDocumentQueue.length === 0) {
        const remainingDocuments = enabledDocuments.filter(
          (document) => !selectedDocumentIds.has(document.id),
        );
        if (remainingDocuments.length === 0) {
          break;
        }
        selectedDocumentQueue.push(
          ...shuffleArray(remainingDocuments).slice(0, documentLimit),
        );
      }

      const document = selectedDocumentQueue.shift()!;
      if (selectedDocumentIds.has(document.id)) {
        continue;
      }
      selectedDocumentIds.add(document.id);

      const detail = knowledgeBaseService.getDocumentById(document.id);
      if (!detail || detail.chunks.length === 0) {
        continue;
      }

      const shuffledChunks = shuffleArray(detail.chunks).slice(0, chunkLimit);
      for (const chunk of shuffledChunks) {
        const chunkContent = normalizeWhitespace(chunk.content).slice(0, 1200);
        const chunkKey = `${detail.id}:${chunkContent}`;
        if (selectedChunkKeys.has(chunkKey)) {
          continue;
        }
        selectedChunkKeys.add(chunkKey);
        chunkCandidates.push({
          documentName: detail.name,
          chunkContent,
        });
        if (chunkCandidates.length >= sampleLimit) {
          break;
        }
      }
    }

    if (chunkCandidates.length < sampleLimit) {
      throw new Error(
        `当前知识库可用于生成的 chunk 只有 ${chunkCandidates.length} 个，少于目标样本数 ${sampleLimit}，无法生成评测包`,
      );
    }

    const generatedItems = await runWithConcurrency(
      chunkCandidates.slice(0, sampleLimit),
      concurrencyLimit,
      async (candidate) => generateEvalsetItem(candidate, timeoutSeconds),
    );

    for (const item of generatedItems) {
      if (usedQuestions.has(item.question)) {
        throw new Error(
          `评测模型生成了重复问题“${item.question}”，无法保证产出 ${sampleLimit} 条不重复样本，请调整参数后重试`,
        );
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

    if (evalsetItems.length < sampleLimit) {
      throw new Error(
        `评测包只生成了 ${evalsetItems.length} 条样本，少于目标样本数 ${sampleLimit}。请增加可用素材或降低样本数后重试`,
      );
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
            knowledgeBaseId,
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
