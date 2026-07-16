import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import CONFIG from "@/config/index.js";
import { attachmentStorageRoot } from "@/services/attachment-storage.service.js";
import { chatMediaRepository } from "@/db/repositories/chat-media.repository.js";

const findProjectRoot = (startDir: string) => {
  let currentDir = path.resolve(startDir);

  while (true) {
    if (
      (fsSync.existsSync(path.join(currentDir, "runtime.config.cjs")) ||
        fsSync.existsSync(path.join(currentDir, "pnpm-workspace.yaml")))
    ) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return path.resolve(startDir);
    }
    currentDir = parentDir;
  }
};

const projectRoot = findProjectRoot(process.cwd());
let managedMediaRoots = {
  attachments: attachmentStorageRoot,
  generatedImages: path.resolve(process.cwd(), ".artifacts", "image-generation"),
  generatedAudio: [path.join(projectRoot, ".artifacts", "tts", "outputs")],
  generatedVideos: [path.join(projectRoot, ".artifacts", "video")],
};

type CleanupSummary = { files: number; bytes: number };

const clearDirectoryContents = async (rootDir: string, protectedPaths = new Set<string>()): Promise<CleanupSummary> => {
  let entries;
  try {
    entries = await fs.readdir(rootDir, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { files: 0, bytes: 0 };
    }
    throw error;
  }

  let files = 0;
  let bytes = 0;
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await clearDirectoryContents(entryPath, protectedPaths);
      files += nested.files;
      bytes += nested.bytes;
      const hasProtectedChild = [...protectedPaths].some((protectedPath) =>
        protectedPath.startsWith(`${path.resolve(entryPath)}${path.sep}`),
      );
      if (!hasProtectedChild) await fs.rm(entryPath, { recursive: true, force: true });
      continue;
    }

    if (protectedPaths.has(path.resolve(entryPath))) continue;

    try {
      const stats = await fs.stat(entryPath);
      bytes += stats.size;
    } catch {}
    await fs.rm(entryPath, { force: true });
    files += 1;
  }

  return { files, bytes };
};

const clearRoots = async (roots: string | string[]) => {
  const protectedPaths = new Set(
    chatMediaRepository.listAll().map((media) => path.resolve(media.absolutePath)),
  );
  const summaries = await Promise.all(
    (Array.isArray(roots) ? roots : [roots]).map((root) => clearDirectoryContents(root, protectedPaths)),
  );
  return summaries.reduce<CleanupSummary>(
    (total, summary) => ({
      files: total.files + summary.files,
      bytes: total.bytes + summary.bytes,
    }),
    { files: 0, bytes: 0 },
  );
};

export const managedMediaCleanupService = {
  configureRoots(input: { imageGenerationRoot: string; ttsRoot: string }) {
    managedMediaRoots = {
      ...managedMediaRoots,
      generatedImages: path.resolve(input.imageGenerationRoot),
      generatedAudio: [path.resolve(input.ttsRoot)],
    };
  },
  async clear() {
    const [attachments, generatedImages, generatedAudio, generatedVideos] =
      await Promise.all([
        clearRoots(managedMediaRoots.attachments),
        clearRoots(managedMediaRoots.generatedImages),
        clearRoots(managedMediaRoots.generatedAudio),
        clearRoots(managedMediaRoots.generatedVideos),
      ]);

    return {
      attachments,
      generatedImages,
      generatedAudio,
      generatedVideos,
    };
  },
};
