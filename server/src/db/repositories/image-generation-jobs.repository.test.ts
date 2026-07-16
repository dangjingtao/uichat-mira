import assert from "node:assert/strict";
import fs from "node:fs";
import { afterAll, beforeAll, test } from "vitest";
import { resetDatabaseClients } from "@/db/index.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { imageGenerationJobsRepository } from "./image-generation-jobs.repository.js";
import { createImageGenerationService } from "@/microapps/image-generation/core/service.js";
import { LocalImageGenerationArtifactStore } from "@/microapps/image-generation/artifacts/store.js";

const dbPath = createTimestampedTestArtifactPath("db", "image-generation-persistence", ".sqlite");

beforeAll(() => {
  process.env.DATABASE_URL = `file:${dbPath}`;
  imageGenerationJobsRepository.initialize();
});

afterAll(() => {
  resetDatabaseClients();
  fs.rmSync(dbPath, { force: true });
});

test("persists a generation job across database client restart", async () => {
  const job = {
    id: "restart-job",
    providerId: "test",
    executionKind: "sync-http" as const,
    status: "succeeded" as const,
    requestSummary: { providerId: "test", providerParamKeys: [], inputFileCount: 0, hasWorkflowApiJson: false },
    artifacts: [{ id: "artifact", type: "image" as const, source: "base64" as const, mimeType: "image/png", localPath: "D:\\media\\result.png" }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
  };
  await imageGenerationJobsRepository.create(job);
  resetDatabaseClients();
  imageGenerationJobsRepository.initialize();
  assert.deepEqual(await imageGenerationJobsRepository.getById(job.id), job);
});

test("image generation service restores a real artifact after database client restart", async () => {
  const artifactRoot = createTimestampedTestArtifactPath("media", "image-service-restart");
  const artifactStore = new LocalImageGenerationArtifactStore({ rootDir: artifactRoot });
  const adapter = { providerId: "restart-provider", executionKind: "sync-http" as const, async startGeneration() {
    return { status: "succeeded" as const, artifacts: [{ type: "image" as const, mimeType: "image/png", source: "base64" as const, base64Data: Buffer.from("real-png").toString("base64"), fileName: "result.png" }] };
  } };
  const createService = () => createImageGenerationService({ adapterRegistry: { getAdapter: (id) => id === adapter.providerId ? adapter : null }, artifactStore, jobStore: imageGenerationJobsRepository, createId: () => "service-restart-job" });
  const firstService = createService();
  const created = await firstService.createGeneration({ providerId: adapter.providerId, prompt: "persist this" });
  const artifactPath = created.artifacts[0]!.localPath!;
  assert.equal(fs.existsSync(artifactPath), true);
  resetDatabaseClients();
  imageGenerationJobsRepository.initialize();
  const restored = await createService().getGeneration(created.id);
  assert.equal(restored?.id, created.id);
  assert.equal(restored?.artifacts[0]?.localPath, artifactPath);
  assert.equal(fs.readFileSync(restored!.artifacts[0]!.localPath!, "utf8"), "real-png");
  fs.rmSync(artifactRoot, { recursive: true, force: true });
});
