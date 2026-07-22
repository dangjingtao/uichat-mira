import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  LoadedSkillResource,
  SkillContent,
  SkillManifest,
  SkillResource,
  SkillResourceKind,
} from "./types.js";

const DISCLOSABLE_DIRECTORIES: Record<string, SkillResourceKind> = {
  reference: "reference",
  references: "reference",
  template: "template",
  templates: "template",
  example: "example",
  examples: "example",
  script: "script",
  scripts: "script",
};

const stripFrontmatter = (raw: string) => {
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---")) return normalized.trim();
  const match = /^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/.exec(normalized);
  return match ? normalized.slice(match[0].length).trim() : normalized.trim();
};

const toUriPath = (value: string) => value.split(path.sep).join("/");

const inferResourceKind = (relativePath: string): SkillResourceKind | null => {
  const firstSegment = relativePath.split(/[\\/]/)[0]?.toLowerCase();
  return firstSegment ? DISCLOSABLE_DIRECTORIES[firstSegment] ?? null : null;
};

const walkFiles = async (root: string, current = ""): Promise<string[]> => {
  const directory = path.join(root, current);
  let entries: Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const result: string[] = [];
  for (const entry of entries) {
    const relative = path.join(current, entry.name);
    if (entry.isDirectory()) result.push(...(await walkFiles(root, relative)));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
};

export class SkillLoader {
  private contentCache = new Map<string, SkillContent>();
  private resourceCache = new Map<string, LoadedSkillResource>();

  async loadContent(manifest: SkillManifest): Promise<SkillContent> {
    const cacheKey = `${manifest.id}@${manifest.version}`;
    const cached = this.contentCache.get(cacheKey);
    if (cached) return { manifest: { ...cached.manifest }, body: cached.body };

    const raw = await fs.readFile(manifest.entry, "utf8");
    const content: SkillContent = {
      manifest: { ...manifest },
      body: stripFrontmatter(raw),
    };
    this.contentCache.set(cacheKey, content);
    return { manifest: { ...content.manifest }, body: content.body };
  }

  async listResources(manifest: SkillManifest): Promise<SkillResource[]> {
    const skillRoot = path.dirname(manifest.entry);
    const files = await walkFiles(skillRoot);
    return files
      .map((relativePath): SkillResource | null => {
        const kind = inferResourceKind(relativePath);
        if (!kind) return null;
        const normalized = toUriPath(relativePath);
        return {
          uri: `skill://${manifest.id}/${normalized}`,
          skillId: manifest.id,
          name: path.basename(relativePath),
          kind,
        };
      })
      .filter((resource): resource is SkillResource => Boolean(resource));
  }

  async loadResource(input: {
    manifest: SkillManifest;
    resource: SkillResource;
  }): Promise<LoadedSkillResource> {
    if (input.resource.skillId !== input.manifest.id) {
      throw new Error(`Skill resource ${input.resource.uri} does not belong to ${input.manifest.id}`);
    }
    const cached = this.resourceCache.get(input.resource.uri);
    if (cached) return { ...cached };

    const prefix = `skill://${input.manifest.id}/`;
    if (!input.resource.uri.startsWith(prefix)) {
      throw new Error(`Invalid skill resource URI: ${input.resource.uri}`);
    }
    const relative = input.resource.uri.slice(prefix.length);
    const skillRoot = path.dirname(input.manifest.entry);
    const resolved = path.resolve(skillRoot, ...relative.split("/"));
    const relativeToRoot = path.relative(skillRoot, resolved);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      throw new Error(`Skill resource escapes package root: ${input.resource.uri}`);
    }

    const loaded: LoadedSkillResource = {
      ...input.resource,
      content: await fs.readFile(resolved, "utf8"),
    };
    this.resourceCache.set(input.resource.uri, loaded);
    return { ...loaded };
  }

  invalidate(skillId: string) {
    for (const key of this.contentCache.keys()) {
      if (key.startsWith(`${skillId}@`)) this.contentCache.delete(key);
    }
    for (const [uri, resource] of this.resourceCache.entries()) {
      if (resource.skillId === skillId) this.resourceCache.delete(uri);
    }
  }

  invalidateAll() {
    this.contentCache.clear();
    this.resourceCache.clear();
  }
}
