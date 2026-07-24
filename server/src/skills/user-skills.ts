import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveUserSkillsRoot } from "./context/scanner.js";

const MAX_IMPORTED_SKILL_BYTES = 512 * 1024;
const RESERVED_SKILL_IDS = new Set(["docx", "xlsx", "pdf", "pptx"]);
const DEFAULT_CATEGORY = "内容创作";

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

const normalizeCategory = (value: string) => {
  const normalized = value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return normalized && normalized !== "." && normalized !== ".." ? normalized : DEFAULT_CATEGORY;
};

const yamlValue = (value: string) => JSON.stringify(value);

const booleanValue = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
};

const fileExists = async (target: string) => {
  try {
    return (await fs.stat(target)).isFile();
  } catch {
    return false;
  }
};

const userSkillIdExists = async (root: string, id: string) => {
  if (await fileExists(path.join(root, id, "SKILL.md"))) return true;
  let categories: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    categories = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const category of categories) {
    if (!category.isDirectory()) continue;
    if (await fileExists(path.join(root, category.name, id, "SKILL.md"))) return true;
  }
  return false;
};

const resolveAvailableSkillId = async (requested: string) => {
  const root = resolveUserSkillsRoot();
  const base = RESERVED_SKILL_IDS.has(requested) ? `user-${requested}` : requested;
  let candidate = base;
  let suffix = 2;
  while (await userSkillIdExists(root, candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

const isPathWithin = (root: string, target: string) => {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const requireUserSkillEntry = (entry: string) => {
  const root = resolveUserSkillsRoot();
  const resolvedEntry = path.resolve(entry);
  if (path.basename(resolvedEntry).toLowerCase() !== "skill.md" || !isPathWithin(root, resolvedEntry)) {
    throw new Error("Only user-installed Skill packages can be modified");
  }
  return resolvedEntry;
};

const buildSkillMarkdown = (input: {
  id: string;
  name: string;
  version: string;
  source: string;
  category: string;
  description: string;
  featured: boolean;
  body: string;
  preservedMetadata?: Array<[string, string]>;
}) => {
  const frontmatter = [
    "---",
    `id: ${yamlValue(input.id)}`,
    `name: ${yamlValue(input.id)}`,
    `displayName: ${yamlValue(input.name)}`,
    `description: ${yamlValue(input.description)}`,
    `version: ${yamlValue(input.version)}`,
    `source: ${yamlValue(input.source)}`,
    `category: ${yamlValue(input.category)}`,
    "visibility: public",
    ...(input.featured ? ["featured: true"] : []),
    ...(input.preservedMetadata ?? []).map(([key, value]) => `${key}: ${yamlValue(value)}`),
    "---",
  ].join("\n");
  return `${frontmatter}\n\n${input.body || `# ${input.name}\n\n${input.description}`}\n`;
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
  featured?: boolean;
};

export type UpdateUserSkillInput = {
  name?: string;
  version?: string;
  source?: string;
  category?: string;
  description?: string;
  featured?: boolean;
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
  const category = normalizeCategory(String(parsed.metadata.category || DEFAULT_CATEGORY));
  const description = String(
    parsed.metadata.description || deriveDescription(parsed.body, name),
  ).trim();
  const featured = booleanValue(parsed.metadata.featured);

  const preservedMetadata = Object.entries(parsed.metadata).filter(
    ([key]) =>
      ![
        "id",
        "name",
        "displayName",
        "title",
        "version",
        "source",
        "category",
        "description",
        "visibility",
        "featured",
      ].includes(key),
  );
  const content = buildSkillMarkdown({
    id,
    name,
    version,
    source,
    category,
    description,
    featured,
    body: parsed.body,
    preservedMetadata,
  });

  const root = resolveUserSkillsRoot();
  const skillDir = path.join(root, category, id);
  await fs.mkdir(skillDir, { recursive: true });
  const entry = path.join(skillDir, "SKILL.md");
  await fs.writeFile(entry, content, "utf8");

  return { id, name, version, source, category, description, entry, content, featured };
};

export const updateUserSkill = async (
  entry: string,
  input: UpdateUserSkillInput,
): Promise<ImportedMarkdownSkill> => {
  const resolvedEntry = requireUserSkillEntry(entry);
  const raw = await fs.readFile(resolvedEntry, "utf8");
  const parsed = parseMarkdown(raw);
  const id = String(parsed.metadata.id || parsed.metadata.name || path.basename(path.dirname(resolvedEntry))).trim();
  const currentName = String(parsed.metadata.displayName || parsed.metadata.title || deriveTitle(parsed.body, "SKILL.md")).trim();
  const name = input.name?.trim() || currentName;
  const version = input.version?.trim() || String(parsed.metadata.version || "1.0.0").trim();
  const source = input.source?.trim() || String(parsed.metadata.source || "用户导入").trim();
  const category = normalizeCategory(
    input.category?.trim() || String(parsed.metadata.category || DEFAULT_CATEGORY),
  );
  const description = input.description?.trim() || String(
    parsed.metadata.description || deriveDescription(parsed.body, name),
  ).trim();
  const featured = input.featured ?? booleanValue(parsed.metadata.featured);
  const preservedMetadata = Object.entries(parsed.metadata).filter(
    ([key]) =>
      ![
        "id",
        "name",
        "displayName",
        "title",
        "version",
        "source",
        "category",
        "description",
        "visibility",
        "featured",
      ].includes(key),
  );
  const content = buildSkillMarkdown({
    id,
    name,
    version,
    source,
    category,
    description,
    featured,
    body: parsed.body,
    preservedMetadata,
  });

  const root = resolveUserSkillsRoot();
  const currentSkillDir = path.dirname(resolvedEntry);
  const targetSkillDir = path.join(root, category, id);
  let targetEntry = resolvedEntry;

  if (path.resolve(currentSkillDir) !== path.resolve(targetSkillDir)) {
    if (await fileExists(path.join(targetSkillDir, "SKILL.md"))) {
      throw new Error(`A Skill package already exists at category ${category}: ${id}`);
    }
    await fs.mkdir(path.dirname(targetSkillDir), { recursive: true });
    await fs.rename(currentSkillDir, targetSkillDir);
    targetEntry = path.join(targetSkillDir, "SKILL.md");
  }

  await fs.writeFile(targetEntry, content, "utf8");
  return {
    id,
    name,
    version,
    source,
    category,
    description,
    entry: targetEntry,
    content,
    featured,
  };
};

export const deleteUserSkill = async (entry: string) => {
  const resolvedEntry = requireUserSkillEntry(entry);
  const skillDir = path.dirname(resolvedEntry);
  await fs.rm(skillDir, { recursive: true, force: true });
};