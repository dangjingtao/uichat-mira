import { llmService } from "@/services/llm.service.js";
import { evolvingKnowledgeRepository } from "@/db/repositories/evolving-knowledge.repository.js";
import type { CaptureInput as RepositoryCaptureInput } from "@/db/repositories/evolving-knowledge.repository.js";
import { convertCapturedHtmlToMarkdown } from "@/services/evolving-knowledge-html.service.js";

export type CaptureRequestInput = Omit<
  RepositoryCaptureInput,
  "userId" | "rewrittenSummary" | "aiTags" | "aiEntities" | "attachments"
> & { attachments?: ImageAttachmentInput[]; rawHtml?: string; captureMode?: "page" | "selection" | "image" };

type ImageAttachmentInput = { filePath: string; mimeType: string; sourceUrl?: string };

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

const localizeAttachmentReferences = (
  markdown: string,
  attachments: ImageAttachmentInput[] | undefined,
) => (attachments ?? []).reduce(
  (value, attachment) => attachment.sourceUrl
    ? value.replaceAll(attachment.sourceUrl, attachment.filePath)
    : value,
  markdown,
);

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

const TOPIC_PROMPT = `你是一位知识库编辑。请根据同一主题下的多条材料，维护一页可持续更新的主题知识页，并提出一个待人工确认的核心观点。

只输出严格 JSON，不要 markdown 代码块：
{
  "summary": "基于材料形成的主题总结，具体说明共识、差异和边界",
  "pendingQuestions": ["仍缺少证据或需要继续调查的问题"],
  "viewpoint": {
    "title": "核心观点标题",
    "statement": "一句可被证据支持或反驳的明确判断",
    "confidence": 0.75,
    "supportingIndices": [0],
    "opposingIndices": [1]
  }
}

规则：
1. 只能根据输入材料归纳，不得补写输入中没有的事实。
2. summary 必须区分材料共识、分歧和适用边界。
3. 没有足够证据形成观点时，viewpoint.statement 输出空字符串。
4. supportingIndices 和 opposingIndices 只能引用输入数组中的索引。
5. 图片只作为原始资料存在，不要要求 OCR 或视觉理解。`;

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

function parseJsonValue<T>(raw: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(raw ?? "") as T;
  } catch {
    return fallback;
  }
}

const EVIDENCE_CHUNK_SIZE = 1200;
const REBUILD_BATCH_SIZE = 25;
const MAX_REBUILD_BATCH_SIZE = 50;

export type KnowledgeQueryMode = "fact" | "viewpoint" | "mixed" | "conflict";

export type KnowledgeQueryCitation = {
  sourceType:
    | "capture"
    | "evidence"
    | "topic"
    | "insight"
    | "viewpoint"
    | "viewpoint_version";
  sourceId: string;
  title: string;
  content: string;
  score: number;
  captureId: string | null;
  evidenceUnitId: string | null;
  topicId: string | null;
  viewpointVersionId: string | null;
  references: Array<{
    captureId: string | null;
    evidenceUnitId: string | null;
    sourceLocator?: Record<string, unknown>;
  }>;
};

export type KnowledgeQueryResult = {
  query: string;
  intent: KnowledgeQueryMode;
  results: KnowledgeQueryCitation[];
  total: number;
};

export type KnowledgeWritebackInput = {
  kind: "topic" | "viewpoint";
  title: string;
  content: string;
  captureIds?: string[];
  evidenceUnitIds?: string[];
  topicId?: string;
  viewpointId?: string;
  stance?: "supports" | "opposes" | "context";
};

const normalizeQueryText = (value: string) => value.trim().toLocaleLowerCase();

const queryTerms = (value: string) => {
  const normalized = normalizeQueryText(value);
  const terms = new Set<string>();

  for (const match of normalized.matchAll(/[a-z0-9_]{2,}/g)) {
    terms.add(match[0]);
  }

  for (const match of normalized.matchAll(/[\u4e00-\u9fff]+/g)) {
    const phrase = match[0];
    if (phrase.length >= 2) terms.add(phrase);
    for (let index = 0; index < phrase.length - 1; index += 1) {
      terms.add(phrase.slice(index, index + 2));
    }
  }

  if (terms.size === 0 && normalized) terms.add(normalized);
  return terms;
};

