import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const rawRoot = path.join(projectRoot, ".artifacts", "model-packs", "raw");
const outputRoot = path.join(projectRoot, ".artifacts", "model-packs", "dist");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function listFiles(dir, base = dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFiles(fullPath, base);
      }
      return {
        fullPath,
        relativePath: path.relative(base, fullPath).replaceAll("\\", "/"),
      };
    })
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function writeTarString(buffer, value, offset, length) {
  buffer.write(value, offset, Math.min(Buffer.byteLength(value), length), "ascii");
}

function createTarHeader(name, size) {
  if (Buffer.byteLength(name) > 100) {
    throw new Error(`Tar entry path is too long: ${name}`);
  }

  const header = Buffer.alloc(512, 0);
  writeTarString(header, name, 0, 100);
  writeTarString(header, "0000644\0", 100, 8);
  writeTarString(header, "0000000\0", 108, 8);
  writeTarString(header, "0000000\0", 116, 8);
  writeTarString(header, `${size.toString(8).padStart(11, "0")}\0`, 124, 12);
  writeTarString(header, "00000000000\0", 136, 12);
  writeTarString(header, "        ", 148, 8);
  writeTarString(header, "0", 156, 1);
  writeTarString(header, "ustar\0", 257, 6);
  writeTarString(header, "00", 263, 2);

  let checksum = 0;
  for (const byte of header) {
    checksum += byte;
  }
  writeTarString(header, `${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8);
  return header;
}

function createTarBuffer(modelDir) {
  const chunks = [];
  for (const file of listFiles(modelDir)) {
    const data = fs.readFileSync(file.fullPath);
    chunks.push(createTarHeader(file.relativePath, data.length));
    chunks.push(data);
    const padding = (512 - (data.length % 512)) % 512;
    if (padding) {
      chunks.push(Buffer.alloc(padding, 0));
    }
  }
  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

function archiveNameForModel(model) {
  return `${model.family}-${model.id}-v1.tar.br`;
}

if (!fs.existsSync(rawRoot)) {
  throw new Error(`Missing prepared local model raw root: ${rawRoot}`);
}

const rawManifestPath = path.join(rawRoot, "manifest.json");
if (!fs.existsSync(rawManifestPath)) {
  throw new Error(`Missing local model manifest: ${rawManifestPath}`);
}

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

const rawManifest = readJson(rawManifestPath);
const archivedModels = [];

for (const model of rawManifest.models ?? []) {
  const modelDir = path.join(rawRoot, model.path);
  if (!fs.existsSync(modelDir)) {
    throw new Error(`Missing local model directory: ${modelDir}`);
  }

  const tar = createTarBuffer(modelDir);
  const compressed = zlib.brotliCompressSync(tar, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: tar.length,
    },
  });
  const archive = archiveNameForModel(model);
  fs.writeFileSync(path.join(outputRoot, archive), compressed);

  archivedModels.push({
    ...model,
    archive,
    archiveBytes: compressed.length,
    archiveSha256: sha256Buffer(compressed),
  });

  console.log(
    `Archived ${model.family}/${model.id}: ${Math.round((compressed.length / 1024 / 1024) * 10) / 10} MB`,
  );
}

const manifest = {
  ...rawManifest,
  packaging: {
    format: "tar.br",
    schemaVersion: 1,
  },
  models: archivedModels,
};

fs.writeFileSync(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`Wrote archived local model manifest: ${path.join(outputRoot, "manifest.json")}`);
