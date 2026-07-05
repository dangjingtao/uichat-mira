import path from "node:path";
import { randomUUID } from "node:crypto";

export function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const normalized = trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-");
  return normalized.length > 0 ? normalized : "artifact";
}

export function detectExtension(
  mimeType: string,
  fallbackSource?: string,
): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    default: {
      const sourceExtension = fallbackSource
        ? path.extname(new URL(fallbackSource, "https://example.invalid").pathname)
        : "";
      return sourceExtension || ".bin";
    }
  }
}

export function createArtifactFileName(params: {
  fileName?: string;
  mimeType: string;
  fallbackSource?: string;
  id?: string;
}): string {
  const extension = detectExtension(params.mimeType, params.fallbackSource);
  const baseName = params.fileName
    ? path.basename(sanitizeFileName(params.fileName), path.extname(params.fileName))
    : params.id ?? randomUUID();
  return `${baseName}${extension}`;
}