const scoreQueryMatch = (query: string, fields: Array<{ value: string; weight: number }>) => {
  const terms = queryTerms(query);
  if (!terms.size) return 0;

  let score = 0;
  let matched = 0;
  for (const term of terms) {
    let termMatched = false;
    for (const field of fields) {
      if (normalizeQueryText(field.value).includes(term)) {
        score += field.weight;
        termMatched = true;
        break;
      }
    }
    if (termMatched) matched += 1;
  }

  if (!matched) return 0;
  return Math.min(1, (matched / terms.size) * (score / Math.max(1, fields.length)));
};

const inferKnowledgeQueryMode = (query: string): KnowledgeQueryMode => {
  const normalized = normalizeQueryText(query);
  if (/(冲突|矛盾|分歧|争议|空白|缺口|不足|contradiction|gap)/i.test(normalized)) {
    return "conflict";
  }
  if (/(观点|认识|结论|主题|理解|怎么看|viewpoint|topic)/i.test(normalized)) {
    return "viewpoint";
  }
  if (/(原文|文章|事实|依据|说了什么|fact|source)/i.test(normalized)) {
    return "fact";
  }
  return "mixed";
};

const clampQueryLimit = (limit: number | undefined) =>
  Math.max(1, Math.min(50, limit ?? 20));

const createTextEvidenceUnits = (capture: {
  id: string;
  rawContent: string;
}, userId: number) => {
  const content = capture.rawContent;
  if (!content) return [];

  const units = [];
  for (let start = 0; start < content.length; start += EVIDENCE_CHUNK_SIZE) {
    const end = Math.min(start + EVIDENCE_CHUNK_SIZE, content.length);
    const chunk = content.slice(start, end);
    if (!chunk.trim()) continue;

    units.push(
      evolvingKnowledgeRepository.createEvidenceUnit({
        userId,
        captureId: capture.id,
        unitType: "text",
        content: chunk,
        sourceLocator: { startOffset: start, endOffset: end },
        extractionMethod: "capture_markdown",
      }),
    );
  }
  return units;
};

const getEvidenceUnits = (captureId: string, userId: number) =>
  evolvingKnowledgeRepository.listEvidenceUnitsByCapture(captureId, userId);

const extractTerms = (capture: {
  title: string;
  rawContent: string;
  rewrittenSummary: string;
  aiTags: string[];
  aiEntities: Array<{ name: string }>;
}) => {
  const source = [
    capture.title,
    capture.rewrittenSummary,
    capture.rawContent.slice(0, 5000),
    ...capture.aiTags,
    ...capture.aiEntities.map((entity) => entity.name),
  ]
    .join(" ")
    .toLowerCase();

  const terms = new Set<string>();
  for (const match of source.matchAll(/[a-z0-9_]{2,}|[\u4e00-\u9fff]{2,}/g)) {
    terms.add(match[0]);
  }

  return terms;
};

