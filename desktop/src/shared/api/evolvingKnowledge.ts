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

export type CaptureInput = {
  sourceUrl: string;
  title: string;
  favicon?: string;
  contentType: "text" | "image";
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

export async function rebuildKnowledge() {
  return post<{ status: "completed"; capturesScanned: number }>(
    "/microapps/evolving-knowledge/rebuild",
  );
}
