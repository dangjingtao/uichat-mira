export type EvaluationMode = "retrieve" | "retrieve-generate";

export type EvaluationJobStatus =
  | "idle"
  | "ready"
  | "running"
  | "completed"
  | "failed";

export interface ParsedDatasetDocument {
  id: string;
  name: string;
  type: "话术" | "案例" | "规章";
  sizeLabel: string;
}

export interface ParsedDatasetSample {
  id: string;
  question: string;
  expectedAnswer: string;
  goldSources: string[];
  tags: string[];
}

export interface ParsedDatasetValidationItem {
  id: string;
  label: string;
  status: "pass" | "warning" | "error";
  detail: string;
}

export interface ParsedDatasetConfig {
  mode: EvaluationMode;
  topK: number;
  topN: number;
  repeat: number;
  concurrency: number;
  timeoutSeconds: number;
}

export interface ParsedDataset {
  id: string;
  datasetName: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  summary: {
    documentCount: number;
    sampleCount: number;
    hasReferenceAnswers: boolean;
    hasGoldSources: boolean;
  };
  config: ParsedDatasetConfig;
  documents: ParsedDatasetDocument[];
  previewSamples: ParsedDatasetSample[];
  validations: ParsedDatasetValidationItem[];
}

export interface EvaluationLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  text: string;
}

export interface EvaluationMetricSummary {
  hitAtK: number;
  recallAtK: number;
  mrr: number;
  faithfulness: number;
  sourceHitRate: number;
  averageLatencyMs: number;
  failedCount: number;
}

export interface EvaluationSampleResult {
  id: string;
  question: string;
  status: "success" | "failed";
  hit: boolean;
  recall: number;
  latencyMs: number;
  sourceHit: boolean;
  faithfulness: number;
  errorMessage?: string;
}

export interface EvaluationRunRecord {
  id: string;
  name: string;
  dataset: ParsedDataset;
  status: Exclude<EvaluationJobStatus, "idle" | "ready">;
  startedAt: string;
  completedAt: string;
  metrics: EvaluationMetricSummary;
  logs: EvaluationLogEntry[];
  sampleResults: EvaluationSampleResult[];
}