const selectCandidateCaptures = (
  target: ReturnType<typeof evolvingKnowledgeRepository.getRecentCaptures>[number],
  captures: ReturnType<typeof evolvingKnowledgeRepository.getRecentCaptures>,
  limit = 15,
) => {
  const targetTerms = extractTerms(target);
  return captures
    .filter(
      (capture) =>
        capture.id !== target.id &&
        capture.processingStatus === "completed" &&
        extractTerms(capture).size > 0,
    )
    .map((capture) => {
      const candidateTerms = extractTerms(capture);
      let overlap = 0;
      for (const term of targetTerms) {
        if (candidateTerms.has(term)) overlap += 1;
      }
      const sameDomain =
        target.captureMetadata.domain &&
        target.captureMetadata.domain === capture.captureMetadata.domain;
      return { capture, score: overlap + (sameDomain ? 1 : 0) };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.capture.capturedAt.localeCompare(left.capture.capturedAt),
    )
    .slice(0, limit)
    .map(({ capture }) => capture);
};

export async function processCapture(
  input: CaptureRequestInput,
  options: { userId: number; processAi?: boolean },
) {
  const { attachments, rawHtml, captureMode = "page", ...captureInput } = input;
  const normalizedContent = rawHtml && captureMode === "page"
    ? convertCapturedHtmlToMarkdown({
        html: rawHtml,
        sourceUrl: input.sourceUrl,
        title: input.title,
        fallbackMarkdown: input.rawContent,
        images: attachments,
      })
    : { title: input.title, markdown: localizeAttachmentReferences(input.rawContent, attachments) };
  const capture = evolvingKnowledgeRepository.createCapture({
    ...captureInput,
    title: normalizedContent.title,
    rawContent: normalizedContent.markdown,
    captureMetadata: {
      ...(captureInput.captureMetadata ?? {}),
      captureMode,
    },
    userId: options.userId,
    rewrittenSummary: normalizedContent.markdown.slice(0, 200),
    aiTags: [],
    aiEntities: [],
  });
  createTextEvidenceUnits(capture, options.userId);
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
        { role: "user", content: `标题: ${normalizedContent.title}\n\n内容:\n${normalizedContent.markdown}` },
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
      rewrittenSummary: parsed.rewrittenSummary || normalizedContent.markdown.slice(0, 200),
      aiTags: safeTags,
      aiEntities: safeEntities,
      processingStatus: "completed",
      processingError: null,
      markUserEdited: false,
    });

    for (const tag of safeTags) {
      evolvingKnowledgeRepository.upsertTag(tag, options.userId);
    }
    try {
      evolvingKnowledgeRepository.syncConceptsForCapture(capture.id, options.userId);
    } catch {
      // 概念索引是第四期派生层，索引失败不能回滚已保存的原始资料和摘要。
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
  const allCaptures =
    fullCaptureSet ?? evolvingKnowledgeRepository.getRecentCaptures(userId, 100);

  const newCapture = allCaptures.find((c) => c.id === newCaptureId);
  if (!newCapture) return;

  const candidates = selectCandidateCaptures(newCapture, allCaptures);
  if (candidates.length === 0) return;
  const all = [newCapture, ...candidates];
  let relationsCreated = 0;
  let insightsCreated = 0;

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

      const evidenceUnitIds = [src.id, tgt.id].flatMap((captureId) =>
        getEvidenceUnits(captureId, userId).map((unit) => unit.id),
      );

      evolvingKnowledgeRepository.createRelation({
        userId,
        sourceCaptureId: src.id,
        targetCaptureId: tgt.id,
        relationType: r.relationType,
        confidence: r.confidence,
        aiReasoning: r.reasoning,
        evidenceUnitIds,
      });
      relationsCreated += 1;
    }
  } catch {
    // 关系检测失败不影响主流程
  }

  // 洞见生成只使用候选集合，避免每次把无关材料重新送入模型。
  if (all.length >= 2) {
    try {
      const insightContext = all
        .slice(0, 16)
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
        const trigger = all[ins.triggerIndex];
        if (!trigger || ins.confidence < 0.6) continue;

        const relatedIds = ins.relatedIndices
          .map((i) => all[i]?.id)
          .filter(Boolean) as string[];
        const evidenceUnitIds = [trigger.id, ...relatedIds].flatMap((captureId) =>
          getEvidenceUnits(captureId, userId).map((unit) => unit.id),
        );

        evolvingKnowledgeRepository.createInsight({
          userId,
          insightType: ins.insightType,
          title: ins.title,
          description: ins.description,
          triggerCaptureId: trigger.id,
          relatedCaptureIds: relatedIds,
          confidence: ins.confidence,
          evidenceUnitIds,
        });
        insightsCreated += 1;
      }
    } catch {
      // 洞见生成失败不影响主流程
    }
  }

  return { relationsCreated, insightsCreated };
}

function buildQueryCitation(input: Omit<KnowledgeQueryCitation, "score"> & { score: number }): KnowledgeQueryCitation {
  return {
    ...input,
    score: Math.max(0, Math.min(1, Number(input.score.toFixed(4)))),
  };
}

