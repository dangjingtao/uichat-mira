import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveUserSkillsRoot } from "./context/scanner.js";

const DEFAULT_CATEGORY = "内容创作";
const MAX_MANIFEST_BYTES = 32 * 1024;

const stripQuotes = (value: string) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const readFrontmatter = async (skillFile: string) => {
  const handle = await fs.open(skillFile, "r");
  try {
    const buffer = Buffer.alloc(MAX_MANIFEST_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const lines = buffer.subarray(0, bytesRead).toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
    if (lines[0]?.trim() !== "---") return {} as Record<string, string>;

    const metadata: Record<string, string> = {};
    for (let index = 1; index < lines.length; index += 1) {
      const line = lines[index]?.trim() ?? "";
      if (line === "---") return metadata;
      const separator = line.indexOf(":");
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (key && value) metadata[key] = stripQuotes(value);
    }
    return {} as Record<string, string>;
  } finally {
    await handle.close();
  }
};

const normalizeCategory = (value: string) => {
  const normalized = value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .replace(/^[._]+/, "")
    .trim();
  return normalized && normalized !== "." && normalized !== ".." ? normalized : DEFAULT_CATEGORY;
};

const isFile = async (target: string) => {
  try {
    return (await fs.stat(target)).isFile();
  } catch {
    return false;
  }
};

export type UserSkillMigrationResult = {
  migrated: Array<{ id: string; from: string; to: string }>;
  skipped: Array<{ id: string; path: string; reason: string }>;
};

/**
 * One-way compatibility migration for user packages created before the canonical
 * <category>/<skill-id>/SKILL.md layout. Only direct children of the managed user
 * Skill root are considered. The whole package directory is renamed atomically so
 * references/templates/scripts travel with the manifest.
 */
export const migrateLegacyUserSkillPackages = async (): Promise<UserSkillMigrationResult> => {
  const root = resolveUserSkillsRoot();
  const result: UserSkillMigrationResult = { migrated: [], skipped: [] };

  let entries: Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name.startsWith("_")) continue;

    const legacyDir = path.join(root, entry.name);
    const skillFile = path.join(legacyDir, "SKILL.md");
    if (!(await isFile(skillFile))) continue;

    let metadata: Record<string, string>;
    try {
      metadata = await readFrontmatter(skillFile);
    } catch (error) {
      result.skipped.push({
        id: entry.name,
        path: legacyDir,
        reason: error instanceof Error ? error.message : "Failed to read SKILL.md",
      });
      continue;
    }

    const id = String(metadata.id || metadata.name || entry.name).trim() || entry.name;
    const category = normalizeCategory(String(metadata.category || DEFAULT_CATEGORY));
    const targetDir = path.join(root, category, id);
    const targetSkillFile = path.join(targetDir, "SKILL.md");

    if (await isFile(targetSkillFile)) {
      result.skipped.push({ id, path: legacyDir, reason: `Target already exists: ${targetDir}` });
      continue;
    }

    try {
      await fs.mkdir(path.dirname(targetDir), { recursive: true });
      await fs.rename(legacyDir, targetDir);
      result.migrated.push({ id, from: legacyDir, to: targetDir });
    } catch (error) {
      result.skipped.push({
        id,
        path: legacyDir,
        reason: error instanceof Error ? error.message : "Failed to migrate Skill package",
      });
    }
  }

  return result;
};
