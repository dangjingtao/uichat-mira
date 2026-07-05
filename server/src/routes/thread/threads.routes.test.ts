import assert from "node:assert/strict";
import fs from "node:fs";
import { afterAll, test } from "vitest";
import Fastify from "fastify";
import { initializeAuthDatabase, createAccessToken } from "@/db/auth.db";
import { initializeKnowledgeBaseDatabase } from "@/db/knowledge-base.db";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { initializeRoleDatabase } from "@/db/role.db";
import { initializeThreadDatabase } from "@/db/thread.db";
import { resetDatabaseClients } from "@/db/index.js";
import { knowledgeBaseRepository, roleRepository, userRepository } from "@/db/repositories";
import threadRoute from "@/routes/thread/index.js";
import { getLoggerConfig } from "@/logger";
import { llmService } from "@/services/llm.service.js";
import { sendRouteError } from "@/utils/route-errors.js";
import { threadService } from "@/services/thread.service.js";
import { vi } from "vitest";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";

const testDbPath = createTimestampedTestArtifactPath("db", "rag-demo-thread-routes", ".sqlite");

process.env.DATABASE_URL = `file:${testDbPath}`;
resetDatabaseClients();

initializeAuthDatabase();
initializeModelConfigDatabase();
initializeKnowledgeBaseDatabase();
initializeRoleDatabase();
initializeThreadDatabase();

afterAll(() => {
  resetDatabaseClients();
  try {
    fs.rmSync(testDbPath, { force: true });
  } catch {
    // ignore cleanup failure on Windows file locking
  }
});

test("PATCH /threads/:id returns 200 when unbinding knowledgeBaseId to null", async () => {
  const app = Fastify({
    logger: getLoggerConfig(),
    serializerOpts: { encoding: "utf8" },
  });
  app.setErrorHandler(sendRouteError);
  await app.register(threadRoute);

  const user = userRepository.create({
    username: `user-${crypto.randomUUID()}`,
    passwordHash: "hash",
    role: "user",
    isActive: true,
  });
  const token = createAccessToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });
  const knowledgeBase = knowledgeBaseRepository.create({
    name: `KB-${crypto.randomUUID()}`,
    description: "",
    status: "active",
    chunkingConfigJson: "{}",
    metadataJson: "{}",
  });
  const thread = threadService.createThread({
    userId: user.id,
    knowledgeBaseId: knowledgeBase.id,
  });

  const response = await app.inject({
    method: "PATCH",
    url: `/threads/${thread.id}`,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    payload: {
      knowledgeBaseId: null,
    },
  });

  assert.equal(response.statusCode, 200, response.body);

  const body = response.json() as {
    success: boolean;
    data: {
      id: string;
      knowledgeBaseId: string | null;
    };
  };

  assert.equal(body.success, true);
  assert.equal(body.data.id, thread.id);
  assert.equal(body.data.knowledgeBaseId, null);

  await app.close();
});

test("PATCH /threads/:id persists roleId and allows clearing it", async () => {
  const app = Fastify({
    logger: getLoggerConfig(),
    serializerOpts: { encoding: "utf8" },
  });
  app.setErrorHandler(sendRouteError);
  await app.register(threadRoute);

  const user = userRepository.create({
    username: `user-${crypto.randomUUID()}`,
    passwordHash: "hash",
    role: "user",
    isActive: true,
  });
  const role = roleRepository.create({
    userId: user.id,
    name: "Programmer",
    summary: "Writes and verifies code carefully",
    avatarId: "pilot-helper",
    status: "active",
    tagsJson: "[]",
    promptJson: JSON.stringify({
      description: "A programmer role",
      worldview: "",
      persona: "",
      scenario: "",
      exampleDialogues: "",
      style: "",
      constraints: "",
    }),
  });
  const token = createAccessToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });
  const thread = threadService.createThread({
    userId: user.id,
  });

  const bindResponse = await app.inject({
    method: "PATCH",
    url: `/threads/${thread.id}`,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    payload: {
      roleId: role.id,
    },
  });
  assert.equal(bindResponse.statusCode, 200, bindResponse.body);
  assert.equal(
    (bindResponse.json() as { data: { roleId: string | null } }).data.roleId,
    role.id,
  );

  const clearResponse = await app.inject({
    method: "PATCH",
    url: `/threads/${thread.id}`,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    payload: {
      roleId: null,
    },
  });
  assert.equal(clearResponse.statusCode, 200, clearResponse.body);
  assert.equal(
    (clearResponse.json() as { data: { roleId: string | null } }).data.roleId,
    null,
  );

  await app.close();
});

test("POST /threads/:id/messages accepts pure image message parts with empty content", async () => {
  const app = Fastify({
    logger: getLoggerConfig(),
    serializerOpts: { encoding: "utf8" },
  });
  app.setErrorHandler(sendRouteError);
  await app.register(threadRoute);

  const user = userRepository.create({
    username: `user-${crypto.randomUUID()}`,
    passwordHash: "hash",
    role: "user",
    isActive: true,
  });
  const token = createAccessToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });
  const thread = threadService.createThread({
    userId: user.id,
  });

  const response = await app.inject({
    method: "POST",
    url: `/threads/${thread.id}/messages`,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    payload: {
      role: "user",
      content: "",
      parts: [
        {
          type: "image",
          image: "/attachments/thread-only.webp",
          filename: "thread-only.webp",
          fileId: "thread-image-1",
          mediaType: "image/webp",
        },
      ],
    },
  });

  assert.equal(response.statusCode, 200, response.body);

  const body = response.json() as {
    success: boolean;
    data: {
      id: string;
      content: string;
      parts: Array<{ type: string }>;
    };
  };

  assert.equal(body.success, true);
  assert.equal(body.data.content, "");
  assert.equal(body.data.parts.length, 1);
  assert.equal(body.data.parts[0]?.type, "image");

  await app.close();
});

test("POST /threads/:id/context-summary generates and persists thread context summary", async () => {
  const generateSpy = vi
    .spyOn(llmService, "generateText")
    .mockResolvedValue("用户偏好简洁回答；当前正在继续后端改造。");
  const app = Fastify({
    logger: getLoggerConfig(),
    serializerOpts: { encoding: "utf8" },
  });
  app.setErrorHandler(sendRouteError);
  await app.register(threadRoute);

  const user = userRepository.create({
    username: `user-${crypto.randomUUID()}`,
    passwordHash: "hash",
    role: "user",
    isActive: true,
  });
  const token = createAccessToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });
  const thread = threadService.createThread({
    userId: user.id,
  });
  threadService.createMessage(thread.id, user.id, {
    role: "user",
    content: "请以后回答更简洁一些",
    parts: [{ type: "text", text: "请以后回答更简洁一些" }],
  });

  const response = await app.inject({
    method: "POST",
    url: `/threads/${thread.id}/context-summary`,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    payload: {},
  });

  assert.equal(response.statusCode, 200, response.body);

  const body = response.json() as {
    success: boolean;
    data: {
      contextSummary: string | null;
      contextSummaryUpdatedAt: string | null;
    };
  };

  assert.equal(body.success, true);
  assert.equal(
    body.data.contextSummary,
    "用户偏好简洁回答；当前正在继续后端改造。",
  );
  assert.ok(body.data.contextSummaryUpdatedAt);
  assert.equal(generateSpy.mock.calls.length, 1);

  await app.close();
});