function queryKnowledge(
  query: string,
  userId: number,
  options?: { mode?: KnowledgeQueryMode; limit?: number },
): KnowledgeQueryResult {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return { query: normalizedQuery, intent: options?.mode ?? "mixed", results: [], total: 0 };
  }

  const intent = options?.mode ?? inferKnowledgeQueryMode(normalizedQuery);
  const limit = clampQueryLimit(options?.limit);
  const captures = evolvingKnowledgeRepository.listCaptures({ userId, limit: 1000 });
  const candidates: KnowledgeQueryCitation[] = [];
  const includeFacts = intent === "fact" || intent === "mixed";
  const includeKnowledge = intent === "viewpoint" || intent === "mixed";

  if (includeFacts) {
    for (const capture of captures) {
      const score = scoreQueryMatch(normalizedQuery, [
        { value: capture.title, weight: 4 },
        { value: capture.rewrittenSummary, weight: 3 },
        { value: capture.rawContent, weight: 1 },
        { value: capture.aiTags.join(" "), weight: 2 },
        { value: capture.aiEntities.map((entity) => entity.name).join(" "), weight: 2 },
      ]);
      if (!score) continue;

      const evidence = evolvingKnowledgeRepository.listEvidenceUnitsByCapture(capture.id, userId);
      candidates.push(buildQueryCitation({
        sourceType: "capture",
        sourceId: capture.id,
        title: capture.title,
        content: capture.rawContent,
        score,
        captureId: capture.id,
        evidenceUnitId: evidence[0]?.id ?? null,
        topicId: null,
        viewpointVersionId: null,
        references: evidence.map((unit) => ({
          captureId: capture.id,
          evidenceUnitId: unit.id,
          sourceLocator: unit.sourceLocator,
        })),
      }));

      for (const unit of evidence) {
        const evidenceScore = scoreQueryMatch(normalizedQuery, [
          { value: unit.content, weight: 4 },
          { value: capture.title, weight: 2 },
        ]);
        if (!evidenceScore) continue;
        candidates.push(buildQueryCitation({
          sourceType: "evidence",
          sourceId: unit.id,
          title: capture.title,
          content: unit.content,
          score: Math.min(1, evidenceScore * 1.05),
          captureId: capture.id,
          evidenceUnitId: unit.id,
          topicId: null,
          viewpointVersionId: null,
          references: [{
            captureId: capture.id,
            evidenceUnitId: unit.id,
            sourceLocator: unit.sourceLocator,
          }],
        }));
      }
    }
  }

  if (includeKnowledge) {
    const topics = evolvingKnowledgeRepository.listTopics(userId, 1000);
    for (const topic of topics) {
      const topicEvidence = evolvingKnowledgeRepository.listTopicEvidence(topic.id, userId);
      const score = scoreQueryMatch(normalizedQuery, [
        { value: topic.name, weight: 4 },
        { value: topic.summary, weight: 3 },
        { value: parseJsonValue<string[]>(topic.pendingQuestionsJson, []).join(" "), weight: 2 },
      ]);
      if (!score) continue;
      candidates.push(buildQueryCitation({
        sourceType: "topic",
        sourceId: topic.id,
        title: topic.name,
        content: topic.summary,
        score,
        captureId: topicEvidence.find((item) => item.captureId)?.captureId ?? null,
        evidenceUnitId: topicEvidence.find((item) => item.evidenceUnitId)?.evidenceUnitId ?? null,
        topicId: topic.id,
        viewpointVersionId: null,
        references: topicEvidence.map((item) => ({
          captureId: item.captureId ?? null,
          evidenceUnitId: item.evidenceUnitId ?? null,
        })),
      }));
    }

    const viewpoints = evolvingKnowledgeRepository.listViewpoints(userId);
    for (const viewpoint of viewpoints) {
      const versions = evolvingKnowledgeRepository.listViewpointVersions(viewpoint.id, userId);
      const currentVersion = versions.find((version) => version.id === viewpoint.currentVersionId) ?? versions[0];
      const versionEvidence = currentVersion
        ? evolvingKnowledgeRepository.listViewpointEvidence(currentVersion.id, userId)
        : [];
      const score = scoreQueryMatch(normalizedQuery, [
        { value: viewpoint.title, weight: 4 },
        { value: viewpoint.statement, weight: 4 },
        { value: currentVersion?.statement ?? "", weight: 3 },
      ]);
      if (!score) continue;

      const sourceId = currentVersion?.id ?? viewpoint.id;
      candidates.push(buildQueryCitation({
        sourceType: currentVersion ? "viewpoint_version" : "viewpoint",
        sourceId,
        title: viewpoint.title,
        content: currentVersion?.statement ?? viewpoint.statement,
        score: viewpoint.status === "needs_review" ? score * 0.9 : score,
        captureId: versionEvidence.find((item) => item.captureId)?.captureId ?? null,
        evidenceUnitId: versionEvidence.find((item) => item.evidenceUnitId)?.evidenceUnitId ?? null,
        topicId: viewpoint.topicId ?? null,
        viewpointVersionId: currentVersion?.id ?? null,
        references: versionEvidence.map((item) => ({
          captureId: item.captureId ?? null,
          evidenceUnitId: item.evidenceUnitId ?? null,
          sourceLocator: parseJsonValue<Record<string, unknown>>(item.locatorJson, {}),
        })),
      }));
    }

  }

  if (includeKnowledge || intent === "conflict") {
    const insights = evolvingKnowledgeRepository.listActiveInsights(userId, { limit: 1000 });
    for (const insight of insights) {
      if (intent === "conflict" && insight.insightType !== "contradiction" && insight.insightType !== "gap") continue;
      const score = scoreQueryMatch(normalizedQuery, [
        { value: insight.title, weight: 4 },
        { value: insight.description, weight: 3 },
        { value: insight.insightType, weight: intent === "conflict" ? 4 : 1 },
      ]);
      if (!score) continue;
      const relatedCaptureIds = parseJsonValue<string[]>(insight.relatedCaptureIdsJson, []);
      const evidenceUnitIds = parseJsonValue<string[]>(insight.evidenceUnitIdsJson, []);
      candidates.push(buildQueryCitation({
        sourceType: "insight",
        sourceId: insight.id,
        title: insight.title,
        content: insight.description,
        score: intent === "conflict" ? Math.min(1, score * 1.1) : score,
        captureId: insight.triggerCaptureId,
        evidenceUnitId: evidenceUnitIds[0] ?? null,
        topicId: null,
        viewpointVersionId: null,
        references: [insight.triggerCaptureId, ...relatedCaptureIds].map((captureId, index) => ({
          captureId: captureId ?? null,
          evidenceUnitId: evidenceUnitIds[index] ?? null,
        })),
      }));
    }
  }

  const deduplicated = new Map<string, KnowledgeQueryCitation>();
  for (const candidate of candidates) {
    const key = `${candidate.sourceType}:${candidate.sourceId}`;
    const existing = deduplicated.get(key);
    if (!existing || candidate.score > existing.score) deduplicated.set(key, candidate);
  }
  const results = [...deduplicated.values()]
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
  const total = results.length;

  const response = { query: normalizedQuery, intent, results: results.slice(0, limit), total };
  evolvingKnowledgeRepository.createQueryLog({
    userId,
    query: normalizedQuery,
    intent,
    resultCount: response.results.length,
    sourceIds: response.results.map((item) => item.sourceId),
  });
  return response;
}

