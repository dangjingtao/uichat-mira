import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type {
  OfficeRuntimeArtifact,
  OfficeRuntimeTaskResult,
  OfficeRuntimeWordReviewRequest,
} from "@/microapps/office-suite/contract.js";
import { DOCUMENT_VERIFICATION_PARAGRAPHS } from "@/microapps/office-suite/document.js";
import type { OfficeSuiteFileKind } from "@/microapps/office-suite/index.js";
import { executeOfficeRuntimeTask } from "@/microapps/office-suite/runtime.js";
import { SPREADSHEET_VERIFICATION_PATCHES } from "@/microapps/office-suite/spreadsheet.js";
import { success } from "@/utils/index.js";
import { badRequest, routeHandler } from "@/utils/route-errors.js";

const MAX_OFFICE_FILE_BYTES = 50 * 1024 * 1024;
const OFFICE_KINDS: OfficeSuiteFileKind[] = ["word", "excel", "powerpoint"];

type WordReviewQuery = {
  author?: string;
  commentTarget?: string;
  commentText?: string;
  insertAfter?: string;
  insertText?: string;
  deleteTarget?: string;
};

const requireCompleted = (
  result: OfficeRuntimeTaskResult,
  unsupportedMessage?: string,
) => {
  if (result.status === "completed") {
    return result;
  }

  if (result.error.code === "UNSUPPORTED_FILE_TYPE") {
    throw badRequest(unsupportedMessage ?? result.error.message);
  }
  if (result.error.code === "INVALID_TASK_INPUT") {
    throw badRequest(result.error.message);
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

const buildWordReviewRequest = (query: WordReviewQuery): OfficeRuntimeWordReviewRequest => {
  const request: OfficeRuntimeWordReviewRequest = {
    type: "review",
    author: query.author?.trim() || undefined,
  };

  const commentTarget = query.commentTarget?.trim();
  const commentText = query.commentText?.trim();
  if (commentTarget || commentText) {
    if (!commentTarget || !commentText) {
      throw badRequest("批注需要同时提供 commentTarget 和 commentText");
    }
    request.comments = [{ targetText: commentTarget, text: commentText }];
  }

  const insertAfter = query.insertAfter?.trim();
  const insertText = query.insertText;
  if (insertAfter || insertText) {
    if (!insertAfter || !insertText) {
      throw badRequest("修订插入需要同时提供 insertAfter 和 insertText");
    }
    request.insertions = [{ afterText: insertAfter, text: insertText }];
  }

  const deleteTarget = query.deleteTarget?.trim();
  if (deleteTarget) {
    request.deletions = [{ targetText: deleteTarget }];
  }

  if (!request.comments?.length && !request.insertions?.length && !request.deletions?.length) {
    throw badRequest("至少提供一项批注、修订插入或修订删除操作");
  }

  return request;
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
      if (buffer.byteLength === 0) {
        throw badRequest("文件内容为空");
      }

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
    routeHandler<{ Body: { kind?: OfficeSuiteFileKind } }>("Failed to create Office sample", async (request, reply) => {
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
      if (buffer.byteLength === 0) {
        throw badRequest("文件内容为空");
      }

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
            paragraphs: DOCUMENT_VERIFICATION_PARAGRAPHS,
          },
        }),
      );

      return sendArtifact(reply, result, requireArtifact(result));
    }),
  );

  app.post<{ Querystring: WordReviewQuery }>(
    "/microapps/office-suite/document/review-copy",
    routeHandler<{ Querystring: WordReviewQuery }>(
      "Failed to review Word document",
      async (request, reply) => {
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
          throw badRequest("Word 审阅当前仅支持 .docx 文件");
        }

        const buffer = await upload.toBuffer();
        if (buffer.byteLength === 0) {
          throw badRequest("文件内容为空");
        }

        const result = requireCompleted(
          await executeOfficeRuntimeTask({
            operation: "modify",
            kind: "word",
            input: {
              fileName: upload.filename,
              mimeType: upload.mimetype,
              buffer,
            },
            request: buildWordReviewRequest(request.query),
          }),
        );

        return sendArtifact(reply, result, requireArtifact(result));
      },
    ),
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
      if (buffer.byteLength === 0) {
        throw badRequest("文件内容为空");
      }

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
            patches: SPREADSHEET_VERIFICATION_PATCHES,
          },
        }),
      );

      return sendArtifact(reply, result, requireArtifact(result));
    }),
  );
};

export default officeSuiteRoutes;
