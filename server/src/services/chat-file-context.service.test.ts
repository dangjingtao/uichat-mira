import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

process.env.UI_CHAT_ATTACHMENTS_DIR = path.resolve(
  process.cwd(),
  "../.test-artifact/chat-file-context",
);

const { attachmentStorageRoot, attachmentStorageService } = await import(
  "./attachment-storage.service.js"
);
const { resolveMessagesForGenerate } = await import(
  "./chat-file-context.service.js"
);
const { chatFileContextNode } = await import("./chat-file-context.service.js");
const { removeFileAttachmentsRemovedFromParts } = await import(
  "./chat-file-context.service.js"
);

afterEach(async () => {
  await fs.rm(attachmentStorageRoot, { recursive: true, force: true });
});

describe("chat file context", () => {
  it("keeps the first context node as an identity transform", () => {
    expect(chatFileContextNode.process({ text: "original content" })).toBe(
      "original content",
    );
  });

  it("replaces the latest user file part with its complete parsed text for generation", async () => {
    const uploaded = await attachmentStorageService.save({
      buffer: Buffer.from("first line\nsecond line", "utf8"),
      mimeType: "text/plain",
      originalName: "notes.txt",
    });

    const messages = await resolveMessagesForGenerate([
      {
        role: "user",
        content: "Please read this",
        parts: [
          { type: "text", text: "Please read this" },
          {
            type: "file",
            filename: "notes.txt",
            data: uploaded.url,
            fileId: uploaded.id,
            mimeType: uploaded.contentType,
          },
        ],
      },
    ]);

    const parts = messages[0]?.parts ?? [];
    expect(parts.some((part) => part.type === "file")).toBe(false);
    const text = parts
      .filter((part): part is Extract<(typeof parts)[number], { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    expect(text).toContain("[文件: notes.txt]");
    expect(text).toContain("first line\nsecond line");
  });

  it("does not delete a file that remains attached when message metadata changes", async () => {
    const uploaded = await attachmentStorageService.save({
      buffer: Buffer.from("keep me", "utf8"),
      mimeType: "text/plain",
      originalName: "keep.txt",
    });
    const parts = [
      {
        type: "file",
        filename: "keep.txt",
        data: uploaded.url,
        fileId: uploaded.id,
        mimeType: uploaded.contentType,
      },
    ];

    removeFileAttachmentsRemovedFromParts(parts, parts);
    await expect(attachmentStorageService.read(uploaded.fileName)).resolves.toBeTruthy();

    removeFileAttachmentsRemovedFromParts(parts, []);
    await expect(attachmentStorageService.read(uploaded.fileName)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
