import AdmZip from "adm-zip";
import {
  deletePersistedEvaluationRun,
  listPersistedEvaluationDatasets,
  listPersistedEvaluationRuns,
  upsertEvaluationDataset,
  upsertEvaluationRun,
} from "@/db/evaluation.db.js";
import { ragPipeline } from "@/services/rag-pipeline.js";
import { badRequest, notFound } from "@/utils/route-errors.js";
import type { RetrievedChunk } from "@/services/rag-nodes/index.js";
import type {
  CreateEvaluationRunBody,
  EvaluationDatasetDocument,
  EvaluationDatasetRecord,
  EvaluationDatasetSample,
  EvaluationDatasetValidationItem,
  DeleteEvaluationRunResponse,
  EvaluationLogEntry,
  EvaluationMetricSummary,
  EvaluationRetrievedSource,
  EvaluationRunListQuery,
  EvaluationRunRecord,
  EvaluationSampleAttempt,
  EvaluationSampleResult,
} from "@/routes/evaluation/types.js";

type ParsedManifest = {
  datasetName?: string;
  knowledgeBaseId?: string;
  config?: Partial<EvaluationDatasetRecord["config"]>;
};

type ParsedEvalsetItem = {
  id?: string;
  question?: string;
  expectedAnswer?: string;
  referenceAnswer?: string;
  goldSources?: unknown;
  tags?: unknown;
};

const PREVIEW_SAMPLE_LIMIT = 4;
const MAX_LOG_LINES = 200;

const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const inferDocumentType = (
  entryName: string,
): EvaluationDatasetDocument["type"] => {
  const normalized = entryName.toLowerCase();
  if (normalized.includes("话术")) {
    return "话术";
  }
  if (normalized.includes("案例")) {
    return "案例";
  }
  if (normalized.includes("规章")) {
    return "规章";
  }
  return "未分类";
};

const createDatasetId = (): string =>
  `dataset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createRunId = (): string =>
  `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const clampPositiveInteger = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value as number));
};

const normalizeSourceToken = (value: string): string =>
  value.trim().toLowerCase();

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const tokenizeText = (value: string): string[] =>
  normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/u)
    .filter(Boolean);

const toRetrievedSourcePreview = (
  source: RetrievedChunk,
): EvaluationRetrievedSource => ({
  documentName: source.documentName,
  ...(typeof source.chunkId === "number" ? { chunkId: source.chunkId } : {}),
  ...(typeof source.score === "number" ? { score: source.score } : {}),
  ...(source.content
    ? { contentPreview: normalizeWhitespace(source.content).slice(0, 180) }
    : {}),
});

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

const parseJsonEntry = <T>(zip: AdmZip, entryName: string): T => {
  const entry = zip.getEntry(entryName);
  if (!entry) {
    throw new Error(`Missing zip entry "${entryName}"`);
  }

  const raw = zip.readAsText(entry, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw) as T;
};

