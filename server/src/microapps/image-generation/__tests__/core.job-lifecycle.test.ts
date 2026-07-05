import assert from "node:assert/strict";
import { test } from "vitest";
import {
  createImageGenerationJob,
  transitionImageGenerationJob,
} from "../core/job-lifecycle.js";

test("image generation job lifecycle moves from queued to running to succeeded", () => {
  const queuedJob = createImageGenerationJob({
    id: "job-1",
    providerId: "provider-a",
    executionKind: "sync-http",
    requestSummary: {
      providerId: "provider-a",
      prompt: "a lighthouse",
      providerParamKeys: ["quality"],
      inputFileCount: 0,
      hasWorkflowApiJson: false,
    },
    createdAt: "2026-07-06T10:00:00.000Z",
  });

  const runningJob = transitionImageGenerationJob(queuedJob, "running", {
    at: "2026-07-06T10:00:01.000Z",
    providerJobId: "provider-job-1",
  });

  const succeededJob = transitionImageGenerationJob(runningJob, "succeeded", {
    at: "2026-07-06T10:00:02.000Z",
    artifacts: [
      {
        id: "artifact-1",
        type: "image",
        mimeType: "image/png",
        source: "local-file",
        localPath: ".artifacts/out.png",
      },
    ],
    clearError: true,
  });

  assert.equal(runningJob.status, "running");
  assert.equal(runningJob.startedAt, "2026-07-06T10:00:01.000Z");
  assert.equal(runningJob.providerJobId, "provider-job-1");
  assert.equal(succeededJob.status, "succeeded");
  assert.equal(succeededJob.completedAt, "2026-07-06T10:00:02.000Z");
  assert.equal(succeededJob.artifacts.length, 1);
});

test("image generation job lifecycle rejects terminal to running transitions", () => {
  const succeededJob = {
    ...createImageGenerationJob({
      id: "job-2",
      providerId: "provider-a",
      executionKind: "sync-http",
      requestSummary: {
        providerId: "provider-a",
        providerParamKeys: [],
        inputFileCount: 0,
        hasWorkflowApiJson: false,
      },
      createdAt: "2026-07-06T10:00:00.000Z",
    }),
    status: "succeeded" as const,
    completedAt: "2026-07-06T10:00:01.000Z",
  };

  assert.throws(
    () =>
      transitionImageGenerationJob(succeededJob, "running", {
        at: "2026-07-06T10:00:02.000Z",
      }),
    /Invalid image generation job status transition/,
  );
});

test("image generation job lifecycle treats blocked as terminal", () => {
  const blockedJob = {
    ...createImageGenerationJob({
      id: "job-3",
      providerId: "provider-a",
      executionKind: "async-job",
      requestSummary: {
        providerId: "provider-a",
        providerParamKeys: [],
        inputFileCount: 0,
        hasWorkflowApiJson: false,
      },
      createdAt: "2026-07-06T10:00:00.000Z",
    }),
    status: "blocked" as const,
    completedAt: "2026-07-06T10:00:01.000Z",
  };

  assert.throws(
    () =>
      transitionImageGenerationJob(blockedJob, "running", {
        at: "2026-07-06T10:00:02.000Z",
      }),
    /Invalid image generation job status transition/,
  );
});
