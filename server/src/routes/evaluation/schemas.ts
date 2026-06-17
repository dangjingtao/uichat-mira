import { errorEnvelope, successEnvelope } from "@/routes/schema-helpers.js";

const datasetDocumentSchema = {
  type: "object",
  required: ["id", "name", "type", "sizeLabel"],
  properties: {
    id: { type: "string", description: "Stable document identifier." },
    name: { type: "string", description: "Display name shown in previews." },
    type: {
      type: "string",
      description: "Coarse document grouping inferred from the package.",
      enum: ["话术", "案例", "规章", "未分类"],
    },
    sizeLabel: {
      type: "string",
      description: "Human-readable size label used by the UI.",
    },
  },
} as const;

const datasetSampleSchema = {
  type: "object",
  required: ["id", "question", "expectedAnswer", "goldSources", "tags"],
  properties: {
    id: { type: "string", description: "Stable sample identifier." },
    question: { type: "string", description: "User question to evaluate." },
    expectedAnswer: {
      type: "string",
      description: "Reference answer used by generate-mode judging.",
    },
    goldSources: {
      type: "array",
      description: "Gold source names or IDs used for retrieval scoring.",
      items: { type: "string" },
    },
    tags: {
      type: "array",
      description: "Optional tags preserved for filtering and diagnostics.",
      items: { type: "string" },
    },
  },
} as const;

const datasetValidationSchema = {
  type: "object",
  required: ["id", "label", "status", "detail"],
  properties: {
    id: { type: "string", description: "Stable validation key." },
    label: { type: "string", description: "Short validation title." },
    status: {
      type: "string",
      description: "Validation severity shown in the workbench.",
      enum: ["pass", "warning", "error"],
    },
    detail: {
      type: "string",
      description: "Human-readable explanation for the current status.",
    },
  },
} as const;

const datasetConfigSchema = {
  type: "object",
  required: [
    "mode",
    "topK",
    "topN",
    "repeat",
    "concurrency",
    "timeoutSeconds",
  ],
  properties: {
    mode: {
      type: "string",
      description: "Evaluation mode declared by the package manifest.",
      enum: ["retrieve", "retrieve-generate"],
    },
    topK: { type: "number", description: "Retrieval top K candidate count." },
    topN: { type: "number", description: "Returned top N source count." },
    repeat: { type: "number", description: "Package-declared repeat count." },
    concurrency: {
      type: "number",
      description: "Requested concurrent sample workers.",
    },
    timeoutSeconds: {
      type: "number",
      description: "Per-sample timeout budget in seconds.",
    },
  },
} as const;

export const evaluationDatasetSchema = {
  type: "object",
  required: [
    "id",
    "datasetName",
    "fileName",
    "fileSize",
    "uploadedAt",
    "summary",
    "config",
    "documents",
    "previewSamples",
    "validations",
  ],
  properties: {
    id: { type: "string", description: "Stable dataset identifier." },
    datasetName: { type: "string", description: "User-facing dataset name." },
    fileName: { type: "string", description: "Uploaded zip filename." },
    fileSize: { type: "number", description: "Uploaded zip size in bytes." },
    uploadedAt: {
      type: "string",
      format: "date-time",
      description: "ISO timestamp when the package was parsed.",
    },
    summary: {
      type: "object",
      required: [
        "documentCount",
        "sampleCount",
        "hasReferenceAnswers",
        "hasGoldSources",
      ],
      properties: {
        documentCount: {
          type: "number",
          description: "Number of package documents discovered.",
        },
        sampleCount: {
          type: "number",
          description: "Number of evaluation samples discovered.",
        },
        hasReferenceAnswers: {
          type: "boolean",
          description: "Whether all or some samples include reference answers.",
        },
        hasGoldSources: {
          type: "boolean",
          description: "Whether all or some samples include gold sources.",
        },
      },
    },
    config: datasetConfigSchema,
    documents: {
      type: "array",
      description: "Lightweight document previews for the workbench.",
      items: datasetDocumentSchema,
    },
    previewSamples: {
      type: "array",
      description: "First few samples shown before a run starts.",
      items: datasetSampleSchema,
    },
    validations: {
      type: "array",
      description: "Validation report for the uploaded package.",
      items: datasetValidationSchema,
    },
  },
} as const;

const evaluationMetricSummarySchema = {
  type: "object",
  required: [
    "hitAtK",
    "recallAtK",
    "mrr",
    "faithfulness",
    "answerRelevance",
    "answerCompleteness",
    "sourceHitRate",
    "averageLatencyMs",
    "failedCount",
  ],
  properties: {
    hitAtK: { type: "number", description: "Retrieval hit rate at K." },
    recallAtK: { type: "number", description: "Mean recall at K." },
    mrr: { type: "number", description: "Mean reciprocal rank." },
    faithfulness: {
      type: "number",
      description: "Answer faithfulness score when generation is evaluated.",
    },
    answerRelevance: {
      type: "number",
      description: "Whether generated answers address the user question.",
    },
    answerCompleteness: {
      type: "number",
      description: "Whether generated answers cover key reference points.",
    },
    sourceHitRate: {
      type: "number",
      description: "Share of samples where returned sources match gold sources.",
    },
    averageLatencyMs: {
      type: "number",
      description: "Average end-to-end latency per sample in milliseconds.",
    },
    failedCount: {
      type: "number",
      description: "Count of samples that failed to finish.",
    },
  },
} as const;

