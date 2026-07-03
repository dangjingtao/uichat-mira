import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { LocalModelManifest, LocalModelManifestEntry } from "./types.js";

interface ResolvedLocalModelResources {
  manifest: LocalModelManifest;
  rawRoot: string;
}

const resolveOptionalPath = (envName: string) => {
  const value = process.env[envName]?.trim();
  return value ? path.resolve(value) : "";
};

const resolveRequiredPath = (envName: string) => {
  const value = resolveOptionalPath(envName);
  if (!value) {
    throw new Error(
      `${envName} is not set. Local model runtime requires an explicit model resource path.`,
    );
  }
  return value;
};

const loadJson = async <T>(filePath: string): Promise<T> =>
  JSON.parse(await fs.readFile(filePath, "utf8")) as T;

const RAW_MODEL_SPECS = [
  {
    id: "multilingual-e5-small",
    family: "embedding" as const,
    source: "Xenova/multilingual-e5-small",
    dimensions: 384,
    path: "embedding/multilingual-e5-small",
    files: [
      "config.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "special_tokens_map.json",
      "sentencepiece.bpe.model",
      "onnx/model_quantized.onnx",
    ],
  },
  {
    id: "ms-marco-MiniLM-L-6-v2",
    family: "rerank" as const,
    source: "Xenova/ms-marco-MiniLM-L-6-v2",
    dimensions: null,
    path: "rerank/ms-marco-MiniLM-L-6-v2",
    files: [
      "config.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "special_tokens_map.json",
      "vocab.txt",
      "onnx/model_quantized.onnx",
    ],
  },
];

const sha256File = async (filePath: string) => {
  const hash = crypto.createHash("sha256");
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
};

const synthesizeManifestFromRawRoot = async (
  rawRoot: string,
): Promise<LocalModelManifest> => {
  const models: LocalModelManifestEntry[] = [];

  for (const spec of RAW_MODEL_SPECS) {
    const modelRoot = path.join(rawRoot, spec.path);
    if (!fsSync.existsSync(modelRoot)) {
      continue;
    }

    const missingFiles = spec.files.filter(
      (filePath) => !fsSync.existsSync(path.join(modelRoot, filePath)),
    );
    if (missingFiles.length > 0) {
      throw new Error(
        `Incomplete local ${spec.family} model "${spec.id}" under ${modelRoot}. Missing: ${missingFiles.join(", ")}`,
      );
    }

    const files = await Promise.all(
      spec.files.map(async (filePath) => {
        const absolutePath = path.join(modelRoot, filePath);
        const stat = await fs.stat(absolutePath);
        return {
          path: filePath,
          bytes: stat.size,
          sha256: await sha256File(absolutePath),
        };
      }),
    );

    models.push({
      id: spec.id,
      family: spec.family,
      source: spec.source,
      runtime: "onnxruntime-web/wasm",
      dimensions: spec.dimensions,
      path: spec.path,
      files,
      totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    });
  }

  if (models.length === 0) {
    throw new Error(
      `No local models were found under ${rawRoot}. Expected raw directories like embedding/multilingual-e5-small or rerank/ms-marco-MiniLM-L-6-v2.`,
    );
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    runtime: {
      default: "onnxruntime-web/wasm",
      native: "optional",
    },
    models,
  };
};

const verifyModelFiles = async (rawRoot: string, model: LocalModelManifestEntry) => {
  for (const file of model.files) {
    const filePath = path.join(rawRoot, model.path, file.path);
    const stat = await fs.stat(filePath);
    if (stat.size !== file.bytes) {
      throw new Error(`Invalid local model file size: ${filePath}`);
    }
    const checksum = await sha256File(filePath);
    if (checksum !== file.sha256) {
      throw new Error(`Invalid local model file checksum: ${filePath}`);
    }
  }
};

const readOctal = (buffer: Buffer, offset: number, length: number) => {
  const value = buffer
    .subarray(offset, offset + length)
    .toString("ascii")
    .replace(/\0.*$/, "")
    .trim();
  return value ? Number.parseInt(value, 8) : 0;
};

