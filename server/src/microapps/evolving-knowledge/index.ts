import { llmService } from "@/services/llm.service.js";
import { evolvingKnowledgeRepository } from "@/db/repositories/evolving-knowledge.repository.js";
import type { CaptureInput as RepositoryCaptureInput } from "@/db/repositories/evolving-knowledge.repository.js";

export type CaptureRequestInput = Omit<
  RepositoryCaptureInput,
  "userId" | "rewrittenSummary" | "aiTags" | "aiEntities" | "attachments"
> & { attachments?: ImageAttachmentInput[] };

type ImageAttachmentInput = { filePath: string; mimeType: string };

const saveImageAttachments = async (
  captureId: string,
  attachments: ImageAttachmentInput[] | undefined,
) => {
  if (!attachments?.length) return;

  for (const attachment of attachments.slice(0, 10)) {
    evolvingKnowledgeRepository.createAttachment({
      captureId,
      filePath: attachment.filePath,
      mimeType: attachment.mimeType,
      processingStatus: "done",
    });
  }
};

const SUMMARY_PROMPT = `你是一位知识管理专家，擅长"卡帕西式笔记法"：看完内容后，用自己的话重新提炼核心论点，而不是摘抄原文。

请对用户提供的内容进行以下处理，并以严格 JSON 格式输出（不要 markdown 代码块，直接输出 JSON）：

{
  "rewrittenSummary": "用你自己的话，简洁地提炼这篇文章的核心论点。100-200字。",
  "tags": ["标签1", "标签2", "标签3", "标签4", "标签5"],
  "entities": [
    {"name": "概念/人名/技术名", "type": "concept|person|technology|methodology", "context": "一句话说明它在文中的角色"}
  ]
}

规则：
1. tags 应该是动态生成的概念标签，不要分类树。标签会随时间演化。
2. entities 提取文中重要的概念实体（人名、技术、方法论）。
3. 如果内容是中文，用中文输出；如果是英文，用英文输出。
4. 只输出 JSON，不要任何其他文字。`;

const RELATION_PROMPT = `你是一位知识图谱分析专家。用户最近收藏了一系列内容，每条都有 AI 生成的摘要和标签。

请分析这些内容之间的关系，并输出 JSON 数组。每条关系包含：
{
  "sourceIndex": 0,  // 在输入数组中的索引
  "targetIndex": 1,  // 在输入数组中的索引
  "relationType": "similar|contradicts|evolves|references",
  "confidence": 0.85,  // 0.0-1.0
  "reasoning": "为什么认为两者有关系，用一句话说明"
}

关系类型定义：
- similar: 主题相似或互补
- contradicts: 观点冲突或数据矛盾
- evolves: 后者在前者基础上演进/改进
- references: 明确引用或继承关系

只输出关系最强的 3-8 条，不要强行凑关系。只输出 JSON 数组，不要任何其他文字。`;

const INSIGHT_PROMPT = `你是一位洞见发现专家。用户收藏了一系列知识片段，你的任务是从中发现有趣的跨内容洞见。

请输出一个 JSON 数组，每个元素是一个洞见：
{
  "insightType": "synthesis|contradiction|resurfacing|gap",
  "title": "洞见标题，15字以内",
  "description": "洞见详细描述，100-200字。要具体引用收藏内容的摘要，不要泛泛而谈。",
  "confidence": 0.85,
  "triggerIndex": 0,  // 触发这个洞见的主要内容的索引
  "relatedIndices": [1, 2]  // 相关的其他内容索引
}

洞见类型定义：
- synthesis: 跨内容主题聚合（"你的收藏中出现了3个不同来源但同一主题的内容"）
- contradiction: 知识冲突发现（"A说X，B说¬X"）
- resurfacing: 跨时间演进追踪（"30天前你关注X，今天这篇Y延续了X但提出了新角度"）
- gap: 知识缺口指出（"你看了A和B，但没看C，而C是理解这个问题的关键"）

只输出最强的 2-5 条洞见。不要强行凑数。只输出 JSON 数组，不要任何其他文字。`;

function cleanJsonOutput(raw: string): string {
  return raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(cleanJsonOutput(raw)) as T;
  } catch {
    return fallback;
  }
}

