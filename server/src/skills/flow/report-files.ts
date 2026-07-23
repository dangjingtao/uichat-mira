import fs from "node:fs/promises";
import path from "node:path";
import { resolveSkillFlowStateRoot } from "./state-store.js";

const SAFE_SESSION_ID = /^[a-zA-Z0-9_-]{8,128}$/;

const requireSafeSessionId = (sessionId: string) => {
  const normalized = sessionId.trim();
  if (!SAFE_SESSION_ID.test(normalized)) {
    throw new Error("Invalid Skill report session id");
  }
  return normalized;
};

export const resolveSkillReportRoot = () =>
  path.join(resolveSkillFlowStateRoot(), "reports");

export const resolveSkillReportHtmlPath = (sessionId: string) =>
  path.join(resolveSkillReportRoot(), `${requireSafeSessionId(sessionId)}.html`);

export const resolveSkillReportPdfPath = (sessionId: string) =>
  path.join(resolveSkillReportRoot(), `${requireSafeSessionId(sessionId)}.pdf`);

export const writeSkillReportHtml = async (sessionId: string, html: string) => {
  const outputPath = resolveSkillReportHtmlPath(sessionId);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, html, "utf8");
  return outputPath;
};

export const hasSkillReportPdf = async (sessionId: string) => {
  try {
    return (await fs.stat(resolveSkillReportPdfPath(sessionId))).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};
