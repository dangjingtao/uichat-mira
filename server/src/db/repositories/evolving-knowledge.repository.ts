import { and, asc, desc, eq, gte, gt, isNull, or, sql } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { hasSqliteColumn } from "../sqlite-utils";
import {
  knowledgeCaptures,
  knowledgeAttachments,
  knowledgeEvidenceUnits,
  knowledgeRelations,
  knowledgeInsights,
  knowledgeTagsEvolution,
  knowledgeMaintenanceRuns,
  knowledgeConcepts,
  knowledgeConceptEvidence,
  knowledgeConceptEdges,
  knowledgeTopics,
  knowledgeTopicEvidence,
  knowledgeViewpoints,
  knowledgeViewpointVersions,
  knowledgeViewpointEvidence,
} from "../schema";

const parseJson = <T>(value: string | null, fallback: T): T => {
  try {
    return JSON.parse(value ?? "") as T;
  } catch {
    return fallback;
  }
};

const normalizeConceptName = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");

export type CaptureInput = {
  userId: number;
  sourceUrl: string;
  title: string;
  favicon?: string;
  contentType: "webpage";
  rawContent: string;
  rewrittenSummary: string;
  aiTags: string[];
  aiEntities: Array<{ name: string; type: string; context: string }>;
  captureMetadata?: Record<string, unknown>;
  attachments?: Array<{ filePath: string; mimeType: string }>;
};

export type CaptureRecord = {
  id: string;
  sourceUrl: string;
  title: string;
  favicon: string;
  capturedAt: string;
  contentType: "webpage";
  rawContent: string;
  rewrittenSummary: string;
  aiTags: string[];
  aiEntities: Array<{ name: string; type: string; context: string }>;
  userEdited: boolean;
  captureMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  processingStatus: "pending" | "processing" | "completed" | "failed" | "skipped";
  processingError: string | null;
};

const toCaptureRecord = (row: typeof knowledgeCaptures.$inferSelect): CaptureRecord => ({
  id: row.id,
  sourceUrl: row.sourceUrl,
  title: row.title,
  favicon: row.favicon,
  capturedAt: row.capturedAt,
  contentType: "webpage",
  rawContent: row.rawContent,
  rewrittenSummary: row.rewrittenSummary,
  aiTags: parseJson<string[]>(row.aiTagsJson, []),
  aiEntities: parseJson<Array<{ name: string; type: string; context: string }>>(
    row.aiEntitiesJson,
    [],
  ),
  userEdited: Boolean(row.userEdited),
  captureMetadata: parseJson<Record<string, unknown>>(
    row.captureMetadataJson,
    {},
  ),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  processingStatus: row.processingStatus as CaptureRecord["processingStatus"],
  processingError: row.processingError,
});

