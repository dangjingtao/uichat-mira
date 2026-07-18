import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import CONFIG from "@/config/index.js";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/webp": ".webp",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
};

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

const WEBP_CONVERTIBLE_MIME_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/jpeg",
  "image/png",
  "image/tiff",
]);

const attachmentRoot = path.resolve(process.cwd(), CONFIG.ATTACHMENTS_DIR);

export const attachmentStorageRoot = attachmentRoot;

const normalizeFileName = (fileName: string) => path.basename(fileName);

const getExtension = (mimeType: string, fileName?: string) => {
  const fromMime = MIME_EXTENSION_MAP[mimeType.toLowerCase()];
  if (fromMime) {
    return fromMime;
  }

  const fromName = fileName ? path.extname(fileName).toLowerCase() : "";
  return fromName && /^[a-z0-9.]+$/i.test(fromName) ? fromName : ".bin";
};

const getContentType = (fileName: string) =>
  EXTENSION_MIME_MAP[path.extname(fileName).toLowerCase()] ??
  "application/octet-stream";

const toPublicUrl = (fileName: string) =>
  `/attachments/${encodeURIComponent(fileName)}`;

const tryParseAttachmentFileName = (url: string) => {
  const trimmed = url.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/attachments/")) {
    return normalizeFileName(decodeURIComponent(trimmed.slice("/attachments/".length)));
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/attachments/")) {
      return normalizeFileName(
        decodeURIComponent(parsed.pathname.slice("/attachments/".length)),
      );
    }
  } catch {
    return null;
  }

  return null;
};

const getSafeAttachmentPath = (fileName: string) => {
  const safeName = normalizeFileName(fileName);
  const resolved = path.resolve(attachmentRoot, safeName);

  if (!resolved.startsWith(`${attachmentRoot}${path.sep}`)) {
    throw new Error("Invalid attachment path");
  }

  return resolved;
};

export const attachmentStorageService = {
  async save(input: {
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
  }) {
    await fs.mkdir(attachmentRoot, { recursive: true });

    const inputMimeType = input.mimeType.toLowerCase().split(";", 1)[0].trim();
    const shouldConvertToWebp = WEBP_CONVERTIBLE_MIME_TYPES.has(inputMimeType);
    const storedBuffer = shouldConvertToWebp
      ? await sharp(input.buffer).webp({ quality: 82 }).toBuffer()
      : input.buffer;
    const storedMimeType = shouldConvertToWebp ? "image/webp" : inputMimeType;
    const id = crypto.randomUUID();
    const extension = getExtension(storedMimeType, input.originalName);
    const fileName = `${id}${extension}`;
    const filePath = getSafeAttachmentPath(fileName);

    await fs.writeFile(filePath, storedBuffer);

    return {
      id,
      fileName,
      url: toPublicUrl(fileName),
      contentType: getContentType(fileName),
      size: storedBuffer.byteLength,
    };
  },

  async read(fileName: string) {
    const safeName = normalizeFileName(fileName);
    const filePath = getSafeAttachmentPath(safeName);
    const buffer = await fs.readFile(filePath);

    return {
      buffer,
      contentType: getContentType(safeName),
    };
  },

  isInternalAttachmentUrl(url: string) {
    return tryParseAttachmentFileName(url) !== null;
  },

  async resolveToDataUrl(url: string) {
    const fileName = tryParseAttachmentFileName(url);
    if (!fileName) {
      return url;
    }

    const file = await this.read(fileName);
    return `data:${file.contentType};base64,${file.buffer.toString("base64")}`;
  },
};
