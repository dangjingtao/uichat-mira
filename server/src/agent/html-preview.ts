import fs from "node:fs";
import path from "node:path";
import { resolveSkillReportHtmlPath } from "@/skills/flow/report-files.js";
import { agentRunStore } from "./run-store.js";
import type { AgentObservation } from "./types.js";

const WECHAT_LAYOUT_SKILL_ID = "wechat-article-layout";
const WECHAT_LAYOUT_OUTPUT_FILE = "article-wechat.html";
const MAX_INLINE_HTML_BYTES = 5 * 1024 * 1024;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const isWechatLayoutObservation = (observation: AgentObservation) => {
  const data = observation.summary?.data;
  if (!data || data.kind !== "generic_structured") return false;
  const preview = asRecord(data.preview);
  return preview?.skillId === WECHAT_LAYOUT_SKILL_ID;
};

const resolveAgentMetadata = (metadata: Record<string, unknown> | undefined) =>
  asRecord(metadata?.agent);

const appendMarker = (content: string, marker: string) =>
  content.includes(marker) ? content : `${content.trimEnd()}\n\n${marker}`.trim();

export const prepareAgentHtmlPreview = (input: {
  content: string;
  metadata?: Record<string, unknown>;
}) => {
  const agent = resolveAgentMetadata(input.metadata);
  const runId = typeof agent?.runId === "string" ? agent.runId.trim() : "";
  if (agent?.status !== "completed" || !runId) return input.content;

  const run = agentRunStore.get(runId);
  const workspaceRoot = run?.runtimeInput?.workspaceRoot?.trim();
  if (!run || !workspaceRoot) return input.content;
  if (!run.observations.some(isWechatLayoutObservation)) return input.content;

  const sourcePath = path.join(workspaceRoot, WECHAT_LAYOUT_OUTPUT_FILE);
  try {
    const stat = fs.statSync(sourcePath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_INLINE_HTML_BYTES) {
      return input.content;
    }

    const targetPath = resolveSkillReportHtmlPath(runId);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);

    return appendMarker(
      input.content,
      `<!--mira-skill-report:${runId}:html:${WECHAT_LAYOUT_SKILL_ID}-->`,
    );
  } catch {
    // Preview is an optional presentation enhancement. It must never block the
    // completed Skill answer or replace the original HTML artifact.
    return input.content;
  }
};
