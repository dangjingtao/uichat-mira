import fs from "node:fs";
import type { FastifyInstance } from "fastify";
import { threadService } from "@/services/thread.service.js";
import { getSkillFlowSession } from "@/skills/flow/state-store.js";
import {
  resolveSkillReportHtmlPath,
  resolveSkillReportPdfPath,
} from "@/skills/flow/report-files.js";
import { notFound, routeHandler } from "@/utils/route-errors.js";

const ensureOwnedReportSession = async (input: {
  threadId: string;
  sessionId: string;
  userId: number;
}) => {
  const thread = threadService.getThreadSummaryById(input.threadId, input.userId);
  if (!thread) throw notFound("Thread not found");

  const session = await getSkillFlowSession({
    threadId: input.threadId,
    userId: input.userId,
  });
  if (!session || session.sessionId !== input.sessionId) {
    throw notFound("Skill report not found");
  }
  return session;
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
