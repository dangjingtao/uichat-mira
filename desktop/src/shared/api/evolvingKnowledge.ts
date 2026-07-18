import { get, post, del } from "@/shared/lib/request";

export type KnowledgeCapture = {
  id: string;
  sourceUrl: string;
  title: string;
  favicon: string;
  capturedAt: string;
  contentType: string;
  rawContent: string;
  rewrittenSummary: string;
  aiTags: string[];
  aiEntities: Array<{ name: string; type: string; context: string }>;
  userEdited: boolean;
  captureMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeRelation = {
  id: string;
  sourceCaptureId: string;
  targetCaptureId: string;
  relationType: "similar" | "contradicts" | "evolves" | "references";
  confidence: number;
  aiReasoning: string;
  evidenceUnitIdsJson: string;
  createdAt: string;
};

export type KnowledgeEvidenceUnit = {
  id: string;
  captureId: string;
  unitType: "text";
  content: string;
  sourceLocator: Record<string, unknown>;
  extractionMethod: string;
  processingVersion: string;
  createdAt: string;
};

export type KnowledgeInsight = {
  id: string;
  insightType: "synthesis" | "contradiction" | "resurfacing" | "gap";
  title: string;
  description: string;
  triggerCaptureId: string | null;
  relatedCaptureIdsJson: string;
  relatedConceptIdsJson: string;
  evidenceUnitIdsJson: string;
  dismissedByUser: boolean;
  confidence: number;
  createdAt: string;
  expiresAt: string | null;
};

export type KnowledgeTag = {
  tagName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  usageCount: number;
};

export type KnowledgeConcept = {
  id: string;
  userId: number | null;
  canonicalName: string;
  displayName: string;
  aliasesJson: string;
  aliases?: string[];
  status: "active" | "merged" | "hidden";
  mergedIntoConceptId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  sourceCount: number;
};

export type KnowledgeTopic = {
  id: string;
  userId: number | null;
  conceptId: string | null;
  name: string;
  summary: string;
  pendingQuestionsJson: string;
  status: "active" | "stale" | "archived";
  currentVersion: number;
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeViewpoint = {
  id: string;
  userId: number | null;
  topicId: string | null;
  title: string;
  statement: string;
  status: "draft" | "active" | "needs_review" | "revised" | "split" | "retired" | "rejected";
  currentVersionId: string | null;
  confidence: number;
  userConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeViewpointVersion = {
  id: string;
  viewpointId: string;
  versionNumber: number;
  statement: string;
  changeType: "formed" | "strengthened" | "revised" | "split" | "retired";
  triggerReason: string;
  inputScopeJson: string;
  schemaVersion: string;
  modelInfoJson: string;
  createdAt: string;
};

export type CaptureInput = {
  sourceUrl: string;
  title: string;
  favicon?: string;
  contentType: "webpage";
  rawContent: string;
  metadata?: Record<string, unknown>;
  attachments?: Array<{ filePath: string; mimeType: string }>;
};

export async function createCapture(input: CaptureInput) {
  return post<KnowledgeCapture>("/microapps/evolving-knowledge/captures", input);
}

export async function listCaptures(options?: {
  limit?: number;
  offset?: number;
  contentType?: string;
}) {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));
  if (options?.contentType) params.set("contentType", options.contentType);
  return get<KnowledgeCapture[]>(`/microapps/evolving-knowledge/captures?${params.toString()}`);
}

export async function searchCaptures(q: string) {
  return get<KnowledgeCapture[]>(
    `/microapps/evolving-knowledge/captures/search?q=${encodeURIComponent(q)}`,
  );
}

export async function getCapture(id: string) {
  return get<KnowledgeCapture>(`/microapps/evolving-knowledge/captures/${id}`);
}

export async function getCaptureRelations(id: string) {
  return get<KnowledgeRelation[]>(
    `/microapps/evolving-knowledge/captures/${id}/relations`,
  );
}

export async function getCaptureEvidence(id: string) {
  return get<KnowledgeEvidenceUnit[]>(
    `/microapps/evolving-knowledge/captures/${id}/evidence`,
  );
}

export async function deleteCapture(id: string) {
  return del<null>(`/microapps/evolving-knowledge/captures/${id}`);
}

export async function listInsights() {
  return get<KnowledgeInsight[]>("/microapps/evolving-knowledge/insights");
}

export async function dismissInsight(id: string) {
  return post<null>(`/microapps/evolving-knowledge/insights/${id}/dismiss`);
}

export async function listTags() {
  return get<KnowledgeTag[]>("/microapps/evolving-knowledge/tags");
}

export async function getStats() {
  return get<{
    totalCaptures: number;
    totalInsights: number;
    totalTags: number;
    byContentType: Record<string, number>;
    topTags: KnowledgeTag[];
  }>("/microapps/evolving-knowledge/stats");
}

export async function listConcepts(options?: { status?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.limit) params.set("limit", String(options.limit));
  return get<KnowledgeConcept[]>(`/microapps/evolving-knowledge/concepts?${params.toString()}`);
}

export async function mergeConcepts(sourceId: string, targetId: string) {
  return post<KnowledgeConcept>(
    `/microapps/evolving-knowledge/concepts/${sourceId}/merge`,
    { targetConceptId: targetId },
  );
}

export async function listTopics(limit?: number) {
  const query = limit ? `?limit=${encodeURIComponent(String(limit))}` : "";
  return get<KnowledgeTopic[]>(`/microapps/evolving-knowledge/topics${query}`);
}

export async function compileTopicForConcept(conceptId: string) {
  return post<{
    topic: KnowledgeTopic | null;
    viewpoint: KnowledgeViewpoint | null;
    version: KnowledgeViewpointVersion | null;
    capturesUsed: number;
  }>("/microapps/evolving-knowledge/topics/compile", { conceptId });
}

export async function listViewpoints(topicId?: string) {
  const query = topicId ? `?topicId=${encodeURIComponent(topicId)}` : "";
  return get<KnowledgeViewpoint[]>(`/microapps/evolving-knowledge/viewpoints${query}`);
}

export async function listViewpointVersions(viewpointId: string) {
  return get<KnowledgeViewpointVersion[]>(
    `/microapps/evolving-knowledge/viewpoints/${viewpointId}/versions`,
  );
}

export async function reviewViewpoint(
  viewpointId: string,
  input: { decision: "confirm" | "reject"; statement?: string },
) {
  return post<{ viewpoint: KnowledgeViewpoint; version: KnowledgeViewpointVersion | null }>(
    `/microapps/evolving-knowledge/viewpoints/${viewpointId}/review`,
    input,
  );
}

export async function rebuildKnowledge(options?: { limit?: number; offset?: number }) {
  return post<{
    status: "completed";
    runId: string;
    capturesScanned: number;
    relationsCreated: number;
    insightsCreated: number;
    nextOffset: number;
    hasMore: boolean;
    totalCaptures: number;
  }>(
    "/microapps/evolving-knowledge/rebuild",
    options,
  );
}