function writeBackKnowledge(input: KnowledgeWritebackInput, userId: number) {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) throw new Error("title and content are required");
  const captureIds = [...new Set(input.captureIds ?? [])];
  const evidenceUnitIds = [...new Set(input.evidenceUnitIds ?? [])];

  for (const captureId of captureIds) {
    if (!evolvingKnowledgeRepository.getCaptureById(captureId, userId)) {
      throw new Error(`Capture not found: ${captureId}`);
    }
  }
  for (const evidenceUnitId of evidenceUnitIds) {
    const capture = evolvingKnowledgeRepository.listCaptures({ userId, limit: 1000 })
      .find((item) => evolvingKnowledgeRepository.listEvidenceUnitsByCapture(item.id, userId)
        .some((unit) => unit.id === evidenceUnitId));
    if (!capture) throw new Error(`Evidence unit not found: ${evidenceUnitId}`);
  }

  if (input.kind === "topic") {
    const topic = evolvingKnowledgeRepository.createTopic({
      userId,
      name: title,
      summary: content,
    });
    const referencedCaptureIds = new Set(captureIds);
    const units = evidenceUnitIds.length
      ? evolvingKnowledgeRepository.listCaptures({ userId, limit: 1000 })
        .flatMap((capture) => evolvingKnowledgeRepository.listEvidenceUnitsByCapture(capture.id, userId)
          .filter((unit) => evidenceUnitIds.includes(unit.id))
          .map((unit) => ({ captureId: capture.id, evidenceUnitId: unit.id })))
      : [];
    for (const reference of units) {
      referencedCaptureIds.add(reference.captureId);
      evolvingKnowledgeRepository.addTopicEvidence({
        userId,
        topicId: topic.id,
        captureId: reference.captureId,
        evidenceUnitId: reference.evidenceUnitId,
        evidenceRole: input.stance ?? "context",
      });
    }
    const unitCaptureIds = new Set(units.map((reference) => reference.captureId));
    for (const captureId of referencedCaptureIds) {
      if (unitCaptureIds.has(captureId)) continue;
      evolvingKnowledgeRepository.addTopicEvidence({
        userId,
        topicId: topic.id,
        captureId,
        evidenceRole: input.stance ?? "context",
      });
    }
    return { kind: input.kind, topic };
  }

  if (!input.viewpointId) throw new Error("viewpointId is required for viewpoint writeback");
  const viewpoint = evolvingKnowledgeRepository.getViewpoint(input.viewpointId, userId);
  if (!viewpoint) throw new Error("Viewpoint not found");
  const evidence = [
    ...captureIds.map((captureId) => ({
      captureId,
      stance: input.stance ?? "context" as const,
    })),
    ...evidenceUnitIds.map((evidenceUnitId) => ({
      evidenceUnitId,
      stance: input.stance ?? "context" as const,
    })),
  ];
  const version = evolvingKnowledgeRepository.createViewpointVersion({
    userId,
    viewpointId: viewpoint.id,
    statement: content,
    changeType: "revised",
    triggerReason: "User explicitly saved a conversation analysis.",
    inputScope: { captureIds, evidenceUnitIds, source: "conversation" },
    modelInfo: { source: "user_writeback" },
    confidence: viewpoint.confidence,
    status: "needs_review",
    evidence,
  });
  if (!version) throw new Error("Failed to create viewpoint version");
  return { kind: input.kind, viewpoint, version };
}

