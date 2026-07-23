import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { getDefaultSkillRegistry } from "./context/scanner.js";
import { getBuiltInSkillPackage, listBuiltInSkillPackages } from "./registry.js";

const TEXT_PREVIEW_EXTENSIONS = new Set([".md", ".txt", ".json", ".yaml", ".yml"]);
const MAX_CATALOG_FILES = 100;
const MAX_PREVIEW_BYTES = 256 * 1024;

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
        if (!TEXT_PREVIEW_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) continue;
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
