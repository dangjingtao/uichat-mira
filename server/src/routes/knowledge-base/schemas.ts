import {
  deletedResponseSchema,
  errorEnvelope,
  idParamsSchema,
  successEnvelope,
} from "@/routes/schema-helpers.js";

// Multipart chunk preview accepts the newer splitter options used by the UI.
// This schema documents transport input/output only; splitter behavior remains
// owned by `knowledge-base.splitter.ts`.
const multipartChunkingConfigSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    splitterType: {
      type: "string",
      description: "Splitter implementation selected by the UI.",
      enum: ["character", "recursive", "markdown", "token"],
    },
    chunkSize: {
      type: "number",
      description: "Maximum target size for each generated chunk.",
    },
    chunkOverlap: {
      type: "number",
      description: "Number of characters or tokens retained between chunks.",
    },
    keepSeparator: {
      type: "boolean",
      description: "Whether separators stay attached to generated chunks.",
    },
    separator: {
      type: "string",
      description: "Primary separator used by character-based splitting.",
    },
    separators: {
      type: "array",
      description: "Ordered separators for recursive splitting.",
      items: { type: "string" },
    },
    presetLanguage: {
      description: "Optional language preset for markdown/code-aware splitting.",
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    encodingName: {
      type: "string",
      description: "Tokenizer encoding name used by token-based splitting.",
    },
    allowedSpecial: {
      description: "Special tokens allowed by token-based splitting.",
      anyOf: [
        { type: "string", enum: ["all"] },
        { type: "array", items: { type: "string" } },
      ],
    },
    disallowedSpecial: {
      description: "Special tokens rejected by token-based splitting.",
      anyOf: [
        { type: "string", enum: ["all"] },
        { type: "array", items: { type: "string" } },
      ],
    },
    lengthMetric: {
      type: "string",
      description: "Length unit used for chunk-size calculations.",
      enum: ["characters", "utf8Bytes"],
    },
    replaceWhitespace: {
      type: "boolean",
      description: "Normalize repeated whitespace before splitting.",
    },
    removeUrls: {
      type: "boolean",
      description: "Remove URL-like text before splitting.",
    },
    useQaSplit: {
      type: "boolean",
      description: "Apply question-answer aware text cleanup before splitting.",
    },
  },
} as const;

// JSON create/update routes expose the legacy chunking knobs kept for
// backwards compatibility with existing renderer calls.
export const chunkingConfigSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    separator: {
      type: "string",
      description: "Separator used by the default splitter.",
    },
    maxLength: {
      type: "number",
      description: "Maximum target character length for a chunk.",
    },
    overlap: {
      type: "number",
      description: "Character overlap retained between adjacent chunks.",
    },
    replaceWhitespace: {
      type: "boolean",
      description: "Normalize repeated whitespace before splitting.",
    },
    removeUrls: {
      type: "boolean",
      description: "Remove URL-like text before splitting.",
    },
    useQaSplit: {
      type: "boolean",
      description: "Apply question-answer aware text cleanup before splitting.",
    },
  },
} as const;

