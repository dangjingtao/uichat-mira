import assert from "node:assert/strict";
import fs from "node:fs";
import { afterAll, test } from "vitest";
import Fastify from "fastify";
import { createAccessToken, initializeAuthDatabase } from "@/db/auth.db";
import { initializeRoleDatabase } from "@/db/role.db";
import { initializeKnowledgeBaseDatabase } from "@/db/knowledge-base.db";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { initializeThreadDatabase } from "@/db/thread.db";
import { resetDatabaseClients } from "@/db/index.js";
import { userRepository } from "@/db/repositories";
import roleRoute from "@/routes/role/index.js";
import { getLoggerConfig } from "@/logger";
import { sendRouteError } from "@/utils/route-errors.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";

const testDbPath = createTimestampedTestArtifactPath("db", "rag-demo-role-routes", ".sqlite");

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

test("role routes support create list update delete", async () => {
  const app = Fastify({
    logger: getLoggerConfig(),
    serializerOpts: { encoding: "utf8" },
  });
  app.setErrorHandler(sendRouteError);
  await app.register(roleRoute);

  const user = userRepository.create({
    username: `role-user-${crypto.randomUUID()}`,
    passwordHash: "hash",
    role: "user",
    isActive: true,
  });
  const token = createAccessToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });

  const createdResponse = await app.inject({
    method: "POST",
    url: "/roles",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    payload: {
      name: "Reviewer",
      tags: ["strict", "clear"],
      llmProfile: {
        temperature: 0.3,
        maxTokens: 768,
      },
      prompt: {
        description: "A reviewer",
      },
    },
  });

  assert.equal(createdResponse.statusCode, 200, createdResponse.body);
  const createdBody = createdResponse.json() as {
    data: {
      id: string;
      name: string;
      tags: string[];
      llmProfile: { temperature: number; maxTokens: number };
    };
  };
  assert.equal(createdBody.data.name, "Reviewer");
  assert.deepEqual(createdBody.data.tags, ["strict", "clear"]);
  assert.deepEqual(createdBody.data.llmProfile, {
    temperature: 0.3,
    maxTokens: 768,
  });

  const listResponse = await app.inject({
    method: "GET",
    url: "/roles",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(listResponse.statusCode, 200, listResponse.body);

  const updatedResponse = await app.inject({
    method: "PATCH",
    url: `/roles/${createdBody.data.id}`,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    payload: {
      summary: "New summary",
      status: "active",
      llmProfile: {
        topK: 16,
      },
      prompt: {
        scenario: "Current review context",
      },
    },
  });
  assert.equal(updatedResponse.statusCode, 200, updatedResponse.body);
  const updatedBody = updatedResponse.json() as {
    data: {
      summary: string;
      status: string;
      llmProfile: { temperature: number; maxTokens: number; topK: number };
      prompt: { scenario: string };
    };
  };
  assert.equal(updatedBody.data.summary, "New summary");
  assert.equal(updatedBody.data.status, "active");
  assert.deepEqual(updatedBody.data.llmProfile, {
    temperature: 0.3,
    maxTokens: 768,
    topK: 16,
  });
  assert.equal(updatedBody.data.prompt.scenario, "Current review context");

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/roles/${createdBody.data.id}`,
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(deleteResponse.statusCode, 200, deleteResponse.body);
  assert.equal(deleteResponse.json().data.deleted, true);

  await app.close();
});
