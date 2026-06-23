/** Supported evaluation execution modes. */
export type EvaluationMode = "retrieve" | "retrieve-generate";

/** Lifecycle states exposed by the evaluation run resource. */
export type EvaluationRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

/** One uploaded source document discovered inside the dataset package. */
export interface EvaluationDatasetDocument {
  /** Stable document identifier within the parsed dataset. */
  id: string;
  /** Display name shown in preview and later source matching. */
  name: string;
  /** Lightweight UI grouping label inferred from filename/path. */
  type: "话术" | "案例" | "规章" | "未分类";
  /** Human-readable size string for previews. */
  sizeLabel: string;
}

/** One parsed evaluation sample. */
export interface EvaluationDatasetSample {
  /** Stable sample identifier. Falls back to generated IDs when absent. */
  id: string;
  /** User question used for retrieval or generation evaluation. */
  question: string;
  /** Optional reference answer used by generate-mode judging. */
  expectedAnswer: string;
  /** Gold source names or IDs used for retrieval scoring. */
  goldSources: string[];
  /** Optional tags carried through for filtering and diagnostics. */
  tags: string[];
}

/** Validation result produced while parsing the uploaded package. */
export interface EvaluationDatasetValidationItem {
  /** Stable validation key. */
  id: string;
  /** Short validation title rendered in the workbench. */
  label: string;
  /** Validation severity. */
  status: "pass" | "warning" | "error";
  /** Human-readable explanation for the current status. */
  detail: string;
}

/** Runtime configuration declared by the dataset package manifest. */
export interface EvaluationDatasetConfig {
  /** Whether the run evaluates retrieval only or retrieval plus generation. */
  mode: EvaluationMode;
  /** Retrieval candidate count before optional rerank. */
  topK: number;
  /** Final source count returned to the answering stage. */
  topN: number;
  /** Repeat count for the same dataset configuration. */
  repeat: number;
  /** Concurrent sample workers requested by the package. */
  concurrency: number;
  /** Per-sample timeout budget in seconds. */
  timeoutSeconds: number;
}

/** Parsed dataset metadata cached after a successful upload. */
export interface EvaluationDatasetRecord {
  /** Stable dataset identifier returned by the parse endpoint. */
  id: string;
  /** User-facing dataset title. */
  datasetName: string;
  /** Knowledge base used to generate or run this dataset, when known. */
  knowledgeBaseId?: string;
  /** Original uploaded zip filename. */
  fileName: string;
  /** Uploaded zip file size in bytes. */
  fileSize: number;
  /** ISO timestamp when the package was parsed. */
  uploadedAt: string;
  /** Package-level counts used by the workbench summary. */
  summary: {
    documentCount: number;
    sampleCount: number;
    hasReferenceAnswers: boolean;
    hasGoldSources: boolean;
  };
  /** Parsed runtime configuration. */
  config: EvaluationDatasetConfig;
  /** Lightweight document previews. */
  documents: EvaluationDatasetDocument[];
  /** First few samples shown before a run starts. */
  previewSamples: EvaluationDatasetSample[];
  /** Validation report for the uploaded package. */
  validations: EvaluationDatasetValidationItem[];
}

/** One log line emitted by a run. */
export interface EvaluationLogEntry {
  /** Stable log entry identifier. */
  id: string;
  /** ISO timestamp when the entry was recorded. */
  timestamp: string;
  /** Severity used for terminal-style display. */
  level: "info" | "success" | "warning" | "error";
  /** Human-readable log text. */
  text: string;
}

/** Aggregated metrics for one evaluation run. */
export interface EvaluationMetricSummary {
  /** Share of samples where at least one gold source appears in top K. */
  hitAtK: number;
  /** Mean recall against the gold source list. */
  recallAtK: number;
  /** Mean reciprocal rank or its approximation. */
  mrr: number;
  /** Answer faithfulness score when generation is evaluated. */
  faithfulness: number;
  /** Whether the generated answer addresses the user question. */
  answerRelevance: number;
  /** Whether the generated answer covers key points from the reference answer. */
  answerCompleteness: number;
  /** Share of samples where cited sources match gold sources. */
  sourceHitRate: number;
  /** Average end-to-end latency per sample in milliseconds. */
  averageLatencyMs: number;
  /** Count of samples that failed to finish. */
  failedCount: number;
}

/** Result for one evaluated sample. */
export interface EvaluationRetrievedSource {
  /** Retrieved document display name. */
  documentName: string;
  /** Retrieved chunk identifier when available. */
  chunkId?: number;
  /** Retrieval score when available. */
  score?: number;
  /** Short preview snippet captured for diagnostics. */
  contentPreview?: string;
}

