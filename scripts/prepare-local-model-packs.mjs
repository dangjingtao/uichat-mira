import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import loadLocalEnv from "./load-local-env.cjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
loadLocalEnv(projectRoot);

const defaultPackRawRoot = path.join(projectRoot, ".artifacts", "model-packs", "raw");
const sourceRoot = process.env.LOCAL_MODEL_RAW_ROOT?.trim() || "";
const outputRoot =
  process.env.LOCAL_MODEL_PACK_RAW_ROOT?.trim() || defaultPackRawRoot;

if (!sourceRoot && process.env.CI !== "true") {
  throw new Error(
    "LOCAL_MODEL_RAW_ROOT is not set in local development. Put the model files in your .env-configured directory.",
  );
}

if (sourceRoot && path.resolve(outputRoot) === path.resolve(sourceRoot)) {
  throw new Error(
    "LOCAL_MODEL_PACK_RAW_ROOT must not point to LOCAL_MODEL_RAW_ROOT. Build staging must stay outside the development model source directory.",
  );
}

const allowNetwork =
  process.env.LOCAL_MODEL_ALLOW_NETWORK === "1" ||
  process.env.LOCAL_MODEL_ALLOW_NETWORK === "true";
const includeRerank =
  process.env.LOCAL_MODEL_INCLUDE_RERANK === "1" ||
  process.env.LOCAL_MODEL_INCLUDE_RERANK === "true";
const hfEndpoint =
  process.env.HF_ENDPOINT?.replace(/\/+$/, "") || "https://huggingface.co";
const hfToken = process.env.HF_TOKEN?.trim();

const modelSpecs = [
  {
    id: "multilingual-e5-small",
    family: "embedding",
    source: "Xenova/multilingual-e5-small",
    revision: process.env.LOCAL_EMBEDDING_MODEL_REVISION || "main",
    dimensions: 384,
    enabled: true,
    targetPath: "embedding/multilingual-e5-small",
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
    family: "rerank",
    source: "Xenova/ms-marco-MiniLM-L-6-v2",
    revision: process.env.LOCAL_RERANK_MODEL_REVISION || "main",
    dimensions: null,
    enabled: includeRerank,
    targetPath: "rerank/ms-marco-MiniLM-L-6-v2",
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

function toDownloadUrl(spec, filePath) {
  const encodedFilePath = filePath.split("/").map(encodeURIComponent).join("/");
  return `${hfEndpoint}/${spec.source}/resolve/${spec.revision}/${encodedFilePath}?download=true`;
}

async function downloadFile(url, destinationPath) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

  const headers = hfToken ? { Authorization: `Bearer ${hfToken}` } : {};
  const response = await fetch(url, { headers });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const tempPath = `${destinationPath}.tmp`;
  fs.writeFileSync(tempPath, Buffer.from(await response.arrayBuffer()));
  fs.renameSync(tempPath, destinationPath);
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

async function ensureFile(spec, filePath) {
  const destinationPath = path.join(outputRoot, spec.targetPath, filePath);
  if (!fs.existsSync(destinationPath)) {
    const sourcePath = sourceRoot
      ? path.join(sourceRoot, spec.targetPath, filePath)
      : destinationPath;

    if (sourcePath !== destinationPath && fs.existsSync(sourcePath)) {
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.copyFileSync(sourcePath, destinationPath);
      console.log(`Copied cached ${spec.source}/${filePath}`);
    } else if (!allowNetwork) {
      throw new Error(
        `Missing cached model file ${sourcePath}. Set LOCAL_MODEL_ALLOW_NETWORK=1 in CI to download from Hugging Face.`,
      );
    } else {
      const url = toDownloadUrl(spec, filePath);
      console.log(`Downloading ${spec.source}/${filePath}`);
      await downloadFile(url, destinationPath);
    }
  } else {
    console.log(`Using cached ${spec.source}/${filePath}`);
  }

  const stat = fs.statSync(destinationPath);
  return {
    path: filePath,
    bytes: stat.size,
    sha256: sha256File(destinationPath),
  };
}

async function prepareModel(spec) {
  const files = [];
  for (const filePath of spec.files) {
    files.push(await ensureFile(spec, filePath));
  }

  return {
    id: spec.id,
    family: spec.family,
    source: spec.source,
    revision: spec.revision,
    runtime: "onnxruntime-web/wasm",
    dimensions: spec.dimensions,
    path: spec.targetPath,
    files,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  };
}

const enabledSpecs = modelSpecs.filter((spec) => spec.enabled);
fs.mkdirSync(outputRoot, { recursive: true });

const models = [];
for (const spec of enabledSpecs) {
  models.push(await prepareModel(spec));
}

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  runtime: {
    default: "onnxruntime-web/wasm",
    native: "optional",
  },
  models,
};

const manifestPath = path.join(outputRoot, "manifest.json");
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote local model manifest: ${manifestPath}`);