export async function processCapture(
  input: CaptureRequestInput,
  options: { userId: number; processAi?: boolean },
) {
  const { attachments, ...captureInput } = input;
  const capture = evolvingKnowledgeRepository.createCapture({
    ...captureInput,
    userId: options.userId,
    rewrittenSummary: input.rawContent.slice(0, 200),
    aiTags: [],
    aiEntities: [],
  });
  try {
    await saveImageAttachments(capture.id, attachments);
  } catch (error) {
    evolvingKnowledgeRepository.updateCapture(capture.id, options.userId, {
      processingError: `Attachment processing failed: ${error instanceof Error ? error.message : "unknown error"}`.slice(0, 500),
      markUserEdited: false,
    });
  }

  if (options.processAi === false) {
    return evolvingKnowledgeRepository.updateCapture(capture.id, options.userId, {
      processingStatus: "skipped",
      markUserEdited: false,
    }) ?? capture;
  }

  evolvingKnowledgeRepository.updateCapture(capture.id, options.userId, {
    processingStatus: "processing",
    processingError: null,
    markUserEdited: false,
  });

  try {
    // 1. AI 重写 + 标签 + 实体提取
    const llmResponse = await llmService.generateText({
      roleType: "llm",
      messages: [
        { role: "system", content: SUMMARY_PROMPT },
        { role: "user", content: `标题: ${input.title}\n\n内容:\n${input.rawContent}` },
      ],
      params: { temperature: 0.3, max_tokens: 800 },
    });

    const parsed = safeJsonParse<{
      rewrittenSummary: string;
      tags: string[];
      entities: Array<{ name: string; type: string; context: string }>;
    }>(llmResponse, {
      rewrittenSummary: input.rawContent.slice(0, 200),
      tags: [],
      entities: [],
    });

    // 2. 更新 AI 结果
    const safeTags = Array.isArray(parsed.tags) ? parsed.tags : [];
    const safeEntities = Array.isArray(parsed.entities) ? parsed.entities : [];

    const updated = evolvingKnowledgeRepository.updateCapture(capture.id, options.userId, {
      rewrittenSummary: parsed.rewrittenSummary || input.rawContent.slice(0, 200),
      aiTags: safeTags,
      aiEntities: safeEntities,
      processingStatus: "completed",
      processingError: null,
      markUserEdited: false,
    });

    for (const tag of safeTags) {
      evolvingKnowledgeRepository.upsertTag(tag, options.userId);
    }

    void generateRelationsAndInsights(capture.id, options.userId).catch(() => {});

    return updated ?? capture;
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI processing failed";
    return evolvingKnowledgeRepository.updateCapture(capture.id, options.userId, {
      processingStatus: "failed",
      processingError: message.slice(0, 500),
      markUserEdited: false,
    }) ?? capture;
  }
}

