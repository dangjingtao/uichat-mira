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
      contentType: "webpage",
      rawContent: "这是一篇关于 AI 的文章。",
    }, { userId: 1 });

    expect(capture).toMatchObject({
      sourceUrl: "https://example.com/article",
      title: "测试文章",
      contentType: "webpage",
      rewrittenSummary: "AI 重写的摘要",
      aiTags: ["AI", "测试"],
    });
    expect(capture.aiEntities).toHaveLength(1);
    expect(capture.aiEntities[0].name).toBe("GPT");

    const stored = service.getCaptureById(capture.id, 1);
    expect(stored).not.toBeNull();
    expect(stored?.rewrittenSummary).toBe("AI 重写的摘要");

    const concepts = service.listConcepts(1);
    expect(concepts.some((concept) => concept.displayName === "AI")).toBe(true);
    expect(concepts.some((concept) => concept.displayName === "GPT")).toBe(true);

    const evidence = evolvingKnowledgeRepository.listEvidenceUnitsByCapture(
      capture.id,
      1,
    );
    expect(evidence).toHaveLength(1);
    expect(evidence[0].content).toBe("这是一篇关于 AI 的文章。");
    expect(evidence[0].sourceLocator).toEqual({
      startOffset: 0,
      endOffset: "这是一篇关于 AI 的文章。".length,
    });
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
      contentType: "webpage",
      rawContent: "content A",
    }, { userId: 1 });
    await service.processCapture({
      sourceUrl: "https://b.com",
      title: "B",
      contentType: "webpage",
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
      contentType: "webpage",
      rawContent: "content A",
    }, { userId: 1 });
    const c2 = await service.processCapture({
      sourceUrl: "https://b.com",
      title: "B",
      contentType: "webpage",
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

    const duplicate = evolvingKnowledgeRepository.createRelation({
      userId: 1,
      sourceCaptureId: c1.id,
      targetCaptureId: c2.id,
      relationType: "similar",
      confidence: 0.9,
      aiReasoning: "重复关系不应再次写入",
    });

    const relations = service.listRelationsForCapture(c1.id, 1);
    expect(relations.length).toBeGreaterThan(0);
    expect(relations[0].relationType).toBe("similar");
    expect(duplicate.id).toBe(relations[0].id);
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
      contentType: "webpage",
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
      contentType: "webpage",
      rawContent: "content",
    }, { userId: 1 });
    await service.processCapture({
      sourceUrl: "https://b.com",
      title: "B",
      contentType: "webpage",
      rawContent: "content",
    }, { userId: 1 });
    await service.processCapture({
      sourceUrl: "https://c.com",
      title: "C",
      contentType: "webpage",
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
      contentType: "webpage",
      rawContent: "机器学习是人工智能的一个分支。",
    }, { userId: 1 });

    const results = service.searchCaptures("机器学习", 1);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe("机器学习入门");
  });

  it("queries facts through evidence and keeps results isolated by user", async () => {
    const service = createEvolvingKnowledgeService();
    const capture = await service.processCapture(
      {
        sourceUrl: "https://example.com/fact",
        title: "机器学习实验",
        contentType: "webpage",
        rawContent: "机器学习实验需要记录指标和实验条件。",
      },
      { userId: 1, processAi: false },
    );

    const result = service.queryKnowledge("机器学习", 1, { mode: "fact" });
    expect(result.intent).toBe("fact");
    expect(result.results.some((item) => item.sourceType === "capture")).toBe(true);
    const evidence = result.results.find((item) => item.sourceType === "evidence");
    expect(evidence?.captureId).toBe(capture.id);
    expect(evidence?.evidenceUnitId).toBeTruthy();
    expect(evidence?.references[0]?.sourceLocator).toEqual({
      startOffset: 0,
      endOffset: "机器学习实验需要记录指标和实验条件。".length,
    });
    expect(service.queryKnowledge("机器学习", 2).results).toHaveLength(0);
  });

  it("queries viewpoint versions and filters conflict results to contradiction or gap insights", async () => {
    const service = createEvolvingKnowledgeService();
    const capture = await service.processCapture(
      {
        sourceUrl: "https://example.com/viewpoint",
        title: "Agent 记忆材料",
        contentType: "webpage",
        rawContent: "Agent 记忆需要验证。",
      },
      { userId: 1, processAi: false },
    );
    evolvingKnowledgeRepository.updateCapture(capture.id, 1, {
      rewrittenSummary: "Agent 记忆观点材料",
      aiTags: ["Agent", "记忆"],
      processingStatus: "completed",
      markUserEdited: false,
    });
    const concept = evolvingKnowledgeRepository.syncConceptsForCapture(capture.id, 1)[0];
    const topic = evolvingKnowledgeRepository.getOrCreateTopicForConcept(concept.id, 1)!;
    evolvingKnowledgeRepository.updateTopic(topic.id, 1, {
      summary: "Agent 记忆需要可验证。",
      pendingQuestions: [],
      sourceCount: 1,
      currentVersion: 1,
    });
    const viewpoint = evolvingKnowledgeRepository.createViewpoint({
      userId: 1,
      topicId: topic.id,
      title: "Agent 记忆观点",
      statement: "Agent 记忆必须可验证。",
      status: "active",
    });
    const version = evolvingKnowledgeRepository.createViewpointVersion({
      userId: 1,
      viewpointId: viewpoint.id,
      statement: "Agent 记忆必须可验证。",
      changeType: "formed",
      triggerReason: "test",
      inputScope: { captureIds: [capture.id] },
      confidence: 0.8,
      status: "active",
      evidence: [{ captureId: capture.id, stance: "supports" }],
    })!;
    evolvingKnowledgeRepository.createInsight({
      userId: 1,
      insightType: "contradiction",
      title: "Agent 记忆存在冲突",
      description: "两条材料对 Agent 记忆的验证要求存在冲突。",
      triggerCaptureId: capture.id,
      relatedCaptureIds: [],
      confidence: 0.8,
    });
    evolvingKnowledgeRepository.createInsight({
      userId: 1,
      insightType: "synthesis",
      title: "Agent 记忆聚合",
      description: "这是普通聚合结果。",
      triggerCaptureId: capture.id,
      relatedCaptureIds: [],
      confidence: 0.8,
    });

    const viewpointResult = service.queryKnowledge("Agent 记忆观点", 1, {
      mode: "viewpoint",
    });
    const viewpointHit = viewpointResult.results.find((item) => item.sourceType === "viewpoint_version");
    expect(viewpointHit?.sourceId).toBe(version.id);
    expect(viewpointHit?.viewpointVersionId).toBe(version.id);
    expect(viewpointHit?.references[0]?.captureId).toBe(capture.id);

    const conflictResult = service.queryKnowledge("Agent 记忆 冲突", 1, {
      mode: "conflict",
    });
    expect(conflictResult.results.every((item) => item.sourceType === "insight")).toBe(true);
    expect(conflictResult.results.map((item) => item.title)).toContain("Agent 记忆存在冲突");
    expect(conflictResult.results.map((item) => item.title)).not.toContain("Agent 记忆聚合");
  });

  it("keeps captures isolated by user and preserves raw content when AI fails", async () => {
    mockGenerateText.mockRejectedValue(new Error("provider unavailable"));

    const service = createEvolvingKnowledgeService();
    const capture = await service.processCapture({
      sourceUrl: "https://example.com/failure",
      title: "保留原文",
      contentType: "webpage",
      rawContent: "必须保留的完整原文",
    }, { userId: 1 });

    expect(capture.rawContent).toBe("必须保留的完整原文");
    expect(capture.processingStatus).toBe("failed");
    expect(service.listCaptures(2)).toHaveLength(0);
    expect(service.getCaptureById(capture.id, 2)).toBeNull();
  });

  it("rebuilds a bounded batch and records the maintenance run", async () => {
    const service = createEvolvingKnowledgeService();
    const first = await service.processCapture(
      {
        sourceUrl: "https://a.com",
        title: "机器学习方法",
        contentType: "webpage",
        rawContent: "机器学习方法需要可验证的实验。",
      },
      { userId: 1, processAi: false },
    );
    const second = await service.processCapture(
      {
        sourceUrl: "https://b.com",
        title: "机器学习实验",
        contentType: "webpage",
        rawContent: "机器学习实验需要记录指标。",
      },
      { userId: 1, processAi: false },
    );
    evolvingKnowledgeRepository.updateCapture(first.id, 1, {
      rewrittenSummary: "机器学习方法",
      aiTags: ["机器学习"],
      processingStatus: "completed",
      markUserEdited: false,
    });
    evolvingKnowledgeRepository.updateCapture(second.id, 1, {
      rewrittenSummary: "机器学习实验",
      aiTags: ["机器学习"],
      processingStatus: "completed",
      markUserEdited: false,
    });
    mockGenerateText
      .mockResolvedValueOnce(
        JSON.stringify([
          {
            sourceIndex: 0,
            targetIndex: 1,
            relationType: "similar",
            confidence: 0.9,
            reasoning: "共享机器学习主题",
          },
        ]),
      )
      .mockResolvedValueOnce(
        JSON.stringify([
          {
            insightType: "synthesis",
            title: "机器学习主题",
            description: "两条材料共同讨论机器学习实践。",
            confidence: 0.8,
            triggerIndex: 0,
            relatedIndices: [1],
          },
        ]),
      );

    const result = await service.rebuildKnowledge(1, { limit: 1, offset: 0 });

    expect(result.capturesScanned).toBe(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextOffset).toBe(1);
    const run = evolvingKnowledgeRepository.getMaintenanceRun(result.runId, 1);
    expect(run?.status).toBe("completed");
    expect(run?.capturesScanned).toBe(1);
    expect(evolvingKnowledgeRepository.listRelationsForCapture(first.id, 1)).toHaveLength(1);
  });

  it("compiles a topic and preserves viewpoint revisions with evidence", async () => {
    const service = createEvolvingKnowledgeService();
    const first = await service.processCapture(
      {
        sourceUrl: "https://a.com/topic",
        title: "Agent 记忆方法",
        contentType: "webpage",
        rawContent: "Agent 需要记录上下文。",
      },
      { userId: 1, processAi: false },
    );
    const second = await service.processCapture(
      {
        sourceUrl: "https://b.com/topic",
        title: "Agent 记忆实验",
        contentType: "webpage",
        rawContent: "Agent 需要验证记忆是否有效。",
      },
      { userId: 1, processAi: false },
    );
    for (const capture of [first, second]) {
      evolvingKnowledgeRepository.updateCapture(capture.id, 1, {
        rewrittenSummary: capture.title,
        aiTags: ["Agent", "记忆"],
        processingStatus: "completed",
        markUserEdited: false,
      });
      evolvingKnowledgeRepository.syncConceptsForCapture(capture.id, 1);
    }

    const concept = service.listConcepts(1).find((item) => item.displayName === "Agent");
    expect(concept).toBeDefined();
    mockGenerateText.mockResolvedValue(
      JSON.stringify({
        summary: "材料共同说明 Agent 记忆需要保存上下文并验证效果。",
        pendingQuestions: ["还需要更多长期运行数据"],
        viewpoint: {
          title: "Agent 记忆需要验证",
          statement: "Agent 记忆机制必须同时保存上下文并通过效果验证。",
          confidence: 0.82,
          supportingIndices: [0, 1],
          opposingIndices: [],
        },
      }),
    );

    const compiled = await service.compileTopicForConcept(concept!.id, 1);

    expect(compiled.topic?.summary).toContain("Agent 记忆");
    expect(compiled.viewpoint?.status).toBe("needs_review");
    expect(compiled.version?.versionNumber).toBe(1);
    expect(
      evolvingKnowledgeRepository.listViewpointEvidence(compiled.version!.id, 1),
    ).toHaveLength(2);

    mockGenerateText.mockReset();
    const reviewed = await service.reviewViewpoint(compiled.viewpoint!.id, 1, {
      decision: "confirm",
      statement: "修订后的 Agent 记忆观点。",
    });
    expect(reviewed?.viewpoint?.status).toBe("active");
    expect(reviewed?.version?.versionNumber).toBe(2);
    expect(service.listViewpointVersions(compiled.viewpoint!.id, 1)).toHaveLength(2);
  });

  it("deduplicates recent insights and excludes expired insights", () => {
    const trigger = evolvingKnowledgeRepository.createCapture({
      userId: 1,
      sourceUrl: "https://example.com",
      title: "Trigger",
      contentType: "webpage",
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

  it("audits queries, reports health, and writes back a topic with evidence", async () => {
    const service = createEvolvingKnowledgeService();
    const capture = await service.processCapture(
      {
        sourceUrl: "https://example.com/maintenance",
        title: "维护材料",
        contentType: "webpage",
        rawContent: "知识维护需要保留证据。",
      },
      { userId: 1, processAi: false },
    );

    const query = service.queryKnowledge("知识维护", 1, { mode: "fact" });
    expect(query.results.length).toBeGreaterThan(0);
    expect(service.listQueryLogs(1)).toHaveLength(1);

    const evidenceUnit = evolvingKnowledgeRepository.listEvidenceUnitsByCapture(capture.id, 1)[0];
    const writeback = service.writeBackKnowledge({
      kind: "topic",
      title: "知识维护实践",
      content: "知识维护需要保留可追溯证据。",
      captureIds: [capture.id],
      evidenceUnitIds: evidenceUnit ? [evidenceUnit.id] : [],
    }, 1);
    expect(writeback.topic?.name).toBe("知识维护实践");
    expect(evolvingKnowledgeRepository.listTopicEvidence(writeback.topic!.id, 1)).toHaveLength(1);

    const health = service.getKnowledgeHealth(1);
    expect(health.status).toBe("healthy");
    expect(health.missingEvidenceCaptureIds).toHaveLength(0);
  });
});
