import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import { OFFICE_RUNTIME_CONTRACT_VERSION } from "./contract.js";
import { executeOfficeRuntimeTask } from "./runtime.js";

describe("WenShu Office Runtime task contract", () => {
  it("creates an artifact and re-inspects it through the same task executor", async () => {
    const created = await executeOfficeRuntimeTask({
      contractVersion: OFFICE_RUNTIME_CONTRACT_VERSION,
      taskId: "task-create-word",
      operation: "create",
      kind: "word",
      request: {
        type: "verification-sample",
      },
    });

    expect(created.status).toBe("completed");
    expect(created.contractVersion).toBe(OFFICE_RUNTIME_CONTRACT_VERSION);
    expect(created.taskId).toBe("task-create-word");
    expect(created.operation).toBe("create");
    expect(created.kind).toBe("word");
    expect(created.artifacts).toHaveLength(1);

    if (created.status !== "completed") {
      throw new Error(created.error.message);
    }
    const artifact = created.artifacts[0];
    expect(artifact).toBeDefined();
    if (!artifact) {
      throw new Error("Create task completed without an artifact");
    }

    const inspected = await executeOfficeRuntimeTask({
      taskId: "task-inspect-word",
      operation: "inspect",
      input: {
        artifactRef: "artifact://word/generated",
        fileName: artifact.fileName,
        mimeType: artifact.mimeType,
        buffer: artifact.buffer,
      },
    });

    expect(inspected.status).toBe("completed");
    expect(inspected.operation).toBe("inspect");
    expect(inspected.kind).toBe("word");
    expect(inspected.input?.artifactRef).toBe("artifact://word/generated");
    expect(inspected.artifacts).toHaveLength(0);
    if (inspected.status !== "completed") {
      throw new Error(inspected.error.message);
    }
    expect(inspected.inspection?.previewText).toContain("文枢");
  });

  it("modifies Word and Excel through task-level requests", async () => {
    const wordSource = await executeOfficeRuntimeTask({
      operation: "create",
      kind: "word",
      request: { type: "verification-sample" },
    });
    const excelSource = await executeOfficeRuntimeTask({
      operation: "create",
      kind: "excel",
      request: { type: "verification-sample" },
    });

    if (wordSource.status !== "completed" || excelSource.status !== "completed") {
      throw new Error("Failed to prepare Office Runtime test artifacts");
    }

    const wordArtifact = wordSource.artifacts[0];
    const excelArtifact = excelSource.artifacts[0];
    if (!wordArtifact || !excelArtifact) {
      throw new Error("Create task completed without test artifacts");
    }

    const wordModified = await executeOfficeRuntimeTask({
      operation: "modify",
      kind: "word",
      input: {
        fileName: wordArtifact.fileName,
        mimeType: wordArtifact.mimeType,
        buffer: wordArtifact.buffer,
      },
      request: {
        type: "append-paragraphs",
        paragraphs: [{ text: "Task contract Word append", bold: true }],
      },
    });

    const excelModified = await executeOfficeRuntimeTask({
      operation: "modify",
      kind: "excel",
      input: {
        fileName: excelArtifact.fileName,
        mimeType: excelArtifact.mimeType,
        buffer: excelArtifact.buffer,
      },
      request: {
        type: "patch-cells",
        patches: [
          {
            sheetName: "TaskContract",
            cell: "A1",
            value: "Task contract Excel patch",
            bold: true,
          },
        ],
      },
    });

    expect(wordModified.status).toBe("completed");
    expect(wordModified.operation).toBe("modify");
    expect(wordModified.kind).toBe("word");
    expect(wordModified.artifacts[0]?.fileName).toContain("-wenshu.docx");

    expect(excelModified.status).toBe("completed");
    expect(excelModified.operation).toBe("modify");
    expect(excelModified.kind).toBe("excel");
    expect(excelModified.artifacts[0]?.fileName).toContain("-wenshu.xlsx");
  });

  it("adds Word comments and tracked revisions through the review request", async () => {
    const source = await executeOfficeRuntimeTask({
      operation: "create",
      kind: "word",
      request: { type: "verification-sample" },
    });
    if (source.status !== "completed" || !source.artifacts[0]) {
      throw new Error("Failed to prepare Word review source artifact");
    }

    const artifact = source.artifacts[0];
    const reviewed = await executeOfficeRuntimeTask({
      taskId: "task-word-review",
      operation: "modify",
      kind: "word",
      input: {
        fileName: artifact.fileName,
        mimeType: artifact.mimeType,
        buffer: artifact.buffer,
      },
      request: {
        type: "review",
        author: "Mira",
        comments: [
          {
            targetText: "文枢",
            text: "这是文枢 Word Review Runtime 的批注验证。",
          },
        ],
        insertions: [
          {
            afterText: "Office Runtime",
            text: " · Review",
          },
        ],
        deletions: [
          {
            targetText: "再次读取",
          },
        ],
      },
    });

    expect(reviewed.status).toBe("completed");
    expect(reviewed.kind).toBe("word");
    expect(reviewed.artifacts).toHaveLength(1);
    if (reviewed.status !== "completed" || !reviewed.artifacts[0]) {
      throw new Error("Word review task did not return an artifact");
    }

    const archive = new AdmZip(reviewed.artifacts[0].buffer);
    const documentXml = archive.readAsText("word/document.xml");
    const commentsXml = archive.readAsText("word/comments.xml");
    const settingsXml = archive.readAsText("word/settings.xml");

    expect(documentXml).toContain("<w:commentRangeStart");
    expect(documentXml).toContain("<w:commentReference");
    expect(documentXml).toContain("<w:ins");
    expect(documentXml).toContain("<w:del");
    expect(documentXml).toContain("<w:delText");
    expect(commentsXml).toContain("Word Review Runtime");
    expect(settingsXml).toContain("<w:trackRevisions");
  });

  it("returns stable failure results instead of leaking execution exceptions", async () => {
    const unsupported = await executeOfficeRuntimeTask({
      taskId: "task-unsupported",
      operation: "inspect",
      input: {
        fileName: "legacy.doc",
        buffer: Buffer.from("not-an-ooxml-file"),
      },
    });

    expect(unsupported.status).toBe("failed");
    expect(unsupported.taskId).toBe("task-unsupported");
    if (unsupported.status === "failed") {
      expect(unsupported.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    }
    expect(unsupported.artifacts).toHaveLength(0);

    const invalidModify = await executeOfficeRuntimeTask({
      operation: "modify",
      kind: "word",
      input: {
        fileName: "empty.docx",
        buffer: Buffer.alloc(0),
      },
      request: {
        type: "append-paragraphs",
        paragraphs: [],
      },
    });

    expect(invalidModify.status).toBe("failed");
    if (invalidModify.status === "failed") {
      expect(invalidModify.error.code).toBe("INVALID_TASK_INPUT");
    }
  });
});
