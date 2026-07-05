import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ImageGenerationProviderNotFoundError,
  ImageGenerationRequestValidationError,
  createImageGenerationService,
  createInMemoryImageGenerationJobStore,
} from "../core/service.js";
import type {
  ImageGenerationAdapterRegistry,
  ImageGenerationArtifactStore,
  ImageGenerationProviderAdapter,
} from "../core/types.js";

const createRegistry = (
  adapters: ImageGenerationProviderAdapter[],
): ImageGenerationAdapterRegistry => ({
  getAdapter(providerId) {
    return adapters.find((item) => item.providerId === providerId) ?? null;
  },
});

test("image generation service orchestrates sync adapter and artifact materialization", async () => {
  const calls: string[] = [];
  const adapter: ImageGenerationProviderAdapter = {
    providerId: "provider-sync",
    executionKind: "sync-http",
    async startGeneration({ job, requestSummary }) {
      calls.push(`start:${job.id}:${requestSummary.providerId}`);
      return {
        status: "succeeded",
        artifacts: [
          {
            type: "image",
            mimeType: "image/png",
            source: "remote-url",
            remoteUrl: "https://example.test/result.png",
          },
        ],
      };
    },
  };
  const artifactStore: ImageGenerationArtifactStore = {
    async materializeArtifacts({ job, artifacts }) {
      calls.push(`artifacts:${job.id}:${artifacts.length}`);
      return [
        {
          id: "artifact-1",
          type: "image",
          mimeType: "image/png",
          source: "local-file",
          localPath: `.test-artifact/${job.id}.png`,
        },
      ];
    },
  };

  const service = createImageGenerationService({
    adapterRegistry: createRegistry([adapter]),
    artifactStore,
    jobStore: createInMemoryImageGenerationJobStore(),
    now: () => "2026-07-06T12:00:00.000Z",
    createId: () => "job-sync-1",
  });

  const job = await service.createGeneration({
    providerId: "provider-sync",
    prompt: "sunrise over the lake",
    providerParams: {
      quality: "high",
    },
  });

  assert.deepEqual(calls, [
    "start:job-sync-1:provider-sync",
    "artifacts:job-sync-1:1",
  ]);
  assert.equal(job.status, "succeeded");
  assert.equal(job.executionKind, "sync-http");
  assert.deepEqual(job.requestSummary.providerParamKeys, ["quality"]);
  assert.equal(job.artifacts[0]?.source, "local-file");
});

test("image generation service refreshes async jobs through the adapter registry", async () => {
  let pollCount = 0;
  const adapter: ImageGenerationProviderAdapter = {
    providerId: "provider-async",
    executionKind: "async-job",
    async startGeneration() {
      return {
        status: "queued",
        providerJobId: "provider-job-2",
      };
    },
    async getGeneration({ job }) {
      pollCount += 1;
      return {
        status: "succeeded",
        providerJobId: job.providerJobId,
        artifacts: [
          {
            type: "image",
            mimeType: "image/webp",
            source: "local-file",
            localPath: `.test-artifact/${job.id}.webp`,
          },
        ],
      };
    },
  };
  const artifactStore: ImageGenerationArtifactStore = {
    async materializeArtifacts({ artifacts }) {
      return artifacts.map((artifact, index) => ({
        id: `artifact-${index + 1}`,
        type: artifact.type,
        mimeType: artifact.mimeType,
        source: artifact.source,
        localPath: artifact.localPath,
      }));
    },
  };
  const service = createImageGenerationService({
    adapterRegistry: createRegistry([adapter]),
    artifactStore,
    jobStore: createInMemoryImageGenerationJobStore(),
    now: (() => {
      const timestamps = [
        "2026-07-06T12:00:00.000Z",
        "2026-07-06T12:00:01.000Z",
      ];
      let index = 0;
      return () => timestamps[Math.min(index++, timestamps.length - 1)];
    })(),
    createId: () => "job-async-1",
  });

  const queuedJob = await service.createGeneration({
    providerId: "provider-async",
    prompt: "city skyline at dusk",
  });
  const completedJob = await service.refreshGeneration(queuedJob.id);

  assert.equal(queuedJob.status, "queued");
  assert.equal(queuedJob.providerJobId, "provider-job-2");
  assert.equal(pollCount, 1);
  assert.equal(completedJob.status, "succeeded");
  assert.equal(completedJob.artifacts.length, 1);
});

test("image generation service throws when provider is not registered", async () => {
  const service = createImageGenerationService({
    adapterRegistry: createRegistry([]),
    artifactStore: {
      async materializeArtifacts() {
        return [];
      },
    },
    jobStore: createInMemoryImageGenerationJobStore(),
  });

  await assert.rejects(
    () =>
      service.createGeneration({
        providerId: "missing-provider",
        prompt: "test",
      }),
    ImageGenerationProviderNotFoundError,
  );
});

test("image generation service rejects empty requests without prompt or workflow", async () => {
  const service = createImageGenerationService({
    adapterRegistry: createRegistry([
      {
        providerId: "provider-sync",
        executionKind: "sync-http",
        async startGeneration() {
          return {
            status: "succeeded",
          };
        },
      },
    ]),
    artifactStore: {
      async materializeArtifacts() {
        return [];
      },
    },
    jobStore: createInMemoryImageGenerationJobStore(),
  });

  await assert.rejects(
    () =>
      service.createGeneration({
        providerId: "provider-sync",
      }),
    ImageGenerationRequestValidationError,
  );
});

test("image generation service does not refresh blocked jobs", async () => {
  let pollCount = 0;
  const adapter: ImageGenerationProviderAdapter = {
    providerId: "provider-async",
    executionKind: "async-job",
    async startGeneration() {
      return {
        status: "blocked",
        error: {
          code: "CONFIG_MISSING",
          message: "missing config",
        },
      };
    },
    async getGeneration() {
      pollCount += 1;
      return {
        status: "succeeded",
      };
    },
  };

  const service = createImageGenerationService({
    adapterRegistry: createRegistry([adapter]),
    artifactStore: {
      async materializeArtifacts() {
        return [];
      },
    },
    jobStore: createInMemoryImageGenerationJobStore(),
    createId: () => "job-blocked-1",
    now: () => "2026-07-06T12:00:00.000Z",
  });

  const blockedJob = await service.createGeneration({
    providerId: "provider-async",
    prompt: "test",
  });
  const refreshedJob = await service.refreshGeneration(blockedJob.id);

  assert.equal(blockedJob.status, "blocked");
  assert.equal(refreshedJob.status, "blocked");
  assert.equal(pollCount, 0);
});