type TopicCompileResult = {
  topic: ReturnType<typeof evolvingKnowledgeRepository.getTopic> | null;
  viewpoint: ReturnType<typeof evolvingKnowledgeRepository.getViewpoint> | null;
  version: ReturnType<typeof evolvingKnowledgeRepository.createViewpointVersion> | null;
  capturesUsed: number;
};

async function compileTopicForConcept(
  conceptId: string,
  userId: number,
): Promise<TopicCompileResult> {
  const topic = evolvingKnowledgeRepository.getOrCreateTopicForConcept(
    conceptId,
    userId,
  );
  if (!topic) throw new Error("Concept not found");

  const conceptEvidence = evolvingKnowledgeRepository.listConceptEvidence(
    conceptId,
    userId,
  );
  const captureIds = [...new Set(conceptEvidence.map((item) => item.captureId))];
  const captures = evolvingKnowledgeRepository
    .listCaptures({ userId, limit: 1000 })
    .filter((capture) => captureIds.includes(capture.id))
    .slice(0, 30);

  for (const capture of captures) {
    const evidenceUnitId = evolvingKnowledgeRepository.listEvidenceUnitsByCapture(
      capture.id,
      userId,
    )[0]?.id;
    evolvingKnowledgeRepository.addTopicEvidence({
      userId,
      topicId: topic.id,
      captureId: capture.id,
      evidenceUnitId,
      evidenceRole: "context",
    });
  }

  if (captures.length === 0) {
    return {
      topic,
      viewpoint: null,
      version: null,
      capturesUsed: 0,
    };
  }

  const context = captures
    .map(
      (capture, index) =>
        `[${index}] ${capture.title}\n摘要: ${capture.rewrittenSummary}\n标签: ${capture.aiTags.join(", ")}\n实体: ${capture.aiEntities.map((entity) => entity.name).join(", ")}`,
    )
    .join("\n\n---\n\n");
  const raw = await llmService.generateText({
    roleType: "llm",
    messages: [
      { role: "system", content: TOPIC_PROMPT },
      { role: "user", content: `主题: ${topic.name}\n\n材料:\n${context}` },
    ],
    params: { temperature: 0.2, max_tokens: 1800 },
  });
  const parsed = safeJsonParse<{
    summary: string;
    pendingQuestions: string[];
    viewpoint?: {
      title: string;
      statement: string;
      confidence: number;
      supportingIndices: number[];
      opposingIndices: number[];
    };
  }>(raw, { summary: "", pendingQuestions: [] });

  const nextTopic = evolvingKnowledgeRepository.updateTopic(topic.id, userId, {
    summary: parsed.summary?.trim() || topic.summary,
    pendingQuestions: Array.isArray(parsed.pendingQuestions)
      ? parsed.pendingQuestions.filter((item) => typeof item === "string")
      : [],
    sourceCount: captures.length,
    currentVersion: topic.currentVersion + 1,
  });

  const viewpointInput = parsed.viewpoint;
  if (!viewpointInput?.statement?.trim()) {
    return {
      topic: nextTopic,
      viewpoint: null,
      version: null,
      capturesUsed: captures.length,
    };
  }

  const title = viewpointInput.title?.trim() || `${topic.name}核心观点`;
  let viewpoint = evolvingKnowledgeRepository.getViewpointByTopicTitle(
    topic.id,
    title,
    userId,
  );
  if (!viewpoint) {
    viewpoint = evolvingKnowledgeRepository.createViewpoint({
      userId,
      topicId: topic.id,
      title,
      statement: "",
      status: "draft",
    });
  }

  const evidenceForVersion = (indices: number[], stance: "supports" | "opposes") =>
    indices
      .filter((index) => Number.isInteger(index) && captures[index])
      .map((index) => {
        const capture = captures[index];
        const evidenceUnitId = evolvingKnowledgeRepository.listEvidenceUnitsByCapture(
          capture.id,
          userId,
        )[0]?.id;
        return {
          captureId: capture.id,
          evidenceUnitId,
          stance,
        };
      });

  const sameStatement = viewpoint.statement.trim() === viewpointInput.statement.trim();
  const version = sameStatement
    ? null
    : evolvingKnowledgeRepository.createViewpointVersion({
        userId,
        viewpointId: viewpoint.id,
        statement: viewpointInput.statement.trim(),
        changeType: viewpoint.statement ? "revised" : "formed",
        triggerReason: `Topic ${topic.name} was recompiled from ${captures.length} captures.`,
        inputScope: { conceptId, topicId: topic.id, captureIds: captures.map((capture) => capture.id) },
        modelInfo: { roleType: "llm" },
        confidence: Math.max(0, Math.min(1, Number(viewpointInput.confidence) || 0.5)),
        status: "needs_review",
        evidence: [
          ...evidenceForVersion(viewpointInput.supportingIndices ?? [], "supports"),
          ...evidenceForVersion(viewpointInput.opposingIndices ?? [], "opposes"),
        ],
      });

  return {
    topic: nextTopic,
    viewpoint: version
      ? evolvingKnowledgeRepository.getViewpoint(viewpoint.id, userId)
      : viewpoint,
    version,
    capturesUsed: captures.length,
  };
}

