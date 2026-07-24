import { createOfficeSample, createWordDocument } from "./create.js";
import { reviewDocument } from "./document-review.js";
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

const normalizeWarnings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

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
    if (task.request.type === "verification-sample") {
      return;
    }
    if (task.kind !== "word") {
      throw new Error("Structured document create is currently supported only for Word");
    }
    const contentCount =
      (task.request.title?.trim() ? 1 : 0) +
      (task.request.paragraphs?.length ?? 0) +
      (task.request.tables?.length ?? 0);
    if (contentCount === 0) {
      throw new Error("Word document create requires a title, paragraph, or table");
    }
    for (const table of task.request.tables ?? []) {
      if (table.rows.length === 0 || table.rows.some((row) => row.length === 0)) {
        throw new Error("Word document tables require non-empty rows and cells");
      }
    }
    return;
  }

  if (!task.input.fileName.trim() || task.input.buffer.byteLength === 0) {
    throw new Error("Modify task requires a non-empty Office file");
  }

  if (task.kind === "word") {
    if (task.request.type === "append-paragraphs") {
      if (task.request.paragraphs.length === 0) {
        throw new Error("Word modify task requires at least one paragraph");
      }
      return;
    }

    const reviewActionCount =
      (task.request.comments?.length ?? 0) +
      (task.request.insertions?.length ?? 0) +
      (task.request.deletions?.length ?? 0);
    if (reviewActionCount === 0) {
      throw new Error("Word review task requires at least one review action");
    }
    for (const comment of task.request.comments ?? []) {
      if (!comment.targetText.trim() || !comment.text.trim()) {
        throw new Error("Word review comments require targetText and text");
      }
    }
    for (const insertion of task.request.insertions ?? []) {
      if (!insertion.afterText.trim() || !insertion.text) {
        throw new Error("Word tracked insertions require afterText and text");
      }
    }
    for (const deletion of task.request.deletions ?? []) {
      if (!deletion.targetText.trim()) {
        throw new Error("Word tracked deletions require targetText");
      }
    }
    return;
  }

  if (task.request.patches.length === 0) {
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
      const created =
        task.request.type === "document"
          ? await createWordDocument(task.request)
          : await createOfficeSample(task.kind);
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
      const modified =
        task.request.type === "append-paragraphs"
          ? appendDocumentParagraphs({
              fileName: task.input.fileName,
              buffer: task.input.buffer,
              paragraphs: task.request.paragraphs,
            })
          : reviewDocument({
              fileName: task.input.fileName,
              buffer: task.input.buffer,
              request: task.request,
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
        warnings: normalizeWarnings("warnings" in modified ? modified.warnings : undefined),
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
