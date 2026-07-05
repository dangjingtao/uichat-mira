import assert from "node:assert/strict";
import fs from "node:fs";
import { afterAll, test } from "vitest";
import { initializeKnowledgeBaseDatabase } from "@/db/knowledge-base.db";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { documentRepository, knowledgeBaseRepository } from "@/db/repositories";
import { knowledgeBaseService } from "@/services/knowledge-base.service.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import { evaluationPackageGeneratorService } from "./evaluation-package-generator.service.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";

const testDbPath = createTimestampedTestArtifactPath("db", "rag-demo-evaluation-package-generator", ".sqlite");

process.env.DATABASE_URL = `file:${testDbPath}`;

initializeModelConfigDatabase();
initializeKnowledgeBaseDatabase();

afterAll(() => {
  try {
    fs.rmSync(testDbPath, { force: true });
  } catch {
    // ignore cleanup failure on Windows file locking
  }
});

const createKnowledgeBaseWithDocuments = (documentCount: number) => {
  const knowledgeBase = knowledgeBaseRepository.create({
    name: `KB-${crypto.randomUUID()}`,
    description: "",
    status: "active",
    chunkingConfigJson: "{}",
    metadataJson: "{}",
  });

  for (let index = 0; index < documentCount; index += 1) {
    documentRepository.createWithChunks({
      document: {
        knowledgeBaseId: knowledgeBase.id,
        name: `doc-${index + 1}.txt`,
        sourceType: "upload",
        sourceLabel: null,
        fileExt: "txt",
        mimeType: "text/plain",
        fileSize: 100,
        textEncoding: "utf-8",
        enabled: true,
        indexStatus: "ready",
        contentText: `chunk content ${index + 1}`,
        chunkCount: 1,
        charCount: 16,
        tokenCount: 4,
        errorMessage: null,
        chunkingConfigJson: "{}",
      },
      chunks: [
        {
          chunkIndex: 0,
          content: `chunk content ${index + 1}`,
          charCount: 16,
          tokenCount: 4,
          startOffset: 0,
          endOffset: 16,
        },
      ],
    });
  }

  return knowledgeBase;
};

test("generateArchive fails when candidate chunks cannot satisfy sampleCount", async () => {
  const knowledgeBase = createKnowledgeBaseWithDocuments(3);

  const originalGenerateTextForRole = providerProxyService.generateTextForRole;
  providerProxyService.generateTextForRole = async () =>
    JSON.stringify({
      question: `question-${crypto.randomUUID()}`,
      expectedAnswer: "answer",
      tags: ["test"],
    });

  await assert.rejects(
    () =>
      evaluationPackageGeneratorService.generateArchive({
        datasetName: "evaluation-pack-test",
        knowledgeBaseId: knowledgeBase.id,
        sampleCount: 5,
        documentCount: 3,
        chunksPerDocument: 1,
        mode: "retrieve-generate",
        topK: 10,
        topN: 5,
        repeat: 1,
        concurrency: 1,
        timeoutSeconds: 30,
      }),
    /少于目标样本数|目标样本数/,
  );

  providerProxyService.generateTextForRole = originalGenerateTextForRole;
});

test("generateArchive fails when the model returns duplicate questions", async () => {
  const knowledgeBase = createKnowledgeBaseWithDocuments(3);

  const originalGenerateTextForRole = providerProxyService.generateTextForRole;
  providerProxyService.generateTextForRole = async () =>
    JSON.stringify({
      question: "重复问题",
      expectedAnswer: "answer",
      tags: ["test"],
    });

  await assert.rejects(
    () =>
      evaluationPackageGeneratorService.generateArchive({
        datasetName: "evaluation-pack-test",
        knowledgeBaseId: knowledgeBase.id,
        sampleCount: 2,
        documentCount: 3,
        chunksPerDocument: 1,
        mode: "retrieve-generate",
        topK: 10,
        topN: 5,
        repeat: 1,
        concurrency: 2,
        timeoutSeconds: 30,
      }),
    /重复问题/,
  );

  providerProxyService.generateTextForRole = originalGenerateTextForRole;
});