async function reviewViewpoint(
  id: string,
  userId: number,
  input: { decision: "confirm" | "reject"; statement?: string },
) {
  const viewpoint = evolvingKnowledgeRepository.getViewpoint(id, userId);
  if (!viewpoint) return null;

  let version = null;
  const nextStatement = input.statement?.trim();
  if (input.decision === "confirm" && nextStatement && nextStatement !== viewpoint.statement) {
    const previousEvidence = viewpoint.currentVersionId
      ? evolvingKnowledgeRepository.listViewpointEvidence(viewpoint.currentVersionId, userId)
      : [];
    version = evolvingKnowledgeRepository.createViewpointVersion({
      userId,
      viewpointId: id,
      statement: nextStatement,
      changeType: "revised",
      triggerReason: "User revised the viewpoint during confirmation.",
      inputScope: { viewpointId: id, source: "user" },
      modelInfo: {},
      confidence: viewpoint.confidence,
      status: "active",
      evidence: previousEvidence.map((evidence) => ({
        captureId: evidence.captureId ?? undefined,
        evidenceUnitId: evidence.evidenceUnitId ?? undefined,
        insightId: evidence.insightId ?? undefined,
        stance: evidence.stance,
        locator: parseJsonValue<Record<string, unknown>>(evidence.locatorJson, {}),
      })),
    });
  }

  const updated = evolvingKnowledgeRepository.updateViewpointReviewState(id, userId, {
    status: input.decision === "confirm" ? "active" : "rejected",
    userConfirmed: input.decision === "confirm",
  });
  return { viewpoint: updated, version };
}

