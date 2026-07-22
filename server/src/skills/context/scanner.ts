import fs from "node:fs/promises";
import path from "node:path";
import { getBuiltInSkillPackage } from "../registry.js";
import type { SkillManifest } from "./types.js";

const FRONTMATTER_BOUNDARY = "---";

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

const parseFrontmatter = (raw: string) => {
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== FRONTMATTER_BOUNDARY) return {} as Record<string, string>;

  const result: Record<string, string> = {};
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (line === FRONTMATTER_BOUNDARY) break;
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && value) result[key] = stripQuotes(value);
  }
  return result;
};

const unique = <T>(values: Array<T | null | undefined>): T[] =>
  values.filter((value): value is T => value !== null && value !== undefined);

export const resolveSkillRootCandidates = () => {
  const configured = process.env.MIRA_SKILLS_ROOT?.trim();
  const entryDir = process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : null;

  return unique([
    configured ? path.resolve(configured) : null,
    entryDir ? path.join(entryDir, "skills") : null,
    path.join(process.cwd(), "src", "skills"),
    path.join(process.cwd(), "server", "src", "skills"),
  ]);
};

const isDirectory = async (target: string) => {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch {
    return false;
  }
};

export class SkillScanner {
  async scan(paths = resolveSkillRootCandidates()): Promise<SkillManifest[]> {
    const manifests: SkillManifest[] = [];
    const seen = new Set<string>();

    for (const root of paths) {
      if (!(await isDirectory(root))) continue;
      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillDir = path.join(root, entry.name);
        const skillFile = path.join(skillDir, "SKILL.md");
        let raw: string;
        try {
          raw = await fs.readFile(skillFile, "utf8");
        } catch {
          continue;
        }

        const frontmatter = parseFrontmatter(raw);
        const fallback = getBuiltInSkillPackage(entry.name);
        const id = String(frontmatter.name || fallback?.id || entry.name).trim();
        if (!id || seen.has(id)) continue;

        seen.add(id);
        manifests.push({
          id,
          name: fallback?.name ?? id,
          description:
            String(frontmatter.description || fallback?.description || "").trim() || id,
          version: String(frontmatter.version || fallback?.version || "1.0.0"),
          entry: skillFile,
          ...(fallback?.source ? { source: fallback.source } : {}),
          ...(fallback?.runtimePack
            ? { runtimeRequirements: [`${fallback.runtimePack.id}@${fallback.runtimePack.version}`] }
            : {}),
        });
      }
    }

    return manifests;
  }
}

export class SkillRegistry {
  private manifests = new Map<string, SkillManifest>();
  private loaded = false;

  constructor(private readonly scanner = new SkillScanner()) {}

  async ensureLoaded() {
    if (!this.loaded) await this.refresh();
  }

  async refresh() {
    const manifests = await this.scanner.scan();
    this.manifests.clear();
    for (const manifest of manifests) this.manifests.set(manifest.id, manifest);
    this.loaded = true;
    return this.listAvailable();
  }

  register(manifest: SkillManifest) {
    this.manifests.set(manifest.id, { ...manifest });
  }

  get(id: string, version?: string) {
    const manifest = this.manifests.get(id) ?? null;
    if (!manifest || (version && manifest.version !== version)) return null;
    return { ...manifest, runtimeRequirements: manifest.runtimeRequirements ? [...manifest.runtimeRequirements] : undefined };
  }

  listAvailable() {
    return [...this.manifests.values()].map((manifest) => ({
      ...manifest,
      runtimeRequirements: manifest.runtimeRequirements ? [...manifest.runtimeRequirements] : undefined,
    }));
  }

  invalidate() {
    this.loaded = false;
    this.manifests.clear();
  }
}

let defaultRegistry: SkillRegistry | null = null;

export const getDefaultSkillRegistry = () => {
  defaultRegistry ??= new SkillRegistry();
  return defaultRegistry;
};