const assertSafeTarPath = (entryName: string) => {
  const normalized = path.normalize(entryName).replaceAll("\\", "/");
  if (
    !entryName ||
    path.isAbsolute(entryName) ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new Error(`Unsafe local model archive entry: ${entryName}`);
  }
  return normalized;
};

const extractTarBuffer = async (tar: Buffer, destinationDir: string) => {
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    offset += 512;

    if (header.every((byte) => byte === 0)) {
      break;
    }

    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const type = header.subarray(156, 157).toString("ascii");
    const size = readOctal(header, 124, 12);
    const safeName = assertSafeTarPath(name);
    const destinationPath = path.join(destinationDir, safeName);

    if (type === "0" || type === "\0" || type === "") {
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.writeFile(destinationPath, tar.subarray(offset, offset + size));
    } else if (type === "5") {
      await fs.mkdir(destinationPath, { recursive: true });
    } else {
      throw new Error(`Unsupported local model archive entry type: ${type}`);
    }

    offset += size;
    offset += (512 - (size % 512)) % 512;
  }
};

const extractModelArchive = async (
  resourceRoot: string,
  userRawRoot: string,
  model: LocalModelManifestEntry,
) => {
  const archive = model.archive;
  if (!archive) {
    throw new Error(`Local model ${model.id} has no archive field`);
  }

  const archivePath = path.join(resourceRoot, archive);
  const readyPath = path.join(userRawRoot, model.path, ".ready");
  if (fsSync.existsSync(readyPath)) {
    await verifyModelFiles(userRawRoot, model);
    return;
  }

  const targetDir = path.join(userRawRoot, model.path);
  const tempDir = `${targetDir}.tmp`;
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(tempDir, { recursive: true });

  const compressed = await fs.readFile(archivePath);
  if (model.archiveSha256) {
    const checksum = crypto.createHash("sha256").update(compressed).digest("hex");
    if (checksum !== model.archiveSha256) {
      throw new Error(`Invalid local model archive checksum: ${archivePath}`);
    }
  }

  const tar = zlib.brotliDecompressSync(compressed);
  await extractTarBuffer(tar, tempDir);
  await verifyModelFiles(path.dirname(tempDir), {
    ...model,
    path: path.basename(tempDir),
  });

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.rename(tempDir, targetDir);
  await fs.writeFile(readyPath, new Date().toISOString());
};

let resolvedResourcesPromise: Promise<ResolvedLocalModelResources> | null = null;

export const resolveLocalModelResources = async (): Promise<ResolvedLocalModelResources> => {
  resolvedResourcesPromise ??= (async () => {
    const rawRoot = resolveOptionalPath("LOCAL_MODEL_RAW_ROOT");
    const resourceRoot = resolveOptionalPath("LOCAL_MODEL_RESOURCE_ROOT");
    const rawManifestPath = rawRoot ? path.join(rawRoot, "manifest.json") : "";

    if (rawRoot && fsSync.existsSync(rawManifestPath)) {
      const manifest = await loadJson<LocalModelManifest>(rawManifestPath);
      return { manifest, rawRoot };
    }

    if (rawRoot && !resourceRoot) {
      return {
        manifest: await synthesizeManifestFromRawRoot(rawRoot),
        rawRoot,
      };
    }

    if (!resourceRoot) {
      resolveRequiredPath("LOCAL_MODEL_RAW_ROOT");
    }

    const manifest = await loadJson<LocalModelManifest>(
      path.join(resourceRoot, "manifest.json"),
    );
    const userDataRoot = resolveRequiredPath("LOCAL_MODEL_USER_DATA_DIR");
    const userRawRoot = path.join(userDataRoot, "models");
    await fs.mkdir(userRawRoot, { recursive: true });

    for (const model of manifest.models) {
      await extractModelArchive(resourceRoot, userRawRoot, model);
    }

    return { manifest, rawRoot: userRawRoot };
  })();

  return resolvedResourcesPromise;
};

export const resetLocalModelResourcesForTests = () => {
  resolvedResourcesPromise = null;
};
