import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type {
  OfficeRuntimeArtifact,
  OfficeRuntimeTaskResult,
} from "@/microapps/office-suite/contract.js";
import type { OfficeSuiteFileKind } from "@/microapps/office-suite/index.js";
import { executeOfficeRuntimeTask } from "@/microapps/office-suite/runtime.js";
import { success } from "@/utils/index.js";
import { badRequest, routeHandler } from "@/utils/route-errors.js";

const MAX_OFFICE_FILE_BYTES = 50 * 1024 * 1024;
const OFFICE_KINDS: OfficeSuiteFileKind[] = ["word", "excel", "powerpoint"];

const requireCompleted = (
  result: OfficeRuntimeTaskResult,
  invalidMessage?: string,
) => {
  if (result.status === "completed") {
    return result;
  }

  if (
    result.error.code === "INVALID_TASK_INPUT" ||
    result.error.code === "UNSUPPORTED_FILE_TYPE"
  ) {
    throw badRequest(invalidMessage ?? result.error.message);
  }

  throw new Error(result.error.message);
};

const requireArtifact = (
  result: ReturnType<typeof requireCompleted>,
): OfficeRuntimeArtifact => {
  const artifact = result.artifacts[0];
  if (!artifact) {
    throw new Error("Office Runtime task completed without an artifact");
  }
  return artifact;
};

const sendArtifact = (
  reply: FastifyReply,
  result: ReturnType<typeof requireCompleted>,
  artifact: OfficeRuntimeArtifact,
) => {
  reply.header("Cache-Control", "no-store");
  reply.header("Content-Disposition", `attachment; filename="${artifact.fileName}"`);
  reply.header("X-Office-Contract-Version", result.contractVersion);
  reply.header("X-Office-Artifact-Kind", artifact.kind);
  reply.header("X-Office-Operation", result.operation);
  reply.header("X-Office-Task-Duration-Ms", String(result.durationMs));
  reply.type(artifact.mimeType);
  return reply.send(artifact.buffer);
};

const officeSuiteRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/microapps/office-suite/inspect",
    routeHandler("Failed to inspect Office document", async (request) => {
      const upload = await request.file({
        limits: {
          files: 1,
          fileSize: MAX_OFFICE_FILE_BYTES,
        },
      });

      if (!upload) {
        throw badRequest("请选择一个 Office 文件");
      }

      const buffer = await upload.toBuffer();
      const result = requireCompleted(
        await executeOfficeRuntimeTask({
          operation: "inspect",
          input: {
            fileName: upload.filename,
            mimeType: upload.mimetype,
            buffer,
          },
        }),
        "当前仅支持 .docx、.xlsx 和 .pptx 文件",
      );

      if (!result.inspection) {
        throw new Error("Office Runtime inspect task completed without inspection data");
      }

      return success(result.inspection, "Office document inspected");
    }),
  );

  app.post<{ Body: { kind?: OfficeSuiteFileKind } }>(
    "/microapps/office-suite/create",
    routeHandler("Failed to create Office sample", async (request, reply) => {
      const kind = request.body?.kind;
      if (!kind || !OFFICE_KINDS.includes(kind)) {
        throw badRequest("请选择要创建的 Office 文件类型");
      }

      const result = requireCompleted(
        await executeOfficeRuntimeTask({
          operation: "create",
          kind,
          request: {
            type: "verification-sample",
          },
        }),
      );

      return sendArtifact(reply, result, requireArtifact(result));
    }),
  );

  app.post(
    "/microapps/office-suite/document/verification-copy",
    routeHandler("Failed to modify Word document", async (request, reply) => {
      const upload = await request.file({
        limits: {
          files: 1,
          fileSize: MAX_OFFICE_FILE_BYTES,
        },
      });

      if (!upload) {
        throw badRequest("请选择一个 .docx 文件");
      }
      if (!upload.filename.toLowerCase().endsWith(".docx")) {
        throw badRequest("Word 修改验证当前仅支持 .docx 文件");
      }

      const buffer = await upload.toBuffer();
      const result = requireCompleted(
        await executeOfficeRuntimeTask({
          operation: "modify",
          kind: "word",
          input: {
            fileName: upload.filename,
            mimeType: upload.mimetype,
            buffer,
          },
          request: {
            type: "append-paragraphs",
            paragraphs: [
              {
                text: "文枢 Word Modify 验证",
                bold: true,
              },
              {
                text: "这段内容由 Mira 文枢追加到现有 DOCX 的新副本中，原文件未被覆盖。",
              },
            ],
          },
        }),
      );

      return sendArtifact(reply, result, requireArtifact(result));
    }),
  );

  app.post(
    "/microapps/office-suite/spreadsheet/verification-copy",
    routeHandler("Failed to modify Excel workbook", async (request, reply) => {
      const upload = await request.file({
        limits: {
          files: 1,
          fileSize: MAX_OFFICE_FILE_BYTES,
        },
      });

      if (!upload) {
        throw badRequest("请选择一个 .xlsx 文件");
      }
      if (!upload.filename.toLowerCase().endsWith(".xlsx")) {
        throw badRequest("Excel 修改验证当前仅支持 .xlsx 文件");
      }

      const buffer = await upload.toBuffer();
      const result = requireCompleted(
        await executeOfficeRuntimeTask({
          operation: "modify",
          kind: "excel",
          input: {
            fileName: upload.filename,
            mimeType: upload.mimetype,
            buffer,
          },
          request: {
            type: "patch-cells",
            patches: [
              {
                sheetName: "文枢验证",
                cell: "A1",
                value: "文枢 Excel Modify 验证",
                bold: true,
              },
              {
                sheetName: "文枢验证",
                cell: "A2",
                value: "原文件未覆盖，此工作表写入到新的 XLSX 产物。",
              },
              { sheetName: "文枢验证", cell: "A4", value: "项目", bold: true },
              { sheetName: "文枢验证", cell: "B4", value: "数量", bold: true },
              { sheetName: "文枢验证", cell: "A5", value: "Inspect" },
              { sheetName: "文枢验证", cell: "B5", value: 1 },
              { sheetName: "文枢验证", cell: "A6", value: "Create" },
              { sheetName: "文枢验证", cell: "B6", value: 1 },
              { sheetName: "文枢验证", cell: "A7", value: "Modify" },
              { sheetName: "文枢验证", cell: "B7", value: 1 },
              {
                sheetName: "文枢验证",
                cell: "B8",
                formula: "SUM(B5:B7)",
                bold: true,
                numberFormat: "0",
              },
            ],
          },
        }),
      );

      return sendArtifact(reply, result, requireArtifact(result));
    }),
  );
};

export default officeSuiteRoutes;
