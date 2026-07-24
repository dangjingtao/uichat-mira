import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getBuiltInSkillPackage } from "../registry.js";
import type { SkillManifest } from "./types.js";

const FRONTMATTER_BOUNDARY = "---";
const MAX_MANIFEST_BYTES = 16 * 1024;
const PUBLIC_VISIBILITY = "public";
const BLOCKED_VISIBILITIES = new Set(["internal", "private", "hidden"]);

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
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== FRONTMATTER_BOUNDARY) return {} as Record<string, string>;

  const result: Record<string, string> = {};
  let closed = false;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (line === FRONTMATTER_BOUNDARY) {
      closed = true;
      break;
    }
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && value) result[key] = stripQuotes(value);
  }

  return closed ? result : {};
};

const readFrontmatterWindow = async (filePath: string) => {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(MAX_MANIFEST_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
};

const unique = (values: Array<string | null | undefined>): string[] => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
];

export const resolveUserSkillsRoot = () => {
  const configured = process.env.MIRA_USER_SKILLS_ROOT?.trim();
  if (configured) return path.resolve(configured);

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA?.trim() || process.env.APPDATA?.trim();
    if (localAppData) return path.join(localAppData, "UIChat Mira", "skills");
  }

  return path.join(os.homedir(), ".local", "share", "uichat-mira", "skills");
};

export const resolveSkillRootCandidates = () => {
  const configured = process.env.MIRA_SKILLS_ROOT?.trim();
  const entryDir = process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : null;

  return unique([
    configured ? path.resolve(configured) : null,
    resolveUserSkillsRoot(),
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

const isFile = async (target: string) => {
  try {
    return (await fs.stat(target)).isFile();
  } catch {
    return false;
  }
};

const isReservedDirectory = (name: string) => name.startsWith(".") || name.startsWith("_");

const samePath = (left: string, right: string) => {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
};

type SkillCandidate = {
  directoryId: string;
  skillFile: string;
  categoryFromDirectory?: string;
  userInstalled: boolean;
  legacyFlat: boolean;
};

const readCandidateManifest = async (candidate: SkillCandidate): Promise<SkillManifest | null> => {
  let manifestWindow: string;
  try {
    manifestWindow = await readFrontmatterWindow(candidate.skillFile);
  } catch {
    return null;
  }

  const frontmatter = parseFrontmatter(manifestWindow);
  const fallback = getBuiltInSkillPackage(candidate.directoryId);
  const visibility = String(frontmatter.visibility || "").trim().toLowerCase();

  if (BLOCKED_VISIBILITIES.has(visibility)) return null;

  // Legacy source-tree public Skills predate visibility metadata. Preserve only manifests
  // that clearly carry user-facing identity + grouping fields. New source-tree Skills must
  // use canonical category/skill layout and visibility: public.
  const legacyPublicManifest = Boolean(
    candidate.legacyFlat &&
      frontmatter.id &&
      (frontmatter.displayName || frontmatter.title) &&
      frontmatter.category,
  );

  // User-installed packages are public by the explicit install action. Bundled packages
  // already registered in registry.ts are also public. Other source-tree packages must pass
  // an explicit/legacy public gate, so a helper SKILL.md cannot silently reach Agent matching.
  const publicEligible =
    candidate.userInstalled ||
    Boolean(fallback) ||
    visibility === PUBLIC_VISIBILITY ||
    legacyPublicManifest;
  if (!publicEligible) return null;

  const id = String(
    frontmatter.id || frontmatter.name || fallback?.id || candidate.directoryId,
  ).trim();
  if (!id) return null;

  return {
    id,
    name: String(
      frontmatter.displayName ||
        frontmatter.title ||
        fallback?.name ||
        frontmatter.name ||
        id,
    ).trim(),
    description:
      String(frontmatter.description || fallback?.description || "").trim() || id,
    version: String(frontmatter.version || fallback?.version || "1.0.0"),
    entry: candidate.skillFile,
    ...(frontmatter.source || fallback?.source
      ? { source: String(frontmatter.source || fallback?.source).trim() }
      : {}),
    ...(candidate.categoryFromDirectory || frontmatter.category || fallback?.category
      ? {
          category: String(
            candidate.categoryFromDirectory || frontmatter.category || fallback?.category,
          ).trim(),
        }
      : {}),
    ...(frontmatter.license ? { license: String(frontmatter.license).trim() } : {}),
    ...(fallback?.runtimePack
      ? { runtimeRequirements: [`${fallback.runtimePack.id}@${fallback.runtimePack.version}`] }
      : {}),
  };
};

/**
 * Public Skill discovery contract:
 *
 *   <root>/<category>/<skill>/SKILL.md  -> canonical public package layout
 *   <user-root>/<skill>/SKILL.md       -> legacy user-import compatibility
 *   <system-root>/<skill>/SKILL.md     -> legacy built-in / complete public-manifest compatibility only
 *
 * A directory that already contains SKILL.md is treated as a complete Skill Package and is
 * never descended into. This is the structural boundary that prevents references/scripts/
 * helper SKILL.md files from becoming independent catalog entries or Agent-matchable Skills.
 * Directories beginning with '_' or '.' are reserved/internal and are never scanned.
 */
export class SkillScanner {
  async scan(paths = resolveSkillRootCandidates()): Promise<SkillManifest[]> {
    const manifests: SkillManifest[] = [];
    const seen = new Set<string>();
    const userSkillsRoot = resolveUserSkillsRoot();

    for (const root of paths) {
      if (!(await isDirectory(root))) continue;
      const userInstalledRoot = samePath(root, userSkillsRoot);
      const entries = await fs.readdir(root, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() || isReservedDirectory(entry.name)) continue;
        const firstLevelDir = path.join(root, entry.name);
        const flatSkillFile = path.join(firstLevelDir, "SKILL.md");

        // Legacy flat package. Never descend further once a package boundary is found.
        if (await isFile(flatSkillFile)) {
          const manifest = await readCandidateManifest({
            directoryId: entry.name,
            skillFile: flatSkillFile,
            userInstalled: userInstalledRoot,
            legacyFlat: true,
          });
          if (manifest && !seen.has(manifest.id)) {
            seen.add(manifest.id);
            manifests.push(manifest);
          }
          continue;
        }

        // Canonical layout: first level is category, second level is one Skill Package.
        let skillEntries: Dirent[];
        try {
          skillEntries = await fs.readdir(firstLevelDir, { withFileTypes: true });
        } catch {
          continue;
        }

        for (const skillEntry of skillEntries) {
          if (!skillEntry.isDirectory() || isReservedDirectory(skillEntry.name)) continue;
          const skillFile = path.join(firstLevelDir, skillEntry.name, "SKILL.md");
          if (!(await isFile(skillFile))) continue;

          const manifest = await readCandidateManifest({
            directoryId: skillEntry.name,
            skillFile,
            categoryFromDirectory: entry.name,
            userInstalled: userInstalledRoot,
            legacyFlat: false,
          });
          if (!manifest || seen.has(manifest.id)) continue;
          seen.add(manifest.id);
          manifests.push(manifest);
        }
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
    return {
      ...manifest,
      runtimeRequirements: manifest.runtimeRequirements
        ? [...manifest.runtimeRequirements]
        : undefined,
    };
  }

  listAvailable() {
    return [...this.manifests.values()].map((manifest) => ({
      ...manifest,
      runtimeRequirements: manifest.runtimeRequirements
        ? [...manifest.runtimeRequirements]
        : undefined,
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