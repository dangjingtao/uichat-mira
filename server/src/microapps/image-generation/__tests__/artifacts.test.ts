import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { LocalImageGenerationArtifactStore } from "../artifacts/index.js";
import type { ImageGenerationJob } from "../core/types.js";

const testFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(testFilePath, "../../../../../..");
const artifactRoot = path.join(
  repoRoot,
  ".test-artifact",
  "image-generation",
  "artifacts-test",
);
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5K0C8AAAAASUVORK5CYII=",
  "base64",
);

const testJob: ImageGenerationJob = {
  id: "job-artifacts-1",
  providerId: "openai_images",
  executionKind: "sync-http",
  status: "running",
  requestSummary: {
    providerId: "openai_images",
    providerParamKeys: [],
    inputFileCount: 0,
    hasWorkflowApiJson: false,
  },
  artifacts: [],
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
};

let server: http.Server;
let serverBaseUrl = "";

beforeAll(async () => {
  server = http.createServer((request, response) => {
    if (request.url === "/image.png") {
      response.statusCode = 200;
      response.setHeader("Content-Type", "image/png");
      response.end(pngBytes);
      return;
    }
    response.statusCode = 404;
    response.end("not found");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to bind test server.");
      }
      serverBaseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterEach(async () => {
  await fs.rm(artifactRoot, { recursive: true, force: true });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

describe("image-generation artifact store", () => {
  it("implements the T101 materializeArtifacts contract for base64 artifacts", async () => {
    const store = new LocalImageGenerationArtifactStore({
      rootDir: artifactRoot,
      now: () => "2026-07-06T00:00:00.000Z",
    });

    const artifacts = await store.materializeArtifacts({
      job: testJob,
      artifacts: [
        {
          type: "image",
          mimeType: "image/png",
          source: "base64",
          base64Data: pngBytes.toString("base64"),
          fileName: "base64-image",
        },
      ],
    });

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.localPath?.startsWith(path.join(artifactRoot, testJob.id))).toBe(
      true,
    );
    const saved = await fs.readFile(artifacts[0]!.localPath!);
    expect(saved.byteLength).toBe(pngBytes.byteLength);
  });

  it("downloads remote-url artifacts and returns ImageGenerationArtifactSummary", async () => {
    const store = new LocalImageGenerationArtifactStore({
      rootDir: artifactRoot,
    });

    const artifacts = await store.materializeArtifacts({
      job: testJob,
      artifacts: [
        {
          type: "image",
          mimeType: "image/png",
          source: "remote-url",
          remoteUrl: `${serverBaseUrl}/image.png`,
          fileName: "remote-image",
        },
      ],
    });

    expect(artifacts[0]?.remoteUrl).toBe(`${serverBaseUrl}/image.png`);
    const saved = await fs.readFile(artifacts[0]!.localPath!);
    expect(Buffer.compare(saved, pngBytes)).toBe(0);
  });

  it("adopts local-file artifacts through the formal materializeArtifacts path", async () => {
    await fs.mkdir(artifactRoot, { recursive: true });
    const sourcePath = path.join(artifactRoot, "source.png");
    await fs.writeFile(sourcePath, pngBytes);

    const store = new LocalImageGenerationArtifactStore({
      rootDir: artifactRoot,
    });

    const artifacts = await store.materializeArtifacts({
      job: testJob,
      artifacts: [
        {
          type: "image",
          mimeType: "image/png",
          source: "local-file",
          localPath: sourcePath,
          fileName: "adopted-image",
        },
      ],
    });

    expect(artifacts[0]?.localPath?.startsWith(path.join(artifactRoot, testJob.id))).toBe(
      true,
    );
    expect(artifacts[0]?.localPath).not.toBe(sourcePath);
    const saved = await fs.readFile(artifacts[0]!.localPath!);
    expect(Buffer.compare(saved, pngBytes)).toBe(0);
  });
});