async function generateRelationsAndInsights(
  newCaptureId: string,
  userId: number,
  fullCaptureSet?: ReturnType<typeof evolvingKnowledgeRepository.getRecentCaptures>,
) {
  const recent = fullCaptureSet ?? evolvingKnowledgeRepository.getRecentCaptures(userId, 20);
  if (recent.length < 2) return;

  const newCapture = recent.find((c) => c.id === newCaptureId);
  if (!newCapture) return;

  // 只和新捕获比较（避免全量 O(N²)）
  const candidates = recent.filter((c) => c.id !== newCaptureId).slice(0, fullCaptureSet ? 30 : 15);
  const all = [newCapture, ...candidates];

  const context = all
    .map(
      (c, i) =>
        `[${i}] ${c.title}\n类型: ${c.contentType}\n摘要: ${c.rewrittenSummary}\n标签: ${c.aiTags.join(", ")}\n实体: ${c.aiEntities.map((e) => e.name).join(", ")}`,
    )
    .join("\n\n---\n\n");

  // 关系检测
  try {
    const relationRaw = await llmService.generateText({
      roleType: "llm",
      messages: [
        { role: "system", content: RELATION_PROMPT },
        { role: "user", content: context },
      ],
      params: { temperature: 0.2, max_tokens: 1200 },
    });

    const relations = safeJsonParse<
      Array<{
        sourceIndex: number;
        targetIndex: number;
        relationType: "similar" | "contradicts" | "evolves" | "references";
        confidence: number;
        reasoning: string;
      }>
    >(relationRaw, []);

    for (const r of relations) {
      const src = all[r.sourceIndex];
      const tgt = all[r.targetIndex];
      if (!src || !tgt || r.confidence < 0.6) continue;

      evolvingKnowledgeRepository.createRelation({
        userId,
        sourceCaptureId: src.id,
        targetCaptureId: tgt.id,
        relationType: r.relationType,
        confidence: r.confidence,
        aiReasoning: r.reasoning,
      });
    }
  } catch {
    // 关系检测失败不影响主流程
  }

  // 洞见生成（只在最近 5 条内做，控制 token）
  if (recent.length >= 2) {
    try {
      const insightContext = recent
        .slice(0, 8)
        .map(
          (c, i) =>
            `[${i}] ${c.title}\n时间: ${c.capturedAt}\n摘要: ${c.rewrittenSummary}\n标签: ${c.aiTags.join(", ")}`,
        )
        .join("\n\n---\n\n");

      const insightRaw = await llmService.generateText({
        roleType: "llm",
        messages: [
          { role: "system", content: INSIGHT_PROMPT },
          { role: "user", content: insightContext },
        ],
        params: { temperature: 0.4, max_tokens: 1500 },
      });

      const insights = safeJsonParse<
        Array<{
          insightType: "synthesis" | "contradiction" | "resurfacing" | "gap";
          title: string;
          description: string;
          confidence: number;
          triggerIndex: number;
          relatedIndices: number[];
        }>
      >(insightRaw, []);

      for (const ins of insights) {
        const trigger = recent[ins.triggerIndex];
        if (!trigger || ins.confidence < 0.6) continue;

        const relatedIds = ins.relatedIndices
          .map((i) => recent[i]?.id)
          .filter(Boolean) as string[];

        evolvingKnowledgeRepository.createInsight({
          userId,
          insightType: ins.insightType,
          title: ins.title,
          description: ins.description,
          triggerCaptureId: trigger.id,
          relatedCaptureIds: relatedIds,
          confidence: ins.confidence,
        });
      }
    } catch {
      // 洞见生成失败不影响主流程
    }
  }
}

async function rebuildKnowledge(userId: number) {
  const captures = evolvingKnowledgeRepository.listCaptures({ userId, limit: 1000 });
  for (const capture of captures) {
    await generateRelationsAndInsights(capture.id, userId, captures);
  }
  return {
    status: "completed" as const,
    capturesScanned: captures.length,
  };
}

export function createEvolvingKnowledgeService() {
  return {
    processCapture,
    rebuildKnowledge,
    listCaptures: (userId: number, options?: Omit<Parameters<typeof evolvingKnowledgeRepository.listCaptures>[0], "userId">) => evolvingKnowledgeRepository.listCaptures({ userId, ...options }),
    getCaptureById: (id: string, userId: number) => evolvingKnowledgeRepository.getCaptureById(id, userId),
    searchCaptures: (q: string, userId: number) => evolvingKnowledgeRepository.searchCapturesByText(q, userId),
    listActiveInsights: (userId: number, options?: { type?: string; limit?: number }) => evolvingKnowledgeRepository.listActiveInsights(userId, options),
    dismissInsight: (id: string, userId: number) => evolvingKnowledgeRepository.dismissInsight(id, userId),
    listRelationsForCapture: (id: string, userId: number) => evolvingKnowledgeRepository.listRelationsForCapture(id, userId),
    listPopularTags: (userId: number, limit?: number) => evolvingKnowledgeRepository.listPopularTags(userId, limit),
    updateCapture: (id: string, userId: number, input: Parameters<typeof evolvingKnowledgeRepository.updateCapture>[2]) => evolvingKnowledgeRepository.updateCapture(id, userId, input),
    deleteCapture: (id: string, userId: number) => evolvingKnowledgeRepository.deleteCapture(id, userId),
  };
}

export type EvolvingKnowledgeService = ReturnType<
  typeof createEvolvingKnowledgeService
>;
