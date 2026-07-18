import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";

process.env.UI_CHAT_ATTACHMENTS_DIR = path.resolve(
  process.cwd(),
  "../.test-artifact/attachment-storage",
);

const { attachmentStorageRoot, attachmentStorageService } = await import(
  "./attachment-storage.service.js"
);

afterEach(async () => {
  await fs.rm(attachmentStorageRoot, { recursive: true, force: true });
});

describe("attachmentStorageService", () => {
  it("converts static raster images to WebP before storing", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );

    const saved = await attachmentStorageService.save({
      buffer: png,
      mimeType: "image/png",
      originalName: "capture.png",
    });
    const stored = await attachmentStorageService.read(saved.fileName);
    const metadata = await sharp(stored.buffer).metadata();

    expect(saved.contentType).toBe("image/webp");
    expect(saved.fileName).toMatch(/\.webp$/);
    expect(metadata.format).toBe("webp");
    expect(saved.size).toBe(stored.buffer.byteLength);
  });
});
