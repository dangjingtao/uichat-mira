import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { getDefaultSkillRegistry, resolveUserSkillsRoot } from "./context/scanner.js";
import { getBuiltInSkillPackage, listBuiltInSkillPackages } from "./registry.js";
import type { SkillManifest } from "./context/types.js";

const LEGACY_TEXT_PREVIEW_EXTENSIONS = new Set([".md", ".txt", ".json", ".yaml", ".yml"]);
const TEXT_FILE_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".html",
  ".css",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".sh",
  ".ps1",
  ".sql",
  ".csv",
]);
const MAX_CATALOG_FILES = 200;
const MAX_PREVIEW_BYTES = 256 * 1024;
const MAX_FILE_CONTENT_BYTES = 512 * 1024;
const MAX_FRONTMATTER_BYTES = 32 * 1024;

export type SkillPackageOrigin = "built-in" | "user" | "external";
export type SkillPackageStatus = "bundled" | "installed";
export type SkillFileKind =
  | "entry"
  | "reference"
  | "template"
  | "example"
  | "script"
  | "runtime"
  | "license"
  | "other";

export type SkillCatalogSummary = {
  id: string;
  version: string;
  name: string;
  source: string;
  category: string;
  description: string;
  origin: SkillPackageOrigin;
  packageStatus: SkillPackageStatus;
  featured: boolean;
  license?: string;
  runtimeRequirements: string[];
};

export type SkillFileDescriptor = {
  path: string;
  name: string;
  kind: SkillFileKind;
  extension: string;
  mimeType: string;
  size: number | null;
  previewable: boolean;
  contentAvailable: boolean;
  declaredOnly: boolean;
};

export type SkillCatalogDetail = SkillCatalogSummary & {
  files: SkillFileDescriptor[];
};

export type SkillFileContent = {
  path: string;
  mimeType: string;
  size: number;
  content: string;
  truncated: boolean;
};

const listRelativeFiles = async (root: string) => {
  const files: string[] = [];
  const walk = async (dir: string) => {
    if (files.length >= MAX_CATALOG_FILES) return;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= MAX_CATALOG_FILES) break;
      if (entry.name.startsWith(".")) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  };
  await walk(root);
  return files;
};

const readTextPreview = async (filePath: string) => {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > MAX_PREVIEW_BYTES) return undefined;
    return await fs.readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
};

const readFrontmatterMetadata = async (filePath: string) => {
  try {
    const handle = await fs.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(MAX_FRONTMATTER_BYTES);
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
        let value = line.slice(separator + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (key && value) metadata[key] = value;
      }
      return {} as Record<string, string>;
    } finally {
      await handle.close();
    }
  } catch {
    return {} as Record<string, string>;
  }
};

const deferredStatefulRuntime = () => ({
  status: "deferred" as const,
  reason:
    "Base SkillContext is active; Stateful Skill Runtime is optional and only needed for workflows that require lifecycle/state/reducer contracts.",
  requiredContracts: [
    "SkillDefinition version binding",
    "SkillInstance state/stage",
    "Evidence-driven reducer",
    "stage-specific tool constraints",
    "completion criteria evaluation",
  ],
});

