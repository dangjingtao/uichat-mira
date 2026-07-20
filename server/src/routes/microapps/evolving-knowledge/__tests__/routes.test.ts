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
        contentType: "webpage",
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

  it("POST /captures preserves a selection and does not call AI by default", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://example.com/selection",
        title: "选中内容",
        contentType: "webpage",
        captureMode: "selection",
        rawContent: "用户选中的一小段文字",
        rawHtml: "<html><body><article><p>整篇文章不应覆盖选中内容。</p></article></body></html>",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.rawContent).toBe("用户选中的一小段文字");
    expect(body.data.captureMetadata.captureMode).toBe("selection");
    expect(body.data.processingStatus).toBe("skipped");
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("POST /captures preserves rule-extracted page content instead of reparsing full-page HTML", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://example.com/article/42",
        title: "规则正文",
        contentType: "webpage",
        captureMode: "page",
        rawContent: "识别码：ABC-42\n\n发行日期：2026-05-18",
        rawHtml: "<html><body><footer>Copyright only</footer></body></html>",
        metadata: {
          ruleApplied: true,
          ruleHasIncludeRegion: true,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.rawContent).toBe("识别码：ABC-42\n\n发行日期：2026-05-18");
    expect(body.data.rawContent).not.toContain("Copyright only");
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
        contentType: "webpage",
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

  it("GET /captures/:id/evidence returns source-located evidence units", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://example.com/evidence",
        title: "证据测试",
        contentType: "webpage",
        rawContent: "第一段原文\n\n第二段原文",
        processAi: false,
      },
    });
    const captureId = JSON.parse(createRes.payload).data.id as string;

    const res = await app.inject({
      method: "GET",
      url: `/microapps/evolving-knowledge/captures/${captureId}/evidence`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data[0].content).toBe("第一段原文\n\n第二段原文");
    expect(body.data[0].sourceLocator).toEqual({
      startOffset: 0,
      endOffset: "第一段原文\n\n第二段原文".length,
    });
  });

  it("supports Phase 4 concept, topic, and viewpoint routes", async () => {
    mockGenerateText.mockResolvedValueOnce(
      JSON.stringify({
        rewrittenSummary: "Agent 记忆摘要",
        tags: ["Agent", "记忆"],
        entities: [],
      }),
    );
    await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://example.com/phase4",
        title: "Agent 记忆",
        contentType: "webpage",
        rawContent: "Agent 需要可验证的记忆。",
        processAi: true,
      },
    });

    const conceptsRes = await app.inject({
      method: "GET",
      url: "/microapps/evolving-knowledge/concepts",
      headers: { authorization: `Bearer ${authToken}` },
    });
    const conceptsBody = JSON.parse(conceptsRes.payload);
    const concept = conceptsBody.data.find((item: { displayName: string }) => item.displayName === "Agent");
    expect(concept).toBeDefined();

    mockGenerateText.mockResolvedValueOnce(
      JSON.stringify({
        summary: "Agent 记忆需要可验证。",
        pendingQuestions: [],
        viewpoint: {
          title: "Agent 记忆观点",
          statement: "Agent 记忆必须可验证。",
          confidence: 0.8,
          supportingIndices: [0],
          opposingIndices: [],
        },
      }),
    );
    const compileRes = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/topics/compile",
      headers: { authorization: `Bearer ${authToken}` },
      payload: { conceptId: concept.id },
    });
    expect(compileRes.statusCode).toBe(200);
    const compiled = JSON.parse(compileRes.payload).data;
    expect(compiled.viewpoint.status).toBe("needs_review");

    const viewpointsRes = await app.inject({
      method: "GET",
      url: "/microapps/evolving-knowledge/viewpoints",
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(JSON.parse(viewpointsRes.payload).data).toHaveLength(1);

    const reviewRes = await app.inject({
      method: "POST",
      url: `/microapps/evolving-knowledge/viewpoints/${compiled.viewpoint.id}/review`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { decision: "confirm" },
    });
    expect(reviewRes.statusCode).toBe(200);
    expect(JSON.parse(reviewRes.payload).data.viewpoint.status).toBe("active");
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
        contentType: "webpage",
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

  it("POST /query returns cited knowledge results", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://example.com/query",
        title: "查询材料",
        contentType: "webpage",
        rawContent: "知识查询必须保留原始证据。",
        processAi: false,
      },
    });
    expect(createRes.statusCode).toBe(200);

    const res = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/query",
      headers: { authorization: `Bearer ${authToken}` },
      payload: { query: "原始证据", mode: "fact", limit: 5 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.intent).toBe("fact");
    expect(body.data.results.some((item: { sourceType: string }) => item.sourceType === "evidence")).toBe(true);
  });

  it("POST /query validates query options", async () => {
    const missingQuery = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/query",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {},
    });
    expect(missingQuery.statusCode).toBe(400);

    const invalidMode = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/query",
      headers: { authorization: `Bearer ${authToken}` },
      payload: { query: "test", mode: "unknown" },
    });
    expect(invalidMode.statusCode).toBe(400);

    const invalidLimit = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/query",
      headers: { authorization: `Bearer ${authToken}` },
      payload: { query: "test", limit: 51 },
    });
    expect(invalidLimit.statusCode).toBe(400);
  });

  it("supports explicit writeback, health, and query log routes", async () => {
    const captureRes = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/captures",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        sourceUrl: "https://example.com/writeback",
        title: "写回材料",
        contentType: "webpage",
        rawContent: "写回必须由用户明确触发。",
        processAi: false,
      },
    });
    const captureId = JSON.parse(captureRes.payload).data.id as string;
    const evidenceRes = await app.inject({
      method: "GET",
      url: `/microapps/evolving-knowledge/captures/${captureId}/evidence`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    const evidenceId = JSON.parse(evidenceRes.payload).data[0].id as string;

    const writebackRes = await app.inject({
      method: "POST",
      url: "/microapps/evolving-knowledge/writeback",
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        kind: "topic",
        title: "写回规则",
        content: "写回必须由用户明确触发。",
        captureIds: [captureId],
        evidenceUnitIds: [evidenceId],
      },
    });
    expect(writebackRes.statusCode).toBe(200);

    const healthRes = await app.inject({
      method: "GET",
      url: "/microapps/evolving-knowledge/health",
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(healthRes.statusCode).toBe(200);
    expect(JSON.parse(healthRes.payload).data.counts.topics).toBeGreaterThan(0);

    const logsRes = await app.inject({
      method: "GET",
      url: "/microapps/evolving-knowledge/query-logs?limit=5",
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(logsRes.statusCode).toBe(200);
    expect(Array.isArray(JSON.parse(logsRes.payload).data)).toBe(true);
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
        contentType: "webpage",
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
        contentType: "webpage",
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
        contentType: "webpage",
        rawContent: "content",
        processAi: true,
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