// Summary shape for the app's default knowledge base. The current product has
// one default KB, but the response keeps IDs explicit for future multi-KB work.
export const knowledgeBaseSummarySchema = {
  type: "object",
  required: [
    "id",
    "name",
    "description",
    "status",
    "documentCount",
    "enabledDocumentCount",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", description: "Stable knowledge-base identifier." },
    name: { type: "string", description: "Display name shown in settings." },
    description: {
      description: "Optional user-facing knowledge-base description.",
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    status: {
      type: "string",
      description: "Lifecycle state for the knowledge base.",
      enum: ["active", "archived"],
    },
    documentCount: {
      type: "number",
      description: "Total documents stored in this knowledge base.",
    },
    enabledDocumentCount: {
      type: "number",
      description: "Documents currently eligible for retrieval.",
    },
    createdAt: { type: "string", description: "ISO creation timestamp." },
    updatedAt: { type: "string", description: "ISO last-update timestamp." },
  },
} as const;

// Public document summary shared by list, status, upload, and detail responses.
// The fields mirror service response DTOs rather than database column names.
export const documentSchema = {
  type: "object",
  required: [
    "id",
    "knowledgeBaseId",
    "name",
    "sourceType",
    "sourceLabel",
    "fileExt",
    "mimeType",
    "fileSize",
    "indexStatus",
    "enabled",
    "chunkCount",
    "charCount",
    "tokenCount",
    "errorMessage",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", description: "Stable document identifier." },
    knowledgeBaseId: {
      type: "string",
      description: "Owning knowledge-base identifier.",
    },
    name: { type: "string", description: "Display name and retrieval source title." },
    sourceType: {
      type: "string",
      description: "Where the document originated.",
      enum: ["upload", "sync", "api"],
    },
    sourceLabel: {
      description: "Optional human-readable external source label.",
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    fileExt: {
      type: "string",
      description: "Normalized extension without the leading dot.",
    },
    mimeType: {
      description: "Client or multipart-reported MIME type.",
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    fileSize: {
      description: "Original file size in bytes when known.",
      anyOf: [{ type: "number" }, { type: "null" }],
    },
    indexStatus: {
      type: "string",
      description: "Embedding/indexing lifecycle state.",
      enum: ["processing", "ready", "failed"],
    },
    enabled: {
      type: "boolean",
      description: "Whether retrieval may use this document.",
    },
    chunkCount: {
      type: "number",
      description: "Number of chunks currently stored for the document.",
    },
    charCount: {
      type: "number",
      description: "Character count after text normalization.",
    },
    tokenCount: {
      description: "Token count when available; currently null for most flows.",
      anyOf: [{ type: "number" }, { type: "null" }],
    },
    errorMessage: {
      description: "Indexing failure detail when `indexStatus` is `failed`.",
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    createdAt: { type: "string", description: "ISO creation timestamp." },
    updatedAt: { type: "string", description: "ISO last-update timestamp." },
  },
} as const;

// Detail response includes the full source text plus stored chunks for document
// inspection and debugging. Retrieval responses use a separate source shape.
export const documentDetailSchema = {
  type: "object",
  required: [...documentSchema.required, "contentText", "chunks"],
  properties: {
    ...documentSchema.properties,
    contentText: {
      type: "string",
      description: "Normalized full document text stored by the backend.",
    },
    chunks: {
      type: "array",
      description: "Persisted chunks in chunk-index order.",
      items: {
        type: "object",
        required: [
          "id",
          "chunkIndex",
          "content",
          "charCount",
          "tokenCount",
          "startOffset",
          "endOffset",
          "createdAt",
        ],
        properties: {
          id: { type: "number", description: "Database chunk row id." },
          chunkIndex: {
            type: "number",
            description: "Zero-based chunk order within the document.",
          },
          content: { type: "string", description: "Chunk text." },
          charCount: {
            type: "number",
            description: "Character count for this chunk.",
          },
          tokenCount: {
            description: "Token count for this chunk when available.",
            anyOf: [{ type: "number" }, { type: "null" }],
          },
          startOffset: {
            description: "Start offset in normalized document text when known.",
            anyOf: [{ type: "number" }, { type: "null" }],
          },
          endOffset: {
            description: "End offset in normalized document text when known.",
            anyOf: [{ type: "number" }, { type: "null" }],
          },
          createdAt: {
            type: "string",
            description: "ISO timestamp for chunk creation.",
          },
        },
      },
    },
  },
} as const;

// Preview sample returned before a file is persisted. IDs are generated only for
// client rendering and are not database identifiers.
const chunkPreviewSampleSchema = {
  type: "object",
  required: ["id", "index", "text", "charCount"],
  properties: {
    id: { type: "string", description: "Preview-only chunk identifier." },
    index: { type: "number", description: "Zero-based preview chunk order." },
    text: { type: "string", description: "Preview chunk text." },
    charCount: {
      type: "number",
      description: "Character count for this preview chunk.",
    },
  },
} as const;

// Aggregate stats help the UI show chunking quality before the user commits an
// upload to the database and embedding queue.
const chunkPreviewStatsSchema = {
  type: "object",
  required: [
    "totalChunks",
    "minChunkLength",
    "maxChunkLength",
    "averageChunkLength",
    "normalizedTextLength",
  ],
  properties: {
    totalChunks: { type: "number", description: "Total chunks produced." },
    minChunkLength: {
      type: "number",
      description: "Shortest generated chunk length.",
    },
    maxChunkLength: {
      type: "number",
      description: "Longest generated chunk length.",
    },
    averageChunkLength: {
      type: "number",
      description: "Mean generated chunk length.",
    },
    normalizedTextLength: {
      type: "number",
      description: "Length of text after normalization and cleanup.",
    },
  },
} as const;

// Full chunk-preview response for multipart uploads before persistence.
export const chunkPreviewResponseSchema = {
  type: "object",
  required: ["totalChunks", "stats", "effectiveConfig", "sampleChunks"],
  properties: {
    totalChunks: { type: "number", description: "Total chunks produced." },
    stats: chunkPreviewStatsSchema,
    effectiveConfig: multipartChunkingConfigSchema,
    sampleChunks: {
      type: "array",
      description: "First preview chunks returned to the UI.",
      items: chunkPreviewSampleSchema,
    },
  },
} as const;

// Route-level OpenAPI schemas are grouped here so route modules can focus on
// HTTP orchestration and service calls.
export const knowledgeBaseRouteSchemas = {
  getKnowledgeBase: {
    tags: ["Knowledge Base"],
    summary: "Get default knowledge base",
    operationId: "getKnowledgeBase",
    response: {
      200: successEnvelope(knowledgeBaseSummarySchema),
      500: errorEnvelope,
    },
  },
  listDocuments: {
    tags: ["Knowledge Base"],
    summary: "List documents in the default knowledge base",
    operationId: "listKnowledgeBaseDocuments",
    querystring: {
      type: "object",
      additionalProperties: false,
      properties: {
        search: {
          type: "string",
          description: "Fuzzy match against document name or source label.",
        },
        enabled: {
          type: "string",
          description: "Filter by retrieval eligibility.",
          enum: ["true", "false"],
        },
        indexStatus: {
          type: "string",
          description: "Filter by indexing lifecycle state.",
          enum: ["processing", "ready", "failed"],
        },
        sortBy: {
          type: "string",
          description: "Document field used for ordering.",
          enum: ["createdAt", "updatedAt", "charCount", "chunkCount"],
        },
        sortOrder: {
          type: "string",
          description: "Sort direction. Defaults to descending in the route.",
          enum: ["asc", "desc"],
        },
      },
    },
    response: {
      200: successEnvelope({
        type: "array",
        items: documentSchema,
      }),
      500: errorEnvelope,
    },
  },
  getDocumentStatus: {
    tags: ["Knowledge Base"],
    summary: "Get document indexing status",
    operationId: "getKnowledgeBaseDocumentStatus",
    params: idParamsSchema,
    response: {
      200: successEnvelope(documentSchema),
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
  getDocument: {
    tags: ["Knowledge Base"],
    summary: "Get document detail",
    operationId: "getKnowledgeBaseDocument",
    params: idParamsSchema,
    response: {
      200: successEnvelope(documentDetailSchema),
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
  createDocument: {
    tags: ["Knowledge Base"],
    summary: "Create document and chunk it",
    operationId: "createKnowledgeBaseDocument",
    body: {
      type: "object",
      required: ["name", "fileExt", "contentText"],
      additionalProperties: false,
      properties: {
        name: {
          type: "string",
          minLength: 1,
          description: "Display name stored with the document.",
        },
        fileExt: {
          type: "string",
          minLength: 1,
          description: "Normalized extension without a leading dot.",
        },
        contentText: {
          type: "string",
          minLength: 1,
          description: "Document text to normalize, chunk, and index.",
        },
        mimeType: {
          description: "Optional client-reported MIME type.",
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        fileSize: {
          description: "Optional client-reported byte size.",
          anyOf: [{ type: "number" }, { type: "null" }],
        },
        sourceType: {
          type: "string",
          description: "Origin category for the document.",
          enum: ["upload", "sync", "api"],
        },
        sourceLabel: {
          description: "Optional human-readable external source label.",
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        enabled: {
          type: "boolean",
          description: "Whether retrieval may use the document.",
        },
        chunkingConfig: chunkingConfigSchema,
      },
    },
    response: {
      200: successEnvelope(documentDetailSchema),
      500: errorEnvelope,
    },
  },
  updateDocument: {
    tags: ["Knowledge Base"],
    summary: "Update document metadata or re-chunk content",
    operationId: "updateKnowledgeBaseDocument",
    params: idParamsSchema,
    body: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: {
          type: "string",
          description: "Replacement display name.",
        },
        sourceLabel: {
          description: "Replacement source label. Use null to clear it.",
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        enabled: {
          type: "boolean",
          description: "Whether retrieval may use the document.",
        },
        contentText: {
          type: "string",
          description: "Replacement text. Supplying it triggers re-indexing.",
        },
        chunkingConfig: chunkingConfigSchema,
      },
    },
    response: {
      200: successEnvelope(documentDetailSchema),
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
  deleteDocument: {
    tags: ["Knowledge Base"],
    summary: "Delete document",
    operationId: "deleteKnowledgeBaseDocument",
    params: idParamsSchema,
    response: {
      200: successEnvelope(deletedResponseSchema),
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
  previewChunks: {
    tags: ["Knowledge Base"],
    summary: "Preview document chunks without persisting",
    operationId: "previewKnowledgeBaseChunks",
    consumes: ["multipart/form-data"],
    response: {
      200: successEnvelope(chunkPreviewResponseSchema),
      400: errorEnvelope,
      413: errorEnvelope,
      500: errorEnvelope,
    },
  },
  uploadDocument: {
    tags: ["Knowledge Base"],
    summary: "Upload a document and index it asynchronously",
    operationId: "uploadKnowledgeBaseDocument",
    consumes: ["multipart/form-data"],
    response: {
      200: successEnvelope(documentSchema),
      400: errorEnvelope,
      413: errorEnvelope,
      500: errorEnvelope,
    },
  },
} as const;