/** One execution attempt for a sample, including retries and timeouts. */
export interface EvaluationSampleAttempt {
  /** One-based attempt index within the sample run. */
  attempt: number;
  /** Whether this attempt completed successfully. */
  status: "success" | "failed";
  /** Attempt latency in milliseconds. */
  latencyMs: number;
  /** Gold-source hit outcome for this attempt. */
  hit: boolean;
  /** Recall score for this attempt. */
  recall: number;
  /** Faithfulness score for this attempt. */
  faithfulness: number;
  /** Relevance score for this attempt. */
  answerRelevance: number;
  /** Completeness score for this attempt. */
  answerCompleteness: number;
  /** Retrieved source previews captured for this attempt. */
  retrievedSources: EvaluationRetrievedSource[];
  /** Generated answer text for this attempt, when available. */
  answerText?: string;
  /** Optional failure reason for this attempt. */
  errorMessage?: string;
}

/** Result for one evaluated sample. */
export interface EvaluationSampleResult {
  /** Stable sample identifier. */
  id: string;
  /** Original user question. */
  question: string;
  /** Gold source set declared by the dataset. */
  goldSources: string[];
  /** Gold sources matched by the final aggregated result. */
  matchedGoldSources: string[];
  /** Retrieved source previews from the best or latest successful attempt. */
  retrievedSources: EvaluationRetrievedSource[];
  /** Generated answer text selected for the sample, when available. */
  answerText?: string;
  /** Reference answer carried from the dataset, when available. */
  referenceAnswer?: string;
  /** Per-sample execution status. */
  status: "success" | "failed";
  /** Whether retrieval hit any gold source. */
  hit: boolean;
  /** Recall against the sample's gold source set. */
  recall: number;
  /** End-to-end latency in milliseconds. */
  latencyMs: number;
  /** Whether cited or returned sources overlap with gold sources. */
  sourceHit: boolean;
  /** Per-sample faithfulness score. */
  faithfulness: number;
  /** Whether the answer addresses the user question. */
  answerRelevance: number;
  /** Whether the answer covers key reference points. */
  answerCompleteness: number;
  /** Attempt-level diagnostics across retries or repeats. */
  attempts: EvaluationSampleAttempt[];
  /** Optional failure reason captured for diagnostics. */
  errorMessage?: string;
}

/** Persisted or in-flight evaluation run record. */
export interface EvaluationRunRecord {
  /** Stable run identifier. */
  id: string;
  /** User-facing run title. */
  name: string;
  /** Dataset snapshot used by this run. */
  dataset: EvaluationDatasetRecord;
  /** Current lifecycle state. */
  status: EvaluationRunStatus;
  /** ISO timestamp when execution started or was queued. */
  startedAt: string;
  /** ISO timestamp when execution finished, when available. */
  completedAt?: string;
  /** Latest aggregate metrics. */
  metrics: EvaluationMetricSummary;
  /** Streamed log entries captured so far. */
  logs: EvaluationLogEntry[];
  /** Sample-level diagnostics accumulated so far. */
  sampleResults: EvaluationSampleResult[];
}

/** Query params accepted by the evaluation run list endpoint. */
export interface EvaluationRunListQuery {
  /** Optional lifecycle filter for the list view. */
  status?: EvaluationRunStatus;
}

/** Response returned after deleting one evaluation run record. */
export interface DeleteEvaluationRunResponse {
  /** Deleted run identifier. */
  id: string;
  /** Whether the record was removed. */
  deleted: boolean;
}

/** Body for deleting multiple evaluation run records at once. */
export interface DeleteEvaluationRunsBody {
  /** Evaluation run identifiers to remove. */
  runIds: string[];
}

/** Response returned after deleting multiple evaluation run records. */
export interface DeleteEvaluationRunsResponse {
  /** Deleted run identifiers. */
  deletedIds: string[];
}

/** Body for creating a new evaluation run from a parsed dataset. */
export interface CreateEvaluationRunBody {
  /** Dataset identifier returned by the parse endpoint. */
  datasetId: string;
  /** Optional user-provided run title override. */
  name?: string;
}

/** Body for generating a downloadable evaluation package. */
export interface GenerateEvaluationPackageBody {
  /** User-facing dataset name embedded in manifest and filename. */
  datasetName: string;
  /** Knowledge base used as the source for package generation. */
  knowledgeBaseId: string;
  /** Total sample count requested for the package. */
  sampleCount: number;
  /** Max number of documents to sample from the selected knowledge base. */
  documentCount: number;
  /** Max chunks sampled from each selected document. */
  chunksPerDocument: number;
  /** Generated package mode. */
  mode: EvaluationMode;
  /** Retrieval top K declared in manifest. */
  topK: number;
  /** Returned source top N declared in manifest. */
  topN: number;
  /** Repeat count declared in manifest. */
  repeat: number;
  /** Concurrency declared in manifest. */
  concurrency: number;
  /** Per-sample timeout budget declared in manifest. */
  timeoutSeconds: number;
}
