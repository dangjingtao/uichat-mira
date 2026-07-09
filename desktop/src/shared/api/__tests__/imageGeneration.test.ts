import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/shared/platform/desktopRuntime", () => ({
  getApiBaseUrl: () => "/api",
}));

import { get, post } from "@/shared/lib/request";
import {
  createImageGeneration,
  getImageGeneration,
  getImageGenerationArtifactContentUrl,
  type ImageGenerationJob,
} from "../imageGeneration";

const sampleJob: ImageGenerationJob = {
  id: "imggen_1",
  providerId: "openai_images",
  executionKind: "sync-http",
  status: "queued",
  requestSummary: {
    providerId: "openai_images",
    model: "gpt-image-1",
    prompt: "A brass robot in a tea shop",
    negativePrompt: undefined,
    size: "1024x1024",
    stylePreset: "cinematic",
    count: 1,
    seed: 7,
    providerParamKeys: ["quality"],
    inputFileCount: 0,
    hasWorkflowApiJson: false,
  },
  artifacts: [],
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
};

describe("image generation api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts create requests to the image generation route", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleJob);

    const payload = {
      providerId: "openai_images",
      model: "gpt-image-1",
      prompt: "A brass robot in a tea shop",
      size: "1024x1024",
      stylePreset: "cinematic",
      count: 1,
      seed: 7,
      providerParams: {
        quality: "high",
      },
    };

    const result = await createImageGeneration(payload);

    expect(post).toHaveBeenCalledWith(
      "/microapps/image-generation/generations",
      payload,
    );
    expect(result).toBe(sampleJob);
  });

  it("gets a generation job by encoded id", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleJob);

    const result = await getImageGeneration("job/with spaces");

    expect(get).toHaveBeenCalledWith(
      "/microapps/image-generation/generations/job%2Fwith%20spaces",
      undefined,
    );
    expect(result).toBe(sampleJob);
  });

  it("requests server-side refresh when asked", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleJob);

    await getImageGeneration("job-refresh", { refresh: true });

    expect(get).toHaveBeenCalledWith(
      "/microapps/image-generation/generations/job-refresh",
      {
        params: {
          refresh: "true",
        },
      },
    );
  });

  it("builds the artifact content url from the backend api base", () => {
    expect(
      getImageGenerationArtifactContentUrl("job/with spaces", "artifact#1"),
    ).toBe(
      "/api/microapps/image-generation/generations/job%2Fwith%20spaces/artifacts/artifact%231/content",
    );
  });
});
