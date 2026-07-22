import { createOfficeSample } from "./create.js";
import { appendDocumentParagraphs } from "./document.js";
import {
  OFFICE_RUNTIME_CONTRACT_VERSION,
  type OfficeRuntimeArtifact,
  type OfficeRuntimeErrorCode,
  type OfficeRuntimeFileInput,
  type OfficeRuntimeTask,
  type OfficeRuntimeTaskResult,
} from "./contract.js";
import {
  inspectOfficeDocument,
  UnsupportedOfficeFileError,
  type OfficeSuiteFileKind,
} from "./index.js";
import { patchSpreadsheetWorkbook } from "./spreadsheet.js";

const describeInput = (input: OfficeRuntimeFileInput) => ({
  artifactRef: input.artifactRef,
  fileName: input.fileName,
  mimeType: input.mimeType,
  byteSize: input.buffer.byteLength,
});

const toArtifact = (input: {
  kind: OfficeSuiteFileKind;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): OfficeRuntimeArtifact => ({
  kind: input.kind,
  fileName: input.fileName,
  mimeType: input.mimeType,
  byteSize: input.buffer.byteLength,
  buffer: input.buffer,
});

const failure = (input: {
  task: OfficeRuntimeTask;
  startedAt: number;
  code: OfficeRuntimeErrorCode;
  message: string;
}): OfficeRuntimeTaskResult => ({
  contractVersion: OFFICE_RUNTIME_CONTRACT_VERSION,
  taskId: input.task.taskId,
  operation: input.task.operation,
  kind: "kind" in input.task ? input.task.kind : undefined,
  status: "failed",
  durationMs: Date.now() - input.startedAt,
  summary: input.message,
  input: "input" in input.task ? describeInput(input.task.input) : undefined,
  artifacts: [],
  warnings: [],
  error: {
    code: input.code,
    message: input.message,
  },
});

const validateTask = (task: OfficeRuntimeTask) => {
  if (
    task.contractVersion &&
    task.contractVersion !== OFFICE_RUNTIME_CONTRACT_VERSION
  ) {
    throw new Error(
      `Unsupported Office Runtime contract version: ${task.contractVersion}`,
    );
  }

  if (task.operation === "inspect") {
    if (!task.input.fileName.trim() || task.input.buffer.byteLength === 0) {
      throw new Error("Inspect task requires a non-empty Office file");
    }
    return;
  }

  if (task.operation === "create") {
    if (task.request.type !== "verification-sample") {
      throw new Error(`Unsupported create request: ${task.request.type}`);
    }
    return;
  }

  if (!task.input.fileName.trim() || task.input.buffer.byteLength === 0) {
    throw new Error("Modify task requires a non-empty Office file");
  }

  if (task.kind === "word" && task.request.paragraphs.length === 0) {
    throw new Error("Word modify task requires at least one paragraph");
  }
  if (task.kind === "excel" && task.request.patches.length === 0) {
    throw new Error("Excel modify task requires at least one cell patch");
  }
};

export const executeOfficeRuntimeTask = async (
  task: OfficeRuntimeTask,
): Promise<OfficeRuntimeTaskResult> => {
  const startedAt = Date.now();

  try {
    validateTask(task);
  } catch (error) {
    return failure({
      task,
      startedAt,
      code: "INVALID_TASK_INPUT",
      message: error instanceof Error ? error.message : "Invalid Office Runtime task",
    });
  }

  try {
    if (task.operation === "inspect") {
      const inspection = inspectOfficeDocument(task.input);
      return {
        contractVersion: OFFICE_RUNTIME_CONTRACT_VERSION,
        taskId: task.taskId,
        operation: "inspect",
        kind: inspection.kind,
        status: "completed",
        durationMs: Date.now() - startedAt,
        summary: inspection.summary,
        input: describeInput(task.input),
        inspection,
        artifacts: [],
        warnings: [],
      };
    }

    if (task.operation === "create") {
      const created = await createOfficeSample(task.kind);
      return {
        contractVersion: OFFICE_RUNTIME_CONTRACT_VERSION,
        taskId: task.taskId,
        operation: "create",
        kind: task.kind,
        status: "completed",
        durationMs: Date.now() - startedAt,
        summary: created.summary,
        artifacts: [
          toArtifact({
            kind: task.kind,
            fileName: created.fileName,
            mimeType: created.mimeType,
            buffer: created.buffer,
          }),
        ],
        warnings: [],
      };
    }

    if (task.kind === "word") {
      const modified = appendDocumentParagraphs({
        fileName: task.input.fileName,
        buffer: task.input.buffer,
        paragraphs: task.request.paragraphs,
      });
      return {
        contractVersion: OFFICE_RUNTIME_CONTRACT_VERSION,
        taskId: task.taskId,
        operation: "modify",
        kind: "word",
        status: "completed",
        durationMs: Date.now() - startedAt,
        summary: modified.summary,
        input: describeInput(task.input),
        artifacts: [
          toArtifact({
            kind: "word",
            fileName: modified.fileName,
            mimeType: modified.mimeType,
            buffer: modified.buffer,
          }),
        ],
        warnings: [],
      };
    }

    const modified = await patchSpreadsheetWorkbook({
      fileName: task.input.fileName,
      buffer: task.input.buffer,
      patches: task.request.patches,
    });
    return {
      contractVersion: OFFICE_RUNTIME_CONTRACT_VERSION,
      taskId: task.taskId,
      operation: "modify",
      kind: "excel",
      status: "completed",
      durationMs: Date.now() - startedAt,
      summary: modified.summary,
      input: describeInput(task.input),
      artifacts: [
        toArtifact({
          kind: "excel",
          fileName: modified.fileName,
          mimeType: modified.mimeType,
          buffer: modified.buffer,
        }),
      ],
      warnings: [],
    };
  } catch (error) {
    if (error instanceof UnsupportedOfficeFileError) {
      return failure({
        task,
        startedAt,
        code: "UNSUPPORTED_FILE_TYPE",
        message: error.message,
      });
    }

    return failure({
      task,
      startedAt,
      code: "EXECUTION_FAILED",
      message: error instanceof Error ? error.message : "Office Runtime execution failed",
    });
  }
};