async function rebuildKnowledge(
  userId: number,
  options?: { limit?: number; offset?: number },
) {
  const limit = Math.min(
    Math.max(options?.limit ?? REBUILD_BATCH_SIZE, 1),
    MAX_REBUILD_BATCH_SIZE,
  );
  const offset = Math.max(options?.offset ?? 0, 0);
  const captures = evolvingKnowledgeRepository.listCaptures({
    userId,
    limit: 1000,
  });
  const batch = captures.slice(offset, offset + limit);
  const run = evolvingKnowledgeRepository.startMaintenanceRun({
    userId,
    scope: { offset, limit, totalCaptures: captures.length },
  });

  try {
    let relationsCreated = 0;
    let insightsCreated = 0;
    for (const capture of batch) {
      const result = await generateRelationsAndInsights(capture.id, userId, captures);
      relationsCreated += result?.relationsCreated ?? 0;
      insightsCreated += result?.insightsCreated ?? 0;
    }

    evolvingKnowledgeRepository.completeMaintenanceRun(run.id, userId, {
      capturesScanned: batch.length,
      relationsCreated,
      insightsCreated,
    });

    const nextOffset = offset + batch.length;
    return {
      status: "completed" as const,
      runId: run.id,
      capturesScanned: batch.length,
      relationsCreated,
      insightsCreated,
      nextOffset,
      hasMore: nextOffset < captures.length,
      totalCaptures: captures.length,
    };
  } catch (error) {
    evolvingKnowledgeRepository.failMaintenanceRun(
      run.id,
      userId,
      error instanceof Error ? error.message : "Knowledge rebuild failed",
    );
    throw error;
  }
}

export function createEvolvingKnowledgeService() {
  return {
    processCapture,
    rebuildKnowledge,
    queryKnowledge,
    writeBackKnowledge,
    getKnowledgeHealth: (userId: number) => evolvingKnowledgeRepository.listKnowledgeHealth(userId),
    listQueryLogs: (userId: number, limit?: number) => evolvingKnowledgeRepository.listQueryLogs(userId, limit),
    compileTopicForConcept,
    reviewViewpoint,
    listConcepts: (userId: number, options?: { status?: string; limit?: number }) => evolvingKnowledgeRepository.listConcepts(userId, options),
    mergeConcepts: (sourceId: string, targetId: string, userId: number) => evolvingKnowledgeRepository.mergeConcepts(sourceId, targetId, userId),
    listTopics: (userId: number, limit?: number) => evolvingKnowledgeRepository.listTopics(userId, limit),
    getTopic: (id: string, userId: number) => evolvingKnowledgeRepository.getTopic(id, userId),
    listTopicEvidence: (id: string, userId: number) => evolvingKnowledgeRepository.listTopicEvidence(id, userId),
    listViewpoints: (userId: number, topicId?: string) => evolvingKnowledgeRepository.listViewpoints(userId, topicId),
    getViewpoint: (id: string, userId: number) => evolvingKnowledgeRepository.getViewpoint(id, userId),
    listViewpointVersions: (id: string, userId: number) => evolvingKnowledgeRepository.listViewpointVersions(id, userId),
    listViewpointEvidence: (id: string, userId: number) => evolvingKnowledgeRepository.listViewpointEvidence(id, userId),
    listCaptures: (userId: number, options?: Omit<Parameters<typeof evolvingKnowledgeRepository.listCaptures>[0], "userId">) => evolvingKnowledgeRepository.listCaptures({ userId, ...options }),
    getCaptureById: (id: string, userId: number) => evolvingKnowledgeRepository.getCaptureById(id, userId),
    searchCaptures: (q: string, userId: number) => evolvingKnowledgeRepository.searchCapturesByText(q, userId),
    listActiveInsights: (userId: number, options?: { type?: string; limit?: number }) => evolvingKnowledgeRepository.listActiveInsights(userId, options),
    dismissInsight: (id: string, userId: number) => evolvingKnowledgeRepository.dismissInsight(id, userId),
    listRelationsForCapture: (id: string, userId: number) => evolvingKnowledgeRepository.listRelationsForCapture(id, userId),
    listEvidenceUnits: (id: string, userId: number) => evolvingKnowledgeRepository.listEvidenceUnitsByCapture(id, userId),
    listPopularTags: (userId: number, limit?: number) => evolvingKnowledgeRepository.listPopularTags(userId, limit),
    updateCapture: (id: string, userId: number, input: Parameters<typeof evolvingKnowledgeRepository.updateCapture>[2]) => evolvingKnowledgeRepository.updateCapture(id, userId, input),
    deleteCapture: (id: string, userId: number) => evolvingKnowledgeRepository.deleteCapture(id, userId),
  };
}

export type EvolvingKnowledgeService = ReturnType<
  typeof createEvolvingKnowledgeService
>;
