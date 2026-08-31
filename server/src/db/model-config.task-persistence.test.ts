import assert from "node:assert/strict";
import fs from "node:fs";
import { afterAll, test } from "vitest";
import { resetDatabaseClients } from "@/db/index.js";
import { initializeModelConfigDatabase } from "@/db/model-config.db.js";
import { modelConfigRepository } from "@/db/repositories/index.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";

const testDbPath = createTimestampedTestArtifactPath(
  "db",
  "model-config-task-persistence",
  ".sqlite",
);

process.env.DATABASE_URL = `file:${testDbPath}`;
resetDatabaseClients();
initializeModelConfigDatabase();

afterAll(() => {
  resetDatabaseClients();
  try {
    fs.rmSync(testDbPath, { force: true });
  } catch {
    // Ignore Windows cleanup failures caused by delayed SQLite file release.
  }
});

test("database initialization preserves an explicit task model and explicit reset", () => {
  modelConfigRepository.updateDefault("task", {
    name: "small-custom-model",
    providerCode: "lmstudio",
    providerConnectionId: "lmstudio",
    remoteModelId: "small-custom-model",
  });

  initializeModelConfigDatabase();

  const selected = modelConfigRepository.findDefaultByType("task");
  assert.equal(selected?.name, "small-custom-model");
  assert.equal(selected?.providerCode, "lmstudio");
  assert.equal(selected?.providerConnectionId, "lmstudio");
  assert.equal(selected?.remoteModelId, "small-custom-model");

  modelConfigRepository.updateDefault("task", {
    name: "",
    providerCode: null,
    providerConnectionId: null,
    remoteModelId: null,
  });

  initializeModelConfigDatabase();

  const reset = modelConfigRepository.findDefaultByType("task");
  assert.equal(reset?.name, "");
  assert.equal(reset?.providerCode, null);
  assert.equal(reset?.providerConnectionId, null);
  assert.equal(reset?.remoteModelId, null);
});
