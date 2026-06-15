import { client, del, get, patch, post } from "../lib/request";

export type KnowledgeBaseStatus = "active" | "archived";
export type DocumentSourceType = "upload" | "sync" | "api";
export type DocumentIndexStatus = "processing" | "ready" | "failed";

export interface ChunkingConfig {
  splitterType: "character" | "recursive" | "markdown" | "token";
  chunkSize: number;
  chunkOverlap: number;
  keepSeparator: boolean;
  separator: string;
  separators: string[];
  presetLanguage:
    | "markdown"
    | "latex"
    | "html"
    | "js"
    | "python"
    | "cpp"
    | "go"
    | "java"
    | "php"
    | "proto"
    | "rst"
    | "ruby"
    | "rust"
    | "scala"
    | "swift"
    | "sol"
    | null;
  encodingName: string;
  allowedSpecial: "all" | string[];
  disallowedSpecial: "all" | string[];
  lengthMetric: "characters" | "utf8Bytes";
  replaceWhitespace: boolean;
  removeUrls: boolean;
  useQaSplit: boolean;
}

export interface KnowledgeBaseSummary {
  id: string;
  name: string;
  description: string | null;
  status: KnowledgeBaseStatus;
  documentCount: number;
  enabledDocumentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseDocument {
  id: string;
  knowledgeBaseId: string;
  name: string;
  sourceType: DocumentSourceType;
  sourceLabel: string | null;
  fileExt: string;
  mimeType: string | null;
  fileSize: number | null;
  indexStatus: DocumentIndexStatus;
  enabled: boolean;
  chunkCount: number;
  charCount: number;
  tokenCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseDocumentChunk {
  id: number;
  chunkIndex: number;
  content: string;
  charCount: number;
  tokenCount: number | null;
  startOffset: number | null;
  endOffset: number | null;
  createdAt: string;
}

export interface KnowledgeBaseDocumentDetail extends KnowledgeBaseDocument {
  contentText: string;
  chunks: KnowledgeBaseDocumentChunk[];
}

export interface ListKnowledgeBaseDocumentsParams {
  search?: string;
  enabled?: boolean;
  indexStatus?: DocumentIndexStatus;
  sortBy?: "createdAt" | "updatedAt" | "charCount" | "chunkCount";
  sortOrder?: "asc" | "desc";
}

export interface CreateKnowledgeBaseDocumentPayload {
  name: string;
  fileExt: string;
  contentText: string;
  mimeType?: string | null;
  fileSize?: number | null;
  sourceType?: DocumentSourceType;
  sourceLabel?: string | null;
  enabled?: boolean;
  chunkingConfig?: Partial<ChunkingConfig>;
}

export interface UploadKnowledgeBaseDocumentPayload {
  file: File;
  name?: string;
  fileExt?: string;
  fileSize?: number | null;
  sourceType?: DocumentSourceType;
  sourceLabel?: string | null;
  enabled?: boolean;
  chunkingConfig?: Partial<ChunkingConfig>;
}

export interface ChunkPreviewSample {
  id: string;
  index: number;
  text: string;
  charCount: number;
}

export interface ChunkPreviewStats {
  totalChunks: number;
  minChunkLength: number;
  maxChunkLength: number;
  averageChunkLength: number;
  normalizedTextLength: number;
}

export interface ChunkPreviewResult {
  totalChunks: number;
  stats: ChunkPreviewStats;
  effectiveConfig: ChunkingConfig;
  sampleChunks: ChunkPreviewSample[];
}

export interface UpdateKnowledgeBaseDocumentPayload {
  name?: string;
  sourceLabel?: string | null;
  enabled?: boolean;
  contentText?: string;
  chunkingConfig?: Partial<ChunkingConfig>;
}

export async function getKnowledgeBase(): Promise<KnowledgeBaseSummary> {
  return get<KnowledgeBaseSummary>("/knowledge-base");
}

export async function listKnowledgeBaseDocuments(
  params?: ListKnowledgeBaseDocumentsParams,
): Promise<KnowledgeBaseDocument[]> {
  return get<KnowledgeBaseDocument[]>("/knowledge-base/documents", {
    params: {
      ...params,
      enabled:
        typeof params?.enabled === "boolean" ? String(params.enabled) : undefined,
    },
  });
}

export async function getKnowledgeBaseDocument(
  id: string,
): Promise<KnowledgeBaseDocumentDetail> {
  return get<KnowledgeBaseDocumentDetail>(`/knowledge-base/documents/${id}`);
}

export async function getKnowledgeBaseDocumentStatus(
  id: string,
): Promise<KnowledgeBaseDocument> {
  return get<KnowledgeBaseDocument>(`/knowledge-base/documents/${id}/status`);
}

export async function createKnowledgeBaseDocument(
  payload: CreateKnowledgeBaseDocumentPayload,
): Promise<KnowledgeBaseDocumentDetail> {
  return post<KnowledgeBaseDocumentDetail>("/knowledge-base/documents", payload);
}

export async function uploadKnowledgeBaseDocument(
  payload: UploadKnowledgeBaseDocumentPayload,
): Promise<KnowledgeBaseDocument> {
  const formData = new FormData();
  formData.append("file", payload.file);

  if (payload.name) {
    formData.append("name", payload.name);
  }
  if (payload.fileExt) {
    formData.append("fileExt", payload.fileExt);
  }
  if (typeof payload.fileSize === "number") {
    formData.append("fileSize", String(payload.fileSize));
  }
  if (payload.sourceType) {
    formData.append("sourceType", payload.sourceType);
  }
  if (payload.sourceLabel !== undefined && payload.sourceLabel !== null) {
    formData.append("sourceLabel", payload.sourceLabel);
  }
  if (typeof payload.enabled === "boolean") {
    formData.append("enabled", String(payload.enabled));
  }
  if (payload.chunkingConfig) {
    formData.append("chunkingConfig", JSON.stringify(payload.chunkingConfig));
  }

  const response = await client.post("/knowledge-base/documents/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 300000,
  });

  return response.data.data as KnowledgeBaseDocument;
}

export async function previewKnowledgeBaseChunks(
  payload: UploadKnowledgeBaseDocumentPayload,
): Promise<ChunkPreviewResult> {
  const formData = new FormData();
  formData.append("file", payload.file);

  if (payload.name) {
    formData.append("name", payload.name);
  }
  if (payload.fileExt) {
    formData.append("fileExt", payload.fileExt);
  }
  if (typeof payload.fileSize === "number") {
    formData.append("fileSize", String(payload.fileSize));
  }
  if (payload.sourceType) {
    formData.append("sourceType", payload.sourceType);
  }
  if (payload.sourceLabel !== undefined && payload.sourceLabel !== null) {
    formData.append("sourceLabel", payload.sourceLabel);
  }
  if (typeof payload.enabled === "boolean") {
    formData.append("enabled", String(payload.enabled));
  }
  if (payload.chunkingConfig) {
    formData.append("chunkingConfig", JSON.stringify(payload.chunkingConfig));
  }

  const response = await client.post("/knowledge-base/chunk-preview", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 300000,
  });

  return response.data.data as ChunkPreviewResult;
}

export async function updateKnowledgeBaseDocument(
  id: string,
  payload: UpdateKnowledgeBaseDocumentPayload,
): Promise<KnowledgeBaseDocumentDetail> {
  return patch<KnowledgeBaseDocumentDetail>(`/knowledge-base/documents/${id}`, payload);
}

export async function deleteKnowledgeBaseDocument(
  id: string,
): Promise<{ deleted: boolean }> {
  return del<{ deleted: boolean }>(`/knowledge-base/documents/${id}`);
}
