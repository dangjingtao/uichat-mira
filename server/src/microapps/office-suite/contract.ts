import type { OfficeSuiteFileKind, OfficeSuiteInspection } from "./index.js";

export const OFFICE_RUNTIME_CONTRACT_VERSION = "office-runtime.v1" as const;

export type OfficeRuntimeContractVersion = typeof OFFICE_RUNTIME_CONTRACT_VERSION;
export type OfficeRuntimeOperation = "inspect" | "create" | "modify";

export type OfficeRuntimeFileInput = {
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
  /**
   * Optional upstream artifact identity. The Runtime does not resolve refs itself;
   * callers such as a future Skill adapter resolve the bytes before execution and
   * may preserve the source ref here for traceability.
   */
  artifactRef?: string;
};

export type OfficeRuntimeParagraph = {
  text: string;
  bold?: boolean;
};

export type OfficeRuntimeSpreadsheetCellPatch = {
  sheetName: string;
  cell: string;
  value?: string | number | boolean | null;
  formula?: string;
  bold?: boolean;
  numberFormat?: string;
};

export type OfficeRuntimeWordReviewComment = {
  /** Exact visible text used as a localized anchor in a simple Word text run. */
  targetText: string;
  text: string;
  author?: string;
};

export type OfficeRuntimeWordTrackedInsertion = {
  /** Insert the revision immediately after this exact visible text anchor. */
  afterText: string;
  text: string;
  author?: string;
};

export type OfficeRuntimeWordTrackedDeletion = {
  /** Mark this exact visible text as a tracked deletion without accepting it. */
  targetText: string;
  author?: string;
};

export type OfficeRuntimeWordReviewRequest = {
  type: "review";
  author?: string;
  comments?: OfficeRuntimeWordReviewComment[];
  insertions?: OfficeRuntimeWordTrackedInsertion[];
  deletions?: OfficeRuntimeWordTrackedDeletion[];
};

type OfficeRuntimeTaskBase = {
  contractVersion?: OfficeRuntimeContractVersion;
  taskId?: string;
};

export type OfficeRuntimeInspectTask = OfficeRuntimeTaskBase & {
  operation: "inspect";
  input: OfficeRuntimeFileInput;
};

export type OfficeRuntimeCreateTask = OfficeRuntimeTaskBase & {
  operation: "create";
  kind: OfficeSuiteFileKind;
  /**
   * V1 currently exposes only the verified baseline generator through the task
   * contract. New create modes should extend this union instead of leaking SDK
   * calls into Skill or UI consumers.
   */
  request: {
    type: "verification-sample";
  };
};

export type OfficeRuntimeModifyWordTask = OfficeRuntimeTaskBase & {
  operation: "modify";
  kind: "word";
  input: OfficeRuntimeFileInput;
  request:
    | {
        type: "append-paragraphs";
        paragraphs: OfficeRuntimeParagraph[];
      }
    | OfficeRuntimeWordReviewRequest;
};

export type OfficeRuntimeModifyExcelTask = OfficeRuntimeTaskBase & {
  operation: "modify";
  kind: "excel";
  input: OfficeRuntimeFileInput;
  request: {
    type: "patch-cells";
    patches: OfficeRuntimeSpreadsheetCellPatch[];
  };
};

export type OfficeRuntimeTask =
  | OfficeRuntimeInspectTask
  | OfficeRuntimeCreateTask
  | OfficeRuntimeModifyWordTask
  | OfficeRuntimeModifyExcelTask;

export type OfficeRuntimeFileDescriptor = {
  artifactRef?: string;
  fileName: string;
  mimeType?: string;
  byteSize: number;
};

export type OfficeRuntimeArtifact = {
  kind: OfficeSuiteFileKind;
  fileName: string;
  mimeType: string;
  byteSize: number;
  buffer: Buffer;
};

export type OfficeRuntimeErrorCode =
  | "UNSUPPORTED_FILE_TYPE"
  | "INVALID_TASK_INPUT"
  | "EXECUTION_FAILED";

export type OfficeRuntimeTaskError = {
  code: OfficeRuntimeErrorCode;
  message: string;
};

type OfficeRuntimeTaskResultBase = {
  contractVersion: OfficeRuntimeContractVersion;
  taskId?: string;
  operation: OfficeRuntimeOperation;
  kind?: OfficeSuiteFileKind;
  durationMs: number;
  summary: string;
  input?: OfficeRuntimeFileDescriptor;
  artifacts: OfficeRuntimeArtifact[];
  warnings: string[];
};

export type OfficeRuntimeTaskCompletedResult = OfficeRuntimeTaskResultBase & {
  status: "completed";
  inspection?: OfficeSuiteInspection;
};

export type OfficeRuntimeTaskFailedResult = OfficeRuntimeTaskResultBase & {
  status: "failed";
  error: OfficeRuntimeTaskError;
};

export type OfficeRuntimeTaskResult =
  | OfficeRuntimeTaskCompletedResult
  | OfficeRuntimeTaskFailedResult;
