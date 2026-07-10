import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import CONFIG from "@/config/index.js";

const TTS_REF_AUDIO_PREFIX = "/microapps/tts/ref-audios/";
const TTS_REF_AUDIO_DIR = path.resolve(
  process.cwd(),
  CONFIG.DATABASE_DIR,
  "microapps",
  "tts",
  "ref-audios",
);

const normalizeFileName = (fileName: string) => path.basename(fileName).trim();

const getSafeRefAudioPath = (fileName: string) => {
  const safeName = normalizeFileName(fileName);
  const resolved = path.resolve(TTS_REF_AUDIO_DIR, safeName);

  if (!resolved.startsWith(`${TTS_REF_AUDIO_DIR}${path.sep}`)) {
    throw new Error("Invalid GPT-SoVITS ref audio path");
  }

  return resolved;
};

const toPublicUrl = (fileName: string) =>
  `${TTS_REF_AUDIO_PREFIX}${encodeURIComponent(fileName)}`;

const toAbsoluteUrl = (publicPath: string) =>
  `http://${CONFIG.HOST}:${CONFIG.PORT}${publicPath}`;

const getExtension = (fileName: string) => {
  const ext = path.extname(normalizeFileName(fileName)).toLowerCase();
  return ext === ".wav" ? ext : ".wav";
};

export const ttsRefAudioStorageRoot = TTS_REF_AUDIO_DIR;
export const ttsRefAudioPublicPrefix = TTS_REF_AUDIO_PREFIX;

export const ttsRefAudioStorageService = {
  async save(input: { buffer: Buffer; originalName?: string }) {
    await fs.mkdir(TTS_REF_AUDIO_DIR, { recursive: true });

    const extension = getExtension(input.originalName ?? "");
    const baseName = normalizeFileName(input.originalName ?? "").replace(/\.[^.]+$/, "");
    const safeStem = baseName ? baseName.replace(/[^\w.-]+/g, "_").slice(0, 48) : "ref-audio";
    const fileName = `${Date.now()}-${crypto.randomUUID()}-${safeStem}${extension}`;
    const filePath = getSafeRefAudioPath(fileName);

    await fs.writeFile(filePath, input.buffer);

    return {
      fileName,
      filePath,
      publicPath: toPublicUrl(fileName),
      absoluteUrl: toAbsoluteUrl(toPublicUrl(fileName)),
    };
  },

  resolvePublicUrl(fileName: string) {
    return toPublicUrl(fileName);
  },

  resolveAbsoluteUrlFromPublicPath(publicPath: string) {
    return toAbsoluteUrl(publicPath);
  },

  resolveAbsoluteUrl(fileName: string) {
    return toAbsoluteUrl(toPublicUrl(fileName));
  },
};