const evaluationLogEntrySchema = {
  type: "object",
  required: ["id", "timestamp", "level", "text"],
  properties: {
    id: { type: "string", description: "Stable log entry identifier." },
    timestamp: {
      type: "string",
      format: "date-time",
      description: "ISO timestamp when the log entry was recorded.",
    },
    level: {
      type: "string",
      description: "Terminal-style log severity.",
      enum: ["info", "success", "warning", "error"],
    },
    text: { type: "string", description: "Human-readable log text." },
  },
} as const;

const evaluationSampleResultSchema = {
  type: "object",
  required: [
    "id",
    "question",
    "goldSources",
    "matchedGoldSources",
    "retrievedSources",
    "status",
    "hit",
    "recall",
    "latencyMs",
    "sourceHit",
    "faithfulness",
    "answerRelevance",
    "answerCompleteness",
    "attempts",
  ],
  properties: {
    id: { type: "string", description: "Stable sample identifier." },
    question: { type: "string", description: "Original user question." },
    goldSources: {
      type: "array",
      description: "Gold source set declared by the dataset.",
      items: { type: "string" },
    },
    matchedGoldSources: {
      type: "array",
      description: "Gold sources matched by the aggregated sample result.",
      items: { type: "string" },
    },
    retrievedSources: {
      type: "array",
      description: "Retrieved source previews from the selected attempt.",
      items: {
        type: "object",
        required: ["documentName"],
        properties: {
          documentName: {
            type: "string",
            description: "Retrieved document display name.",
          },
          chunkId: {
            type: "number",
            description: "Retrieved chunk identifier when available.",
          },
          score: {
            type: "number",
            description: "Retrieval score when available.",
          },
          contentPreview: {
            type: "string",
            description: "Short preview snippet for diagnostics.",
          },
        },
      },
    },
    answerText: {
      type: "string",
      description: "Generated answer text for this sample, when available.",
    },
    referenceAnswer: {
      type: "string",
      description: "Reference answer carried from the dataset, when available.",
    },
    status: {
      type: "string",
      description: "Per-sample execution status.",
      enum: ["success", "failed"],
    },
    hit: {
      type: "boolean",
      description: "Whether retrieval hit any gold source.",
    },
    recall: { type: "number", description: "Recall score for this sample." },
    latencyMs: {
      type: "number",
      description: "End-to-end latency in milliseconds.",
    },
    sourceHit: {
      type: "boolean",
      description: "Whether returned sources overlap with gold sources.",
    },
    faithfulness: {
      type: "number",
      description: "Per-sample faithfulness score.",
    },
    answerRelevance: {
      type: "number",
      description: "Per-sample answer relevance score.",
    },
    answerCompleteness: {
      type: "number",
      description: "Per-sample answer completeness score.",
    },
    attempts: {
      type: "array",
      description: "Attempt-level diagnostics across retries or repeats.",
      items: {
        type: "object",
        required: [
          "attempt",
          "status",
          "latencyMs",
          "hit",
          "recall",
          "faithfulness",
          "answerRelevance",
          "answerCompleteness",
          "retrievedSources",
        ],
        properties: {
          attempt: {
            type: "number",
            description: "One-based attempt index within the sample run.",
          },
          status: {
            type: "string",
            description: "Whether this attempt completed successfully.",
            enum: ["success", "failed"],
          },
          latencyMs: {
            type: "number",
            description: "Attempt latency in milliseconds.",
          },
          hit: {
            type: "boolean",
            description: "Gold-source hit outcome for this attempt.",
          },
          recall: {
            type: "number",
            description: "Recall score for this attempt.",
          },
          faithfulness: {
            type: "number",
            description: "Faithfulness score for this attempt.",
          },
          answerRelevance: {
            type: "number",
            description: "Relevance score for this attempt.",
          },
          answerCompleteness: {
            type: "number",
            description: "Completeness score for this attempt.",
          },
          retrievedSources: {
            type: "array",
            description: "Retrieved source previews for this attempt.",
            items: {
              type: "object",
              required: ["documentName"],
              properties: {
                documentName: { type: "string" },
                chunkId: { type: "number" },
                score: { type: "number" },
                contentPreview: { type: "string" },
              },
            },
          },
          answerText: {
            type: "string",
            description: "Generated answer text for this attempt, when available.",
          },
          errorMessage: {
            type: "string",
            description: "Optional failure reason for this attempt.",
          },
        },
      },
    },
    errorMessage: {
      type: "string",
      description: "Optional failure reason for diagnostics.",
    },
  },
} as const;

