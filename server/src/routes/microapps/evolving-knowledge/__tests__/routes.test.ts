import assert from "node:assert/strict";
import fs from "node:fs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { createAccessToken, initializeAuthDatabase } from "@/db/auth.db";
import { resetDatabaseClients } from "@/db/index.js";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { initializeKnowledgeBaseDatabase } from "@/db/knowledge-base.db";
import { initializeThreadDatabase } from "@/db/thread.db";
import { initializeRoleDatabase } from "@/db/role.db";
import { userRepository } from "@/db/repositories/index.js";
import { getLoggerConfig } from "@/logger";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { sendRouteError } from "@/utils/route-errors.js";
import { evolvingKnowledgeRepository } from "@/db/repositories/evolving-knowledge.repository.js";
import evolvingKnowledgeRoutes from "../index.js";

const testDbPath = createTimestampedTestArtifactPath(
  "db",
  "evolving-knowledge-routes",
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

const mockGenerateText = vi.fn();
vi.mock("@/services/llm.service.js", () => ({
  llmService: {
    generateText: (...args: any[]) => mockGenerateText(...args),
  },
}));

const createTestUser = () => {
  const user = userRepository.create({
    username: `ek-test-${Date.now()}`,
    passwordHash: "hash",
    role: "admin",
  });
  return user;
};

const createAuthToken = (userId: number) =>
  createAccessToken({ id: userId, username: "test", role: "admin" });

describe("evolving-knowledge routes", () => {
  let app: ReturnType<typeof Fastify>;
  let authToken: string;

  beforeEach(async () => {
    mockGenerateText.mockReset();
    evolvingKnowledgeRepository.initialize();
    app = Fastify({ logger: getLoggerConfig() });
    app.setErrorHandler(sendRouteError);

    const user = createTestUser();
    authToken = createAuthToken(user.id);

    const { createEvolvingKnowledgeService } = await import(
      "@/microapps/evolving-knowledge/index.js"
    );
    const service = createEvolvingKnowledgeService();

    await app.register(evolvingKnowledgeRoutes, { service });
  });

  it("POST /captures creates a capture", async () => {
    mockGenerateText.mockResolvedValue(
      JSON.stringify({
        rewrittenSummary: "重写摘要",
        tags: ["AI"],
        entities: [{ name: "GPT", type: "technology", context: "模型" }],
      }),
    );

    const res = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://example.com",
        title: "测试",
        contentType: "text",
        rawContent: "原始内容",
        processAi: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.rewrittenSummary).toBe("重写摘要");
    expect(body.data.aiTags).toEqual(["AI"]);
  });

  it("POST /captures rejects invalid capture input", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://example.com",
        title: "无效捕获",
        contentType: "unknown",
        rawContent: "原始内容",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).code).toBe("VALIDATION_ERROR");
  });

  it("POST /captures rejects deferred audio and video types", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://example.com/video",
        title: "暂不支持的视频",
        contentType: "video",
        rawContent: "视频内容",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("GET /captures lists captures", async () => {
    mockGenerateText.mockResolvedValue(
      JSON.stringify({
        rewrittenSummary: "摘要",
        tags: [],
        entities: [],
      }),
    );

    await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://a.com",
        title: "A",
        contentType: "text",
        rawContent: "content",
        processAi: true,
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("GET /captures/search finds by query", async () => {
    mockGenerateText.mockResolvedValue(
      JSON.stringify({
        rewrittenSummary: "关于机器学习的文章",
        tags: ["ML"],
        entities: [],
      }),
    );

    await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://ml.com",
        title: "机器学习",
        contentType: "text",
        rawContent: "机器学习是 AI 分支",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/microapps/evolving-knowledge/captures/search?q=机器学习",
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("GET /insights returns active insights", async () => {
    let callCount = 0;
    mockGenerateText.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve(
          JSON.stringify({
            rewrittenSummary: `摘要${callCount}`,
            tags: [],
            entities: [],
          }),
        );
      }
      if (callCount === 3) {
        return Promise.resolve(
          JSON.stringify([
            {
              sourceIndex: 0,
              targetIndex: 1,
              relationType: "similar",
              confidence: 0.85,
              reasoning: "相似",
            },
          ]),
        );
      }
      return Promise.resolve(
        JSON.stringify([
          {
            insightType: "synthesis",
            title: "洞见",
            description: "描述",
            confidence: 0.8,
            triggerIndex: 0,
            relatedIndices: [1],
          },
        ]),
      );
    });

    await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://a.com",
        title: "A",
        contentType: "text",
        rawContent: "content",
        processAi: true,
      },
    });
    await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://b.com",
        title: "B",
        contentType: "text",
        rawContent: "content",
        processAi: true,
      },
    });

    await new Promise((r) => setTimeout(r, 300));

    const res = await app.inject({
      method: "GET",
      url: "/microapps/evolving-knowledge/insights",
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("GET /stats returns statistics", async () => {
    mockGenerateText.mockResolvedValue(
      JSON.stringify({
        rewrittenSummary: "摘要",
        tags: ["tag1"],
        entities: [],
      }),
    );

    await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://example.com",
        title: "Test",
        contentType: "text",
        rawContent: "content",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/microapps/evolving-knowledge/stats",
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.totalCaptures).toBeGreaterThan(0);
    expect(body.data.totalTags).toBeGreaterThan(0);
  });
});
