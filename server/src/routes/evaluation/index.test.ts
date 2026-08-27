import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendRouteError } from "@/utils/route-errors.js";

const mocks = vi.hoisted(() => ({
  readSingleZipUpload: vi.fn(),
  isMultipartTooLargeError: vi.fn(),
  parseDataset: vi.fn(),
  listRuns: vi.fn(),
  getRun: vi.fn(),
  deleteRun: vi.fn(),
  deleteRuns: vi.fn(),
  createRun: vi.fn(),
  generateArchive: vi.fn(),
}));

vi.mock("./multipart.js", () => ({
  EvaluationMultipartValidationError: class EvaluationMultipartValidationError extends Error {},
  readSingleZipUpload: mocks.readSingleZipUpload,
  isMultipartTooLargeError: mocks.isMultipartTooLargeError,
}));
vi.mock("@/services/evaluation.service.js", () => ({
  evaluationService: {
    parseDataset: mocks.parseDataset,
    listRuns: mocks.listRuns,
    getRun: mocks.getRun,
    deleteRun: mocks.deleteRun,
    deleteRuns: mocks.deleteRuns,
    createRun: mocks.createRun,
  },
}));
vi.mock("@/services/evaluation-package-generator.service.js", () => ({
  evaluationPackageGeneratorService: { generateArchive: mocks.generateArchive },
}));

import { EvaluationMultipartValidationError } from "./multipart.js";
import evaluationRoute from "./index.js";

const createApp = async () => {
  const app = Fastify();
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));
  app.setErrorHandler(sendRouteError);
  await app.register(evaluationRoute);
  return app;
};

const dataset = { id: "dataset-1", datasetName: "Regression" };
const run = { id: "run-1", name: "Recovered run", status: "failed", dataset };

describe("evaluation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readSingleZipUpload.mockResolvedValue({ fileName: "evaluation.zip", buffer: Buffer.from("zip") });
    mocks.parseDataset.mockReturnValue(dataset);
    mocks.listRuns.mockReturnValue([run]);
    mocks.getRun.mockReturnValue(run);
    mocks.createRun.mockReturnValue(run);
    mocks.deleteRun.mockReturnValue({ id: "run-1", deleted: true });
    mocks.deleteRuns.mockReturnValue({ deletedIds: ["run-1"] });
    mocks.isMultipartTooLargeError.mockReturnValue(false);
  });

  it("imports an evaluation package and returns the cached dataset record", async () => {
    const app = await createApp();
    const response = await app.inject({ method: "POST", url: "/evaluation/datasets/parse" });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(dataset);
    expect(mocks.parseDataset).toHaveBeenCalledWith(expect.objectContaining({ fileName: "evaluation.zip" }));
    await app.close();
  });

  it("maps invalid packages to 400 without invoking the parser", async () => {
    mocks.readSingleZipUpload.mockRejectedValue(new EvaluationMultipartValidationError("manifest.json is required"));
    const app = await createApp();
    const response = await app.inject({ method: "POST", url: "/evaluation/datasets/parse" });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe("manifest.json is required");
    expect(mocks.parseDataset).not.toHaveBeenCalled();
    await app.close();
  });

  it("lists and restores persisted run details after a failed run", async () => {
    const app = await createApp();
    const list = await app.inject({ method: "GET", url: "/evaluation/runs?status=failed" });
    expect(list.statusCode).toBe(200);
    expect(mocks.listRuns).toHaveBeenCalledWith({ status: "failed" });

    const detail = await app.inject({ method: "GET", url: "/evaluation/runs/run-1" });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data).toEqual(run);
    await app.close();
  });

  it("returns 404 for a missing persisted run", async () => {
    mocks.getRun.mockReturnValue(null);
    const app = await createApp();
    const response = await app.inject({ method: "GET", url: "/evaluation/runs/missing" });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
