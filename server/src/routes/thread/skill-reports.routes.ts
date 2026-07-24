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

type SkillReportRoute = {
  Params: {
    id: string;
    sessionId: string;
  };
};

const hasPersistedReportMarker = (input: {
  threadId: string;
  sessionId: string;
  userId: number;
}) => {
  const markerPrefix = `<!--mira-skill-report:${input.sessionId}:`;
  return threadService
    .getMessages(input.threadId, input.userId)
    .some((message) =>
      message.role === "assistant" && message.content.includes(markerPrefix),
    );
};

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

  const session = await getSkillFlowSession({
    threadId: input.threadId,
    userId: input.userId,
  });
  const activeSessionOwnsReport = session?.sessionId === input.sessionId;
  const persistedMessageOwnsReport = hasPersistedReportMarker(input);

  if (!activeSessionOwnsReport && !persistedMessageOwnsReport) {
    throw notFound("Skill report not found");
  }

  const created = {
    sessionId: input.sessionId,
    threadId: input.threadId,
    userId: input.userId,
    title: "两个人的备孕全景报告",
    createdAt: new Date().toISOString(),
  };
  await writeSkillReportManifest(created);
  return created;
};

export const registerThreadSkillReportRoutes = async (app: FastifyInstance) => {
  app.get<SkillReportRoute>(
    "/threads/:id/skill-reports/:sessionId/html",
    routeHandler<SkillReportRoute>(
      "Failed to load skill report HTML",
      async (request, reply) => {
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
      },
    ),
  );

  app.get<SkillReportRoute>(
    "/threads/:id/skill-reports/:sessionId/pdf",
    routeHandler<SkillReportRoute>(
      "Failed to load skill report PDF",
      async (request, reply) => {
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
      },
    ),
  );
};
