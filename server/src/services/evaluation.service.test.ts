import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, test } from "vitest";
import AdmZip from "adm-zip";
import { initializeEvaluationDatabase } from "@/db/evaluation.db";
import { initializeKnowledgeBaseDatabase } from "@/db/knowledge-base.db";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { knowledgeBaseRepository } from "@/db/repositories";
import { evaluationService } from "./evaluation.service.js";

const testDbPath = path.join(
  os.tmpdir(),
  `rag-demo-evaluation-service-${process.pid}-${Date.now()}.sqlite`,
);

process.env.DATABASE_URL = `file:${testDbPath}`;

initializeModelConfigDatabase();
initializeKnowledgeBaseDatabase();
initializeEvaluationDatabase();

afterAll(() => {
  try {
    fs.rmSync(testDbPath, { force: true });
  } catch {
    // ignore cleanup failure on Windows file locking
  }
});

const createDatasetZip = (input: {
  knowledgeBaseId?: string;
  datasetName?: string;
}) => {
  const zip = new AdmZip();
  const manifest = {
    datasetName: input.datasetName ?? "evaluation-dataset",
    ...(input.knowledgeBaseId
      ? { knowledgeBaseId: input.knowledgeBaseId }
      : {}),
    config: {
      mode: "retrieve",
      topK: 4,
      topN: 2,
      repeat: 1,
      concurrency: 1,
      timeoutSeconds: 30,
    },
  };

  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest), "utf8"));
  zip.addFile(
    "evalset.json",
    Buffer.from(
      JSON.stringify([
        {
          id: "sample-001",
          question: "这是什么？",
          expectedAnswer: "这是一个测试样本。",
          goldSources: ["doc-1.txt"],
          tags: ["test"],
        },
      ]),
      "utf8",
    ),
  );
  zip.addFile("documents/doc-1.txt", Buffer.from("hello world", "utf8"));
  return zip.toBuffer();
};

test("parseDataset marks missing knowledge base id as validation error", () => {
  const dataset = evaluationService.parseDataset({
    fileName: "missing-kb.zip",
    fileSize: 0,
    buffer: createDatasetZip({}),
  });

  const knowledgeBaseValidation = dataset.validations.find(
    (item) => item.id === "knowledgeBase",
  );

  assert.ok(knowledgeBaseValidation);
  assert.equal(knowledgeBaseValidation.status, "error");
  assert.match(knowledgeBaseValidation.detail, /knowledgeBaseId/i);
});

test("createRun rejects datasets that reference an unknown knowledge base", () => {
  const dataset = evaluationService.parseDataset({
    fileName: "unknown-kb.zip",
    fileSize: 0,
    buffer: createDatasetZip({
      knowledgeBaseId: `kb-missing-${crypto.randomUUID()}`,
    }),
  });

  assert.throws(
    () =>
      evaluationService.createRun({
        datasetId: dataset.id,
      }),
    /validation errors|unknown knowledge base/i,
  );
});

test("createRun succeeds when dataset references an existing knowledge base", () => {
  const knowledgeBase = knowledgeBaseRepository.create({
    name: `KB-${crypto.randomUUID()}`,
    description: "",
    status: "active",
    chunkingConfigJson: "{}",
    metadataJson: "{}",
  });

  const dataset = evaluationService.parseDataset({
    fileName: "valid-kb.zip",
    fileSize: 0,
    buffer: createDatasetZip({
      knowledgeBaseId: knowledgeBase.id,
    }),
  });

  const run = evaluationService.createRun({
    datasetId: dataset.id,
  });

  assert.equal(run.dataset.knowledgeBaseId, knowledgeBase.id);
  assert.equal(run.status, "queued");
});
