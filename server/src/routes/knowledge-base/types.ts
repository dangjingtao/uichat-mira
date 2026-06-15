import type { ChunkingConfig } from "@/services/knowledge-base.splitter";

/**
 * Route-local request contracts for the knowledge-base API.
 *
 * These types describe HTTP transport payloads only. Service-layer contracts
 * stay in `knowledge-base.service.ts`, so route parsing details such as query
 * strings do not leak into core document operations.
 */
export interface DocumentListQuery {
  /** Fuzzy keyword matched against document name and source label. */
  search?: string;
  /** String boolean from query params. It is normalized before service calls. */
  enabled?: string;
  /** Current indexing lifecycle state used to filter document lists. */
  indexStatus?: "processing" | "ready" | "failed";
  /** Whitelisted sortable document fields exposed by the API. */
  sortBy?: "createdAt" | "updatedAt" | "charCount" | "chunkCount";
  /** Sort direction. The route defaults this to `desc` when omitted. */
  sortOrder?: "asc" | "desc";
}

/** JSON body for direct document creation, without multipart upload parsing. */
export interface CreateDocumentBody {
  /** Display name stored with the document and shown in retrieval sources. */
  name: string;
  /** Normalized extension without a dot, for example `md` or `txt`. */
  fileExt: string;
  /** Raw document text that will be normalized, chunked, and embedded. */
  contentText: string;
  /** Optional client-reported MIME type. Upload routes infer this from file parts. */
  mimeType?: string | null;
  /** Optional client-reported byte size. Upload routes infer this from file parts. */
  fileSize?: number | null;
  /** Origin category used by the UI to distinguish uploads, sync jobs, and API writes. */
  sourceType?: "upload" | "sync" | "api";
  /** Human-readable source label, such as an upload bucket or external source name. */
  sourceLabel?: string | null;
  /** Whether this document can participate in retrieval. Defaults are applied by service code. */
  enabled?: boolean;
  /** Per-request chunking override; omitted requests use the default splitter config. */
  chunkingConfig?: Partial<ChunkingConfig>;
}

/** Partial update body. Supplying `contentText` triggers re-chunking and re-indexing. */
export interface UpdateDocumentBody {
  /** New display name. Empty strings are handled by service-level fallback logic. */
  name?: string;
  /** Optional source label update. `null` clears the label. */
  sourceLabel?: string | null;
  /** Enables or disables retrieval for this document. */
  enabled?: boolean;
  /** Replacement document text. When present, chunks and embeddings are rebuilt. */
  contentText?: string;
  /** Chunking override used only when `contentText` is also supplied. */
  chunkingConfig?: Partial<ChunkingConfig>;
}
