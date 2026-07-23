import fs from "node:fs";
import type { FastifyInstance } from "fastify";
import { threadService } from "@/services/thread.service.js";
import { getSkillFlowSession } from "@/skills/flow/state-store.js";
import {
  readSkillReportManifest,
  resolveSkillReportHtmlPath,
  resolveSkillReportPdfPath,
  writeSkillReportManifest,
} from "@/skills/flow/report-files.js";
import { notFound, routeHandler } from "@/utils/route-errors.js";

const ensureOwnedReportSession = async (input: {
  threadId: string;
  sessionId: string;
  userId: number;
}) => {
  const thread = threadService.getThreadSummaryById(input.threadId, input.userId);
  if (!thread) throw notFound("Thread not found");

  const manifest = await readSkillReportManifest(input.sessionId);
  if (manifest) {
    if (manifest.threadId !== input.threadId || manifest.userId !== input.userId) {
      throw notFound("Skill report not found");
    }
    return manifest;
  }

  // First access after report generation can backfill ownership from the active
  // flow. The inline report immediately performs this authenticated request, so
  // later Skill runs may replace active state without invalidating this report.
  const session = await getSkillFlowSession({
    threadId: input.threadId,
    userId: input.userId,
  });
  if (!session || session.sessionId !== input.sessionId) {
    throw notFound("Skill report not found");
  }

  const created = {
    sessionId: session.sessionId,
    threadId: session.threadId,
    userId: session.userId,
    title: "两个人的备孕全景报告",
    createdAt: new Date().toISOString(),
  };
  await writeSkillReportManifest(created);
  return created;
};

export const registerThreadSkillReportRoutes = async (app: FastifyInstance) => {
  app.get<{ Params: { id: string; sessionId: string } }>(
    "/threads/:id/skill-reports/:sessionId/html",
    routeHandler("Failed to load skill report HTML", async (request, reply) => {
      await ensureOwnedReportSession({
        threadId: request.params.id,
        sessionId: request.params.sessionId,
        userId: request.authUser!.id,
      });
      const filePath = resolveSkillReportHtmlPath(request.params.sessionId);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw notFound("Skill report HTML not found");
      }
      reply.type("text/html; charset=utf-8");
      return reply.send(fs.createReadStream(filePath));
    }),
  );

  app.get<{ Params: { id: string; sessionId: string } }>(
    "/threads/:id/skill-reports/:sessionId/pdf",
    routeHandler("Failed to load skill report PDF", async (request, reply) => {
      await ensureOwnedReportSession({
        threadId: request.params.id,
        sessionId: request.params.sessionId,
        userId: request.authUser!.id,
      });
      const filePath = resolveSkillReportPdfPath(request.params.sessionId);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw notFound("Skill report PDF not found");
      }
      reply.type("application/pdf");
      reply.header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent("两个人的备孕全景报告.pdf")}`,
      );
      return reply.send(fs.createReadStream(filePath));
    }),
  );
};
