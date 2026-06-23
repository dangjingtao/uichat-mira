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
  isSystem: boolean;
  metadata: {
    persona: string | null;
    scenario: string | null;
    tags: string[];
  };
  documentCount: number;
  enabledDocumentCount: number;
  totalChunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBasePayload {
  name: string;
  description?: string | null;
  status?: KnowledgeBaseStatus;
  embeddingModelConfigId?: string | null;
  metadata?: {
    persona?: string | null;
    scenario?: string | null;
    tags?: string[];
  };
}

export interface UpdateKnowledgeBasePayload {
  name?: string;
  description?: string | null;
  status?: KnowledgeBaseStatus;
  embeddingModelConfigId?: string | null;
  metadata?: {
    persona?: string | null;
    scenario?: string | null;
    tags?: string[];
  };
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

export async function listKnowledgeBases(): Promise<KnowledgeBaseSummary[]> {
  return get<KnowledgeBaseSummary[]>("/knowledge-bases");
}

export async function getKnowledgeBaseById(
  knowledgeBaseId: string,
): Promise<KnowledgeBaseSummary> {
  return get<KnowledgeBaseSummary>(`/knowledge-bases/${knowledgeBaseId}`);
}

export async function createKnowledgeBase(
  payload: CreateKnowledgeBasePayload,
): Promise<KnowledgeBaseSummary> {
  return post<KnowledgeBaseSummary>("/knowledge-bases", payload);
}

export async function updateKnowledgeBase(
  knowledgeBaseId: string,
  payload: UpdateKnowledgeBasePayload,
): Promise<KnowledgeBaseSummary> {
  return patch<KnowledgeBaseSummary>(
    `/knowledge-bases/${knowledgeBaseId}`,
    payload,
  );
}

export async function deleteKnowledgeBase(
  knowledgeBaseId: string,
): Promise<{ deleted: boolean }> {
  return del<{ deleted: boolean }>(`/knowledge-bases/${knowledgeBaseId}`);
}

export async function listKnowledgeBaseDocuments(
  knowledgeBaseIdOrParams?: string | ListKnowledgeBaseDocumentsParams,
  params?: ListKnowledgeBaseDocumentsParams,
): Promise<KnowledgeBaseDocument[]> {
  const knowledgeBaseId =
    typeof knowledgeBaseIdOrParams === "string"
      ? knowledgeBaseIdOrParams
      : undefined;
  const effectiveParams =
    typeof knowledgeBaseIdOrParams === "string"
      ? params
      : knowledgeBaseIdOrParams;
  const path = knowledgeBaseId
    ? `/knowledge-bases/${knowledgeBaseId}/documents`
    : "/knowledge-base/documents";

  return get<KnowledgeBaseDocument[]>(path, {
    params: {
      ...effectiveParams,
      enabled:
        typeof effectiveParams?.enabled === "boolean"
          ? String(effectiveParams.enabled)
          : undefined,
    },
  });
}

export async function getKnowledgeBaseDocument(
  knowledgeBaseIdOrId: string,
  id?: string,
): Promise<KnowledgeBaseDocumentDetail> {
  const documentId = id ?? knowledgeBaseIdOrId;
  const path = id
    ? `/knowledge-bases/${knowledgeBaseIdOrId}/documents/${documentId}`
    : `/knowledge-base/documents/${documentId}`;
  return get<KnowledgeBaseDocumentDetail>(
    path,
  );
}

export async function getKnowledgeBaseDocumentStatus(
  knowledgeBaseIdOrId: string,
  id?: string,
): Promise<KnowledgeBaseDocument> {
  const documentId = id ?? knowledgeBaseIdOrId;
  const path = id
    ? `/knowledge-bases/${knowledgeBaseIdOrId}/documents/${documentId}/status`
    : `/knowledge-base/documents/${documentId}/status`;
  return get<KnowledgeBaseDocument>(path);
}

export async function createKnowledgeBaseDocument(
  knowledgeBaseIdOrPayload:
    | string
    | CreateKnowledgeBaseDocumentPayload,
  payload?: CreateKnowledgeBaseDocumentPayload,
): Promise<KnowledgeBaseDocumentDetail> {
  const knowledgeBaseId =
    typeof knowledgeBaseIdOrPayload === "string"
      ? knowledgeBaseIdOrPayload
      : undefined;
  const effectivePayload =
    typeof knowledgeBaseIdOrPayload === "string"
      ? payload
      : knowledgeBaseIdOrPayload;
  const path = knowledgeBaseId
    ? `/knowledge-bases/${knowledgeBaseId}/documents`
    : "/knowledge-base/documents";

  return post<KnowledgeBaseDocumentDetail>(path, effectivePayload);
}

export async function uploadKnowledgeBaseDocument(
  knowledgeBaseIdOrPayload:
    | string
    | UploadKnowledgeBaseDocumentPayload,
  payload?: UploadKnowledgeBaseDocumentPayload,
): Promise<KnowledgeBaseDocument> {
  const knowledgeBaseId =
    typeof knowledgeBaseIdOrPayload === "string"
      ? knowledgeBaseIdOrPayload
      : undefined;
  const effectivePayload =
    typeof knowledgeBaseIdOrPayload === "string"
      ? (payload as unknown as UploadKnowledgeBaseDocumentPayload)
      : knowledgeBaseIdOrPayload;
  const formData = new FormData();
  formData.append("file", effectivePayload.file);

  if (effectivePayload.name) {
    formData.append("name", effectivePayload.name);
  }
  if (effectivePayload.fileExt) {
    formData.append("fileExt", effectivePayload.fileExt);
  }
  if (typeof effectivePayload.fileSize === "number") {
    formData.append("fileSize", String(effectivePayload.fileSize));
  }
  if (effectivePayload.sourceType) {
    formData.append("sourceType", effectivePayload.sourceType);
  }
  if (
    effectivePayload.sourceLabel !== undefined &&
    effectivePayload.sourceLabel !== null
  ) {
    formData.append("sourceLabel", effectivePayload.sourceLabel);
  }
  if (typeof effectivePayload.enabled === "boolean") {
    formData.append("enabled", String(effectivePayload.enabled));
  }
  if (effectivePayload.chunkingConfig) {
    formData.append(
      "chunkingConfig",
      JSON.stringify(effectivePayload.chunkingConfig),
    );
  }

  const path = knowledgeBaseId
    ? `/knowledge-bases/${knowledgeBaseId}/documents/upload`
    : "/knowledge-base/documents/upload";

  const response = await client.post(path, formData, {
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
  knowledgeBaseIdOrId: string,
  idOrPayload:
    | string
    | UpdateKnowledgeBaseDocumentPayload,
  maybePayload?: UpdateKnowledgeBaseDocumentPayload,
): Promise<KnowledgeBaseDocumentDetail> {
  const knowledgeBaseId =
    typeof idOrPayload === "string" ? knowledgeBaseIdOrId : undefined;
  const documentId =
    typeof idOrPayload === "string" ? idOrPayload : knowledgeBaseIdOrId;
  const payload =
    typeof idOrPayload === "string" ? maybePayload : idOrPayload;
  const path = knowledgeBaseId
    ? `/knowledge-bases/${knowledgeBaseId}/documents/${documentId}`
    : `/knowledge-base/documents/${documentId}`;

  return patch<KnowledgeBaseDocumentDetail>(path, payload);
}

export async function updateDefaultKnowledgeBaseDocument(
  id: string,
  payload: UpdateKnowledgeBaseDocumentPayload,
): Promise<KnowledgeBaseDocumentDetail> {
  return patch<KnowledgeBaseDocumentDetail>(`/knowledge-base/documents/${id}`, payload);
}

export async function deleteKnowledgeBaseDocument(
  knowledgeBaseIdOrId: string,
  id?: string,
): Promise<{ deleted: boolean }> {
  const documentId = id ?? knowledgeBaseIdOrId;
  const path = id
    ? `/knowledge-bases/${knowledgeBaseIdOrId}/documents/${documentId}`
    : `/knowledge-base/documents/${documentId}`;
  return del<{ deleted: boolean }>(path);
}
