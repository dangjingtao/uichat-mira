import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import { initializeAuthDatabase } from "@/db/auth.db.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { evolvingKnowledgeRepository } from "@/db/repositories/evolving-knowledge.repository.js";
import { createEvolvingKnowledgeService } from "../index.js";

const mockGenerateText = vi.fn();
vi.mock("@/services/llm.service.js", () => ({
  llmService: {
    generateText: (...args: any[]) => mockGenerateText(...args),
  },
}));

describe("evolving-knowledge service", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${createTimestampedTestArtifactPath("db", "tmp-evolving-knowledge", ".sqlite")}`;
    resetDatabaseClients();
    getSqlite();
    initializeAuthDatabase();
    evolvingKnowledgeRepository.initialize();
    mockGenerateText.mockReset();
  });

  afterEach(() => {
    resetDatabaseClients();
    delete process.env.DATABASE_URL;
  });

  it("processes a text capture and stores AI summary", async () => {
    mockGenerateText.mockResolvedValue(
      JSON.stringify({
        rewrittenSummary: "AI 重写的摘要",
        tags: ["AI", "测试"],
        entities: [{ name: "GPT", type: "technology", context: "语言模型" }],
      }),
    );

    const service = createEvolvingKnowledgeService();
    const capture = await service.processCapture({
      sourceUrl: "https://example.com/article",
      title: "测试文章",
      contentType: "text",
      rawContent: "这是一篇关于 AI 的文章。",
    }, { userId: 1 });

    expect(capture).toMatchObject({
      sourceUrl: "https://example.com/article",
      title: "测试文章",
      contentType: "text",
      rewrittenSummary: "AI 重写的摘要",
      aiTags: ["AI", "测试"],
    });
    expect(capture.aiEntities).toHaveLength(1);
    expect(capture.aiEntities[0].name).toBe("GPT");

    const stored = service.getCaptureById(capture.id, 1);
    expect(stored).not.toBeNull();
    expect(stored?.rewrittenSummary).toBe("AI 重写的摘要");
  });

  it("lists captures ordered by capturedAt desc", async () => {
    mockGenerateText.mockResolvedValue(
      JSON.stringify({
        rewrittenSummary: "摘要",
        tags: ["tag"],
        entities: [],
      }),
    );

    const service = createEvolvingKnowledgeService();
    await service.processCapture({
      sourceUrl: "https://a.com",
      title: "A",
      contentType: "text",
      rawContent: "content A",
    }, { userId: 1 });
    await service.processCapture({
      sourceUrl: "https://b.com",
      title: "B",
      contentType: "text",
      rawContent: "content B",
    }, { userId: 1 });

    const list = service.listCaptures(1, { limit: 10 });
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe("B");
    expect(list[1].title).toBe("A");
  });

  it("creates and reads relations", async () => {
    mockGenerateText.mockResolvedValue(
      JSON.stringify({
        rewrittenSummary: "摘要",
        tags: [],
        entities: [],
      }),
    );

    const service = createEvolvingKnowledgeService();
    const c1 = await service.processCapture({
      sourceUrl: "https://a.com",
      title: "A",
      contentType: "text",
      rawContent: "content A",
    }, { userId: 1 });
    const c2 = await service.processCapture({
      sourceUrl: "https://b.com",
      title: "B",
      contentType: "text",
      rawContent: "content B",
    }, { userId: 1 });

    // 手动创建关系（不依赖异步 LLM）
    evolvingKnowledgeRepository.createRelation({
      userId: 1,
      sourceCaptureId: c1.id,
      targetCaptureId: c2.id,
      relationType: "similar",
      confidence: 0.85,
      aiReasoning: "两者主题相似",
    });

    const relations = service.listRelationsForCapture(c1.id, 1);
    expect(relations.length).toBeGreaterThan(0);
    expect(relations[0].relationType).toBe("similar");
  });

  it("deletes a capture", async () => {
    mockGenerateText.mockResolvedValue(
      JSON.stringify({
        rewrittenSummary: "摘要",
        tags: [],
        entities: [],
      }),
    );

    const service = createEvolvingKnowledgeService();
    const capture = await service.processCapture({
      sourceUrl: "https://example.com",
      title: "Test",
      contentType: "text",
      rawContent: "content",
    }, { userId: 1 });

    service.deleteCapture(capture.id, 1);
    expect(service.getCaptureById(capture.id, 1)).toBeNull();
  });

  it("dismisses an insight", async () => {
    let callCount = 0;
    mockGenerateText.mockImplementation(() => {
      callCount++;
      if (callCount <= 3) {
        return Promise.resolve(
          JSON.stringify({
            rewrittenSummary: `摘要${callCount}`,
            tags: [],
            entities: [],
          }),
        );
      }
      if (callCount === 4) {
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
            relatedIndices: [1, 2],
          },
        ]),
      );
    });

    const service = createEvolvingKnowledgeService();
    await service.processCapture({
      sourceUrl: "https://a.com",
      title: "A",
      contentType: "text",
      rawContent: "content",
    }, { userId: 1 });
    await service.processCapture({
      sourceUrl: "https://b.com",
      title: "B",
      contentType: "text",
      rawContent: "content",
    }, { userId: 1 });
    await service.processCapture({
      sourceUrl: "https://c.com",
      title: "C",
      contentType: "text",
      rawContent: "content",
    }, { userId: 1 });

    await new Promise((r) => setTimeout(r, 400));

    const insights = service.listActiveInsights(1);
    expect(insights.length).toBeGreaterThan(0);

    service.dismissInsight(insights[0].id, 1);
    const after = service.listActiveInsights(1);
    expect(after.find((i) => i.id === insights[0].id)).toBeUndefined();
  });

  it("searches captures by text", async () => {
    mockGenerateText.mockResolvedValue(
      JSON.stringify({
        rewrittenSummary: "关于机器学习的文章",
        tags: ["ML"],
        entities: [],
      }),
    );

    const service = createEvolvingKnowledgeService();
    await service.processCapture({
      sourceUrl: "https://ml.com",
      title: "机器学习入门",
      contentType: "text",
      rawContent: "机器学习是人工智能的一个分支。",
    }, { userId: 1 });

    const results = service.searchCaptures("机器学习", 1);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe("机器学习入门");
  });

  it("keeps captures isolated by user and preserves raw content when AI fails", async () => {
    mockGenerateText.mockRejectedValue(new Error("provider unavailable"));

    const service = createEvolvingKnowledgeService();
    const capture = await service.processCapture({
      sourceUrl: "https://example.com/failure",
      title: "保留原文",
      contentType: "text",
      rawContent: "必须保留的完整原文",
    }, { userId: 1 });

    expect(capture.rawContent).toBe("必须保留的完整原文");
    expect(capture.processingStatus).toBe("failed");
    expect(service.listCaptures(2)).toHaveLength(0);
    expect(service.getCaptureById(capture.id, 2)).toBeNull();
  });

  it("deduplicates recent insights and excludes expired insights", () => {
    const trigger = evolvingKnowledgeRepository.createCapture({
      userId: 1,
      sourceUrl: "https://example.com",
      title: "Trigger",
      contentType: "text",
      rawContent: "content",
      rewrittenSummary: "summary",
      aiTags: [],
      aiEntities: [],
    });

    const first = evolvingKnowledgeRepository.createInsight({
      userId: 1,
      insightType: "synthesis",
      title: "重复洞见",
      description: "description",
      triggerCaptureId: trigger.id,
      relatedCaptureIds: [],
      confidence: 0.8,
    });
    const duplicate = evolvingKnowledgeRepository.createInsight({
      userId: 1,
      insightType: "synthesis",
      title: "不应重复",
      description: "description",
      triggerCaptureId: trigger.id,
      relatedCaptureIds: [],
      confidence: 0.9,
    });

    expect(duplicate.id).toBe(first.id);

    getSqlite().prepare(
      "UPDATE knowledge_insights SET expires_at = ? WHERE id = ?",
    ).run("2000-01-01T00:00:00.000Z", first.id);

    expect(evolvingKnowledgeRepository.listActiveInsights(1)).toHaveLength(0);
  });
});
