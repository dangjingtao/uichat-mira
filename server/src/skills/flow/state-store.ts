import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveUserSkillsRoot } from "../context/scanner.js";
import type { StoredSkillFlowSession } from "./types.js";

const resolveSkillFlowStateRoot = () => {
  const configured = process.env.MIRA_SKILL_FLOW_STATE_ROOT?.trim();
  if (configured) return path.resolve(configured);
  return path.join(path.dirname(resolveUserSkillsRoot()), "skill-flow-state");
};

const toThreadStateFile = (threadId: string, userId: number) => {
  const digest = createHash("sha256")
    .update(`${userId}:${threadId}`)
    .digest("hex");
  return path.join(resolveSkillFlowStateRoot(), `${digest}.json`);
};

const readJson = async (filePath: string) => {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

export const getSkillFlowSession = async (input: {
  threadId: string;
  userId: number;
}): Promise<StoredSkillFlowSession | null> => {
  const value = await readJson(toThreadStateFile(input.threadId, input.userId));
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as StoredSkillFlowSession;
};

export const saveSkillFlowSession = async (session: StoredSkillFlowSession) => {
  const filePath = toThreadStateFile(session.threadId, session.userId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
  return filePath;
};

export const clearSkillFlowSession = async (input: {
  threadId: string;
  userId: number;
}) => {
  try {
    await fs.unlink(toThreadStateFile(input.threadId, input.userId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};

export const toSkillFlowStateRef = (session: StoredSkillFlowSession) =>
  `skill-flow:${session.sessionId}`;