const isPathWithin = (root: string, target: string) => {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const parseBoolean = (value: string | undefined) =>
  Boolean(value && ["true", "1", "yes", "on"].includes(value.trim().toLowerCase()));

const resolveOrigin = (manifest: SkillManifest): SkillPackageOrigin => {
  if (getBuiltInSkillPackage(manifest.id)) return "built-in";
  return isPathWithin(resolveUserSkillsRoot(), manifest.entry) ? "user" : "external";
};

const toSummary = async (manifest: SkillManifest): Promise<SkillCatalogSummary> => {
  const builtIn = getBuiltInSkillPackage(manifest.id);
  const metadata = builtIn?.featured ? {} : await readFrontmatterMetadata(manifest.entry);
  return {
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    source: manifest.source || builtIn?.source || "Mira",
    category: manifest.category || builtIn?.category || "其他",
    description: manifest.description,
    origin: resolveOrigin(manifest),
    packageStatus: builtIn?.bundled ? "bundled" : "installed",
    featured: builtIn?.featured ?? parseBoolean(metadata.featured),
    ...(manifest.license || builtIn?.license ? { license: manifest.license || builtIn?.license } : {}),
    runtimeRequirements: manifest.runtimeRequirements
      ? [...manifest.runtimeRequirements]
      : builtIn?.runtimePack
        ? [`${builtIn.runtimePack.id}@${builtIn.runtimePack.version}`]
        : [],
  };
};

const mimeTypeFor = (relativePath: string) => {
  const extension = path.extname(relativePath).toLowerCase();
  if (extension === ".md") return "text/markdown";
  if ([".json"].includes(extension)) return "application/json";
  if ([".yaml", ".yml"].includes(extension)) return "application/yaml";
  if (extension === ".xml") return "application/xml";
  if (extension === ".html") return "text/html";
  if (extension === ".css") return "text/css";
  if ([".js", ".jsx"].includes(extension)) return "text/javascript";
  if ([".ts", ".tsx"].includes(extension)) return "text/typescript";
  if (extension === ".py") return "text/x-python";
  if (extension === ".csv") return "text/csv";
  return TEXT_FILE_EXTENSIONS.has(extension) ? "text/plain" : "application/octet-stream";
};

const kindFor = (relativePath: string): SkillFileKind => {
  const normalized = relativePath.toLowerCase();
  if (normalized === "skill.md") return "entry";
  if (normalized.includes("license")) return "license";
  const first = normalized.split("/")[0];
  if (first === "reference" || first === "references") return "reference";
  if (first === "template" || first === "templates") return "template";
  if (first === "example" || first === "examples") return "example";
  if (first === "script" || first === "scripts") return "script";
  if (first === "runtime") return "runtime";
  const extension = path.extname(normalized);
  if ([".py", ".js", ".jsx", ".ts", ".tsx", ".sh", ".ps1"].includes(extension)) return "script";
  return "other";
};

const inspectFile = async (root: string, relativePath: string): Promise<SkillFileDescriptor> => {
  const normalized = relativePath.split("\\").join("/");
  const absolute = path.resolve(root, normalized);
  const extension = path.extname(normalized).toLowerCase();
  let size: number | null = null;
  let exists = false;
  if (isPathWithin(root, absolute)) {
    try {
      const stat = await fs.stat(absolute);
      if (stat.isFile()) {
        size = stat.size;
        exists = true;
      }
    } catch {
      // Declared package files may point at an execution implementation that is not embedded in the Skill package.
    }
  }
  const previewable = TEXT_FILE_EXTENSIONS.has(extension) || normalized.toLowerCase() === "skill.md";
  return {
    path: normalized,
    name: path.posix.basename(normalized),
    kind: kindFor(normalized),
    extension,
    mimeType: mimeTypeFor(normalized),
    size,
    previewable,
    contentAvailable: exists && previewable,
    declaredOnly: !exists,
  };
};

const getManifest = async (id: string) => {
  const registry = getDefaultSkillRegistry();
  await registry.refresh();
  return registry.get(id);
};

export const listSkillCatalogSummaries = async (): Promise<SkillCatalogSummary[]> => {
  const registry = getDefaultSkillRegistry();
  const manifests = await registry.refresh();
  return await Promise.all(manifests.map((manifest) => toSummary(manifest)));
};

export const getSkillCatalogDetail = async (id: string): Promise<SkillCatalogDetail | null> => {
  const manifest = await getManifest(id);
  if (!manifest) return null;
  const summary = await toSummary(manifest);
  const root = path.dirname(manifest.entry);
  const discoveredFiles = await listRelativeFiles(root);
  const declaredFiles = getBuiltInSkillPackage(id)?.packageFiles ?? [];
  const filePaths = [...new Set(["SKILL.md", ...declaredFiles, ...discoveredFiles])];
  const files = await Promise.all(filePaths.map((relativePath) => inspectFile(root, relativePath)));
  return { ...summary, files };
};

export const getSkillCatalogFileContent = async (
  id: string,
  relativePath: string,
): Promise<SkillFileContent | null> => {
  const manifest = await getManifest(id);
  if (!manifest) return null;
  const root = path.dirname(manifest.entry);
  const normalized = relativePath.replace(/^\/+/, "").split("\\").join("/");
  if (!normalized || normalized.split("/").some((segment) => segment === "..")) return null;
  const absolute = path.resolve(root, normalized);
  if (!isPathWithin(root, absolute)) return null;
  const extension = path.extname(normalized).toLowerCase();
  if (!(TEXT_FILE_EXTENSIONS.has(extension) || normalized.toLowerCase() === "skill.md")) return null;
  try {
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) return null;
    const readLength = Math.min(stat.size, MAX_FILE_CONTENT_BYTES);
    const handle = await fs.open(absolute, "r");
    try {
      const buffer = Buffer.alloc(readLength);
      const { bytesRead } = await handle.read(buffer, 0, readLength, 0);
      return {
        path: normalized,
        mimeType: mimeTypeFor(normalized),
        size: stat.size,
        content: buffer.subarray(0, bytesRead).toString("utf8"),
        truncated: stat.size > MAX_FILE_CONTENT_BYTES,
      };
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
};

/**
 * Legacy WenShu workbench catalog payload.
 *
 * Keep this while dev callers migrate to the canonical /skills API. New UI code
 * must use listSkillCatalogSummaries/getSkillCatalogDetail/file content instead,
 * so list rendering never pulls every package file into one response.
 */
export const listSkillCatalogPackages = async () => {
  const registry = getDefaultSkillRegistry();
  const manifests = await registry.refresh();
  const builtIns = new Map(listBuiltInSkillPackages().map((definition) => [definition.id, definition]));

  return await Promise.all(
    manifests.map(async (manifest) => {
      const builtIn = builtIns.get(manifest.id) ?? getBuiltInSkillPackage(manifest.id);
      const root = path.dirname(manifest.entry);
      const discoveredFiles = await listRelativeFiles(root);
      const packageFiles = builtIn?.packageFiles?.length
        ? [...builtIn.packageFiles]
        : discoveredFiles.length
          ? discoveredFiles
          : ["SKILL.md"];
      const content = await readTextPreview(manifest.entry);
      const fileContents: Record<string, string> = {};
      for (const relativePath of discoveredFiles) {
        if (relativePath === "SKILL.md") continue;
        if (!LEGACY_TEXT_PREVIEW_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) continue;
        const preview = await readTextPreview(path.join(root, relativePath));
        if (preview !== undefined) fileContents[relativePath] = preview;
      }

      if (builtIn) {
        return {
          ...builtIn,
          name: manifest.name || builtIn.name,
          description: manifest.description || builtIn.description,
          source: manifest.source || builtIn.source,
          category: manifest.category || builtIn.category,
          ...(content ? { content } : {}),
          fileContents,
        };
      }

      return {
        id: manifest.id,
        version: manifest.version,
        name: manifest.name,
        source: manifest.source || "Mira",
        category: manifest.category || "内容创作",
        description: manifest.description,
        bundled: true,
        runtimeCapabilities: [] as string[],
        packageFiles,
        ...(content ? { content } : {}),
        fileContents,
        contextIntegration: {
          status: "ready" as const,
          mode: "progressive-disclosure" as const,
        },
        statefulRuntime: deferredStatefulRuntime(),
      };
    }),
  );
};