export const evaluationRunRecordSchema = {
  type: "object",
  required: [
    "id",
    "name",
    "dataset",
    "status",
    "startedAt",
    "metrics",
    "logs",
    "sampleResults",
  ],
  properties: {
    id: { type: "string", description: "Stable evaluation run identifier." },
    name: { type: "string", description: "User-facing run title." },
    dataset: evaluationDatasetSchema,
    status: {
      type: "string",
      description: "Current lifecycle state of the evaluation run.",
      enum: ["queued", "running", "completed", "failed"],
    },
    startedAt: {
      type: "string",
      format: "date-time",
      description: "ISO timestamp when execution started or was queued.",
    },
    completedAt: {
      type: "string",
      format: "date-time",
      description: "ISO timestamp when execution finished, when available.",
    },
    metrics: evaluationMetricSummarySchema,
    logs: {
      type: "array",
      description: "Captured run log entries.",
      items: evaluationLogEntrySchema,
    },
    sampleResults: {
      type: "array",
      description: "Sample-level diagnostics accumulated so far.",
      items: evaluationSampleResultSchema,
    },
  },
} as const;

const deleteEvaluationRunResponseSchema = {
  type: "object",
  required: ["id", "deleted"],
  properties: {
    id: { type: "string", description: "Deleted evaluation run identifier." },
    deleted: {
      type: "boolean",
      description: "Whether the record was removed successfully.",
    },
  },
} as const;

const createRunBodySchema = {
  type: "object",
  required: ["datasetId"],
  additionalProperties: false,
  properties: {
    datasetId: {
      type: "string",
      description: "Dataset identifier returned by the parse endpoint.",
    },
    name: {
      type: "string",
      description: "Optional run title override for the created job.",
    },
  },
} as const;

export const evaluationRouteSchemas = {
  generatePackage: {
    tags: ["Evaluation"],
    summary: "Generate a downloadable evaluation package",
    operationId: "generateEvaluationPackage",
    body: {
      type: "object",
      additionalProperties: false,
      required: [
        "datasetName",
        "sampleCount",
        "documentCount",
        "chunksPerDocument",
        "mode",
        "topK",
        "topN",
        "repeat",
        "concurrency",
        "timeoutSeconds",
      ],
      properties: {
        datasetName: { type: "string" },
        sampleCount: { type: "number" },
        documentCount: { type: "number" },
        chunksPerDocument: { type: "number" },
        mode: { type: "string", enum: ["retrieve", "retrieve-generate"] },
        topK: { type: "number" },
        topN: { type: "number" },
        repeat: { type: "number" },
        concurrency: { type: "number" },
        timeoutSeconds: { type: "number" },
      },
    },
    response: {
      400: errorEnvelope,
      500: errorEnvelope,
    },
  },
  parseDataset: {
    tags: ["Evaluation"],
    summary: "Parse an evaluation dataset package",
    operationId: "parseEvaluationDataset",
    consumes: ["multipart/form-data"],
    response: {
      200: successEnvelope(evaluationDatasetSchema),
      400: errorEnvelope,
      413: errorEnvelope,
      500: errorEnvelope,
    },
  },
  listRuns: {
    tags: ["Evaluation"],
    summary: "List evaluation runs",
    operationId: "listEvaluationRuns",
    querystring: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: {
          type: "string",
          description: "Optional lifecycle filter.",
          enum: ["queued", "running", "completed", "failed"],
        },
      },
    },
    response: {
      200: successEnvelope({
        type: "array",
        items: evaluationRunRecordSchema,
      }),
      500: errorEnvelope,
    },
  },
  getRun: {
    tags: ["Evaluation"],
    summary: "Get evaluation run detail",
    operationId: "getEvaluationRun",
    params: {
      type: "object",
      required: ["runId"],
      properties: {
        runId: { type: "string", description: "Evaluation run identifier." },
      },
    },
    response: {
      200: successEnvelope(evaluationRunRecordSchema),
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
  deleteRun: {
    tags: ["Evaluation"],
    summary: "Delete an evaluation run",
    operationId: "deleteEvaluationRun",
    params: {
      type: "object",
      required: ["runId"],
      properties: {
        runId: { type: "string", description: "Evaluation run identifier." },
      },
    },
    response: {
      200: successEnvelope(deleteEvaluationRunResponseSchema),
      400: errorEnvelope,
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
  createRun: {
    tags: ["Evaluation"],
    summary: "Create an evaluation run",
    operationId: "createEvaluationRun",
    body: createRunBodySchema,
    response: {
      200: successEnvelope(evaluationRunRecordSchema),
      400: errorEnvelope,
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
} as const;
