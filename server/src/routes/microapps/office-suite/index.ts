import type { FastifyPluginAsync } from "fastify";
import {
  inspectOfficeDocument,
  UnsupportedOfficeFileError,
  type OfficeSuiteFileKind,
} from "@/microapps/office-suite/index.js";
import { createOfficeSample } from "@/microapps/office-suite/create.js";
import { success } from "@/utils/index.js";
import { badRequest, routeHandler } from "@/utils/route-errors.js";

const MAX_OFFICE_FILE_BYTES = 50 * 1024 * 1024;
const OFFICE_KINDS: OfficeSuiteFileKind[] = ["word", "excel", "powerpoint"];

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

      try {
        return success(
          inspectOfficeDocument({
            fileName: upload.filename,
            mimeType: upload.mimetype,
            buffer,
          }),
          "Office document inspected",
        );
      } catch (error) {
        if (error instanceof UnsupportedOfficeFileError) {
          throw badRequest("当前仅支持 .docx、.xlsx 和 .pptx 文件", {
            cause: error,
          });
        }
        throw error;
      }
    }),
  );

  app.post<{ Body: { kind?: OfficeSuiteFileKind } }>(
    "/microapps/office-suite/create",
    routeHandler("Failed to create Office sample", async (request, reply) => {
      const kind = request.body?.kind;
      if (!kind || !OFFICE_KINDS.includes(kind)) {
        throw badRequest("请选择要创建的 Office 文件类型");
      }

      const artifact = await createOfficeSample(kind);
      reply.header("Cache-Control", "no-store");
      reply.header(
        "Content-Disposition",
        `attachment; filename="${artifact.fileName}"`,
      );
      reply.header("X-Office-Artifact-Kind", artifact.kind);
      reply.type(artifact.mimeType);
      return reply.send(artifact.buffer);
    }),
  );
};

export default officeSuiteRoutes;
