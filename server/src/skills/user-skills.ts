import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveUserSkillsRoot } from "./context/scanner.js";

const MAX_IMPORTED_SKILL_BYTES = 512 * 1024;
const RESERVED_SKILL_IDS = new Set(["docx", "xlsx", "pdf", "pptx"]);

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

const parseMarkdown = (raw: string) => {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const metadata: Record<string, string> = {};
  let bodyStart = 0;

  if (lines[0]?.trim() === "---") {
    const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (closingIndex > 0) {
      for (const line of lines.slice(1, closingIndex)) {
        const separator = line.indexOf(":");
        if (separator <= 0) continue;
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim();
        if (key && value) metadata[key] = stripQuotes(value);
      }
      bodyStart = closingIndex + 1;
    }
  }

  return {
    metadata,
    body: lines.slice(bodyStart).join("\n").trim(),
  };
};

const deriveTitle = (body: string, fileName: string) => {
  const heading = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^#\s+\S/.test(line));
  if (heading) return heading.replace(/^#\s+/, "").trim();
  return path.basename(fileName, path.extname(fileName)).replace(/[-_]+/g, " ").trim() || "Imported Skill";
};

const deriveDescription = (body: string, title: string) => {
  const paragraph = body
    .split(/\n\s*\n/)
    .map((value) => value.replace(/^#+\s+/gm, "").trim())
    .find((value) => value && value !== title && !value.startsWith("```"));
  const compact = paragraph?.replace(/\s+/g, " ").trim();
  return compact ? compact.slice(0, 240) : `${title} 的可复用任务方法与执行说明。`;
};

const slugify = (value: string) => {
  const normalized = value.normalize("NFKC").toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (slug) return slug;
  const digest = createHash("sha1").update(normalized).digest("hex").slice(0, 8);
  return `skill-${digest}`;
};

const yamlValue = (value: string) => JSON.stringify(value);

const resolveAvailableSkillId = async (requested: string) => {
  const root = resolveUserSkillsRoot();
  const base = RESERVED_SKILL_IDS.has(requested) ? `user-${requested}` : requested;
  let candidate = base;
  let suffix = 2;
  while (true) {
    try {
      await fs.access(path.join(root, candidate));
      candidate = `${base}-${suffix}`;
      suffix += 1;
    } catch {
      return candidate;
    }
  }
};

export type ImportedMarkdownSkill = {
  id: string;
  name: string;
  version: string;
  source: string;
  category: string;
  description: string;
  entry: string;
  content: string;
};

export const importMarkdownSkill = async (input: {
  fileName: string;
  content: string;
}): Promise<ImportedMarkdownSkill> => {
  if (!input.fileName.toLowerCase().endsWith(".md")) {
    throw new Error("Only Markdown (.md) files can be imported as a Skill");
  }
  const bytes = Buffer.byteLength(input.content, "utf8");
  if (bytes === 0) throw new Error("Markdown file is empty");
  if (bytes > MAX_IMPORTED_SKILL_BYTES) {
    throw new Error(`Markdown Skill exceeds ${MAX_IMPORTED_SKILL_BYTES / 1024} KB limit`);
  }

  const parsed = parseMarkdown(input.content);
  const fallbackTitle = deriveTitle(parsed.body, input.fileName);
  const name = String(parsed.metadata.displayName || parsed.metadata.title || fallbackTitle).trim();
  const requestedId = slugify(parsed.metadata.id || parsed.metadata.name || name);
  const id = await resolveAvailableSkillId(requestedId);
  const version = String(parsed.metadata.version || "1.0.0").trim();
  const source = String(parsed.metadata.source || "用户导入").trim();
  const category = String(parsed.metadata.category || "内容创作").trim();
  const description = String(
    parsed.metadata.description || deriveDescription(parsed.body, name),
  ).trim();

  const preservedMetadata = Object.entries(parsed.metadata).filter(
    ([key]) => !["id", "name", "displayName", "title", "version", "source", "category", "description"].includes(key),
  );
  const frontmatter = [
    "---",
    `id: ${yamlValue(id)}`,
    `name: ${yamlValue(id)}`,
    `displayName: ${yamlValue(name)}`,
    `description: ${yamlValue(description)}`,
    `version: ${yamlValue(version)}`,
    `source: ${yamlValue(source)}`,
    `category: ${yamlValue(category)}`,
    ...preservedMetadata.map(([key, value]) => `${key}: ${yamlValue(value)}`),
    "---",
  ].join("\n");
  const content = `${frontmatter}\n\n${parsed.body || `# ${name}\n\n${description}`}\n`;

  const root = resolveUserSkillsRoot();
  const skillDir = path.join(root, id);
  await fs.mkdir(skillDir, { recursive: true });
  const entry = path.join(skillDir, "SKILL.md");
  await fs.writeFile(entry, content, "utf8");

  return { id, name, version, source, category, description, entry, content };
};
