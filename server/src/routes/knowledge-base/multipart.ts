import type { FastifyRequest } from "fastify";
import path from "node:path";
import {
  DEFAULT_UPLOAD_SOURCE_LABEL,
  MAX_UPLOAD_FILE_BYTES,
  SUPPORTED_UPLOAD_FILE_EXTENSIONS,
} from "@/constants/knowledge-base.js";
import type { CreateDocumentInput } from "@/services/knowledge-base.service.js";
import type { ChunkingConfig } from "@/services/knowledge-base.splitter";

const supportedUploadExtensions = new Set(SUPPORTED_UPLOAD_FILE_EXTENSIONS);

/** Validation error that should be returned to the client as a 400 response. */
export class MultipartValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MultipartValidationError";
  }
}

/**
 * Normalized multipart upload payload shared by preview and persistence routes.
 *
 * File fields are extracted from the single accepted file part; `fields`
 * contains the remaining form fields as strings for explicit conversion.
 */
export interface ParsedUpload {
  /** Original client-provided filename. Used as the default document name. */
  fileName: string;
  /** Lowercase extension without a leading dot. */
  fileExt: string;
  /** Multipart-reported MIME type, falling back to `text/plain`. */
  mimeType: string | null;
  /** Uploaded byte size measured from the buffered file content. */
  fileSize: number;
  /** BOM-stripped UTF-8 file text consumed by preview/indexing services. */
  contentText: string;
  /** Non-file multipart fields kept as raw strings until converted. */
  fields: Record<string, string>;
}

export const parseOptionalString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseOptionalBoolean = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
};

export const parseOptionalNumber = (value: unknown) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

// Multipart fields arrive as strings, so this is the single conversion point
// from transport payload into the service-layer chunking config shape.
export const parseChunkingConfig = (value: unknown): Partial<ChunkingConfig> | undefined => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object"
    ? (parsed as Partial<ChunkingConfig>)
    : undefined;
};

// Shared upload reader for preview and persisted upload routes. It normalizes
// BOM-stripped UTF-8 text and validates the common one-file Markdown/TXT rules.
export const readSingleTextUpload = async (
  request: FastifyRequest,
): Promise<ParsedUpload> => {
  if (!request.isMultipart()) {
    throw new MultipartValidationError("Expected multipart/form-data upload");
  }

  let fileName = "";
  let fileExt = "";
  let mimeType: string | null = null;
  let fileSize = 0;
  let contentText = "";
  const fields: Record<string, string> = {};

  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (fileName) {
        throw new MultipartValidationError("Only one file can be uploaded");
      }

      const buffer = await part.toBuffer();
      fileName = part.filename;
      fileExt = path.extname(part.filename).replace(/^\./, "").toLowerCase();
      mimeType = part.mimetype || "text/plain";
      fileSize = buffer.byteLength;
      contentText = buffer.toString("utf8").replace(/^\uFEFF/, "");
      continue;
    }

    fields[part.fieldname] =
      typeof part.value === "string" ? part.value : String(part.value ?? "");
  }

  if (!fileName) {
    throw new MultipartValidationError("Please upload a file");
  }

  if (
    !supportedUploadExtensions.has(
      fileExt as (typeof SUPPORTED_UPLOAD_FILE_EXTENSIONS)[number],
    )
  ) {
    throw new MultipartValidationError(
      `Unsupported file type ".${fileExt}". Only Markdown and TXT files are supported.`,
    );
  }

  if (!contentText.trim()) {
    throw new MultipartValidationError("Uploaded file is empty");
  }

  return {
    fileName,
    fileExt,
    mimeType,
    fileSize,
    contentText,
    fields,
  };
};

// Converts optional upload form fields into the create-upload service input
// while preserving the existing route defaults.
export const toUploadDocumentInput = (upload: ParsedUpload): CreateDocumentInput => {
  const sourceType = parseOptionalString(upload.fields.sourceType);

  return {
    name: parseOptionalString(upload.fields.name) ?? upload.fileName,
    fileExt:
      parseOptionalString(upload.fields.fileExt)?.toLowerCase() ??
      upload.fileExt,
    contentText: upload.contentText,
    mimeType: upload.mimeType,
    fileSize:
      parseOptionalNumber(upload.fields.fileSize) ??
      upload.fileSize ??
      MAX_UPLOAD_FILE_BYTES,
    sourceType:
      sourceType === "api" || sourceType === "sync" ? sourceType : "upload",
    sourceLabel:
      parseOptionalString(upload.fields.sourceLabel) ??
      DEFAULT_UPLOAD_SOURCE_LABEL,
    enabled: parseOptionalBoolean(upload.fields.enabled) ?? true,
    chunkingConfig: parseChunkingConfig(upload.fields.chunkingConfig),
  };
};

export const isMultipartTooLargeError = (
  err: unknown,
): err is Error & { statusCode: 413 } =>
  err instanceof Error && "statusCode" in err && err.statusCode === 413;

export const uploadLimitMessage = () =>
  `Uploaded file exceeds the ${Math.floor(
    MAX_UPLOAD_FILE_BYTES / (1024 * 1024),
  )} MB limit`;
