// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
  ApiError: class MockApiError extends Error {},
}));

vi.mock("@/shared/lib/sessionStorage", () => ({
  getSession: vi.fn(() => ({ token: "token-1", user: { username: "alice" } })),
}));

vi.mock("@/shared/platform/desktopRuntime", () => ({
  getApiBaseUrl: vi.fn(() => "http://localhost:3000"),
}));

import { get, post, del } from "@/shared/lib/request";
import {
  parseEvaluationDataset,
  createEvaluationRun,
  generateEvaluationPackage,
  getEvaluationRuns,
  getEvaluationRun,
  deleteEvaluationRun,
  deleteEvaluationRuns,
  type EvaluationDatasetRecord,
  type EvaluationRunRecord,
} from "../evaluation";

const sampleDataset: EvaluationDatasetRecord = {
  id: "ds-1",
  datasetName: "dataset",
  fileName: "ds.json",
  fileSize: 100,
  uploadedAt: "2026-07-06T00:00:00.000Z",
  knowledgeBaseId: null,
  summary: {
    documentCount: 1,
    sampleCount: 2,
    hasReferenceAnswers: true,
    hasGoldSources: true,
  },
  config: {
    mode: "retrieve-generate",
    topK: 5,
    topN: 3,
    repeat: 1,
    concurrency: 1,
    timeoutSeconds: 30,
  },
  documents: [],
  previewSamples: [],
  validations: [],
};

const sampleRun: EvaluationRunRecord = {
  id: "run-1",
  name: "run",
  dataset: sampleDataset,
  status: "completed",
  startedAt: "2026-07-06T00:00:00.000Z",
  completedAt: "2026-07-06T00:00:00.000Z",
  metrics: {
    hitAtK: 0.9,
    recallAtK: 0.8,
    mrr: 0.7,
    faithfulness: 0.6,
    answerRelevance: 0.5,
    answerCompleteness: 0.4,
    sourceHitRate: 0.3,
    averageLatencyMs: 100,
    failedCount: 0,
  },
  logs: [],
  sampleResults: [],
};

describe("evaluation api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("parseEvaluationDataset 上传文件并返回数据集", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleDataset);

    const file = new File(["{}"], "ds.json", { type: "application/json" });
    const result = await parseEvaluationDataset(file);

    expect(post).toHaveBeenCalledWith(
      "/evaluation/datasets/parse",
      expect.any(FormData),
    );
    expect(result).toBe(sampleDataset);
  });

  it("createEvaluationRun 创建评测任务", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleRun);

    const result = await createEvaluationRun({
      datasetId: "ds-1",
      name: "run",
    });

    expect(post).toHaveBeenCalledWith("/evaluation/runs", {
      datasetId: "ds-1",
      name: "run",
    });
    expect(result).toBe(sampleRun);
  });

  it("getEvaluationRuns 支持状态过滤", async () => {
    vi.mocked(get).mockResolvedValueOnce([sampleRun]);

    const result = await getEvaluationRuns({ status: "completed" });

    expect(get).toHaveBeenCalledWith("/evaluation/runs?status=completed");
    expect(result).toEqual([sampleRun]);
  });

  it("getEvaluationRun 获取单个任务", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleRun);

    const result = await getEvaluationRun("run-1");

    expect(get).toHaveBeenCalledWith("/evaluation/runs/run-1");
    expect(result).toBe(sampleRun);
  });

  it("deleteEvaluationRun 删除单个任务", async () => {
    vi.mocked(del).mockResolvedValueOnce({ id: "run-1", deleted: true });

    const result = await deleteEvaluationRun("run-1");

    expect(del).toHaveBeenCalledWith("/evaluation/runs/run-1");
    expect(result).toEqual({ id: "run-1", deleted: true });
  });

  it("deleteEvaluationRuns 批量删除任务", async () => {
    vi.mocked(post).mockResolvedValueOnce({ deletedIds: ["run-1", "run-2"] });

    const result = await deleteEvaluationRuns(["run-1", "run-2"]);

    expect(post).toHaveBeenCalledWith("/evaluation/runs/batch-delete", {
      runIds: ["run-1", "run-2"],
    });
    expect(result).toEqual({ deletedIds: ["run-1", "run-2"] });
  });

  it("generateEvaluationPackage 下载评测包", async () => {
    const blob = new Blob(["zip"], { type: "application/zip" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          "content-disposition": 'attachment; filename="package.zip"',
        }),
        blob: vi.fn().mockResolvedValue(blob),
      }),
    );

    const input = {
      datasetName: "ds",
      knowledgeBaseId: "kb-1",
      sampleCount: 10,
      documentCount: 2,
      chunksPerDocument: 5,
      mode: "retrieve" as const,
      topK: 5,
      topN: 3,
      repeat: 1,
      concurrency: 1,
      timeoutSeconds: 30,
    };
    const result = await generateEvaluationPackage(input);

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/evaluation/packages/generate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
        }),
        body: JSON.stringify(input),
      }),
    );
    expect(result.blob).toBe(blob);
    expect(result.fileName).toBe("package.zip");
  });
});
