import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getTestArtifactDir } from "@/test-support/artifacts.js";
import {
  resetLocalModelResourcesForTests,
  resolveLocalModelResources,
} from "./resource-resolver.js";

const RAW_MODEL_FILES = {
  embedding: [
    "embedding/multilingual-e5-small/config.json",
    "embedding/multilingual-e5-small/tokenizer.json",
    "embedding/multilingual-e5-small/tokenizer_config.json",
    "embedding/multilingual-e5-small/special_tokens_map.json",
    "embedding/multilingual-e5-small/sentencepiece.bpe.model",
    "embedding/multilingual-e5-small/onnx/model_quantized.onnx",
  ],
  rerank: [
    "rerank/ms-marco-MiniLM-L-6-v2/config.json",
    "rerank/ms-marco-MiniLM-L-6-v2/tokenizer.json",
    "rerank/ms-marco-MiniLM-L-6-v2/tokenizer_config.json",
    "rerank/ms-marco-MiniLM-L-6-v2/special_tokens_map.json",
    "rerank/ms-marco-MiniLM-L-6-v2/vocab.txt",
    "rerank/ms-marco-MiniLM-L-6-v2/onnx/model_quantized.onnx",
  ],
};

const originalRawRoot = process.env.LOCAL_MODEL_RAW_ROOT;
const originalResourceRoot = process.env.LOCAL_MODEL_RESOURCE_ROOT;
const originalUserDataDir = process.env.LOCAL_MODEL_USER_DATA_DIR;

const writeFiles = async (root: string, files: string[]) => {
  for (const relativePath of files) {
    const absolutePath = path.join(root, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, relativePath);
  }
};

afterEach(() => {
  if (originalRawRoot === undefined) {
    delete process.env.LOCAL_MODEL_RAW_ROOT;
  } else {
    process.env.LOCAL_MODEL_RAW_ROOT = originalRawRoot;
  }

  if (originalResourceRoot === undefined) {
    delete process.env.LOCAL_MODEL_RESOURCE_ROOT;
  } else {
    process.env.LOCAL_MODEL_RESOURCE_ROOT = originalResourceRoot;
  }

  if (originalUserDataDir === undefined) {
    delete process.env.LOCAL_MODEL_USER_DATA_DIR;
  } else {
    process.env.LOCAL_MODEL_USER_DATA_DIR = originalUserDataDir;
  }

  resetLocalModelResourcesForTests();
});

describe("resolveLocalModelResources", () => {
  it("synthesizes a development manifest from a raw model directory", async () => {
    const rawRoot = await fs.mkdtemp(path.join(getTestArtifactDir("workspace"), "local-model-raw-"));
    await writeFiles(rawRoot, [...RAW_MODEL_FILES.embedding, ...RAW_MODEL_FILES.rerank]);
    process.env.LOCAL_MODEL_RAW_ROOT = rawRoot;
    delete process.env.LOCAL_MODEL_RESOURCE_ROOT;
    delete process.env.LOCAL_MODEL_USER_DATA_DIR;

    const resolved = await resolveLocalModelResources();

    expect(resolved.rawRoot).toBe(path.resolve(rawRoot));
    expect(resolved.manifest.models).toHaveLength(2);
    expect(
      resolved.manifest.models.map((model) => ({
        id: model.id,
        family: model.family,
        path: model.path,
      })),
    ).toEqual([
      {
        id: "multilingual-e5-small",
        family: "embedding",
        path: "embedding/multilingual-e5-small",
      },
      {
        id: "ms-marco-MiniLM-L-6-v2",
        family: "rerank",
        path: "rerank/ms-marco-MiniLM-L-6-v2",
      },
    ]);
  });

  it("throws a clear error when a discovered raw model is incomplete", async () => {
    const rawRoot = await fs.mkdtemp(path.join(getTestArtifactDir("workspace"), "local-model-raw-"));
    await writeFiles(rawRoot, RAW_MODEL_FILES.embedding.slice(0, -1));
    process.env.LOCAL_MODEL_RAW_ROOT = rawRoot;
    delete process.env.LOCAL_MODEL_RESOURCE_ROOT;
    delete process.env.LOCAL_MODEL_USER_DATA_DIR;

    await expect(resolveLocalModelResources()).rejects.toThrow(
      'Incomplete local embedding model "multilingual-e5-small"',
    );
  });
});