export const evolvingKnowledgeRepository = {
  // ── Captures ────────────────────────────────────────────────

  createCapture(input: CaptureInput) {
    const now = new Date().toISOString();
    const row = getDb()
      .insert(knowledgeCaptures)
      .values({
        userId: input.userId,
        capturedAt: now,
        sourceUrl: input.sourceUrl,
        title: input.title,
        favicon: input.favicon ?? "",
        contentType: input.contentType,
        rawContent: input.rawContent,
        rewrittenSummary: input.rewrittenSummary,
        aiTagsJson: JSON.stringify(input.aiTags),
        aiEntitiesJson: JSON.stringify(input.aiEntities),
        captureMetadataJson: JSON.stringify(input.captureMetadata ?? {}),
        processingStatus: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    return toCaptureRecord(row);
  },

  listCaptures(options: { userId: number; limit?: number; offset?: number; contentType?: string }) {
    let query = getDb()
      .select()
      .from(knowledgeCaptures)
      .orderBy(desc(knowledgeCaptures.capturedAt))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);

    query = query.where(
      and(
        eq(knowledgeCaptures.userId, options.userId),
        options.contentType
          ? eq(knowledgeCaptures.contentType, options.contentType as never)
          : undefined,
      ),
    ) as typeof query;

    return query.all().map(toCaptureRecord);
  },

  getCaptureById(id: string, userId: number) {
    const row = getDb()
      .select()
      .from(knowledgeCaptures)
      .where(and(eq(knowledgeCaptures.id, id), eq(knowledgeCaptures.userId, userId)))
      .get();
    return row ? toCaptureRecord(row) : null;
  },

  getRecentCaptures(userId: number, limit = 50) {
    return getDb()
      .select()
      .from(knowledgeCaptures)
      .where(eq(knowledgeCaptures.userId, userId))
      .orderBy(desc(knowledgeCaptures.capturedAt))
      .limit(limit)
      .all()
      .map(toCaptureRecord);
  },

  updateCapture(id: string, userId: number, input: Partial<Pick<CaptureInput, "rewrittenSummary" | "aiTags" | "aiEntities">> & Partial<Pick<CaptureRecord, "processingStatus" | "processingError">> & { markUserEdited?: boolean }) {
    const current = this.getCaptureById(id, userId);
    if (!current) return null;

    const row = getDb()
      .update(knowledgeCaptures)
      .set({
        rewrittenSummary:
          input.rewrittenSummary !== undefined
            ? input.rewrittenSummary
            : current.rewrittenSummary,
        aiTagsJson: input.aiTags !== undefined ? JSON.stringify(input.aiTags) : JSON.stringify(current.aiTags),
        aiEntitiesJson:
          input.aiEntities !== undefined
            ? JSON.stringify(input.aiEntities)
            : JSON.stringify(current.aiEntities),
        userEdited: input.markUserEdited ?? true,
        processingStatus: input.processingStatus ?? current.processingStatus,
        processingError: input.processingError !== undefined ? input.processingError : current.processingError,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(knowledgeCaptures.id, id), eq(knowledgeCaptures.userId, userId)))
      .returning()
      .get();
    return row ? toCaptureRecord(row) : null;
  },

  deleteCapture(id: string, userId: number) {
    getDb()
      .delete(knowledgeCaptures)
      .where(and(eq(knowledgeCaptures.id, id), eq(knowledgeCaptures.userId, userId)))
      .run();
  },

  searchCapturesByText(q: string, userId: number) {
    // SQLite FTS 后面再加，先用 LIKE
    const pattern = `%${q}%`;
    return getDb()
      .select()
      .from(knowledgeCaptures)
      .where(and(
        eq(knowledgeCaptures.userId, userId),
        sql`${knowledgeCaptures.title} LIKE ${pattern} OR ${knowledgeCaptures.rewrittenSummary} LIKE ${pattern} OR ${knowledgeCaptures.rawContent} LIKE ${pattern}`,
      ))
      .orderBy(desc(knowledgeCaptures.capturedAt))
      .limit(50)
      .all()
      .map(toCaptureRecord);
  },

  // ── Attachments ─────────────────────────────────────────────

  createAttachment(input: {
    captureId: string;
    filePath: string;
    mimeType: string;
    aiExtractedText?: string;
    processingStatus?: "done" | "pending" | "failed";
  }) {
    return getDb()
      .insert(knowledgeAttachments)
      .values({
        captureId: input.captureId,
        filePath: input.filePath,
        mimeType: input.mimeType,
        aiExtractedText: input.aiExtractedText ?? "",
        processingStatus: input.processingStatus ?? "pending",
      })
      .returning()
      .get();
  },

  createEvidenceUnit(input: {
    userId: number;
    captureId: string;
    unitType: "text";
    content: string;
    sourceLocator: Record<string, unknown>;
    extractionMethod: string;
    processingVersion?: string;
  }) {
    return getDb()
      .insert(knowledgeEvidenceUnits)
      .values({
        userId: input.userId,
        captureId: input.captureId,
        unitType: input.unitType,
        content: input.content,
        sourceLocatorJson: JSON.stringify(input.sourceLocator),
        extractionMethod: input.extractionMethod,
        processingVersion: input.processingVersion ?? "v1",
      })
      .returning()
      .get();
  },

  listEvidenceUnitsByCapture(captureId: string, userId: number) {
    return getDb()
      .select()
      .from(knowledgeEvidenceUnits)
      .where(
        and(
          eq(knowledgeEvidenceUnits.captureId, captureId),
          eq(knowledgeEvidenceUnits.userId, userId),
        ),
      )
      .orderBy(asc(knowledgeEvidenceUnits.createdAt))
      .all()
      .map((unit) => ({
        ...unit,
        sourceLocator: parseJson<Record<string, unknown>>(
          unit.sourceLocatorJson,
          {},
        ),
      }));
  },

  syncConceptsForCapture(captureId: string, userId: number) {
    const capture = this.getCaptureById(captureId, userId);
    if (!capture) return [];

    const mentions = [
      ...capture.aiTags.map((value) => ({ value, mentionType: "tag" as const })),
      ...capture.aiEntities.map((entity) => ({
        value: entity.name,
        mentionType: "entity" as const,
      })),
    ].filter((mention) => mention.value.trim());
    const evidenceUnitId = this.listEvidenceUnitsByCapture(captureId, userId)[0]?.id;
    const concepts = new Map<string, typeof knowledgeConcepts.$inferSelect>();

    for (const mention of mentions) {
      const canonicalName = normalizeConceptName(mention.value);
      if (!canonicalName) continue;

      let concept = getDb()
        .select()
        .from(knowledgeConcepts)
        .where(
          and(
            eq(knowledgeConcepts.userId, userId),
            eq(knowledgeConcepts.canonicalName, canonicalName),
          ),
        )
        .get();

      if (!concept) {
        const candidates = getDb()
          .select()
          .from(knowledgeConcepts)
          .where(
            and(
              eq(knowledgeConcepts.userId, userId),
              eq(knowledgeConcepts.status, "active"),
            ),
          )
          .all();
        concept = candidates.find((candidate) =>
          parseJson<string[]>(candidate.aliasesJson, []).some(
            (alias) => normalizeConceptName(alias) === canonicalName,
          ),
        );
      }

      if (!concept) {
        concept = getDb()
          .insert(knowledgeConcepts)
          .values({
            userId,
            canonicalName,
            displayName: mention.value.trim(),
          })
          .returning()
          .get();
      }

      const existingEvidence = getDb()
        .select()
        .from(knowledgeConceptEvidence)
        .where(
          and(
            eq(knowledgeConceptEvidence.conceptId, concept.id),
            eq(knowledgeConceptEvidence.captureId, captureId),
            eq(knowledgeConceptEvidence.mentionText, mention.value.trim()),
            eq(knowledgeConceptEvidence.mentionType, mention.mentionType),
          ),
        )
        .get();

      if (!existingEvidence) {
        const hasSource = getDb()
          .select({ id: knowledgeConceptEvidence.id })
          .from(knowledgeConceptEvidence)
          .where(
            and(
              eq(knowledgeConceptEvidence.conceptId, concept.id),
              eq(knowledgeConceptEvidence.captureId, captureId),
            ),
          )
          .get();
        getDb()
          .insert(knowledgeConceptEvidence)
          .values({
            userId,
            conceptId: concept.id,
            captureId,
            evidenceUnitId,
            mentionText: mention.value.trim(),
            mentionType: mention.mentionType,
          })
          .run();
        concept = getDb()
          .update(knowledgeConcepts)
          .set({
            lastSeenAt: new Date().toISOString(),
            sourceCount: hasSource
              ? concept.sourceCount
              : sql`${knowledgeConcepts.sourceCount} + 1`,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(knowledgeConcepts.id, concept.id))
          .returning()
          .get();
      }
      concepts.set(concept.id, concept);
    }

    return [...concepts.values()];
  },

  listConcepts(userId: number, options?: { status?: string; limit?: number }) {
    const conditions = [eq(knowledgeConcepts.userId, userId)];
    if (options?.status) {
      conditions.push(eq(knowledgeConcepts.status, options.status as never));
    }
    return getDb()
      .select()
      .from(knowledgeConcepts)
      .where(and(...conditions))
      .orderBy(desc(knowledgeConcepts.lastSeenAt))
      .limit(options?.limit ?? 100)
      .all()
      .map((concept) => ({
        ...concept,
        aliases: parseJson<string[]>(concept.aliasesJson, []),
      }));
  },

  listConceptEvidence(conceptId: string, userId: number) {
    return getDb()
      .select()
      .from(knowledgeConceptEvidence)
      .where(
        and(
          eq(knowledgeConceptEvidence.conceptId, conceptId),
          eq(knowledgeConceptEvidence.userId, userId),
        ),
      )
      .orderBy(asc(knowledgeConceptEvidence.createdAt))
      .all();
  },

  mergeConcepts(sourceId: string, targetId: string, userId: number) {
    if (sourceId === targetId) return null;
    const source = getDb()
      .select()
      .from(knowledgeConcepts)
      .where(and(eq(knowledgeConcepts.id, sourceId), eq(knowledgeConcepts.userId, userId)))
      .get();
    const target = getDb()
      .select()
      .from(knowledgeConcepts)
      .where(and(eq(knowledgeConcepts.id, targetId), eq(knowledgeConcepts.userId, userId)))
      .get();
    if (!source || !target) return null;

    const aliases = new Set([
      ...parseJson<string[]>(target.aliasesJson, []),
      source.displayName,
      ...parseJson<string[]>(source.aliasesJson, []),
    ]);
    getDb()
      .update(knowledgeConcepts)
      .set({
        aliasesJson: JSON.stringify([...aliases]),
        sourceCount: target.sourceCount + source.sourceCount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(knowledgeConcepts.id, target.id))
      .run();
    getDb()
      .update(knowledgeConcepts)
      .set({
        status: "merged",
        mergedIntoConceptId: target.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(knowledgeConcepts.id, source.id))
      .run();
    return getDb()
      .select()
      .from(knowledgeConcepts)
      .where(eq(knowledgeConcepts.id, target.id))
      .get();
  },

  createConceptEdge(input: {
    userId: number;
    sourceConceptId: string;
    targetConceptId: string;
    relationType: "related" | "part_of" | "contradicts" | "evolves" | "references";
    confidence: number;
    evidenceUnitIds?: string[];
  }) {
    const existing = getDb()
      .select()
      .from(knowledgeConceptEdges)
      .where(
        and(
          eq(knowledgeConceptEdges.userId, input.userId),
          eq(knowledgeConceptEdges.sourceConceptId, input.sourceConceptId),
          eq(knowledgeConceptEdges.targetConceptId, input.targetConceptId),
          eq(knowledgeConceptEdges.relationType, input.relationType),
        ),
      )
      .get();
    if (existing) return existing;
    return getDb()
      .insert(knowledgeConceptEdges)
      .values({
        userId: input.userId,
        sourceConceptId: input.sourceConceptId,
        targetConceptId: input.targetConceptId,
        relationType: input.relationType,
        confidence: input.confidence,
        evidenceUnitIdsJson: JSON.stringify(input.evidenceUnitIds ?? []),
      })
      .returning()
      .get();
  },

  getOrCreateTopicForConcept(conceptId: string, userId: number) {
    const concept = getDb()
      .select()
      .from(knowledgeConcepts)
      .where(and(eq(knowledgeConcepts.id, conceptId), eq(knowledgeConcepts.userId, userId)))
      .get();
    if (!concept) return null;
    const existing = getDb()
      .select()
      .from(knowledgeTopics)
      .where(and(eq(knowledgeTopics.userId, userId), eq(knowledgeTopics.conceptId, conceptId)))
      .get();
    if (existing) return existing;
    return getDb()
      .insert(knowledgeTopics)
      .values({ userId, conceptId, name: concept.displayName })
      .returning()
      .get();
  },

  getTopic(id: string, userId: number) {
    return getDb()
      .select()
      .from(knowledgeTopics)
      .where(and(eq(knowledgeTopics.id, id), eq(knowledgeTopics.userId, userId)))
      .get();
  },

  listTopics(userId: number, limit = 100) {
    return getDb()
      .select()
      .from(knowledgeTopics)
      .where(eq(knowledgeTopics.userId, userId))
      .orderBy(desc(knowledgeTopics.updatedAt))
      .limit(limit)
      .all();
  },

  updateTopic(id: string, userId: number, input: {
    summary: string;
    pendingQuestions: string[];
    sourceCount: number;
    currentVersion: number;
  }) {
    return getDb()
      .update(knowledgeTopics)
      .set({
        summary: input.summary,
        pendingQuestionsJson: JSON.stringify(input.pendingQuestions),
        sourceCount: input.sourceCount,
        currentVersion: input.currentVersion,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(knowledgeTopics.id, id), eq(knowledgeTopics.userId, userId)))
      .returning()
      .get();
  },

  addTopicEvidence(input: {
    userId: number;
    topicId: string;
    captureId?: string;
    evidenceUnitId?: string;
    insightId?: string;
    evidenceRole: "supports" | "opposes" | "context";
  }) {
    const conditions = [
      eq(knowledgeTopicEvidence.userId, input.userId),
      eq(knowledgeTopicEvidence.topicId, input.topicId),
      input.captureId
        ? eq(knowledgeTopicEvidence.captureId, input.captureId)
        : isNull(knowledgeTopicEvidence.captureId),
      input.evidenceUnitId
        ? eq(knowledgeTopicEvidence.evidenceUnitId, input.evidenceUnitId)
        : isNull(knowledgeTopicEvidence.evidenceUnitId),
      input.insightId
        ? eq(knowledgeTopicEvidence.insightId, input.insightId)
        : isNull(knowledgeTopicEvidence.insightId),
      eq(knowledgeTopicEvidence.evidenceRole, input.evidenceRole),
    ];
    const existing = getDb().select().from(knowledgeTopicEvidence).where(and(...conditions)).get();
    if (existing) return existing;
    return getDb()
      .insert(knowledgeTopicEvidence)
      .values(input)
      .returning()
      .get();
  },

  listTopicEvidence(topicId: string, userId: number) {
    return getDb()
      .select()
      .from(knowledgeTopicEvidence)
      .where(and(eq(knowledgeTopicEvidence.topicId, topicId), eq(knowledgeTopicEvidence.userId, userId)))
      .orderBy(asc(knowledgeTopicEvidence.createdAt))
      .all();
  },

  createViewpoint(input: {
    userId: number;
    topicId?: string;
    title: string;
    statement?: string;
    status?: "draft" | "active" | "needs_review" | "revised" | "split" | "retired" | "rejected";
  }) {
    return getDb()
      .insert(knowledgeViewpoints)
      .values({
        userId: input.userId,
        topicId: input.topicId,
        title: input.title,
        statement: input.statement ?? "",
        status: input.status ?? "draft",
      })
      .returning()
      .get();
  },

  getViewpointByTopicTitle(topicId: string, title: string, userId: number) {
    return getDb()
      .select()
      .from(knowledgeViewpoints)
      .where(
        and(
          eq(knowledgeViewpoints.topicId, topicId),
          eq(knowledgeViewpoints.title, title),
          eq(knowledgeViewpoints.userId, userId),
        ),
      )
      .get();
  },

  getViewpoint(id: string, userId: number) {
    return getDb()
      .select()
      .from(knowledgeViewpoints)
      .where(and(eq(knowledgeViewpoints.id, id), eq(knowledgeViewpoints.userId, userId)))
      .get();
  },

  listViewpoints(userId: number, topicId?: string) {
    return getDb()
      .select()
      .from(knowledgeViewpoints)
      .where(
        and(
          eq(knowledgeViewpoints.userId, userId),
          topicId ? eq(knowledgeViewpoints.topicId, topicId) : undefined,
        ),
      )
      .orderBy(desc(knowledgeViewpoints.updatedAt))
      .all();
  },

  updateViewpointReviewState(
    id: string,
    userId: number,
    input: {
      status: "active" | "needs_review" | "rejected";
      userConfirmed: boolean;
    },
  ) {
    return getDb()
      .update(knowledgeViewpoints)
      .set({
        status: input.status,
        userConfirmed: input.userConfirmed,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(knowledgeViewpoints.id, id), eq(knowledgeViewpoints.userId, userId)))
      .returning()
      .get();
  },

  createViewpointVersion(input: {
    userId: number;
    viewpointId: string;
    statement: string;
    changeType: "formed" | "strengthened" | "revised" | "split" | "retired";
    triggerReason: string;
    inputScope: Record<string, unknown>;
    modelInfo?: Record<string, unknown>;
    confidence: number;
    status?: "draft" | "active" | "needs_review" | "revised" | "split" | "retired" | "rejected";
    evidence: Array<{
      captureId?: string;
      evidenceUnitId?: string;
      insightId?: string;
      stance: "supports" | "opposes" | "context";
      locator?: Record<string, unknown>;
    }>;
  }) {
    const viewpoint = this.getViewpoint(input.viewpointId, input.userId);
    if (!viewpoint) return null;
    const latest = getDb()
      .select({ maxVersion: sql<number>`max(${knowledgeViewpointVersions.versionNumber})` })
      .from(knowledgeViewpointVersions)
      .where(eq(knowledgeViewpointVersions.viewpointId, input.viewpointId))
      .get();
    const versionNumber = (latest?.maxVersion ?? 0) + 1;
    const version = getDb()
      .insert(knowledgeViewpointVersions)
      .values({
        userId: input.userId,
        viewpointId: input.viewpointId,
        versionNumber,
        statement: input.statement,
        changeType: input.changeType,
        triggerReason: input.triggerReason,
        inputScopeJson: JSON.stringify(input.inputScope),
        modelInfoJson: JSON.stringify(input.modelInfo ?? {}),
      })
      .returning()
      .get();

    getDb()
      .update(knowledgeViewpoints)
      .set({
        statement: input.statement,
        status: input.status ?? "needs_review",
        currentVersionId: version.id,
        confidence: input.confidence,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(knowledgeViewpoints.id, input.viewpointId))
      .run();

    for (const evidence of input.evidence) {
      getDb()
        .insert(knowledgeViewpointEvidence)
        .values({
          userId: input.userId,
          viewpointVersionId: version.id,
          captureId: evidence.captureId,
          evidenceUnitId: evidence.evidenceUnitId,
          insightId: evidence.insightId,
          stance: evidence.stance,
          locatorJson: JSON.stringify(evidence.locator ?? {}),
        })
        .run();
    }
    return version;
  },

  listViewpointVersions(viewpointId: string, userId: number) {
    return getDb()
      .select()
      .from(knowledgeViewpointVersions)
      .where(and(eq(knowledgeViewpointVersions.viewpointId, viewpointId), eq(knowledgeViewpointVersions.userId, userId)))
      .orderBy(desc(knowledgeViewpointVersions.versionNumber))
      .all();
  },

  listViewpointEvidence(versionId: string, userId: number) {
    return getDb()
      .select()
      .from(knowledgeViewpointEvidence)
      .where(and(eq(knowledgeViewpointEvidence.viewpointVersionId, versionId), eq(knowledgeViewpointEvidence.userId, userId)))
      .orderBy(asc(knowledgeViewpointEvidence.createdAt))
      .all();
  },

  listAttachmentsByCapture(captureId: string) {
    return getDb()
      .select()
      .from(knowledgeAttachments)
      .where(eq(knowledgeAttachments.captureId, captureId))
      .all();
  },

  // ── Relations ───────────────────────────────────────────────

  createRelation(input: {
    userId: number;
    sourceCaptureId: string;
    targetCaptureId: string;
    relationType: "similar" | "contradicts" | "evolves" | "references";
    confidence: number;
    aiReasoning: string;
    evidenceUnitIds?: string[];
  }) {
    const directionalMatch = and(
      eq(knowledgeRelations.sourceCaptureId, input.sourceCaptureId),
      eq(knowledgeRelations.targetCaptureId, input.targetCaptureId),
    );
    const reverseMatch = and(
      eq(knowledgeRelations.sourceCaptureId, input.targetCaptureId),
      eq(knowledgeRelations.targetCaptureId, input.sourceCaptureId),
    );
    const existing = getDb()
      .select()
      .from(knowledgeRelations)
      .where(
        and(
          eq(knowledgeRelations.userId, input.userId),
          eq(knowledgeRelations.relationType, input.relationType),
          input.relationType === "evolves" || input.relationType === "references"
            ? directionalMatch
            : or(directionalMatch, reverseMatch),
        ),
      )
      .get();

    if (existing) return existing;

    return getDb()
      .insert(knowledgeRelations)
      .values({
        userId: input.userId,
        sourceCaptureId: input.sourceCaptureId,
        targetCaptureId: input.targetCaptureId,
        relationType: input.relationType,
        confidence: input.confidence,
        aiReasoning: input.aiReasoning,
        evidenceUnitIdsJson: JSON.stringify(input.evidenceUnitIds ?? []),
      })
      .returning()
      .get();
  },

  listRelationsForCapture(captureId: string, userId: number) {
    return getDb()
      .select()
      .from(knowledgeRelations)
      .where(and(
        eq(knowledgeRelations.userId, userId),
        sql`${knowledgeRelations.sourceCaptureId} = ${captureId} OR ${knowledgeRelations.targetCaptureId} = ${captureId}`,
      ))
      .orderBy(desc(knowledgeRelations.confidence))
      .all();
  },

  // ── Insights ────────────────────────────────────────────────

  createInsight(input: {
    userId: number;
    insightType: "synthesis" | "contradiction" | "resurfacing" | "gap";
    title: string;
    description: string;
    triggerCaptureId?: string;
    relatedCaptureIds: string[];
    confidence: number;
    evidenceUnitIds?: string[];
  }) {
    const dedupeSince = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const existing = getDb()
      .select()
      .from(knowledgeInsights)
      .where(
        and(
          eq(knowledgeInsights.insightType, input.insightType),
          eq(knowledgeInsights.userId, input.userId),
          input.triggerCaptureId
            ? eq(knowledgeInsights.triggerCaptureId, input.triggerCaptureId)
            : isNull(knowledgeInsights.triggerCaptureId),
          gte(knowledgeInsights.createdAt, dedupeSince),
        ),
      )
      .get();

    if (existing) return existing;

    return getDb()
      .insert(knowledgeInsights)
      .values({
        userId: input.userId,
        insightType: input.insightType,
        title: input.title,
        description: input.description,
        triggerCaptureId: input.triggerCaptureId ?? null,
        relatedCaptureIdsJson: JSON.stringify(input.relatedCaptureIds),
        evidenceUnitIdsJson: JSON.stringify(input.evidenceUnitIds ?? []),
        confidence: input.confidence,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .returning()
      .get();
  },

  listActiveInsights(userId: number, options?: { type?: string; limit?: number }) {
    const now = new Date().toISOString();
    const conditions = [
      eq(knowledgeInsights.dismissedByUser, false),
      eq(knowledgeInsights.userId, userId),
      sql`(${knowledgeInsights.expiresAt} IS NULL OR ${knowledgeInsights.expiresAt} > ${now})`,
    ];
    if (options?.type) {
      conditions.push(eq(knowledgeInsights.insightType, options.type as never));
    }

    return getDb()
      .select()
      .from(knowledgeInsights)
      .where(and(...conditions))
      .orderBy(desc(knowledgeInsights.createdAt))
      .limit(options?.limit ?? 20)
      .all();
  },

  dismissInsight(id: string, userId: number) {
    return getDb()
      .update(knowledgeInsights)
      .set({ dismissedByUser: true })
      .where(and(eq(knowledgeInsights.id, id), eq(knowledgeInsights.userId, userId)))
      .returning()
      .get();
  },

  // ── Tags Evolution ──────────────────────────────────────────

  upsertTag(tagName: string, userId: number) {
    const existing = getDb()
      .select()
      .from(knowledgeTagsEvolution)
      .where(and(eq(knowledgeTagsEvolution.tagName, tagName), eq(knowledgeTagsEvolution.userId, userId)))
      .get();

    if (existing) {
      return getDb()
        .update(knowledgeTagsEvolution)
        .set({
          lastSeenAt: new Date().toISOString(),
          usageCount: existing.usageCount + 1,
        })
        .where(and(eq(knowledgeTagsEvolution.tagName, tagName), eq(knowledgeTagsEvolution.userId, userId)))
        .returning()
        .get();
    }

    return getDb()
      .insert(knowledgeTagsEvolution)
      .values({ tagName, userId })
      .returning()
      .get();
  },

  listPopularTags(userId: number, limit = 30) {
    return getDb()
      .select()
      .from(knowledgeTagsEvolution)
      .where(eq(knowledgeTagsEvolution.userId, userId))
      .orderBy(desc(knowledgeTagsEvolution.usageCount))
      .limit(limit)
      .all();
  },

  startMaintenanceRun(input: {
    userId: number;
    runType?: string;
    scope: Record<string, unknown>;
  }) {
    return getDb()
      .insert(knowledgeMaintenanceRuns)
      .values({
        userId: input.userId,
        runType: input.runType ?? "rebuild",
        status: "running",
        scopeJson: JSON.stringify(input.scope),
      })
      .returning()
      .get();
  },

  completeMaintenanceRun(
    id: string,
    userId: number,
    result: {
      capturesScanned: number;
      relationsCreated: number;
      insightsCreated: number;
    },
  ) {
    return getDb()
      .update(knowledgeMaintenanceRuns)
      .set({
        status: "completed",
        capturesScanned: result.capturesScanned,
        relationsCreated: result.relationsCreated,
        insightsCreated: result.insightsCreated,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(knowledgeMaintenanceRuns.id, id),
          eq(knowledgeMaintenanceRuns.userId, userId),
        ),
      )
      .returning()
      .get();
  },

  failMaintenanceRun(id: string, userId: number, errorMessage: string) {
    return getDb()
      .update(knowledgeMaintenanceRuns)
      .set({
        status: "failed",
        errorMessage: errorMessage.slice(0, 500),
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(knowledgeMaintenanceRuns.id, id),
          eq(knowledgeMaintenanceRuns.userId, userId),
        ),
      )
      .returning()
      .get();
  },

  getMaintenanceRun(id: string, userId: number) {
    return getDb()
      .select()
      .from(knowledgeMaintenanceRuns)
      .where(
        and(
          eq(knowledgeMaintenanceRuns.id, id),
          eq(knowledgeMaintenanceRuns.userId, userId),
        ),
      )
      .get();
  },

  initialize() {
    const sqlite = getSqlite();
    const ensureColumn = (table: string, column: string, definition: string) => {
      if (!hasSqliteColumn(sqlite, table, column)) {
        sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    };
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_captures (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        source_url TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        favicon TEXT NOT NULL DEFAULT '',
        captured_at TEXT NOT NULL DEFAULT (datetime('now')),
        content_type TEXT NOT NULL DEFAULT 'webpage',
        raw_content TEXT NOT NULL DEFAULT '',
        rewritten_summary TEXT NOT NULL DEFAULT '',
        ai_tags_json TEXT NOT NULL DEFAULT '[]',
        ai_entities_json TEXT NOT NULL DEFAULT '[]',
        user_edited INTEGER NOT NULL DEFAULT 0,
        capture_metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        processing_status TEXT NOT NULL DEFAULT 'pending',
        processing_error TEXT
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_captures_captured_at
      ON knowledge_captures(captured_at)
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_captures_content_type
      ON knowledge_captures(content_type)
    `);
    ensureColumn("knowledge_captures", "user_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
    ensureColumn("knowledge_captures", "processing_status", "TEXT NOT NULL DEFAULT 'pending'");
    ensureColumn("knowledge_captures", "processing_error", "TEXT");
    sqlite.exec("UPDATE knowledge_captures SET content_type = 'webpage' WHERE content_type IN ('text', 'image')");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_captures_user_id ON knowledge_captures(user_id)");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_attachments (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        capture_id TEXT NOT NULL REFERENCES knowledge_captures(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL DEFAULT '',
        mime_type TEXT NOT NULL DEFAULT '',
        ai_extracted_text TEXT NOT NULL DEFAULT '',
        processing_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_attachments_capture_id
      ON knowledge_attachments(capture_id)
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_evidence_units (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        capture_id TEXT NOT NULL REFERENCES knowledge_captures(id) ON DELETE CASCADE,
        unit_type TEXT NOT NULL DEFAULT 'text',
        content TEXT NOT NULL DEFAULT '',
        source_locator_json TEXT NOT NULL DEFAULT '{}',
        extraction_method TEXT NOT NULL DEFAULT 'capture',
        processing_version TEXT NOT NULL DEFAULT 'v1',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_evidence_units_capture
      ON knowledge_evidence_units(capture_id)
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_evidence_units_user_id
      ON knowledge_evidence_units(user_id)
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_tags_evolution (
        tag_name TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        usage_count INTEGER NOT NULL DEFAULT 1,
        merged_into_tag TEXT,
        merged_at TEXT,
        PRIMARY KEY (tag_name, user_id)
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_tags_last_seen
      ON knowledge_tags_evolution(last_seen_at)
    `);
    ensureColumn("knowledge_tags_evolution", "user_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
    const tagColumns = sqlite
      .prepare("PRAGMA table_info(knowledge_tags_evolution)")
      .all() as Array<{ name: string; pk: number }>;
    const hasLegacyTagPrimaryKey =
      tagColumns.some((column) => column.name === "tag_name" && column.pk === 1) &&
      !tagColumns.some((column) => column.name === "user_id" && column.pk > 0);
    if (hasLegacyTagPrimaryKey) {
      sqlite.exec("ALTER TABLE knowledge_tags_evolution RENAME TO knowledge_tags_evolution_legacy");
      sqlite.exec(`
        CREATE TABLE knowledge_tags_evolution (
          tag_name TEXT NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
          usage_count INTEGER NOT NULL DEFAULT 1,
          merged_into_tag TEXT,
          merged_at TEXT,
          PRIMARY KEY (tag_name, user_id)
        )
      `);
      sqlite.exec(`
        INSERT INTO knowledge_tags_evolution (
          tag_name, user_id, first_seen_at, last_seen_at, usage_count, merged_into_tag, merged_at
        )
        SELECT tag_name, user_id, first_seen_at, last_seen_at, usage_count, merged_into_tag, merged_at
        FROM knowledge_tags_evolution_legacy
        WHERE user_id IS NOT NULL
      `);
      sqlite.exec("DROP TABLE knowledge_tags_evolution_legacy");
    }
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_tags_user_id ON knowledge_tags_evolution(user_id)");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_relations (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        source_capture_id TEXT NOT NULL REFERENCES knowledge_captures(id) ON DELETE CASCADE,
        target_capture_id TEXT NOT NULL REFERENCES knowledge_captures(id) ON DELETE CASCADE,
        relation_type TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.5,
        ai_reasoning TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_relations_source
      ON knowledge_relations(source_capture_id)
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_relations_target
      ON knowledge_relations(target_capture_id)
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_relations_type
      ON knowledge_relations(relation_type)
    `);
    ensureColumn("knowledge_relations", "user_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
    ensureColumn("knowledge_relations", "evidence_unit_ids_json", "TEXT NOT NULL DEFAULT '[]'");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_relations_user_id ON knowledge_relations(user_id)");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_insights (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        insight_type TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        trigger_capture_id TEXT REFERENCES knowledge_captures(id) ON DELETE SET NULL,
        related_capture_ids_json TEXT NOT NULL DEFAULT '[]',
        related_concept_ids_json TEXT NOT NULL DEFAULT '[]',
        dismissed_by_user INTEGER NOT NULL DEFAULT 0,
        confidence REAL NOT NULL DEFAULT 0.5,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT
      )
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_insights_type
      ON knowledge_insights(insight_type)
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_insights_dismissed
      ON knowledge_insights(dismissed_by_user)
    `);
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_insights_created_at
      ON knowledge_insights(created_at)
    `);
    ensureColumn("knowledge_insights", "user_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE");
    ensureColumn("knowledge_insights", "evidence_unit_ids_json", "TEXT NOT NULL DEFAULT '[]'");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_insights_user_id ON knowledge_insights(user_id)");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_maintenance_runs (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        run_type TEXT NOT NULL DEFAULT 'rebuild',
        status TEXT NOT NULL DEFAULT 'running',
        scope_json TEXT NOT NULL DEFAULT '{}',
        captures_scanned INTEGER NOT NULL DEFAULT 0,
        relations_created INTEGER NOT NULL DEFAULT 0,
        insights_created INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_maintenance_runs_user_id ON knowledge_maintenance_runs(user_id)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_maintenance_runs_status ON knowledge_maintenance_runs(status)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_maintenance_runs_created_at ON knowledge_maintenance_runs(created_at)");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_concepts (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        canonical_name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        aliases_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        merged_into_concept_id TEXT,
        first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        source_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (user_id, canonical_name)
      )
    `);
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_concepts_user_id ON knowledge_concepts(user_id)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_concepts_status ON knowledge_concepts(status)");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_concept_evidence (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        concept_id TEXT NOT NULL REFERENCES knowledge_concepts(id) ON DELETE CASCADE,
        capture_id TEXT NOT NULL REFERENCES knowledge_captures(id) ON DELETE CASCADE,
        evidence_unit_id TEXT REFERENCES knowledge_evidence_units(id) ON DELETE SET NULL,
        mention_text TEXT NOT NULL,
        mention_type TEXT NOT NULL DEFAULT 'tag',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (concept_id, capture_id, mention_text, mention_type)
      )
    `);
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_concept_evidence_concept ON knowledge_concept_evidence(concept_id)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_concept_evidence_capture ON knowledge_concept_evidence(capture_id)");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_concept_edges (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        source_concept_id TEXT NOT NULL REFERENCES knowledge_concepts(id) ON DELETE CASCADE,
        target_concept_id TEXT NOT NULL REFERENCES knowledge_concepts(id) ON DELETE CASCADE,
        relation_type TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.5,
        evidence_unit_ids_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (user_id, source_concept_id, target_concept_id, relation_type)
      )
    `);
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_concept_edges_source ON knowledge_concept_edges(source_concept_id)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_concept_edges_target ON knowledge_concept_edges(target_concept_id)");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_topics (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        concept_id TEXT REFERENCES knowledge_concepts(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        pending_questions_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        current_version INTEGER NOT NULL DEFAULT 0,
        source_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (user_id, name)
      )
    `);
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_topics_concept ON knowledge_topics(concept_id)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_topics_status ON knowledge_topics(status)");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_topic_evidence (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        topic_id TEXT NOT NULL REFERENCES knowledge_topics(id) ON DELETE CASCADE,
        capture_id TEXT REFERENCES knowledge_captures(id) ON DELETE CASCADE,
        evidence_unit_id TEXT REFERENCES knowledge_evidence_units(id) ON DELETE SET NULL,
        insight_id TEXT REFERENCES knowledge_insights(id) ON DELETE SET NULL,
        evidence_role TEXT NOT NULL DEFAULT 'context',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_topic_evidence_topic ON knowledge_topic_evidence(topic_id)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_topic_evidence_capture ON knowledge_topic_evidence(capture_id)");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_viewpoints (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        topic_id TEXT REFERENCES knowledge_topics(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        statement TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        current_version_id TEXT,
        confidence REAL NOT NULL DEFAULT 0.5,
        user_confirmed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_viewpoints_user_id ON knowledge_viewpoints(user_id)");
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_viewpoints_topic ON knowledge_viewpoints(topic_id)");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_viewpoint_versions (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        viewpoint_id TEXT NOT NULL REFERENCES knowledge_viewpoints(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        statement TEXT NOT NULL,
        change_type TEXT NOT NULL,
        trigger_reason TEXT NOT NULL DEFAULT '',
        input_scope_json TEXT NOT NULL DEFAULT '{}',
        schema_version TEXT NOT NULL DEFAULT 'phase4-v1',
        model_info_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (viewpoint_id, version_number)
      )
    `);
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_viewpoint_versions_user_id ON knowledge_viewpoint_versions(user_id)");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_viewpoint_evidence (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        viewpoint_version_id TEXT NOT NULL REFERENCES knowledge_viewpoint_versions(id) ON DELETE CASCADE,
        capture_id TEXT REFERENCES knowledge_captures(id) ON DELETE CASCADE,
        evidence_unit_id TEXT REFERENCES knowledge_evidence_units(id) ON DELETE SET NULL,
        insight_id TEXT REFERENCES knowledge_insights(id) ON DELETE SET NULL,
        stance TEXT NOT NULL DEFAULT 'context',
        locator_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_viewpoint_evidence_version ON knowledge_viewpoint_evidence(viewpoint_version_id)");
  },
};
