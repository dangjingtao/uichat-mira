import assert from "node:assert/strict";
import fs from "node:fs";
import { afterAll, test } from "vitest";
import Fastify from "fastify";
import { createAccessToken, initializeAuthDatabase } from "@/db/auth.db";
import { resetDatabaseClients } from "@/db/index.js";
import { initializeKnowledgeBaseDatabase } from "@/db/knowledge-base.db";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { userRepository } from "@/db/repositories/index.js";
import { initializeRoleDatabase } from "@/db/role.db";
import { initializeThreadDatabase } from "@/db/thread.db";
import {
  ImageGenerationJobNotFoundError,
  ImageGenerationRequestValidationError,
  type ImageGenerationJob,
} from "@/microapps/image-generation/index.js";
import { getLoggerConfig } from "@/logger";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { sendRouteError } from "@/utils/route-errors.js";
import microappsRoute, { type ImageGenerationRouteService } from "./index.js";

const testDbPath = createTimestampedTestArtifactPath(
  "db",
  "rag-demo-microapps-routes",
  ".sqlite",
);

process.env.DATABASE_URL = `file:${testDbPath}`;
resetDatabaseClients();

initializeAuthDatabase();
initializeModelConfigDatabase();
initializeKnowledgeBaseDatabase();
initializeThreadDatabase();
initializeRoleDatabase();

afterAll(() => {
  resetDatabaseClients();
  try {
    fs.rmSync(testDbPath, { force: true });
  } catch {
    // ignore cleanup failure on Windows file locking
  }
});

const createTestJob = (
  overrides: Partial<ImageGenerationJob> = {},
): ImageGenerationJob => ({
  id: "job-1",
  providerId: "provider-sync",
  executionKind: "sync-http",
  status: "succeeded",
  requestSummary: {
    providerId: "provider-sync",
    prompt: "sunrise over the river",
    providerParamKeys: [],
    inputFileCount: 0,
    hasWorkflowApiJson: false,
  },
  artifacts: [
    {
      id: "artifact-1",
      type: "image",
      mimeType: "image/png",
      source: "remote-url",
      remoteUrl: "https://example.test/image.png",
    },
  ],
  createdAt: "2026-07-06T12:00:00.000Z",
  updatedAt: "2026-07-06T12:00:00.000Z",
  ...overrides,
});

const createApp = async (service: ImageGenerationRouteService) => {
  const app = Fastify({
    logger: getLoggerConfig(),
    serializerOpts: { encoding: "utf8" },
  });
  app.setErrorHandler(sendRouteError);
  await app.register(microappsRoute, {
    imageGenerationService: service,
  });
  return app;
};

const createToken = () => {
  const user = userRepository.create({
    username: `image-generation-user-${crypto.randomUUID()}`,
    passwordHash: "hash",
    role: "user",
    isActive: true,
  });

  return createAccessToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });
};

test("microapps image generation routes create and query jobs", async () => {
  const createdJob = createTestJob();
  const service: ImageGenerationRouteService = {
    async createGeneration(request) {
      assert.equal(request.providerId, "provider-sync");
      assert.equal(request.prompt, "sunrise over the river");
      return createdJob;
    },
    async getGeneration(jobId) {
      assert.equal(jobId, createdJob.id);
      return createdJob;
    },
  };
  const app = await createApp(service);
  const token = createToken();

  const createResponse = await app.inject({
    method: "POST",
    url: "/microapps/image-generation/generations",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    payload: {
      providerId: "provider-sync",
      prompt: "sunrise over the river",
    },
  });

  assert.equal(createResponse.statusCode, 200, createResponse.body);
  assert.equal(createResponse.json().data.generationId, createdJob.id);
  assert.equal(
    createResponse.json().data.requestSummary.prompt,
    "sunrise over the river",
  );

  const getResponse = await app.inject({
    method: "GET",
    url: `/microapps/image-generation/generations/${createdJob.id}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(getResponse.statusCode, 200, getResponse.body);
  assert.equal(getResponse.json().data.status, "succeeded");
  assert.equal(
    getResponse.json().data.artifacts[0].remoteUrl,
    "https://example.test/image.png",
  );

  await app.close();
});

test("microapps image generation routes reject missing auth", async () => {
  const service: ImageGenerationRouteService = {
    async createGeneration() {
      return createTestJob();
    },
    async getGeneration() {
      return createTestJob();
    },
  };
  const app = await createApp(service);

  const response = await app.inject({
    method: "POST",
    url: "/microapps/image-generation/generations",
    headers: {
      "content-type": "application/json",
    },
    payload: {
      providerId: "provider-sync",
      prompt: "missing auth",
    },
  });

  assert.equal(response.statusCode, 401, response.body);
  assert.equal(response.json().message, "Missing auth token");

  await app.close();
});

test("microapps image generation routes map job not found to 404", async () => {
  const service: ImageGenerationRouteService = {
    async createGeneration() {
      return createTestJob();
    },
    async getGeneration() {
      throw new ImageGenerationJobNotFoundError("job-missing");
    },
  };
  const app = await createApp(service);
  const token = createToken();

  const response = await app.inject({
    method: "GET",
    url: "/microapps/image-generation/generations/job-missing",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 404, response.body);
  assert.equal(
    response.json().message,
    "Image generation job was not found: job-missing",
  );

  await app.close();
});

test("microapps image generation routes map request validation errors to 400", async () => {
  const service: ImageGenerationRouteService = {
    async createGeneration() {
      throw new ImageGenerationRequestValidationError(
        "Prompt or workflow is required.",
      );
    },
    async getGeneration() {
      return createTestJob();
    },
  };
  const app = await createApp(service);
  const token = createToken();

  const response = await app.inject({
    method: "POST",
    url: "/microapps/image-generation/generations",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    payload: {
      providerId: "provider-sync",
      prompt: "   ",
    },
  });

  assert.equal(response.statusCode, 400, response.body);
  assert.equal(response.json().message, "Prompt or workflow is required.");

  await app.close();
});