const tryFindEntryName = (
  zip: AdmZip,
  candidates: string[],
): string | null => {
  const lookup = new Set(candidates.map((item) => item.toLowerCase()));
  const matched = zip
    .getEntries()
    .find((entry) => !entry.isDirectory && lookup.has(entry.entryName.toLowerCase()));
  return matched?.entryName ?? null;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const toDatasetSample = (
  item: ParsedEvalsetItem,
  index: number,
): EvaluationDatasetSample | null => {
  const question =
    typeof item.question === "string" ? item.question.trim() : "";
  if (!question) {
    return null;
  }

  const expectedAnswer =
    typeof item.expectedAnswer === "string"
      ? item.expectedAnswer
      : typeof item.referenceAnswer === "string"
        ? item.referenceAnswer
        : "";

  return {
    id:
      typeof item.id === "string" && item.id.trim()
        ? item.id
        : `sample-${String(index + 1).padStart(3, "0")}`,
    question,
    expectedAnswer,
    goldSources: normalizeStringArray(item.goldSources),
    tags: normalizeStringArray(item.tags),
  };
};

const createValidationReport = (
  samples: EvaluationDatasetSample[],
  hasManifest: boolean,
  documentCount: number,
): EvaluationDatasetValidationItem[] => {
  const sampleCount = samples.length;
  const samplesWithReference = samples.filter((item) =>
    item.expectedAnswer.trim().length > 0
  ).length;
  const samplesWithGoldSources = samples.filter((item) =>
    item.goldSources.length > 0
  ).length;

  return [
    {
      id: "structure",
      label: "评测包结构完整",
      status:
        hasManifest && documentCount > 0 && sampleCount > 0 ? "pass" : "error",
      detail: hasManifest
        ? `已识别 manifest、documents 和 evalset 清单。`
        : "缺少 manifest.json，当前将使用文件名和默认参数回填。",
    },
    {
      id: "reference",
      label: "参考答案字段齐全",
      status:
        sampleCount === 0
          ? "error"
          : samplesWithReference === sampleCount
            ? "pass"
            : samplesWithReference > 0
              ? "warning"
              : "warning",
      detail:
        sampleCount === 0
          ? "未识别到可用样本。"
          : `检测到 ${samplesWithReference}/${sampleCount} 条样本包含 reference answer。`,
    },
    {
      id: "sources",
      label: "gold sources 可用于检索评测",
      status:
        sampleCount === 0
          ? "error"
          : samplesWithGoldSources === sampleCount
            ? "pass"
            : samplesWithGoldSources > 0
              ? "warning"
              : "warning",
      detail:
        sampleCount === 0
          ? "未识别到可用样本。"
          : `检测到 ${samplesWithGoldSources}/${sampleCount} 条样本包含 gold sources。`,
    },
  ];
};

const emptyMetrics = (): EvaluationMetricSummary => ({
  hitAtK: 0,
  recallAtK: 0,
  mrr: 0,
  faithfulness: 0,
  answerRelevance: 0,
  answerCompleteness: 0,
  sourceHitRate: 0,
  averageLatencyMs: 0,
  failedCount: 0,
});

export class EvaluationService {
  private readonly datasets = new Map<string, EvaluationDatasetRecord>();

  private readonly datasetSamples = new Map<string, EvaluationDatasetSample[]>();

  private readonly datasetKnowledgeBaseIds = new Map<string, string | undefined>();

  private readonly runs = new Map<string, EvaluationRunRecord>();

  parseDataset(input: {
    fileName: string;
    fileSize: number;
    buffer: Buffer;
  }): EvaluationDatasetRecord {
    const zip = new AdmZip(input.buffer);
    const manifestEntryName = tryFindEntryName(zip, ["manifest.json"]);
    const evalsetEntryName = tryFindEntryName(zip, [
      "evalset.json",
      "evalset/evalset.json",
      "dataset/evalset.json",
    ]);

    if (!evalsetEntryName) {
      throw new Error(
        'Missing evalset.json. The package must include an "evalset.json" file.',
      );
    }

    const manifest = manifestEntryName
      ? parseJsonEntry<ParsedManifest>(zip, manifestEntryName)
      : null;
    const evalsetRaw = parseJsonEntry<
      ParsedEvalsetItem[] | { samples?: ParsedEvalsetItem[] }
    >(zip, evalsetEntryName);
    const evalsetItems = Array.isArray(evalsetRaw)
      ? evalsetRaw
      : Array.isArray(evalsetRaw.samples)
        ? evalsetRaw.samples
        : [];

    const documents = zip
      .getEntries()
      .filter(
        (entry) =>
          !entry.isDirectory &&
          entry.entryName.toLowerCase().startsWith("documents/"),
      )
      .map<EvaluationDatasetDocument>((entry, index) => ({
        id: `doc-${index + 1}`,
        name: entry.entryName.split("/").at(-1) || entry.entryName,
        type: inferDocumentType(entry.entryName),
        sizeLabel: formatFileSize(entry.header.size),
      }));

    const samples = evalsetItems
      .map((item, index) => toDatasetSample(item, index))
      .filter((item): item is EvaluationDatasetSample => item !== null);

    const datasetName =
      manifest?.datasetName?.trim() ||
      input.fileName.replace(/\.zip$/i, "") ||
      "evaluation-dataset";

    const dataset: EvaluationDatasetRecord = {
      id: createDatasetId(),
      datasetName,
      fileName: input.fileName,
      fileSize: input.fileSize,
      uploadedAt: new Date().toISOString(),
      summary: {
        documentCount: documents.length,
        sampleCount: samples.length,
        hasReferenceAnswers: samples.some(
          (item) => item.expectedAnswer.trim().length > 0,
        ),
        hasGoldSources: samples.some((item) => item.goldSources.length > 0),
      },
      config: {
        mode:
          manifest?.config?.mode === "retrieve-generate"
            ? "retrieve-generate"
            : "retrieve",
        topK:
          typeof manifest?.config?.topK === "number" ? manifest.config.topK : 8,
        topN:
          typeof manifest?.config?.topN === "number" ? manifest.config.topN : 3,
        repeat:
          typeof manifest?.config?.repeat === "number"
            ? manifest.config.repeat
            : 1,
        concurrency:
          typeof manifest?.config?.concurrency === "number"
            ? manifest.config.concurrency
            : 1,
        timeoutSeconds:
          typeof manifest?.config?.timeoutSeconds === "number"
            ? manifest.config.timeoutSeconds
            : 300,
      },
      documents,
      previewSamples: samples.slice(0, PREVIEW_SAMPLE_LIMIT),
      validations: createValidationReport(
        samples,
        Boolean(manifestEntryName),
        documents.length,
      ),
    };

    this.datasets.set(dataset.id, dataset);
    this.datasetSamples.set(dataset.id, samples);
    this.datasetKnowledgeBaseIds.set(dataset.id, manifest?.knowledgeBaseId);
    upsertEvaluationDataset({
      dataset,
      samples,
      knowledgeBaseId: manifest?.knowledgeBaseId,
    });
    return dataset;
  }

  listRuns(query?: EvaluationRunListQuery): EvaluationRunRecord[] {
    const runs = Array.from(this.runs.values()).sort((left, right) =>
      right.startedAt.localeCompare(left.startedAt)
    );

    if (!query?.status) {
      return runs;
    }

    return runs.filter((run) => run.status === query.status);
  }

  getRun(runId: string): EvaluationRunRecord | null {
    return this.runs.get(runId) ?? null;
  }

  deleteRun(runId: string): DeleteEvaluationRunResponse {
    const run = this.runs.get(runId);
    if (!run) {
      throw notFound(`Evaluation run "${runId}" was not found`);
    }

    if (run.status === "queued" || run.status === "running") {
      throw badRequest("Running evaluation records cannot be deleted");
    }

    const deleted = deletePersistedEvaluationRun(runId);
    this.runs.delete(runId);

    return {
      id: runId,
      deleted,
    };
  }

  createRun(input: CreateEvaluationRunBody): EvaluationRunRecord {
    const dataset = this.datasets.get(input.datasetId);
    if (!dataset) {
      throw notFound(`Evaluation dataset "${input.datasetId}" was not found`);
    }

    if (dataset.validations.some((item) => item.status === "error")) {
      throw badRequest("The evaluation dataset still contains validation errors");
    }

    const samples = this.datasetSamples.get(input.datasetId) ?? [];
    if (samples.length === 0) {
      throw badRequest("The evaluation dataset does not contain any runnable samples");
    }

    const startedAt = new Date().toISOString();
    const run: EvaluationRunRecord = {
      id: createRunId(),
      name:
        input.name?.trim() ||
        `${dataset.datasetName}-${startedAt.slice(0, 19).replace(/[:T]/g, "-")}`,
      dataset,
      status: "queued",
      startedAt,
      metrics: emptyMetrics(),
      logs: [
        this.createLogEntry("info", `已创建评测任务，等待执行：${dataset.datasetName}`),
      ],
      sampleResults: [],
    };

    this.runs.set(run.id, run);
    upsertEvaluationRun(run);
    queueMicrotask(() => {
      void this.executeRun(run.id);
    });
    return run;
  }

  private createLogEntry(
    level: EvaluationLogEntry["level"],
    text: string,
  ): EvaluationLogEntry {
    return {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      text,
    };
  }

  private appendLog(
    run: EvaluationRunRecord,
    level: EvaluationLogEntry["level"],
    text: string,
  ): void {
    run.logs.push(this.createLogEntry(level, text));
    if (run.logs.length > MAX_LOG_LINES) {
      run.logs.splice(0, run.logs.length - MAX_LOG_LINES);
    }
    upsertEvaluationRun(run);
  }

  private async executeRun(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      return;
    }

    const samples = this.datasetSamples.get(run.dataset.id) ?? [];
    const knowledgeBaseId = this.datasetKnowledgeBaseIds.get(run.dataset.id);
    const repeatCount = clampPositiveInteger(run.dataset.config.repeat, 1);
    const concurrency = clampPositiveInteger(run.dataset.config.concurrency, 1);
    const timeoutSeconds = clampPositiveInteger(
      run.dataset.config.timeoutSeconds,
      300,
    );

    run.status = "running";
    upsertEvaluationRun(run);
    this.appendLog(
      run,
      "info",
      `开始执行评测，共 ${samples.length} 条样本，模式 ${run.dataset.config.mode}，repeat=${repeatCount}，concurrency=${concurrency}，timeout=${timeoutSeconds}s`,
    );

    try {
      let nextIndex = 0;
      const workerCount = Math.min(concurrency, samples.length);
      const workers = Array.from({ length: workerCount }, (_, workerIndex) =>
        (async () => {
          while (true) {
            const currentIndex = nextIndex;
            nextIndex += 1;

            if (currentIndex >= samples.length) {
              return;
            }

            const sample = samples[currentIndex]!;
            this.appendLog(
              run,
              "info",
              `worker-${workerIndex + 1} 开始样本 ${currentIndex + 1}/${samples.length}: ${sample.id}`,
            );

            const result = await this.evaluateSample({
              sample,
              config: run.dataset.config,
              knowledgeBaseId,
              repeatCount,
              timeoutSeconds,
              onAttemptLog: (text, level = "info") => {
                this.appendLog(run, level, `[${sample.id}] ${text}`);
              },
            });

            run.sampleResults.push(result);
            run.metrics = this.computeMetrics(run.sampleResults);
            run.sampleResults.sort((left, right) => left.id.localeCompare(right.id));
            upsertEvaluationRun(run);

            this.appendLog(
              run,
              result.status === "success" ? "success" : "warning",
              result.status === "success"
                ? `完成样本 ${sample.id}: hit=${result.hit ? "yes" : "no"} latency=${(
                    result.latencyMs / 1000
                  ).toFixed(1)}s progress=${run.sampleResults.length}/${samples.length}`
                : `样本 ${sample.id} 失败: ${result.errorMessage ?? "unknown error"} progress=${run.sampleResults.length}/${samples.length}`,
            );
          }
        })(),
      );

      await Promise.all(workers);

      run.status = run.sampleResults.some((item) => item.status === "failed")
        ? "failed"
        : "completed";
      run.completedAt = new Date().toISOString();
      run.metrics = this.computeMetrics(run.sampleResults);
      upsertEvaluationRun(run);
      this.appendLog(run, "success", "批量评测完成，结果已汇总");
    } catch (error) {
      run.status = "failed";
      run.completedAt = new Date().toISOString();
      upsertEvaluationRun(run);
      this.appendLog(
        run,
        "error",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async evaluateSample(input: {
    sample: EvaluationDatasetSample;
    config: EvaluationDatasetRecord["config"];
    knowledgeBaseId?: string;
    repeatCount: number;
    timeoutSeconds: number;
    onAttemptLog?: (
      text: string,
      level?: EvaluationLogEntry["level"],
    ) => void;
  }): Promise<EvaluationSampleResult> {
    const goldSet = new Set(
      input.sample.goldSources.map((item) => normalizeSourceToken(item)),
    );
    const successfulAttempts: Array<{
      hit: boolean;
      recall: number;
      latencyMs: number;
      sourceHit: boolean;
      answerText: string;
      faithfulness: number;
      answerRelevance: number;
      answerCompleteness: number;
      matchedGoldSources: string[];
      retrievedSources: EvaluationRetrievedSource[];
    }> = [];
    const attempts: EvaluationSampleAttempt[] = [];
    const failedMessages: string[] = [];

    for (let attempt = 0; attempt < input.repeatCount; attempt += 1) {
      const startedAt = Date.now();
      input.onAttemptLog?.(
        `repeat ${attempt + 1}/${input.repeatCount} started`,
      );

      try {
        const retrievedSources = await withTimeout(
          input.config.mode === "retrieve-generate"
            ? ragPipeline
                .run({
                  question: input.sample.question,
                  knowledgeBaseId: input.knowledgeBaseId,
                  topK: input.config.topK,
                  topN: input.config.topN,
                })
                .then((result) => ({
                  answer: result.answer,
                  sources: result.sources,
                }))
            : ragPipeline.retrieveOnly({
                question: input.sample.question,
                knowledgeBaseId: input.knowledgeBaseId,
                topK: input.config.topK,
                topN: input.config.topN,
              }).then((sources) => ({
                answer: "",
                sources,
              })),
          input.timeoutSeconds * 1000,
          `sample timeout after ${input.timeoutSeconds}s`,
        );

        const latencyMs = Date.now() - startedAt;
        const answerText = retrievedSources.answer;
        const retrievedChunks = retrievedSources.sources;
        const retrievedNames = retrievedChunks.map((item) =>
          normalizeSourceToken(item.documentName),
        );
        const matchedNames = retrievedNames.filter((item) => goldSet.has(item));
        const matchedGoldSources = Array.from(new Set(matchedNames));
        const hit = matchedNames.length > 0;
        const recall =
          goldSet.size > 0
            ? new Set(matchedNames).size / goldSet.size
            : 0;
        const sourceHit = hit;
        const faithfulness =
          input.config.mode === "retrieve-generate"
            ? this.computeFaithfulnessFromSources(
                retrievedChunks,
                answerText,
                input.sample.expectedAnswer,
              )
            : 0;
        const answerRelevance =
          input.config.mode === "retrieve-generate"
            ? this.computeAnswerRelevance(
                input.sample.question,
                answerText,
                input.sample.expectedAnswer,
              )
            : 0;
        const answerCompleteness =
          input.config.mode === "retrieve-generate"
            ? this.computeAnswerCompleteness(
                answerText,
                input.sample.expectedAnswer,
              )
            : 0;

        const retrievedSourcePreviews = retrievedChunks.map(
          toRetrievedSourcePreview,
        );

        successfulAttempts.push({
          hit,
          recall,
          latencyMs,
          sourceHit,
          answerText,
          faithfulness,
          answerRelevance,
          answerCompleteness,
          matchedGoldSources,
          retrievedSources: retrievedSourcePreviews,
        });
        attempts.push({
          attempt: attempt + 1,
          status: "success",
          latencyMs,
          hit,
          recall,
          faithfulness,
          answerRelevance,
          answerCompleteness,
          retrievedSources: retrievedSourcePreviews,
          answerText,
        });
        input.onAttemptLog?.(
          `repeat ${attempt + 1}/${input.repeatCount} finished hit=${hit ? "yes" : "no"} latency=${(
            latencyMs / 1000
          ).toFixed(1)}s`,
          "success",
        );
      } catch (error) {
        const latencyMs = Date.now() - startedAt;
        const message =
          error instanceof Error ? error.message : String(error);
        failedMessages.push(`attempt ${attempt + 1}: ${message}`);
        attempts.push({
          attempt: attempt + 1,
          status: "failed",
          latencyMs,
          hit: false,
          recall: 0,
          faithfulness: 0,
          answerRelevance: 0,
          answerCompleteness: 0,
          retrievedSources: [],
          errorMessage: message,
        });
        input.onAttemptLog?.(
          `repeat ${attempt + 1}/${input.repeatCount} failed after ${(
            latencyMs / 1000
          ).toFixed(1)}s: ${message}`,
          "warning",
        );
      }
    }

    if (successfulAttempts.length === 0) {
      return {
        id: input.sample.id,
        question: input.sample.question,
        goldSources: input.sample.goldSources,
        matchedGoldSources: [],
        retrievedSources: [],
        answerText: "",
        referenceAnswer: input.sample.expectedAnswer,
        status: "failed",
        hit: false,
        recall: 0,
        latencyMs: input.timeoutSeconds * 1000,
        sourceHit: false,
        faithfulness: 0,
        answerRelevance: 0,
        answerCompleteness: 0,
        attempts,
        errorMessage: failedMessages.join(" | "),
      };
    }

    const attemptCount = successfulAttempts.length;
    const bestAttempt =
      [...successfulAttempts].sort((left, right) => {
        if (right.recall !== left.recall) {
          return right.recall - left.recall;
        }
        if (right.hit !== left.hit) {
          return Number(right.hit) - Number(left.hit);
        }
        return left.latencyMs - right.latencyMs;
      })[0] ?? successfulAttempts[0]!;
    const matchedGoldSources = Array.from(
      new Set(successfulAttempts.flatMap((item) => item.matchedGoldSources)),
    );
    return {
      id: input.sample.id,
      question: input.sample.question,
      goldSources: input.sample.goldSources,
      matchedGoldSources,
      retrievedSources: bestAttempt.retrievedSources,
      answerText: bestAttempt.answerText,
      referenceAnswer: input.sample.expectedAnswer,
      status: failedMessages.length > 0 ? "failed" : "success",
      hit: successfulAttempts.some((item) => item.hit),
      recall:
        successfulAttempts.reduce((sum, item) => sum + item.recall, 0) /
        attemptCount,
      latencyMs:
        successfulAttempts.reduce((sum, item) => sum + item.latencyMs, 0) /
        attemptCount,
      sourceHit: successfulAttempts.some((item) => item.sourceHit),
      faithfulness:
        successfulAttempts.reduce((sum, item) => sum + item.faithfulness, 0) /
        attemptCount,
      answerRelevance:
        successfulAttempts.reduce((sum, item) => sum + item.answerRelevance, 0) /
        attemptCount,
      answerCompleteness:
        successfulAttempts.reduce((sum, item) => sum + item.answerCompleteness, 0) /
        attemptCount,
      attempts,
      ...(failedMessages.length > 0
        ? { errorMessage: failedMessages.join(" | ") }
        : {}),
    };
  }

  private computeFaithfulnessFromSources(
    sources: RetrievedChunk[],
    answerText: string,
    expectedAnswer: string,
  ): number {
    const answerBasis = answerText.trim() || expectedAnswer.trim();
    if (!answerBasis) {
      return sources.length > 0 ? 1 : 0;
    }

    const answerTokens = new Set(tokenizeText(answerBasis));
    if (answerTokens.size === 0) {
      return sources.length > 0 ? 1 : 0;
    }

    const sourceTokens = new Set(
      sources.flatMap((item) => tokenizeText(item.content)),
    );
    let overlapCount = 0;
    for (const token of answerTokens) {
      if (sourceTokens.has(token)) {
        overlapCount += 1;
      }
    }

    return overlapCount / answerTokens.size;
  }

  private computeAnswerRelevance(
    question: string,
    answerText: string,
    expectedAnswer: string,
  ): number {
    if (!answerText.trim()) {
      return 0;
    }

    const questionTokens = new Set(tokenizeText(question));
    const answerTokens = new Set(tokenizeText(answerText));
    const expectedTokens = new Set(tokenizeText(expectedAnswer));

    if (questionTokens.size === 0 || answerTokens.size === 0) {
      return 0;
    }

    let questionOverlap = 0;
    for (const token of questionTokens) {
      if (answerTokens.has(token)) {
        questionOverlap += 1;
      }
    }

    let expectedOverlap = 0;
    for (const token of expectedTokens) {
      if (answerTokens.has(token)) {
        expectedOverlap += 1;
      }
    }

    const questionScore = questionOverlap / questionTokens.size;
    const expectedScore =
      expectedTokens.size > 0 ? expectedOverlap / expectedTokens.size : questionScore;

    return Math.min(1, questionScore * 0.6 + expectedScore * 0.4);
  }

  private computeAnswerCompleteness(
    answerText: string,
    expectedAnswer: string,
  ): number {
    if (!expectedAnswer.trim()) {
      return answerText.trim() ? 1 : 0;
    }

    const answerTokens = new Set(tokenizeText(answerText));
    const expectedTokens = new Set(tokenizeText(expectedAnswer));
    if (expectedTokens.size === 0) {
      return answerText.trim() ? 1 : 0;
    }

    let overlapCount = 0;
    for (const token of expectedTokens) {
      if (answerTokens.has(token)) {
        overlapCount += 1;
      }
    }

    return overlapCount / expectedTokens.size;
  }

  private computeMetrics(
    sampleResults: EvaluationSampleResult[],
  ): EvaluationMetricSummary {
    const total = sampleResults.length || 1;
    const successItems = sampleResults.filter((item) => item.status === "success");
    const successCount = successItems.length || 1;

    return {
      hitAtK: sampleResults.filter((item) => item.hit).length / total,
      recallAtK:
        sampleResults.reduce((sum, item) => sum + item.recall, 0) / total,
      mrr:
        sampleResults.reduce(
          (sum, item) => sum + (item.hit ? Math.max(item.recall, 1 / 3) : 0),
          0,
        ) / total,
      faithfulness:
        successItems.reduce((sum, item) => sum + item.faithfulness, 0) /
        successCount,
      answerRelevance:
        successItems.reduce((sum, item) => sum + item.answerRelevance, 0) /
        successCount,
      answerCompleteness:
        successItems.reduce((sum, item) => sum + item.answerCompleteness, 0) /
        successCount,
      sourceHitRate:
        sampleResults.filter((item) => item.sourceHit).length / total,
      averageLatencyMs:
        sampleResults.reduce((sum, item) => sum + item.latencyMs, 0) / total,
      failedCount:
        sampleResults.filter((item) => item.status === "failed").length,
    };
  }

  private hydrateFromPersistence(): void {
    for (const item of listPersistedEvaluationDatasets()) {
      this.datasets.set(item.dataset.id, item.dataset);
      this.datasetSamples.set(item.dataset.id, item.samples);
      this.datasetKnowledgeBaseIds.set(item.dataset.id, item.knowledgeBaseId);
    }

    for (const run of listPersistedEvaluationRuns()) {
      this.runs.set(run.id, run);
    }
  }

  initializePersistence(): void {
    if (this.datasets.size > 0 || this.runs.size > 0) {
      return;
    }

    this.hydrateFromPersistence();
  }
}

export const evaluationService = new EvaluationService();
